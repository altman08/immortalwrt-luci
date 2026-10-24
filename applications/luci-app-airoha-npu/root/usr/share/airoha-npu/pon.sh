#!/bin/sh
# Read-only PON status. Prefer the native driver; retain vendor ABI fallbacks.

npu_pon_status() {
	local dev node present=0 line mode=unknown signal state="" rates down up
	dev=$(uci -q get pon.line0.device)
	[ -n "$dev" ] || dev=pon0
	line=/sys/kernel/debug/airoha-xpon-${dev}/line
	if [ -d "/sys/class/net/$dev" ] || [ -r "$line" ] ||
	   [ -d /proc/xgpon ] || [ -d /proc/epon ] ||
	   [ -e /sys/module/xpon_10g/parameters/mode ]; then
		present=1
	fi
	for node in /proc/device-tree/soc/ethernet@*/ethernet@*; do
		npu_dt_enabled "$node" || continue
		[ ! -e "$node/airoha,pon-data-path" ] || present=1
	done
	if [ "$present" = 0 ]; then
		printf '{"present":false}\n'
		return
	fi

	mode=$(awk '$1 == "active_mode:" { print $2; exit }' "$line" 2>/dev/null)
	case "$mode" in
		gpon|xgpon|xgspon|epon|epon-1g|epon-10g-1g|epon-10g-10g) ;;
		*)
			case "$(cat /sys/module/xpon_10g/parameters/mode 2>/dev/null)" in
				0) mode=auto ;; 1) mode=gpon ;; 2) mode=epon ;;
				3) mode=epon-10g-1g ;; 4) mode=epon-10g-10g ;;
				5) mode=epon-1g ;; 6) mode=xgpon ;; 7) mode=xgspon ;;
				8) mode=ngpon2-10g-10g ;; 9) mode=ngpon2-10g-2g ;;
				10) mode=ngpon2-2g-2g ;; 11) mode=gpon-sym ;;
				12) mode=turbo-epon ;; *) mode=unknown ;;
			esac ;;
	esac
	# Nominal line rates derived from the mode, not measured throughput.
	case "$mode" in
		gpon) rates="2488 1244" ;; gpon-sym) rates="2488 2488" ;;
		xgpon) rates="10000 2500" ;;
		xgspon|ngpon2-10g-10g|epon-10g-10g) rates="10000 10000" ;;
		epon) rates="1250 1250" ;; epon-1g) rates="1000 1000" ;;
		epon-10g-1g) rates="10000 1000" ;;
		ngpon2-10g-2g) rates="10000 2000" ;;
		ngpon2-2g-2g|turbo-epon) rates="2000 2000" ;;
		*) rates="null null" ;;
	esac
	set -- $rates
	down="$1"; up="$2"
	signal=$(awk '$1 == "optical_signal:" { print $2; exit }' "$line" 2>/dev/null)
	case "$signal" in
		0|1) ;;
		*) signal=$(cat /proc/tc3162/los_status 2>/dev/null) ;;
	esac
	# Both ABIs expose light present=1; the JSON field exposes LOS asserted=1.
	case "$signal" in 0) signal=1 ;; 1) signal=0 ;; *) signal=null ;; esac
	state=$(awk '$1 == "onu_state:" && $2 ~ /^O[1-9]$/ { print $2; exit }' \
		"${line%/line}/registration" 2>/dev/null)
	if [ -z "$state" ] && [ -r /proc/xgpon/state ]; then
		IFS= read -r state < /proc/xgpon/state
	fi
	json_init
	json_add_boolean present 1
	json_add_string netdev "$dev"
	json_add_string mode_name "$mode"
	json_add_string onu_state "$state"
	if [ "$signal" = null ]; then json_add_null los; else json_add_int los "$signal"; fi
	if [ "$down" = null ]; then
		json_add_null down_mbps; json_add_null up_mbps
	else
		json_add_int down_mbps "$down"; json_add_int up_mbps "$up"
	fi
	json_dump
}
