'use strict';
'require view';
'require poll';
'require rpc';
'require ui';

var callDashboard = rpc.declare({ object: 'luci.airoha_npu', method: 'getDashboard' });
var callSetGovernor = rpc.declare({ object: 'luci.airoha_npu', method: 'setGovernor', params: ['governor'] });
var callSetMaxFreq = rpc.declare({ object: 'luci.airoha_npu', method: 'setMaxFreq', params: ['freq'] });
var callSetOverclock = rpc.declare({ object: 'luci.airoha_npu', method: 'setOverclock', params: ['freq_mhz'] });


/*
 * Use theme colour properties where available. Themes such as Argon do not
 * export these properties, so neutral surfaces must fall back to transparent
 * backgrounds and inherited text, not a hardcoded light palette. Translucent
 * neutral borders and tracks remain visible on both light and dark surfaces.
 *
 * Text that sits on a filled surface takes its ink from the matching
 * --on-*-color, because a hardcoded white fails against half of the dark
 * fills, and a chip with no status colour is drawn as an outline rather than
 * invented as a filled pair the tier makes no promise about. Nothing is
 * declared on :root and every selector carries the package prefix, so the
 * sheet cannot reach another application's page.
 */
var viewCSS = '\
.airoha-npu-card{background:var(--background-color-high,transparent);border:1px solid var(--border-color-medium,rgba(128,128,128,.4));border-radius:8px;padding:14px;transition:border-color .3s}\
.airoha-npu-card-active{border-color:var(--primary-color-medium,#2196f3)}\
.airoha-npu-title{font-weight:bold;font-size:14px;color:var(--text-color-highest,inherit)}\
.airoha-npu-muted{color:var(--text-color-medium,inherit)}\
.airoha-npu-text{color:var(--text-color-high,inherit)}\
.airoha-npu-label{font-size:11px;color:var(--text-color-medium,inherit)}\
.airoha-npu-ok{color:var(--success-color-medium,#4caf50)}\
.airoha-npu-warn{color:var(--warn-color-medium,#ff9800)}\
.airoha-npu-error{color:var(--error-color-medium,#f44336)}\
.airoha-npu-idle{color:var(--text-color-medium,inherit)}\
.airoha-npu-dot{width:7px;height:7px;border-radius:50%;background:currentColor;display:inline-block}\
.airoha-npu-chip{padding:1px 7px;border-radius:3px;font-size:10px;font-weight:600;text-transform:uppercase}\
.airoha-npu-chip-on{background:var(--success-color-high,#2e7d32);color:var(--on-success-color,#fff)}\
.airoha-npu-chip-npu{background:var(--primary-color-high,#1565c0);color:var(--on-primary-color,#fff)}\
.airoha-npu-chip-off{background:none;border:1px solid var(--border-color-medium,rgba(128,128,128,.4));color:var(--text-color-medium,inherit)}\
.airoha-npu-bar-track{background:var(--border-color-medium,rgba(128,128,128,.4));border-radius:4px;overflow:hidden}\
.airoha-npu-bar-fill{height:100%;border-radius:4px;transition:width .5s}\
.airoha-npu-bar-ok{background:var(--success-color-high,#2e7d32)}\
.airoha-npu-bar-warn{background:var(--warn-color-high,#e65100)}\
.airoha-npu-bar-error{background:var(--error-color-high,#c62828)}\
.airoha-npu-bar-idle{background:var(--border-color-high,rgba(128,128,128,.7))}\
.airoha-npu-freq-value{font-weight:bold;font-size:13px;color:var(--text-color-highest,inherit);margin-bottom:4px}\
.airoha-npu-freq-row{display:flex;align-items:center;gap:10px}\
.airoha-npu-freq-track{flex:1;width:100%;max-width:350px;height:12px}\
.airoha-npu-cpu-table .td+.td{text-align:center}\
.airoha-npu-cpu-table .cbi-input-select{width:140px;box-sizing:border-box}\
.airoha-npu-oc-row{display:grid;grid-template-columns:minmax(0,1fr) 140px minmax(0,1fr);align-items:center;column-gap:8px}\
.airoha-npu-oc-row>input{grid-column:2}\
.airoha-npu-oc-actions{grid-column:3;justify-self:start;display:flex;align-items:center;gap:8px;white-space:nowrap}\
.airoha-npu-oc-hint{font-size:85%;margin-top:8px;white-space:normal}\
.airoha-npu-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px;margin-bottom:10px;align-items:start}\
.airoha-npu-band-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:6px}\
.airoha-npu-pse-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:6px}\
.airoha-npu-pse-cell{background:var(--background-color-high,transparent);border:1px solid var(--border-color-medium,rgba(128,128,128,.4));border-radius:5px;padding:6px 8px;font-size:12px}\
.airoha-npu-pse-cell-drop{border-color:var(--error-color-medium,#f44336)}\
.airoha-npu-table-scroll{max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch}\
.airoha-npu-table-scroll .table{min-width:820px}\
@media(max-width:600px){.airoha-npu-grid{grid-template-columns:1fr}.airoha-npu-band-grid{grid-template-columns:repeat(auto-fit,minmax(130px,1fr))}.airoha-npu-pse-grid{grid-template-columns:repeat(auto-fit,minmax(110px,1fr))}.airoha-npu-freq-row{gap:5px}.airoha-npu-freq-track{min-width:0}.airoha-npu-oc-row{display:flex;flex-direction:column;gap:8px}}\
';

