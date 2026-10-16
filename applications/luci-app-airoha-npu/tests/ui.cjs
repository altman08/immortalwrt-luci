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
     cpu_avail_governors: 'ondemand performance schedutil', cpu_avail_freqs: '400000 500000 1200000 1400000 1600000', cpu_temp: 42},
    ppe: {available: true, total: 3, bound: 2, ipv4: 1, ipv6: 1, l2b: 1,
     entries: [{index: '00001', state: 'BND', type: 'IPv4', packets: '9007199254740993', bytes: '18446744073709551615'}]},
    topology: {has_wifi: false, ports: [
     {kind: 'gdm', gdm: 3, reg: 0, split: true, netdev: 'lan5', role: 'lan', mode: 'usxgmii', carrier: '1', speed: '10000', rx_bytes: '9007199254740993'},
     {kind: 'gdm', gdm: 3, reg: 1, split: true, netdev: 'lan6', role: 'lan', mode: 'usxgmii', carrier: '0'}]},
    token: {has_wifi: false, station_counts: [], tx_queues: []},
    frame_engine: {gdm3: {tx: 100, rx: 200}, cdm1: {}, cdm2: {}, pse_used: 5, pse_free: 100,
     pse_ports: [{port: 0, iq: 1, oq: 2, drops: 0}, {port: 7, iq: 0, oq: 0, drops: 0}]},
    flow_offload: {enabled: 0}, vlan_offload: {supported: false, enabled: 0},
    pppoe_offload: {supported: true, enabled: 0}, apmode_offload: {supported: true, enabled: 0},
    device_mode: {bridge_offload_blocked: false}
   };
   window.calls = []; window.notifications = []; window.fail = false;
   const rpc = {declare: declaration => (...args) => {
    calls.push([declaration.method, ...args]);
    if (declaration.method === 'getDashboard') return Promise.resolve(structuredClone(data));
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
  assert.equal(await page.locator('#airoha-npu-offload-vlan').isDisabled(), true);

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

  await page.evaluate(async () => {
   data.vlan_offload.supported = true;
   data.device_mode.bridge_offload_blocked = true;
   await pollNpu();
  });
  assert.equal(await page.locator('#airoha-npu-offload-vlan').isDisabled(), false);
  assert.equal(await page.locator('#airoha-npu-offload-pppoe option[value="1"]').isDisabled(), true);
  assert((await page.locator('#airoha-npu-offload-hint-vlan').textContent()).includes('Routed WAN'));
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

  if (process.env.NPU_SCREENSHOTS) {
   fs.mkdirSync(process.env.NPU_SCREENSHOTS, {recursive: true});
   await page.screenshot({path: path.join(process.env.NPU_SCREENSHOTS, 'desktop.png'), fullPage: true});
  }
  await page.setViewportSize({width: 375, height: 812});
  if (process.env.NPU_SCREENSHOTS) await page.screenshot({path: path.join(process.env.NPU_SCREENSHOTS, 'mobile.png'), fullPage: true});
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  assert.deepEqual(errors, []);
  console.log('PASS: wired/Wi-Fi, topology, bounded cpufreq/PLL controls, PLL readback display, RPC failures, router guards, aggregate polling and mobile layout');
 } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exit(1); });
