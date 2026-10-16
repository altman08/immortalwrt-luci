#!/bin/sh
# Direct ARMPLL control restored from the AN7581/AN7583 implementation.
# This path bypasses the kernel OPP table; it is never applied at boot.

AIROHA_OC_MIN_MHZ=500
AIROHA_OC_MAX_MHZ=1600
CR_CPU_CLK_GATING=0x1fa201e0
CR_ACLKEN_DIV=0x1efbe640
CR_BUS_PLL_DIV=0x1efbe7c0
CR_PLL_WR_PROTECT=0x1fa20268
CLK_SRC_ARMPLL=1
CLK_SRC_PLL2=3

soc_pll_regs() {
	case "$1" in
		en7581)
			WT_PROTECT_MAGIC=0x12
			CR_CPUPLL_SDM_PCW=0x1fa202b4
			CR_CPUPLL_SDM_PCW_CHG=0x1fa202b8
			CR_CPUPLL_SDM_POSDIV=0x1fa202b8
			POSDIV_SHIFT=4 ;;
		an7583)
			WT_PROTECT_MAGIC=0x80
			CR_CPUPLL_SDM_PCW=0x1fa202ac
			CR_CPUPLL_SDM_PCW_CHG=0x1fa202b0
			CR_CPUPLL_SDM_POSDIV=0x1fa202b8
			POSDIV_SHIFT=18 ;;
		*) return 1 ;;
	esac
}

npu_pll_read() {
	local value digits
	value=$(devmem "$1" 32 2>/dev/null) || return 1
	case "$value" in
		0x*|0X*)
			digits=${value#??}
			case "$digits" in ''|*[!0-9a-fA-F]*) return 1 ;; esac
			[ "${#digits}" -le 8 ] || return 1 ;;
		*) return 1 ;;
	esac
	printf '%s\n' "$value"
}

npu_pll_write() {
	devmem "$1" 32 "$(printf '0x%08X' "$2")" >/dev/null 2>&1
}

read_armpll_mhz() {
	local pcw posdiv mux
	soc_pll_regs "$1" || { echo 0; return; }
	mux=$(npu_pll_read "$CR_BUS_PLL_DIV") &&
	pcw=$(npu_pll_read "$CR_CPUPLL_SDM_PCW") &&
	posdiv=$(npu_pll_read "$CR_CPUPLL_SDM_POSDIV") || { echo 0; return; }
	# ARMPLL is not the CPU clock while the mux selects the backup source.
	[ "$(( (mux >> 9) & 3 ))" -eq "$CLK_SRC_ARMPLL" ] || { echo 0; return; }
	pcw=$(( (pcw >> 24) & 0xff ))
	posdiv=$(( (posdiv >> POSDIV_SHIFT) & 7 ))
	case "$posdiv" in
		0) echo $((pcw * 50)) ;;
		1) echo $((pcw * 25)) ;;
		*) echo 0 ;;
	esac
}

clk_src_switch() {
	local src="$1" val
	val=$(npu_pll_read "$CR_CPU_CLK_GATING") || return 1
	npu_pll_write "$CR_CPU_CLK_GATING" "$((val | (1 << (src - 1))))" || return 1
	val=$(npu_pll_read "$CR_ACLKEN_DIV") || return 1
	npu_pll_write "$CR_ACLKEN_DIV" "$(( (val & 0xFFFFFFE0) | 0x12 ))" || return 1
	val=$(npu_pll_read "$CR_BUS_PLL_DIV") || return 1
	npu_pll_write "$CR_BUS_PLL_DIV" "$(( (val & 0xFFFFF9FF) | (src << 9) ))" || return 1
	val=$(npu_pll_read "$CR_BUS_PLL_DIV") || return 1
	[ "$(( (val >> 9) & 3 ))" -eq "$src" ]
}

clk_src_gate_off() {
	local val
	val=$(npu_pll_read "$CR_CPU_CLK_GATING") || return 1
	npu_pll_write "$CR_CPU_CLK_GATING" "$(( val & ~(1 << ($1 - 1)) ))"
}

pll_write_protect() {
	local val
	val=$(npu_pll_read "$CR_PLL_WR_PROTECT") || return 1
	case "$1" in
		off) val=$(( (val & 0xFFFFFF00) | WT_PROTECT_MAGIC )) ;;
		on) val=$(( val & 0xFFFFFF00 )) ;;
		*) return 1 ;;
	esac
	npu_pll_write "$CR_PLL_WR_PROTECT" "$val"
}