/* ── Helpers ── */
var bandNames = ['2.4 GHz', '5 GHz', '6 GHz'];

var psePortMap = [
	'CDM1', 'GDM1', 'GDM2', 'GDM3', 'PPE1', 'CDM2', 'CDM3', 'CDM4', 'PPE2', 'GDM4'
];

function fmtFreq(khz) { return (!khz || khz === 0) ? _('N/A') : (khz / 1000).toFixed(0) + ' MHz'; }
function fmtK(n) {
	if (!n || n === 0) return '0';
	if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
	if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K';
	return n.toString();
}

function calcTotalMem(regions) {
	var t = 0;
	(regions || []).forEach(function(r) {
		var m = (r.size || '').match(/(\d+)\s*(KiB|MiB|GiB)/i);
		if (m) { var s = parseInt(m[1]); var u = m[2][0].toUpperCase(); t += u === 'G' ? s*1048576 : u === 'M' ? s*1024 : s; }
	});
	return t >= 1024 ? (t/1024).toFixed(0)+' MiB' : t+' KiB';
}

// Occupancy shown as a load: quiet is good, full is not. Returned as a class
// from the export tier so the shade follows the theme.
function loadClass(pct) {
	return pct > 80 ? 'error' : pct > 50 ? 'warn' : 'ok';
}

function getBandStats(ti, b) {
	var c = Array.isArray(ti.station_counts) ? ti.station_counts : [];
	for (var i=0;i<c.length;i++) if (c[i].band===b) return c[i];
	return { band:b, count:0, tx_packets:0, tx_retries:0 };
}

function getTxQueue(ti, b) {
	var q = Array.isArray(ti.tx_queues) ? ti.tx_queues : [];
	for (var i=0;i<q.length;i++) if (q[i].band===b) return q[i];
	return null;
}

function bandHealth(s) {
	if (!s || s.count===0) return { text:_('No clients'), cls:'idle' };
	if (!s.tx_packets) return { text:_('Idle'), cls:'idle' };
	var r = s.tx_retries/(s.tx_packets+s.tx_retries);
	return r>0.5 ? {text:_('Poor'),cls:'error'} : r>0.2 ? {text:_('Fair'),cls:'warn'} : {text:_('Good'),cls:'ok'};
}

function retryPct(s) {
	if (!s || !s.tx_packets) return '-';
	return (s.tx_retries/(s.tx_packets+s.tx_retries)*100).toFixed(1)+'%';
}

/* ── Mini Band Chip (compact for FE diagram) ── */
function renderBandChip(band, txQ, stats) {
	var name = bandNames[band] || _('Band %d').format(band);
	var h = bandHealth(stats);
	var type = txQ ? txQ.type : '?';

	return E('div', { 'class': 'airoha-npu-pse-cell' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:6px' }, [
			E('span', { 'class': 'airoha-npu-title', 'style': 'font-size:13px' }, name),
			E('span', { 'class': 'airoha-npu-chip '+(type==='npu'?'airoha-npu-chip-npu':'airoha-npu-chip-off'), 'style': 'font-size:9px' }, type.toUpperCase())
		]),
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;gap:6px' }, [
			E('span', { 'class': 'airoha-npu-'+h.cls, 'style': 'display:flex;align-items:center;gap:4px;font-weight:500' }, [
				E('span', { 'class': 'airoha-npu-dot' }),
				E('span', {}, h.text)
			]),
			E('span', { 'class': 'airoha-npu-muted' }, _('%d sta').format(stats.count)),
			(stats.tx_packets > 0) ? E('span', { 'class': 'airoha-npu-muted' }, retryPct(stats)) : E('span')
		])
	]);
}

