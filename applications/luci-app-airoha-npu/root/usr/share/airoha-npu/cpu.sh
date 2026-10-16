#!/bin/sh
# Runtime-only cpufreq control, shared by rpcd and the boot service.

NPU_CPU_ROOT=/sys/devices/system/cpu/cpufreq

# Serialize CPU RPC writes, especially the multi-register PLL sequence.
npu_cpu_locked() (
	mkdir /tmp/airoha-npu.cpu.lock 2>/dev/null || {
		npu_error 'Another CPU operation is in progress'; exit
	}
	trap 'rmdir /tmp/airoha-npu.cpu.lock' EXIT
	trap 'exit 1' HUP INT TERM
	"$@"
)

npu_cpu_policy() {
	local dir
	for dir in "$NPU_CPU_ROOT"/policy[0-9]*; do
		[ -w "$dir/scaling_governor" ] || continue
		printf '%s\n' "$dir"
		return 0
	done
	return 1
}

npu_cpu_frequencies() {
	local dir="$1" values
	values=$(cat "$dir/scaling_available_frequencies" 2>/dev/null)
	if [ "$(cat "$NPU_CPU_ROOT/boost" 2>/dev/null)" = 1 ]; then
		values="$values $(cat "$dir/scaling_boost_frequencies" 2>/dev/null)"
	fi
	# Never invent a frequency when the driver does not publish its OPPs.
	printf '%s\n' "$values" | tr ' ' '\n' | awk '
		/^[0-9]+$/ && $1 >= 500000 && $1 <= 1400000 { print $1 }
	' | sort -nu
}

npu_cpu_frequency_allowed() {
	local value
	case "$2" in ''|*[!0-9]*) return 1 ;; esac
	for value in $(npu_cpu_frequencies "$1"); do
		[ "$value" = "$2" ] && return 0
	done
	return 1
}

npu_cpu_governor_allowed() {
	local value
	for value in $(cat "$1/scaling_available_governors" 2>/dev/null); do
		[ "$value" = "$2" ] && return 0
	done
	return 1
}

# Reduce scaling_min_freq first if another service left it above this ceiling.
# Keep the old minimum on failure; no partial limit change is reported as OK.
npu_cpu_set_max() {
	local dir="$1" freq="$2" old_min new_min
	npu_cpu_frequency_allowed "$dir" "$freq" || return 1
	old_min=$(cat "$dir/scaling_min_freq" 2>/dev/null)
	case "$old_min" in ''|*[!0-9]*) return 1 ;; esac
	if [ "$old_min" -gt "$freq" ]; then
		new_min=$(npu_cpu_frequencies "$dir" | head -n1)
		printf '%s\n' "$new_min" > "$dir/scaling_min_freq" || return 1
	fi
	if ! printf '%s\n' "$freq" > "$dir/scaling_max_freq"; then
		printf '%s\n' "$old_min" > "$dir/scaling_min_freq"
		return 1
	fi
}

npu_cpu_boot_defaults() {
	local dir="$1" freq value
	npu_cpu_governor_allowed "$dir" ondemand || {
		logger -t airoha-npu 'ondemand is unavailable; retaining the kernel governor'
		return 1
	}
	# Prefer exactly 1200 MHz, otherwise the highest advertised OPP below it.
	for value in $(npu_cpu_frequencies "$dir"); do
		[ "$value" -le 1200000 ] && freq="$value"
	done
	[ -n "$freq" ] || {
		logger -t airoha-npu 'no supported OPP at or below 1200 MHz'
		return 1
	}
	npu_cpu_set_max "$dir" "$freq" || return 1
	printf '%s\n' ondemand > "$dir/scaling_governor" || return 1
	logger -t airoha-npu "boot defaults: ondemand, maximum ${freq} kHz"
}