configure_armpll() {
	local soc="$1" pcw="$2" posdiv="$3" val
	val=$(npu_pll_read "$CR_CPUPLL_SDM_PCW") || return 1
	npu_pll_write "$CR_CPUPLL_SDM_PCW" "$(( (val & 0x00FFFFFF) | (pcw << 24) ))" || return 1
	if [ "$soc" = an7583 ]; then
		val=$(npu_pll_read "$CR_CPUPLL_SDM_POSDIV") || return 1
		npu_pll_write "$CR_CPUPLL_SDM_POSDIV" "$(( (val & 0xFFE3FFFF) | (posdiv << 18) ))" || return 1
		val=$(npu_pll_read "$CR_CPUPLL_SDM_PCW_CHG") || return 1
	else
		val=$(npu_pll_read "$CR_CPUPLL_SDM_PCW_CHG") || return 1
		val=$(( (val & 0xFFFFFF8F) | (posdiv << 4) ))
	fi
	npu_pll_write "$CR_CPUPLL_SDM_PCW_CHG" "$((val ^ 1))"
}

set_overclock() {
	local target_mhz soc dir old_governor pcw posdiv actual reg cleanup=0
	json_load "$1" 2>/dev/null || { npu_error 'Invalid request'; return; }
	json_get_var target_mhz freq_mhz
	# Exactly representable in both POSDIV ranges, without silent rounding.
	case "$target_mhz" in ''|0*|*[!0-9]*) npu_error 'freq_mhz must be a positive integer'; return ;; esac
	if [ "${#target_mhz}" -gt 4 ] || [ "$target_mhz" -lt "$AIROHA_OC_MIN_MHZ" ] ||
	   [ "$target_mhz" -gt "$AIROHA_OC_MAX_MHZ" ] || [ "$((target_mhz % 50))" -ne 0 ]; then
		npu_error 'Select 500-1600 MHz in steps of 50 MHz'; return
	fi
	soc=$(airoha_soc)
	soc_pll_regs "$soc" || { npu_error 'Unsupported SoC for direct PLL control'; return; }
	# Read all registers before changing either the governor or the clock.
	for reg in "$CR_CPU_CLK_GATING" "$CR_ACLKEN_DIV" "$CR_BUS_PLL_DIV" "$CR_PLL_WR_PROTECT" \
		"$CR_CPUPLL_SDM_PCW" "$CR_CPUPLL_SDM_PCW_CHG" "$CR_CPUPLL_SDM_POSDIV"; do
		npu_pll_read "$reg" >/dev/null || { npu_error 'CPU PLL registers are unavailable'; return; }
	done
	dir=$(npu_cpu_policy)
	[ -n "$dir" ] && npu_cpu_governor_allowed "$dir" performance || {
		npu_error 'The performance governor is required for direct PLL control'; return
	}
	old_governor=$(cat "$dir/scaling_governor")
	printf '%s\n' performance > "$dir/scaling_governor" || { npu_error 'Cannot set performance governor'; return; }
	if [ "$target_mhz" -lt 1000 ]; then posdiv=1; pcw=$((target_mhz / 25))
	else posdiv=0; pcw=$((target_mhz / 50)); fi
	# Same order as the original ATF-based implementation: backup clock,
	# unlock, program, settle, ARMPLL, gate backup, lock, verify.
	if ! clk_src_switch "$CLK_SRC_PLL2"; then
		printf '%s\n' "$old_governor" > "$dir/scaling_governor"
		npu_error 'Failed to switch CPU clock to PLL2'; return
	fi
	if ! pll_write_protect off || ! configure_armpll "$soc" "$pcw" "$posdiv"; then
		pll_write_protect on
		# Leave the backup source running after a partial programming failure.
		npu_error 'Failed to program ARMPLL; CPU remains on the backup clock'; return
	fi
	sleep 0.02 2>/dev/null || sleep 1
	if ! clk_src_switch "$CLK_SRC_ARMPLL"; then
		pll_write_protect on
		npu_error 'Failed to switch CPU clock back to ARMPLL'; return
	fi
	clk_src_gate_off "$CLK_SRC_PLL2" || cleanup=1
	pll_write_protect on || cleanup=1
	if [ "$cleanup" -ne 0 ]; then
		npu_error 'Failed to finish CPU PLL update'; return
	fi
	actual=$(read_armpll_mhz "$soc")
	[ "$actual" = "$target_mhz" ] || { npu_error 'CPU PLL readback does not match the requested frequency'; return; }
	printf '{"result":"ok","soc":"%s","target_mhz":%s,"actual_mhz":%s}\n' "$soc" "$target_mhz" "$actual"
}