/* ── Frame Engine Diagram (with WiFi bands, NPU, PPE flows) ── */
function renderFeDiagram(fe, ti, st, topo) {
	if (!fe || fe.error) return E('div', { 'class': 'airoha-npu-muted' }, _('devmem is not available on this build'));
	ti = ti || {}; st = st || {}; topo = topo || {};

	var ports = Array.isArray(fe.pse_ports) ? fe.pse_ports : [];

	// Helper: GDM card
	function gdmCard(key, name, label, pse) {
		var d = fe[key] || {};
		var active = d.tx > 0 || d.rx > 0;
		return E('div', { 'class': 'airoha-npu-card' + (active ? ' airoha-npu-card-active' : '') }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px' }, [
				E('span', { 'class': 'airoha-npu-title' }, name),
				E('span', { 'class': 'airoha-npu-label' }, pse)
			]),
			E('div', { 'class': 'airoha-npu-label', 'style': 'margin-bottom:6px' }, label),
			E('div', { 'style': 'display:grid;grid-template-columns:auto 1fr;gap:2px 10px;font-size:12px' }, [
				E('span', { 'class': 'airoha-npu-muted' }, _('TX')), E('span', { 'class': 'airoha-npu-text', 'style': 'text-align:right' }, fmtK(d.tx)),
				E('span', { 'class': 'airoha-npu-muted' }, _('RX')), E('span', { 'class': 'airoha-npu-text', 'style': 'text-align:right' }, fmtK(d.rx))
			].concat(d.tx_drop > 0 ? [
				E('span', { 'class': 'airoha-npu-error' }, _('TX Drop')), E('span', { 'class': 'airoha-npu-error', 'style': 'text-align:right' }, fmtK(d.tx_drop))
			] : []).concat(d.rx_drop > 0 ? [
				E('span', { 'class': 'airoha-npu-error' }, _('RX Drop')), E('span', { 'class': 'airoha-npu-error', 'style': 'text-align:right' }, fmtK(d.rx_drop))
			] : []))
		]);
	}

	// Helper: CDM offload bar
	function cdmCard(key, name, label, pse) {
		var d = fe[key] || {};
		var total = (d.rx_cpu||0) + (d.rx_hwf||0);
		var pct = total > 0 ? ((d.rx_hwf/total)*100).toFixed(1) : '0.0';
		// Here a high share is the good case: it is traffic the CPU never saw.
		var barCls = total === 0 ? 'idle' : parseFloat(pct) > 80 ? 'ok' : parseFloat(pct) > 50 ? 'warn' : 'error';
		return E('div', { 'class': 'airoha-npu-card' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;gap:8px;margin-bottom:4px' }, [
				E('span', { 'class': 'airoha-npu-title', 'style': 'font-size:13px' }, name+' '+pse),
				E('span', { 'class': 'airoha-npu-label' }, label)
			]),
			E('div', { 'class': 'airoha-npu-text', 'style': 'font-size:12px;margin-bottom:4px' }, _('HW Offload: %s%%').format(pct)),
			E('div', { 'class': 'airoha-npu-bar-track', 'style': 'height:6px' }, [
				E('div', { 'class': 'airoha-npu-bar-fill airoha-npu-bar-'+barCls, 'style': 'width:'+pct+'%' })
			]),
			E('div', { 'style': 'display:flex;justify-content:space-between;gap:6px;font-size:11px;margin-top:4px' }, [
				E('span', { 'class': 'airoha-npu-muted' }, _('CPU: %s').format(fmtK(d.rx_cpu||0))),
				E('span', { 'class': 'airoha-npu-muted' }, _('HWF: %s').format(fmtK(d.rx_hwf||0))),
				E('span', { 'class': 'airoha-npu-muted' }, _('TX: %s').format(fmtK(d.tx||0)))
			])
		]);
	}

	// WiFi band chips for CDM4
	var bandChips = [];
	for (var b = 0; b < 3; b++) {
		var stats = getBandStats(ti, b);
		if (stats.available) bandChips.push(renderBandChip(b, getTxQueue(ti, b), stats));
	}

	// CDM4/WDMA + WiFi bands grouped
	var p7 = ports[7] || { iq: 0, oq: 0, drops: 0 };
	var cdm4WiFi = E('div', { 'class': 'airoha-npu-card' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:2px' }, [
			E('span', { 'class': 'airoha-npu-title' }, 'CDM4 / WDMA'),
			E('span', { 'class': 'airoha-npu-label' }, _('P7 WiFi DMA'))
		]),
		E('div', { 'style': 'display:flex;gap:12px;font-size:11px;margin-bottom:8px' }, [
			E('span', { 'class': 'airoha-npu-muted' }, 'IQ '+p7.iq),
			E('span', { 'class': 'airoha-npu-muted' }, 'OQ '+p7.oq),
			p7.drops > 0 ? E('span', { 'class': 'airoha-npu-error' }, _('Drop %s').format(fmtK(p7.drops))) : null
		].filter(Boolean)),
		// WiFi bands inside
		E('div', { 'class': 'airoha-npu-band-grid' }, bandChips.length ? bandChips : [_('No active wireless APs')])
	]);

	// NPU indicator
	var npuActive = st.npu_loaded;
	var npuCard = E('div', { 'class': 'airoha-npu-card' + (npuActive ? ' airoha-npu-card-active' : '') }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px' }, [
			E('span', { 'class': 'airoha-npu-title' }, 'NPU'),
			E('span', { 'class': 'airoha-npu-chip '+(npuActive?'airoha-npu-chip-on':'airoha-npu-chip-off') }, npuActive ? _('Active') : _('Off'))
		]),
		E('div', { 'class': 'airoha-npu-label', 'style': 'margin-bottom:4px' }, _('%d RISC-V cores').format(st.npu_cores || 0)),
		E('div', { 'style': 'font-size:11px' }, [
			E('span', { 'class': 'airoha-npu-muted' }, _('Manages:') + ' '),
			E('span', { 'class': 'airoha-npu-text' }, _('PPE init, WDMA rings, flow stats'))
		])
	]);

	// PPE engines with flow count
	var ppeCard = E('div', { 'class': 'airoha-npu-card airoha-npu-card-active' }, [
		E('div', { 'style': 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:4px' }, [
			E('span', { 'class': 'airoha-npu-title' }, _('PPE Engines')),
			E('span', { 'class': 'airoha-npu-label' }, 'P4 + P8')
		]),
		E('div', { 'style': 'display:flex;gap:16px;font-size:12px' }, [
			E('span', {}, [
				E('span', { 'class': 'airoha-npu-muted' }, _('Bound') + ' '),
				E('span', { 'class': 'airoha-npu-text', 'style': 'font-weight:bold' }, (st.offload_bound||0).toString())
			]),
			E('span', {}, [
				E('span', { 'class': 'airoha-npu-muted' }, _('Total') + ' '),
				E('span', { 'class': 'airoha-npu-text' }, (st.offload_total||0).toString())
			])
		])
	]);

	// PSE buffer
	var pseT = (fe.pse_used||0)+(fe.pse_free||0);
	var pseP = pseT>0 ? ((fe.pse_used/pseT)*100).toFixed(1) : '0';

	// PSE port cells (skip P7 since it's shown in CDM4/WiFi section)
	var portCells = ports.filter(function(p){ return p.port !== 7 || !topo.has_wifi; }).map(function(p) {
		var name = psePortMap[p.port] || '';
		var drop = p.drops > 0;
		return E('div', { 'class': 'airoha-npu-pse-cell' + (drop ? ' airoha-npu-pse-cell-drop' : '') }, [
			E('div', { 'class': 'airoha-npu-text', 'style': 'font-weight:600;font-size:11px' }, ('P'+p.port+' '+name).trim()),
			E('div', { 'style': 'display:flex;gap:8px;font-size:11px;margin-top:2px' }, [
				E('span', { 'class': 'airoha-npu-muted' }, 'IQ '+p.iq),
				E('span', { 'class': 'airoha-npu-muted' }, 'OQ '+p.oq),
				drop ? E('span', { 'class': 'airoha-npu-error' }, fmtK(p.drops)) : null
			].filter(Boolean))
		]);
	});

	return E('div', {}, [
		// PSE buffer bar
		E('div', { 'class': 'airoha-npu-card', 'style': 'margin-bottom:10px' }, [
			E('div', { 'style': 'display:flex;justify-content:space-between;gap:8px;margin-bottom:4px' }, [
				E('span', { 'class': 'airoha-npu-title', 'style': 'font-size:13px' }, _('PSE Shared Buffer')),
				E('span', { 'class': 'airoha-npu-muted', 'style': 'font-size:12px' }, _('%d used / %d free (%s%%)').format(fe.pse_used||0, fe.pse_free||0, pseP))
			]),
			E('div', { 'class': 'airoha-npu-bar-track', 'style': 'height:8px' }, [
				E('div', { 'class': 'airoha-npu-bar-fill airoha-npu-bar-'+loadClass(parseFloat(pseP)), 'style': 'width:'+pseP+'%' })
			])
		]),
		// Row 1: GDM ports
		E('div', { 'class': 'airoha-npu-grid' }, [1, 2, 3, 4].filter(function(id) {
			return !!fe['gdm' + id];
		}).map(function(id) {
			var ports = (topo.ports || []).filter(function(p) { return p.kind === 'gdm' && p.gdm === id; });
			var names = ports.map(function(p) { return p.netdev || p.mode || _('N/A'); });
			return gdmCard('gdm' + id, 'GDM' + id, names.join(', '), 'P' + (id === 4 ? 9 : id));
		})),
		// Row 2: CDM1/CDM2 (CPU) + CDM4/WiFi
		E('div', { 'class': 'airoha-npu-grid' }, [
			cdmCard('cdm1', 'CDM1', _('CPU DMA 1'), 'P0'),
			cdmCard('cdm2', 'CDM2', _('CPU DMA 2'), 'P5')
		].concat(topo.has_wifi ? [cdm4WiFi] : [])),
		// Row 3: PPE + NPU
		E('div', { 'class': 'airoha-npu-grid' }, [
			ppeCard,
			npuCard
		]),
		// PSE port grid
		E('div', { 'class': 'airoha-npu-text', 'style': 'font-size:12px;font-weight:600;margin-bottom:6px' }, _('PSE Port Queue Status')),
		E('div', { 'class': 'airoha-npu-pse-grid' }, portCells)
	]);
}

