#!/bin/sh
# Join enabled DT ports with live netdev state. Split GDM/NBQ children stay
# separate here; the Frame Engine counters are shared by their parent GDM.

npu_dt_string() {
	[ -r "$1" ] && tr '\000' '\n' < "$1" | head -n1
}

npu_dt_enabled() {
	local node="$1" status
	[ -d "$node" ] || return 1
	while [ "$node" != /proc/device-tree ] && [ "$node" != / ]; do
		status=$(npu_dt_string "$node/status")
		case "$status" in ''|okay|ok) ;; *) return 1 ;; esac
		node=${node%/*}
	done
}

npu_has_wifi() {
	local phy
	for phy in /sys/class/ieee80211/phy*; do
		[ -d "$phy" ] && return 0
	done
	return 1
}

npu_port_netdev() {
	local node="$1" name path iface link
	name=$(npu_dt_string "$node/openwrt,netdev-name")
	[ -n "$name" ] || name=$(npu_dt_string "$node/label")
	if [ -n "$name" ]; then
		printf '%s\n' "$name"
		return
	fi
	path=$(readlink -f "$node")
	for iface in /sys/class/net/*; do
		link=$(readlink -f "$iface/of_node" 2>/dev/null)
		[ "$link" = "$path" ] || continue
		printf '%s\n' "${iface##*/}"
		return
	done
}

npu_json_number_file() {
	local value=""
	[ -r "$2" ] && read -r value < "$2"
	case "$value" in
		''|*[!0-9]*) json_add_null "$1" ;;
		*) json_add_string "$1" "$value" ;;
	esac
}

npu_topology_port() {
	local node="$1" kind="$2" gdm="$3" netdev mode role=lan reg parent stat
	npu_dt_enabled "$node" || return
	reg=$(dt_cells "$node/reg" | head -n1)
	case "$reg" in ''|*[!0-9]*) return ;; esac
	netdev=$(npu_port_netdev "$node")
	mode=$(npu_dt_string "$node/phy-mode")
	parent=${node%/*}
	[ -n "$mode" ] || mode=$(npu_dt_string "$parent/phy-mode")
	if [ "$kind" = switch ] && [ -z "$netdev" ]; then return; fi
	if [ "$mode" = internal ] && [ "$kind" = gdm ]; then role=conduit; fi
	case "$netdev" in
		wan|"$NPU_WAN_DEVICE") [ -n "$netdev" ] && role=wan ;;
		pon*) role=pon ;;
	esac
	if [ -e "$node/airoha,pon-data-path" ] || [ -e "$parent/airoha,pon-data-path" ]; then role=pon; fi
	json_add_object ''
	json_add_string kind "$kind"
	json_add_int reg "$reg"
	json_add_int gdm "$gdm"
	json_add_string netdev "$netdev"
	json_add_string role "$role"
	json_add_string mode "$mode"
	json_add_boolean present "$([ -d "/sys/class/net/$netdev" ] && [ -n "$netdev" ] && echo 1 || echo 0)"
	json_add_boolean split "$([ "${node##*/}" != "ethernet@$gdm" ] && [ "$kind" = gdm ] && echo 1 || echo 0)"
	for stat in carrier speed duplex; do
		if [ "$stat" = duplex ]; then
			json_add_string duplex "$(cat "/sys/class/net/$netdev/duplex" 2>/dev/null)"
		else
			npu_json_number_file "$stat" "/sys/class/net/$netdev/$stat"
		fi
	done
	for stat in rx_bytes tx_bytes rx_packets tx_packets rx_dropped tx_dropped; do
		npu_json_number_file "$stat" "/sys/class/net/$netdev/statistics/$stat"
	done
	json_close_object
}

get_topology() {
	local node child gdm children
	local NPU_WAN_DEVICE
	NPU_WAN_DEVICE=$(uci -q get network.wan.device)
	NPU_WAN_DEVICE=${NPU_WAN_DEVICE%%.*}
	json_init
	json_add_string model "$(npu_dt_string /proc/device-tree/model)"
	json_add_string compatible "$(npu_dt_string /proc/device-tree/compatible)"
	json_add_boolean has_wifi "$(npu_has_wifi && echo 1 || echo 0)"
	json_add_array ports
	for node in /proc/device-tree/soc/ethernet@*/ethernet@*; do
		npu_dt_enabled "$node" || continue
		gdm=$(dt_cells "$node/reg" | head -n1)
		case "$gdm" in 1|2|3|4) ;; *) continue ;; esac
		children=0
		for child in "$node"/ethernet-port@*; do
			[ -d "$child" ] || continue
			children=1
			npu_topology_port "$child" gdm "$gdm"
		done
		[ "$children" = 1 ] || npu_topology_port "$node" gdm "$gdm"
	done
	for node in /proc/device-tree/soc/switch@*/ports/port@*; do
		npu_topology_port "$node" switch 1
	done
	json_close_array
	json_dump
}
