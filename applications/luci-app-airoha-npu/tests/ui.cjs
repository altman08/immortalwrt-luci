// Run with Playwright installed: node tests/ui.cjs
const fs = require('fs');
const path = require('path');
const assert = require('assert').strict;
const { chromium } = require('playwright');
const pkg = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(pkg, 'htdocs/luci-static/resources/view/airoha_npu/status.js'), 'utf8');

(async () => {
 const browser = await chromium.launch({headless: true, args: ['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport: {width: 1440, height: 1000}});
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route('http://npu.test/', route => route.fulfill({contentType: 'text/html', body: '<html><body></body></html>'}));
  await page.goto('http://npu.test/');
  await page.setContent('<div id="maincontent"></div>');
  await page.addStyleTag({content: fs.readFileSync(path.resolve(pkg, '../../themes/luci-theme-bootstrap/htdocs/luci-static/bootstrap/cascade.css'), 'utf8')});
  await page.evaluate(source => {
   String.prototype.format = function(...args) { let i = 0; return this.replace(/%[%sd]/g, m => m === '%%' ? '%' : String(args[i++])); };
   const E = (tag, attrs, children) => {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(attrs || {})) {
     if (value == null) continue;
     if (typeof value === 'function') node.addEventListener(key, value);
     else node.setAttribute(key, value);
    }
    for (const child of Array.isArray(children) ? children : children == null ? [] : [children])
     if (child != null) node.append(child instanceof Node ? child : document.createTextNode(String(child)));
    return node;
   };
   window.data = {
    status: {soc: 'an7583', npu_loaded: true, npu_device: '1e900000.npu', npu_cores: 8,
     cpu_governor: 'ondemand', cpu_hw_freq: 800000, cpu_min_freq: 500000, cpu_max_freq: 1200000,
     boot_id: 'fixture-boot', cpu_ticks: [{core: 0, total: '1000', idle: '500'}, {core: 2, total: '1000', idle: '500'}],
     cpu_avail_governors: 'ondemand performance schedutil', cpu_avail_freqs: '400000 500000 1200000 1400000 1600000', cpu_temp: 42},
    ppe: {available: true, total: 3, bound: 2, ipv4: 1, ipv6: 1, l2b: 1,
     entries: [{index: '00001', state: 'BND', type: 'IPv4', packets: '9007199254740993', bytes: '18446744073709551615'}]},
    topology: {has_wifi: false, ports: [
     {kind: 'gdm', gdm: 3, reg: 0, split: true, netdev: 'lan5', role: 'lan', mode: 'usxgmii', carrier: '1', speed: '10000', rx_bytes: '9007199254740993'},
     {kind: 'gdm', gdm: 3, reg: 1, split: true, netdev: 'lan6', role: 'lan', mode: 'usxgmii', carrier: '0'}]},
    token: {has_wifi: false, station_counts: [], tx_queues: []},
    frame_engine: {gdm3: {tx: 100, rx: 200}, cdm1: {}, cdm2: {}, pse_used: 5, pse_free: 100,
     pse_ports: [{port: 0, iq: 1, oq: 2, drops: 0}, {port: 7, iq: 0, oq: 0, drops: 0}]},

   };
   window.testNow = Date.now(); Date.now = () => testNow;
   window.calls = []; window.notifications = []; window.fail = false;
   const rpc = {declare: declaration => (...args) => {
    calls.push([declaration.method, ...args]);
    if (declaration.method === 'getDashboard') {
     const result = structuredClone(data);
     if (args[0] === 0) result.ppe = {deferred: true, available: true, total: data.ppe.total, bound: data.ppe.bound};
     return Promise.resolve(result);
    }
    if (fail) return Promise.resolve({error: 'fixture failure'});
    if (declaration.method === 'setGovernor') data.status.cpu_governor = args[0];
    if (declaration.method === 'setMaxFreq') data.status.cpu_max_freq = args[0];
    if (declaration.method === 'setOverclock') {
     data.status.pll_freq_mhz = args[0]; data.status.cpu_governor = 'performance';
     return Promise.resolve({result: 'ok', actual_mhz: args[0]});
    }
    return Promise.resolve({result: 'ok'});
   }};
   window.view = new Function('view', 'poll', 'rpc', 'ui', 'E', '_', 'L', source)(
    {extend: value => value}, {add: fn => { window.pollNpu = fn; }}, rpc,
    {addNotification: (title, node) => notifications.push(node.textContent),
     showModal: (title, children) => {
      const modal = E('div', {id: 'npu-modal'}, [E('h3', {}, title), ...children]);
      document.body.append(modal);
     },
     hideModal: () => document.getElementById('npu-modal')?.remove()}, E, text => text,
    {bind: (fn, context) => fn.bind(context)});
   document.getElementById('maincontent').append(view.render(data));
  }, source);

  assert.equal(await page.locator('#airoha-npu-fe-container').getByText('CDM4 / WDMA', {exact: true}).count(), 0);
  assert.equal(await page.getByText('Overclock', {exact: true}).count(), 1);
  assert.equal(await page.locator('#airoha-npu-oc-input').getAttribute('type'), 'number');
  assert.equal(await page.locator('#airoha-npu-oc-input').getAttribute('max'), '1600');
  const ocButton = page.locator('#airoha-npu-oc-input').locator('..').locator('button');
  assert((await page.locator('#airoha-npu-ports').textContent()).includes('NBQ1'));
  assert((await page.locator('#airoha-npu-fe-container').textContent()).includes('lan5, lan6'));
  assert.equal(await page.locator('#airoha-npu-maxfreq-select option:not(:disabled)').evaluateAll(opts => opts.every(o => Number(o.value) >= 500000 && Number(o.value) <= 1400000)), true);
  assert((await page.locator('#airoha-npu-ppe-table').textContent()).includes('18446744073709551615'));
  assert.equal(await page.locator('[id^=airoha-npu-offload]').count(), 0);
  assert.equal(await page.getByText('Offload controls', {exact: true}).count(), 0);

  assert.equal(await page.locator('#airoha-npu-pon').textContent(), '');
  assert.equal(await page.locator('#airoha-npu-history svg').count(), 2);
  assert.equal(await page.locator('#airoha-npu-history svg[aria-label="CPU Usage History"] polyline').count(), 0);
  await page.evaluate(async () => {
   calls.length = 0;
   await view.load();
   testNow += 5000;
   data.status.cpu_ticks = [{core: 0, total: '1100', idle: '550'}, {core: 2, total: '1100', idle: '500'}];
   data.topology.pon = {present: true, netdev: 'pon0', mode_name: 'xgspon', los: 0, onu_state: 'O5', down_mbps: 10000, up_mbps: 10000};
   await pollNpu();
  });
  assert((await page.locator('#airoha-npu-history').textContent()).includes('CPU 0: 50.0%'));
  assert((await page.locator('#airoha-npu-history').textContent()).includes('CPU 2: 100.0%'));
  assert((await page.locator('#airoha-npu-pon').textContent()).includes('XGSPON'));
  assert((await page.locator('#airoha-npu-pon').textContent()).includes('Light detected'));
  assert((await page.locator('#airoha-npu-pon').textContent()).includes('O5'));

  // Full snapshots every fourth poll; light polls retain the rows and totals.
  await page.evaluate(async () => {
   data.ppe = {available: true, ppe_count: 1, ppe1: 110, ppe1_bound: 90, dram: 13, dram_bound: 10, total: 123, bound: 100,
    sampled_at: Math.floor(testNow / 1000), entries: Array.from({length: 123}, (_, i) => ({index: String(i), state: 'BND', type: 'IPv4', bytes: i === 0 ? '18446744073709551615' : '0'}))};
   for (let i = 0; i < 3; i++) { testNow += 5000; await pollNpu(); }
  });
  assert.deepEqual(await page.evaluate(() => calls.map(c => c[1])), [1, 0, 0, 0, 1]);
  assert.equal(await page.locator('#airoha-npu-ppe-table tr').count(), 51);
  assert((await page.locator('#airoha-npu-ppe-page').textContent()).includes('Page 1 of 3'));
  assert.equal(await page.locator('#airoha-npu-ppe-prev').isDisabled(), true);
  assert((await page.locator('#airoha-npu-ppe-partitions').textContent()).includes('DRAM'));
  assert.equal(await page.locator('#airoha-npu-ppe-partitions').getByText('PPE2', {exact: true}).count(), 0);
  const beforePaging = await page.evaluate(() => calls.length);
  await page.click('#airoha-npu-ppe-next');
  await page.click('#airoha-npu-ppe-next');
  assert.equal(await page.locator('#airoha-npu-ppe-table tr').count(), 24);
  assert((await page.locator('#airoha-npu-ppe-page').textContent()).includes('101–123'));
  assert.equal(await page.locator('#airoha-npu-ppe-next').isDisabled(), true);
  assert.equal(await page.evaluate(() => calls.length), beforePaging);
  await page.evaluate(async () => { testNow += 5000; data.ppe.total = 1; await pollNpu(); });
  assert((await page.locator('#airoha-npu-ppe-summary').textContent()).includes('Total: 123'));
  assert((await page.locator('#airoha-npu-ppe-page').textContent()).includes('Page 3 of 3'));
  assert((await page.locator('#airoha-npu-fe-container').textContent()).includes('123'));
  // When the next table shrinks, clamp the selected page and expose its precision.
  await page.evaluate(async () => {
   data.ppe.entries = data.ppe.entries.slice(0, 1);
   data.ppe.truncated = true;
   data.ppe.ppe_count = 2; data.ppe.ppe2 = 0;
   data.topology.pon.los = 1;
   for (let i = 0; i < 3; i++) { testNow += 5000; await pollNpu(); }
  });
  assert((await page.locator('#airoha-npu-ppe-page').textContent()).includes('Page 1 of 1'));
  assert((await page.locator('#airoha-npu-ppe-panel').textContent()).includes('statistics cover the full snapshot'));
  assert((await page.locator('#airoha-npu-ppe-table').textContent()).includes('18446744073709551615'));
  assert.equal(await page.locator('#airoha-npu-ppe-partitions').getByText('PPE2', {exact: true}).count(), 1);
  assert((await page.locator('#airoha-npu-pon').textContent()).includes('LOS / No light'));

  // A reset CPU counter creates a missing interval. A new boot clears history.
  await page.evaluate(async () => {
   testNow += 5000;
   data.status.cpu_ticks = [{core: 0, total: '10', idle: '5'}];
   await pollNpu();
  });
  assert((await page.locator('#airoha-npu-history').textContent()).includes('CPU 0: N/A'));
  const storedPoints = await page.evaluate(() => JSON.parse(sessionStorage.getItem('airoha_npu.history.v1')).points.length);
  assert(storedPoints > 1);
  await page.evaluate(() => {
   testNow += 5000;
   document.getElementById('maincontent').replaceChildren(view.render(data));
  });
  assert((await page.evaluate(() => JSON.parse(sessionStorage.getItem('airoha_npu.history.v1')).points.length)) > storedPoints);
  await page.evaluate(() => {
   testNow += 5000;
   data.status.boot_id = 'next-boot';
   document.getElementById('maincontent').replaceChildren(view.render(data));
  });
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('airoha_npu.history.v1')).points.length), 1);
  await page.evaluate(async () => {
   data.topology.pon = {present: true};
   testNow += 5000;
   await pollNpu();
  });
  assert((await page.locator('#airoha-npu-pon').textContent()).includes('N/A'));
  assert(!(await page.locator('#airoha-npu-pon').textContent()).includes('Light detected'));

  await page.selectOption('#airoha-npu-governor-select', 'schedutil');
  await page.waitForFunction(() => !document.getElementById('airoha-npu-governor-select').disabled);
  assert.equal(await page.evaluate(() => data.status.cpu_governor), 'schedutil');
  await page.evaluate(() => { window.fail = true; });
  await page.selectOption('#airoha-npu-governor-select', 'performance');
  await page.waitForFunction(() => notifications.length > 0);
  assert.equal(await page.locator('#airoha-npu-governor-select').inputValue(), 'schedutil');

  // Original numeric input and confirmation behavior remain retryable after a failed write.
  await page.fill('#airoha-npu-oc-input', '1400');
  await ocButton.click();
  await page.waitForFunction(() => notifications.some(n => n.includes('Failed: fixture failure')));
  assert.equal(await ocButton.isEnabled(), true);
  await page.evaluate(() => { window.fail = false; });
  await ocButton.click();
  await page.waitForFunction(() => notifications.some(n => n === 'CPU set to 1400 MHz'));
  await page.evaluate(() => pollNpu());
  assert.equal(await page.locator('#airoha-npu-freq-value').textContent(), '1400 MHz (OC)');
  assert.equal(await page.locator('#airoha-npu-governor-select').inputValue(), 'performance');

  await page.fill('#airoha-npu-oc-input', '1600');
  await ocButton.click();
  assert.equal(await page.locator('#npu-modal').isVisible(), true);
  await page.locator('#npu-modal').getByText('Cancel', {exact: true}).click();
  assert.equal(await page.evaluate(() => data.status.pll_freq_mhz), 1400);
  await ocButton.click();
  await page.locator('#npu-modal').getByText('Continue', {exact: true}).click();
  await page.waitForFunction(() => notifications.some(n => n === 'CPU set to 1600 MHz'));
  await page.evaluate(() => pollNpu());
  assert.equal(await page.locator('#airoha-npu-freq-value').textContent(), '1600 MHz (OC)');
  await page.fill('#airoha-npu-oc-input', '1400');
  await ocButton.click();
  await page.waitForFunction(() => data.status.pll_freq_mhz === 1400);
  await page.evaluate(() => pollNpu());

  assert.equal(await page.evaluate(() => calls.filter(c => c[0].startsWith('get')).every(c => c[0] === 'getDashboard')), true);
  assert.equal(await page.locator('#airoha-npu-freq-value').textContent(), '1400 MHz (OC)');

  await page.evaluate(() => {
   data.status.soc = 'unknown';
   document.getElementById('maincontent').replaceChildren(view.render(data));
  });
  assert.equal(await page.locator('#airoha-npu-oc-input').count(), 0);

  await page.evaluate(() => {
   data.status.soc = 'an7583';
   data.topology.has_wifi = true;
   data.token.station_counts = [{band: 1, available: true, count: 1, tx_packets: 100, tx_retries: 5}];
   data.token.tx_queues = [{band: 1, type: 'npu'}];
   document.getElementById('maincontent').replaceChildren(view.render(data));
  });
  assert.equal(await page.locator('#airoha-npu-fe-container').getByText('CDM4 / WDMA', {exact: true}).count(), 1);
  assert.equal(await page.locator('#airoha-npu-fe-container').getByText('5 GHz', {exact: true}).count(), 1);
  assert.equal(await page.locator('#airoha-npu-fe-container').getByText('2.4 GHz', {exact: true}).count(), 0);

  // A long pause must not join stale load samples across the gap.
  await page.evaluate(async () => {
   testNow += 11 * 60 * 1000;
   await pollNpu();
  });
  assert.equal(await page.evaluate(() => JSON.parse(sessionStorage.getItem('airoha_npu.history.v1')).points.length), 1);
  assert.equal(await page.locator('#airoha-npu-history svg[aria-label="CPU Usage History"] polyline').count(), 0);
  await page.evaluate(async () => {
   data.topology.pon = {present: true, netdev: 'pon0', mode_name: 'xgspon', los: 0, onu_state: 'O5', down_mbps: 10000, up_mbps: 10000};
   data.ppe = {available: true, ppe_count: 1, ppe1: 1, ppe1_bound: 1, dram: 0, dram_bound: 0, total: 1, bound: 1, sampled_at: Math.floor(testNow / 1000),
    entries: [{index: '00001', state: 'BND', type: 'IPv4', bytes: '18446744073709551615'}]};
   for (let i = 0; i < 4; i++) {
    testNow += 5000;
    data.status.cpu_ticks = [{core: 0, total: String(2000 + i * 100), idle: String(1000 + i * 50)}, {core: 2, total: String(2000 + i * 100), idle: String(1000 + i * 80)}];
    await pollNpu();
   }
  });

  if (process.env.NPU_SCREENSHOTS) {
   fs.mkdirSync(process.env.NPU_SCREENSHOTS, {recursive: true});
   await page.screenshot({path: path.join(process.env.NPU_SCREENSHOTS, 'desktop.png'), fullPage: true});
  }
  await page.setViewportSize({width: 375, height: 812});
  if (process.env.NPU_SCREENSHOTS) await page.screenshot({path: path.join(process.env.NPU_SCREENSHOTS, 'mobile.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: PON native/unknown/LOS display, CPU history/deltas/reboot/session restore, PPE partitions/paging/shrinking snapshots/precision/deferred polls, wired/Wi-Fi, topology, bounded cpufreq/PLL controls, PLL readback display, RPC failures, removed offload controls, aggregate polling and mobile layout');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