/* ── CPU Frequency ── */
// The PLL sitting above what cpufreq is allowed to ask for is an overclock
// whichever governor is running: the direct write goes behind cpufreq's back,
// so the governor says nothing about whether it happened.
function freqBarState(hw, min, max, pll) {
	var estimate = !(max > 0) && pll > 0;
	var oc = max > 0 && pll > 0 && (pll * 1000) > max;
	return { freq: estimate ? pll*1000 : oc ? pll*1000 : Math.min(hw,max), max: estimate ? 0 : oc ? pll*1000 : max, oc: oc, estimate: estimate };
}

function freqBarPct(s, min) {
	if (!(s.max > min)) return 0;
	return Math.max(0, Math.min(100, Math.round(((s.freq-min)/(s.max-min))*100)));
}

function freqBarLabel(s, pll) {
	return s.estimate ? _('%s (PLL estimate)').format(fmtFreq(pll * 1000)) : s.oc ? (pll+' MHz (OC)') : fmtFreq(s.freq);
}

function renderFreqBar(hw, min, max, pll) {
	var s = freqBarState(hw,min,max,pll);

	// The reading sits above the bar rather than on top of it: a label
	// overlaying the track covers both the filled and the empty part, and no
	// single ink colour is guaranteed to be readable on both.
	return E('div', {}, [
		E('div', { 'id':'airoha-npu-freq-value', 'class':'airoha-npu-freq-value' }, freqBarLabel(s, pll)),
		E('div', { 'class':'airoha-npu-freq-row', 'style':s.max>0?'':'display:none' }, [
			E('span', { 'class':'airoha-npu-muted', 'style':'font-size:90%' }, fmtFreq(min)),
			E('div', { 'class':'airoha-npu-bar-track airoha-npu-freq-track' }, [
				E('div', { 'id':'airoha-npu-freq-fill', 'class':'airoha-npu-bar-fill airoha-npu-bar-'+(s.oc?'warn':'ok'), 'style':'width:'+freqBarPct(s,min)+'%' })
			]),
			E('span', { 'id':'airoha-npu-freq-max', 'class':'airoha-npu-muted', 'style':'font-size:90%' }, fmtFreq(s.max))
		])
	]);
}

