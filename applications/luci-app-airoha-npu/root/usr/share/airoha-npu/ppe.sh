#!/bin/sh

# Timestamp and JSON are published together; a light dashboard reuses only
# their counts, and never opens debugfs or returns the full table.
npu_ppe_cached() {
	local cache="$1" soc="$2" deferred="$3" schema stamp cached_soc total bound extra now cached
	[ -s "$cache" ] || return 1
	# Keep counts in the same atomic file as the table. Light polls read just
	# this short header, avoiding both debugfs and decoding 1024 cached rows.
	{
		read -r schema stamp cached_soc total bound extra
		[ "$deferred" = 1 ] || IFS= read -r cached
	} < "$cache"
	[ "$schema" = 2 ] && [ "$cached_soc" = "$soc" ] && [ -z "$extra" ] || return 1
	case "$stamp" in ''|*[!0-9]*) return 1 ;; esac
	case "$total" in ''|*[!0-9]*) return 1 ;; esac
	case "$bound" in ''|*[!0-9]*) return 1 ;; esac
	if [ "$deferred" = 1 ]; then
		printf '{"deferred":true,"available":true,"total":%s,"bound":%s,"sampled_at":%s}\n' "$total" "$bound" "$stamp"
	else
		now=$(date +%s)
		[ "$now" -ge "$stamp" ] && [ "$((now - stamp))" -lt 2 ] || return 1
		printf '%s' "$cached" | jsonfilter -e '@.total' >/dev/null 2>&1 || return 1
		printf '%s\n' "$cached"
	fi
}

get_ppe_entries() {
	local file=/sys/kernel/debug/ppe/entries
	local cache=/tmp/luci-airoha-npu.ppe.cache snapshot parsed tmp soc ppe_count stamp counts
	soc=$(airoha_soc)
	if npu_ppe_cached "$cache" "$soc" "${1:-0}"; then return; fi
	if [ "$1" = 1 ]; then
		printf '{"deferred":true,"available":false,"total":0,"bound":0}\n'
		return
	fi
	if [ ! -r "$file" ]; then
		rm -f "$cache"
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	snapshot=$(mktemp /tmp/airoha-npu.ppe.XXXXXX) || {
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'; return
	}
	# Bound a debugfs read that may stall while the driver is being reset.
	if ! timeout 3 cat "$file" > "$snapshot" 2>/dev/null; then
		rm -f "$snapshot" "$cache"
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	case "$soc" in en7581) ppe_count=2 ;; an7583) ppe_count=1 ;; *) ppe_count=0 ;; esac
	stamp=$(date +%s)
	parsed=$(awk -v limit=1024 -v soc="$soc" -v ppe_count="$ppe_count" -v sampled_at="$stamp" \
		-f /usr/libexec/airoha-ppe.awk "$snapshot")
	rm -f "$snapshot"
	if ! counts=$(printf '%s' "$parsed" | jsonfilter -e '@.total' -e '@.bound'); then
		rm -f "$cache"
		printf '{"available":false,"entries":[],"total":0,"bound":0}\n'
		return
	fi
	set -- $counts
	tmp=$(mktemp "${cache}.XXXXXX") && {
		printf '2 %s %s %s %s\n%s\n' "$stamp" "$soc" "$1" "$2" "$parsed" > "$tmp" && mv -f "$tmp" "$cache"
		rm -f "$tmp"
	}
	printf '%s\n' "$parsed"
}
