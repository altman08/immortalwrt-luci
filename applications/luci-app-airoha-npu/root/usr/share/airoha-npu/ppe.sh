#!/bin/sh

# The timestamp and JSON are published together: concurrent readers never see
# a half-written flow table. One parser pass produces both entries and totals.
get_ppe_entries() {
	local file=/sys/kernel/debug/ppe/entries
	local cache=/tmp/luci-airoha-npu.ppe.cache now stamp cached snapshot parsed tmp
	now=$(date +%s)
	if [ -s "$cache" ]; then
		read -r stamp < "$cache"
		case "$stamp" in
			''|*[!0-9]*) ;;
			*)
				if [ "$now" -ge "$stamp" ] && [ "$((now - stamp))" -lt 2 ]; then
					cached=$(sed -n '2,$p' "$cache")
					if printf '%s' "$cached" | jsonfilter -e '@.total' >/dev/null 2>&1; then
						printf '%s\n' "$cached"
						return
					fi
				fi
				;;
		esac
	fi
	if [ ! -r "$file" ]; then
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	snapshot=$(mktemp /tmp/airoha-npu.ppe.XXXXXX) || {
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'; return
	}
	# Bound a debugfs read that may stall while the driver is being reset.
	if ! timeout 3 cat "$file" > "$snapshot" 2>/dev/null; then
		rm -f "$snapshot"
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	parsed=$(awk -v limit=1024 -f /usr/libexec/airoha-ppe.awk "$snapshot")
	rm -f "$snapshot"
	if ! printf '%s' "$parsed" | jsonfilter -e '@.total' >/dev/null 2>&1; then
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	tmp=$(mktemp "${cache}.XXXXXX") && {
		printf '%s\n%s\n' "$(date +%s)" "$parsed" > "$tmp" && mv -f "$tmp" "$cache"
		rm -f "$tmp"
	}
	printf '%s\n' "$parsed"
}