function updateFreqBar(hw, min, max, pll) {
	var s = freqBarState(hw,min,max,pll);
	var el = document.getElementById('airoha-npu-freq-value');
	var fl = document.getElementById('airoha-npu-freq-fill');
	var ml = document.getElementById('airoha-npu-freq-max');
	var row = el && el.nextElementSibling;
	if (el) el.textContent = freqBarLabel(s, pll);
	if (row) row.style.display = s.max>0 ? '' : 'none';
	if (fl && s.max>0) {
		fl.style.width = freqBarPct(s,min)+'%';
		fl.className = 'airoha-npu-bar-fill airoha-npu-bar-'+(s.oc?'warn':'ok');
	}
	if (ml) ml.textContent = fmtFreq(s.max);
}

function runtimeSelect(id, values, active, setter, format) {
	if (!values.length) return E('span', {}, _('N/A'));
	var current = String(active || '');
	var choices = values.slice();
	if (current && choices.indexOf(current) < 0) choices.push(current);
	var select = E('select', {
		'id': id, 'class': 'cbi-input-select', 'style': 'min-width:140px',
		'change': function(ev) {
			var el = ev.target, previous = el.dataset.applied, requested = el.value;
			el.disabled = true;
			el.dataset.busy = '1';
			setter(requested).then(function(result) {
				if (!result || result.error) throw new Error(result && result.error || _('No response'));
				el.dataset.applied = requested;
			}).catch(function(err) {
				el.value = previous;
				ui.addNotification(null, E('p', {}, _('Error: %s').format(err.message)), 'error');
			}).then(function() { el.disabled = false; delete el.dataset.busy; });
		}
	}, choices.map(function(value) {
		return E('option', { 'value': value, 'selected': value === current ? '' : null, 'disabled': values.indexOf(value) < 0 ? '' : null }, format(value));
	}));
	select.dataset.applied = current;
	return select;
}

