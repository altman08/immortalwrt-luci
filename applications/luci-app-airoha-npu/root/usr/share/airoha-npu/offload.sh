#!/bin/sh

npu_error() {
	json_init
	json_add_string error "$1"
	json_dump
}

npu_read_enabled() {
	json_load "$1" 2>/dev/null || return 1
	json_get_var NPU_ENABLED enabled
	case "$NPU_ENABLED" in 0|1) return 0 ;; *) return 1 ;; esac
}

# Include the WAN zone's networks so ONU-managed uplinks need not be named wan.
npu_routed_wan_active() {
	local section networks=wan network status up proto device
	for section in $(uci -q show firewall | sed -n 's/^firewall\.\([^=]*\)=zone$/\1/p'); do
		[ "$(uci -q get "firewall.$section.name")" = wan ] || continue
		networks="$networks $(uci -q get "firewall.$section.network")"
	done
	for network in $networks; do
		[ "$network" = lan ] && continue
		status=$(ubus call "network.interface.$network" status 2>/dev/null) || continue
		up=$(printf '%s' "$status" | jsonfilter -e '@.up')
		proto=$(printf '%s' "$status" | jsonfilter -e '@.proto')
		device=$(printf '%s' "$status" | jsonfilter -e '@.l3_device')
		[ "$up" = true ] && [ "$proto" != none ] && [ -n "$device" ] && return 0
	done
	return 1
}

get_device_mode() {
	if npu_routed_wan_active; then
		printf '{"mode":"router","bridge_offload_blocked":true}\n'
	else
		printf '{"mode":"bridge","bridge_offload_blocked":false}\n'
	fi
}

npu_bridge_keys() {
	case "$1" in
		vlan) echo 'bridge-nf-filter-vlan-tagged bridge-nf-pass-vlan-input-dev' ;;
		pppoe) echo bridge-nf-filter-pppoe-tagged ;;
		ap) echo 'bridge-nf-call-iptables bridge-nf-call-ip6tables bridge-nf-call-arptables' ;;
		*) return 1 ;;
	esac
}

get_bridge_control() {
	local key value enabled=1 supported=true
	for key in $(npu_bridge_keys "$1"); do
		value=$(cat "/proc/sys/net/bridge/$key" 2>/dev/null)
		[ -w "/proc/sys/net/bridge/$key" ] || supported=false
		[ "$value" = 1 ] || enabled=0
	done
	printf '{"supported":%s,"enabled":%s}\n' "$supported" "$enabled"
}

npu_restore_bridge() {
	local pair
	for pair in $1; do
		printf '%s\n' "${pair#*=}" > "/proc/sys/net/bridge/${pair%%=*}"
	done
}

set_bridge_control() {
	local kind="$1" NPU_ENABLED key old="" value tmp
	npu_read_enabled "$2" || { npu_error 'enabled must be 0 or 1'; return; }
	if [ "$NPU_ENABLED" = 1 ] && npu_routed_wan_active; then
		npu_error 'Bridge controls cannot be enabled while a routed WAN is active; use Hardware Flow Offload'
		return
	fi
	# Each switch owns disjoint sysctls. In particular AP mode never writes
	# the PPPoE or VLAN passthrough settings.
	for key in $(npu_bridge_keys "$kind"); do
		value=$(cat "/proc/sys/net/bridge/$key" 2>/dev/null)
		case "$value" in 0|1) ;; *) npu_error 'Bridge netfilter control is unavailable'; return ;; esac
		[ -w "/proc/sys/net/bridge/$key" ] || { npu_error 'Bridge netfilter control is read-only'; return; }
		old="$old $key=$value"
	done
	tmp=$(mktemp "/etc/sysctl.d/.airoha-npu-$kind.XXXXXX") || {
		npu_error 'Cannot persist bridge settings'; return
	}
	for key in $(npu_bridge_keys "$kind"); do
		if ! printf '%s\n' "$NPU_ENABLED" > "/proc/sys/net/bridge/$key" ||
		   ! printf 'net.bridge.%s=%s\n' "$key" "$NPU_ENABLED" >> "$tmp"; then
			npu_restore_bridge "$old"
			rm -f "$tmp"
			npu_error 'Failed to apply bridge settings'
			return
		fi
	done
	if ! mv -f "$tmp" "/etc/sysctl.d/90-airoha-npu-$kind.conf"; then
		npu_restore_bridge "$old"
		rm -f "$tmp"
		npu_error 'Cannot persist bridge settings'
		return
	fi
	printf '{"result":"ok","enabled":%s}\n' "$NPU_ENABLED"
}

get_flow_offload() {
	local software hardware enabled=0
	software=$(uci -q get 'firewall.@defaults[0].flow_offloading')
	hardware=$(uci -q get 'firewall.@defaults[0].flow_offloading_hw')
	[ "$software:$hardware" = 1:1 ] && enabled=1
	printf '{"enabled":%s}\n' "$enabled"
}

set_flow_offload() {
	local NPU_ENABLED
	npu_read_enabled "$1" || { npu_error 'enabled must be 0 or 1'; return; }
	# UCI also loads the global delta directory with a private savedir. Refuse
	# pending edits so this action cannot commit someone else's firewall work.
	if [ -n "$(uci changes firewall 2>/dev/null)" ]; then
		npu_error 'Apply or discard pending firewall changes before changing flow offload'
		return
	fi
	local cursor
	cursor=$(mktemp -d /tmp/airoha-npu.uci.XXXXXX) || { npu_error 'Cannot create UCI cursor'; return; }
	if ! uci -t "$cursor" set "firewall.@defaults[0].flow_offloading=$NPU_ENABLED" ||
	   ! uci -t "$cursor" set "firewall.@defaults[0].flow_offloading_hw=$NPU_ENABLED" ||
	   ! uci -t "$cursor" commit firewall; then
		rm -rf "$cursor"
		npu_error 'Cannot update firewall offload configuration'
		return
	fi
	rm -rf "$cursor"
	if ! /etc/init.d/firewall reload >/dev/null 2>&1; then
		npu_error 'Offload configuration saved, but firewall reload failed'
		return
	fi
	printf '{"result":"ok","enabled":%s}\n' "$NPU_ENABLED"
}