function renderGovSelect(avail, active) {
	return runtimeSelect('airoha-npu-governor-select', (avail || '').trim().split(/\s+/).filter(Boolean), active,
		callSetGovernor, function(value) { return value; });
}

function renderMaxFreqSelect(avail, current) {
	var values = (avail || '').trim().split(/\s+/).filter(function(value) { return Number(value) >= 500000 && Number(value) <= 1400000; });
	return runtimeSelect('airoha-npu-maxfreq-select', values, current,
		function(value) { return callSetMaxFreq(Number(value)); }, function(value) { return fmtFreq(Number(value)); });
}

function updateRuntimeSelect(id, value) {
	var select = document.getElementById(id);
	if (!select || select.matches(':focus') || select.dataset.busy) return;
	select.value = String(value || '');
	select.dataset.applied = select.value;
}

function socLabel(soc) {
	if (soc === 'an7583') return 'AN7583';
	if (soc === 'en7581') return 'AN7581';
	return _('Unknown');
}

// The highest frequency this package has been run at on real hardware. The
// ceiling itself is the backend's (AIROHA_OC_MAX_MHZ), which a characterisation
// sweep may raise well past what anyone has tested.
var OC_TESTED_MHZ = 1400;

// Ask before going past the frequency the package has been tested at. A
// blocking confirm() freezes the whole page and is styled by the browser,
// so use the LuCI modal and continue on its answer.
function confirmHighFreq(mhz) {
	return new Promise(function(resolve) {
		ui.showModal(_('Confirm overclock'), [
			E('p', {}, _('%d MHz is above %d MHz, which is as far as this has been tested. The board may run unstable or stop responding until it is power cycled.').format(mhz, OC_TESTED_MHZ)),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'cbi-button', 'click': function() { ui.hideModal(); resolve(false); } }, _('Cancel')),
				' ',
				E('button', { 'class': 'cbi-button cbi-button-negative', 'click': function() { ui.hideModal(); resolve(true); } }, _('Continue'))
			])
		]);
	});
}

function applyOverclock(btn, mhz) {
	btn.disabled = true;
	btn.textContent = _('Applying...');
	return callSetOverclock(mhz).then(function(r) {
		if (r && r.error)
			ui.addNotification(null, E('p', {}, _('Failed: %s').format(r.error)), 'error');
		else if (r && r.result === 'ok')
			ui.addNotification(null, E('p', {}, _('CPU set to %d MHz').format(r.actual_mhz)), 'info');
	}).catch(function(e) {
		ui.addNotification(null, E('p', {}, _('Overclock request failed: %s').format(e.message)), 'error');
	}).then(function() {
		btn.disabled = false;
		btn.textContent = _('Apply');
	});
}

function renderOcControls(soc, ocMin, ocMax) {
	// The PLL register map differs per SoC, so refuse to write anything when
	// the SoC was not identified rather than poking AN7581 addresses blindly.
	if (soc !== 'an7583' && soc !== 'en7581')
		return E('span',{'class':'airoha-npu-muted'},_('Not available: unrecognised SoC'));

	// The bounds are the backend's, not a second copy of them: it is the side
	// that enforces them, and its ceiling is configurable.
	ocMin = parseInt(ocMin) || 500;
	ocMax = parseInt(ocMax) || 1600;

	var inp = E('input',{'id':'airoha-npu-oc-input','type':'number','min':String(ocMin),'max':String(ocMax),'step':'50','value':String(Math.min(OC_TESTED_MHZ, ocMax)),'class':'cbi-input-text','style':'width:140px;max-width:100%;box-sizing:border-box'});
	var btn = E('button',{'class':'cbi-button cbi-button-action','click':function(){
		var f=parseInt(inp.value);
		if(isNaN(f)||f<ocMin||f>ocMax){ui.addNotification(null,E('p',{},_('The frequency must be between %d and %d MHz').format(ocMin,ocMax)),'error');return;}
		if(f>OC_TESTED_MHZ)
			confirmHighFreq(f).then(function(ok){ if(ok) applyOverclock(btn,f); });
		else
			applyOverclock(btn,f);
	}},_('Apply'));
	return E('div',{},[
		E('div',{'class':'airoha-npu-oc-row'},[
			inp, E('div',{'class':'airoha-npu-oc-actions'},[E('span',{'class':'airoha-npu-muted'},'MHz'),btn])
		]),
		E('div',{'class':'airoha-npu-muted airoha-npu-oc-hint'},_('Direct PLL write, %d-%d MHz. Tested up to %d MHz.').format(ocMin,ocMax,OC_TESTED_MHZ))
	]);
}

/* ── PPE Table ── */
function formatPpeCount(count) {
	return count == null ? '-' : String(count);
}

function renderPpeRows(entries) {
	return entries.slice(0,100).map(function(e) {
		var eth = e.eth||''; if(eth==='00:00:00:00:00:00->00:00:00:00:00:00') eth='-';
		return E('tr',{'class':'tr'},[
			E('td',{'class':'td'},e.index), E('td',{'class':'td'},E('span',{'class':e.state==='BND'?'label-success':''},e.state)),
			E('td',{'class':'td'},e.type), E('td',{'class':'td'},e.orig||'-'), E('td',{'class':'td'},e.new_flow||'-'), E('td',{'class':'td'},eth),
			E('td',{'class':'td'},formatPpeCount(e.packets)), E('td',{'class':'td'},formatPpeCount(e.bytes))
		]);
	});
}

/* ── Main View ── */
function collect() {
	return callDashboard();
}

function renderPorts(topo) {
	var rows = (topo.ports || []).map(function(p) {
		return E('tr', { 'class': 'tr' }, [
			E('td', { 'class': 'td' }, (p.kind === 'gdm' ? 'GDM' + p.gdm : _('Switch') + ' ' + p.reg) + (p.split ? ' / NBQ' + p.reg : '')),
			E('td', { 'class': 'td' }, p.netdev || _('Internal Switch CPU Port')),
			E('td', { 'class': 'td' }, p.role === 'pon' ? 'PON' : p.role === 'wan' ? 'WAN' : p.role === 'conduit' ? _('Internal') : 'LAN'),
			E('td', { 'class': 'td' }, p.mode || '-'),
			E('td', { 'class': 'td' }, p.carrier == null ? _('N/A') : Number(p.carrier) === 1 ? _('Link up') : _('Link down')),
			E('td', { 'class': 'td' }, Number(p.speed) > 0 ? p.speed + ' Mbps' : _('N/A')),
			E('td', { 'class': 'td' }, formatPpeCount(p.rx_bytes)),
			E('td', { 'class': 'td' }, formatPpeCount(p.tx_bytes))
		]);
	});
	return E('div', { 'class': 'airoha-npu-table-scroll' }, E('table', { 'class': 'table' }, [
		E('tr', { 'class': 'tr' }, [_('Port'), _('Interface'), _('Role'), _('Mode'), _('Link'), _('Speed'), _('RX bytes'), _('TX bytes')].map(function(t) { return E('th', { 'class': 'th' }, t); }))
	].concat(rows)));
}

function ppeSummary(ppe) {
	if (!ppe.available) return _('PPE debugfs is unavailable');
	return _('Total: %d, bound: %d, IPv4: %d, IPv6: %d, L2 bridge: %d. Showing up to 100 entries.').format(
		ppe.total || 0, ppe.bound || 0, ppe.ipv4 || 0, ppe.ipv6 || 0, ppe.l2b || 0);
}

return view.extend({
	load: function() {
		return collect();
	},

	render: function(data) {
		var st = data.status||{}, ppe = data.ppe||{}, ti = data.token||{}, fe = data.frame_engine||{}, topo = data.topology||{};
		var entries = Array.isArray(ppe.entries) ? ppe.entries : [];
		var memR = Array.isArray(st.memory_regions) ? st.memory_regions : [];

		var view = E('div',{'class':'cbi-map'},[
			// The stylesheet is part of the view, so it is torn down with the
			// view instead of outliving it in <head> on an SPA theme.
			E('style',{'type':'text/css'}, viewCSS),
			E('h2',{},_('Airoha SoC Status')),

			// CPU Frequency
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('CPU Frequency')),
				E('table',{'class':'table airoha-npu-cpu-table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td','width':'33%'},E('strong',{},_('Current Frequency'))), E('td',{'class':'td'}, renderFreqBar((st.cpu_hw_freq||st.cpu_cur_freq),st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU Temperature'))), E('td',{'class':'td','id':'airoha-npu-cpu-temp'}, st.cpu_temp >= 0 ? st.cpu_temp + ' °C' : _('N/A')) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Governor'))), E('td',{'class':'td'}, renderGovSelect(st.cpu_avail_governors,st.cpu_governor)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Max Frequency'))), E('td',{'class':'td'}, renderMaxFreqSelect(st.cpu_avail_freqs,st.cpu_max_freq)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Overclock'))), E('td',{'class':'td'}, renderOcControls(st.soc, st.oc_min_mhz, st.oc_max_mhz)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('CPU Cores'))), E('td',{'class':'td'},(st.cpu_count||0).toString()) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('SoC'))), E('td',{'class':'td'},socLabel(st.soc)) ])
				])
			]),

			// NPU & Frame Engine (unified)
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('NPU & Offload Engine')),
				E('table',{'class':'table'},[
					E('tr',{'class':'tr'},[ E('td',{'class':'td','width':'33%'},E('strong',{},_('NPU Status'))),
						E('td',{'class':'td','id':'airoha-npu-status'}, st.npu_loaded ?
							E('span',{'class':'label-success'},st.npu_device?_('Active (%s)').format(st.npu_device):_('Active')) :
							E('span',{'class':'label-danger'},_('Not Active'))) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Firmware / Clock / Cores'))),
						E('td',{'class':'td'}, _('%s | %s | %d cores').format(st.npu_version||_('N/A'), st.npu_clock?(st.npu_clock/1e6).toFixed(0)+' MHz':_('N/A'), st.npu_cores||0)) ]),
					E('tr',{'class':'tr'},[ E('td',{'class':'td'},E('strong',{},_('Reserved Memory'))),
						E('td',{'class':'td'}, _('%s (%d regions)').format(calcTotalMem(memR), memR.length)) ])
				]),

				// Frame Engine diagram (includes WiFi bands, PPE flows, NPU indicator)
				E('div',{'style':'margin-top:12px'},[ E('h4',{'class':'airoha-npu-text','style':'font-size:14px;margin-bottom:8px'},_('Frame Engine'))]),
				E('div',{'id':'airoha-npu-fe-container'}, renderFeDiagram(fe, ti, st, topo))
			]),

			E('div', {'class': 'cbi-section'}, [
				E('h3', {}, _('Ethernet topology')),
				E('div', {'id': 'airoha-npu-ports'}, renderPorts(topo))
			]),

			// PPE Flow Table
			E('div',{'class':'cbi-section'},[
				E('h3',{},_('PPE Flow Offload Entries')),
				E('p',{'id':'airoha-npu-ppe-summary','class':'airoha-npu-muted'},ppeSummary(ppe)),
				E('div',{'class':'airoha-npu-table-scroll'}, E('table',{'class':'table','id':'airoha-npu-ppe-table'},[
					E('tr',{'class':'tr cbi-section-table-titles'},[
						E('th',{'class':'th'},_('Index')), E('th',{'class':'th'},_('State')), E('th',{'class':'th'},_('Type')),
						E('th',{'class':'th'},_('Original Flow')), E('th',{'class':'th'},_('New Flow')), E('th',{'class':'th'},_('Ethernet')),
						E('th',{'class':'th'},_('Packets')), E('th',{'class':'th'},_('Bytes'))
					])
				].concat(renderPpeRows(entries))))
			])
		]);

		poll.add(L.bind(function() {
			return collect().then(L.bind(function(d) {
				var st=d.status||{}, ppe=d.ppe||{}, ti=d.token||{}, fe=d.frame_engine||{}, topo=d.topology||{};
				var entries = Array.isArray(ppe.entries)?ppe.entries:[];

				updateFreqBar((st.cpu_hw_freq||st.cpu_cur_freq),st.cpu_min_freq,st.cpu_max_freq,st.pll_freq_mhz);
				var tempEl=document.getElementById('airoha-npu-cpu-temp'); if(tempEl) tempEl.textContent=st.cpu_temp >= 0 ? st.cpu_temp + ' °C' : _('N/A');
				updateRuntimeSelect('airoha-npu-governor-select', st.cpu_governor);
				updateRuntimeSelect('airoha-npu-maxfreq-select', st.cpu_max_freq);

				var se=document.getElementById('airoha-npu-status');
				if(se){se.innerHTML='';var sp=document.createElement('span');sp.className=st.npu_loaded?'label-success':'label-danger';sp.textContent=st.npu_loaded?(st.npu_device?_('Active (%s)').format(st.npu_device):_('Active')):_('Not Active');se.appendChild(sp);}

				var fc=document.getElementById('airoha-npu-fe-container'); if(fc){fc.innerHTML='';fc.appendChild(renderFeDiagram(fe, ti, st, topo));}

				var portsEl=document.getElementById('airoha-npu-ports'); if(portsEl) portsEl.replaceChildren(renderPorts(topo));
				var summary=document.getElementById('airoha-npu-ppe-summary'); if(summary) summary.textContent=ppeSummary(ppe);

				var tb=document.getElementById('airoha-npu-ppe-table');
				if(tb){while(tb.rows.length>1)tb.deleteRow(1);renderPpeRows(entries).forEach(function(r){tb.appendChild(r);});}
			},this));
		},this), 5);

		return view;
	},

	handleSaveApply: null, handleSave: null, handleReset: null
});
