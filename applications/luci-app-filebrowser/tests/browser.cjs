const fs = require('node:fs');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const path = require('node:path');
const base = path.resolve(__dirname, '../../..') + '/';
const output = process.env.FILEBROWSER_TEST_OUTPUT || path.join(__dirname, 'results');
fs.mkdirSync(output, {recursive: true});
const app = base + 'applications/luci-app-filebrowser/';
const source = fs.readFileSync(app + 'htdocs/luci-static/resources/view/system/filebrowser.js', 'utf8');

(async () => {
  const browser = await chromium.launch({args: ['--no-sandbox']});
  const page = await browser.newPage({viewport: {width: 1280, height: 800}});
  await page.route('http://filebrowser.test/**', route => {
    assets.add(route.request().url());
    return route.abort();
  });
  const errors = [];
  const assets = new Set();
  page.on('pageerror', error => errors.push(error.message));
  await page.setContent('<html><head></head><body style="color:#333;background:#f4f5f7;padding:20px;font-family:sans-serif"><main></main><div id="modal" hidden></div></body></html>');
  await page.addScriptTag({content: fs.readFileSync(base + 'modules/luci-base/htdocs/luci-static/resources/cbi.js', 'utf8')});
  await page.addScriptTag({content: fs.readFileSync(base + 'modules/luci-base/htdocs/luci-static/resources/luci.js', 'utf8')});
  await page.addStyleTag({content: fs.readFileSync(base + 'themes/luci-theme-argon/htdocs/luci-static/argon/css/cascade.css', 'utf8')});
  await page.evaluate(source => {
    window.L = Object.create(LuCI.prototype);
    L.env.cgi_base = '/cgi-bin';
    L.env.sessionid = 'test-session';
    L.env.resource = 'http://filebrowser.test/resources';
    window.E = L.dom.create.bind(L.dom);
    window._ = s => s;
    const files = new Map([
      ['/', [{name: 'tmp', type: 'directory', size: 0, mtime: 1700000000}, {name: 'etc', type: 'directory', size: 0, mtime: 1700000000},
        {name: '<img src=x onerror=alert(1)>.txt', type: 'file', size: 128, mtime: 1700000000}]],
      ['/tmp', [{name: 'same.txt', type: 'file', size: 3, mtime: 1700000000}, {name: 'folder.txt', type: 'directory', size: 0, mtime: 0}]],
      ['/etc', []]
    ]);
    window.mock = {files, calls: [], active: 0, maxActive: 0, failedOnce: false, delay: 25, listDelay: 0};
    const api = {
      list: async path => {
        await new Promise(r => setTimeout(r, mock.listDelay));
        if (path === '/denied') throw new Error('Permission denied');
        if (!files.has(path)) throw new Error('Not found');
        return files.get(path).map(e => ({...e}));
      },
      exec: async (command, args) => {
        mock.exec = [command, args];
        files.set(args[1], []);
        return {code: 0};
      },
      remove: async path => { mock.removed = path; },
      read_direct: async path => { mock.download = path; return new Blob(['contents']); }
    };
    const request = {post: async (url, data, options) => {
      mock.active++;
      mock.maxActive = Math.max(mock.maxActive, mock.active);
      const path = data.get('filename');
      const file = data.get('filedata');
      mock.calls.push({url, path, name: file.name, session: data.get('sessionid')});
      options.progress({loaded: 1, total: 2});
      await new Promise(r => setTimeout(r, mock.delay));
      mock.active--;
      if (file.name === 'fail.txt' && !mock.failedOnce) {
        mock.failedOnce = true;
        return {ok: true, json: () => ({failure: 1, message: 'Disk full'})};
      }
      const directory = path.substring(0, path.lastIndexOf('/')) || '/';
      const entries = files.get(directory);
      const entry = {name: file.name, size: file.size, type: 'file', mtime: 1700000000};
      const index = entries.findIndex(e => e.name === file.name);
      if (index < 0) entries.push(entry); else entries[index] = entry;
      return {ok: true, json: () => ({size: file.size})};
    }};
    const ui = {
      showModal: (title, children) => {
        const modal = document.getElementById('modal');
        modal.hidden = false;
        L.dom.content(modal, [E('h3', {}, [title]), ...children]);
      },
      hideModal: () => {document.getElementById('modal').hidden = true;},
      addNotification: (title, content) => { mock.notification = content.textContent; }
    };
    window.app = new Function('view', 'ui', 'fs', 'request', 'dom', source)({extend: o => o}, ui, api, request, L.dom);
    document.querySelector('main').appendChild(app.render());
  }, source);
  await page.waitForSelector('.fb-table');
  assert.equal(await page.locator('.fb-toolbar').getByRole('button', {name: 'Parent directory'}).count(), 0);
  assert.equal(await page.locator('.fb-table tbody tr').first().innerText(), '...');
  assert.equal(await page.locator('.fb-parent-link').getAttribute('aria-disabled'), 'true');
  assert.equal(await page.evaluate(() => {
    const reference = E('div', {class: 'cbi-map', hidden: ''}, E('h2', {name: 'content'}, ['Flash operations']));
    document.body.appendChild(reference);
    const actual = getComputedStyle(app.root.querySelector('h2'));
    const standard = getComputedStyle(reference.querySelector('h2'));
    const matches = ['paddingTop', 'paddingLeft', 'backgroundColor', 'fontSize', 'color'].every(property => actual[property] === standard[property]);
    reference.remove();
    return matches;
  }), true, 'title uses standard LuCI map heading styles');
  assert.equal(await page.locator('style#filebrowser-css').count(), 1, 'stylesheet is injected by JS');
  assert.equal(await page.locator('.fb-entry svg').first().getAttribute('fill'), 'currentColor', 'webd folder uses a filled shape');
  assert.equal(await page.locator('.fb-entry .fb-icon').first().evaluate(n => getComputedStyle(n).color), 'rgb(245, 166, 35)', 'webd folder color');
  assert.equal(await page.locator('.fb-entry svg').first().evaluate(n => n.namespaceURI), 'http://www.w3.org/2000/svg');
  const entrance = await page.evaluate(async () => {
    await app.loadDirectory('/');
    const row = document.querySelector('.fb-enter');
    const animations = row.getAnimations();
    const initial = getComputedStyle(row).opacity;
    await Promise.all(animations.map(animation => animation.finished));
    return {count: animations.length, duration: animations[0]?.effect.getTiming().duration, initial, final: getComputedStyle(row).opacity};
  });
  assert.equal(entrance.count, 1, 'directory rows animate on entry');
  assert.equal(entrance.duration, 150);
  assert.ok(Number(entrance.initial) < 1);
  assert.equal(entrance.final, '1');
  await page.emulateMedia({reducedMotion: 'reduce'});
  assert.equal(await page.evaluate(async () => {
    await app.loadDirectory('/');
    return document.querySelector('.fb-enter').getAnimations().length;
  }), 0, 'reduced motion disables entrance animation');
  await page.emulateMedia({reducedMotion: 'no-preference'});
  const refresh = page.getByRole('button', {name: 'Refresh', exact: true});
  await refresh.hover();
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.fb-button[data-tip="Refresh"]'), '::after').opacity === '1');
  await page.mouse.move(0, 0);
  await page.emulateMedia({colorScheme: 'dark'});
  assert.equal(await page.evaluate(() => app.root.dataset.fbTheme), 'light', 'forced light follows actual theme, not system preference');
  assert.equal(await page.locator('.fb-entry').first().innerText(), 'etc');
  assert.equal(await page.locator('.fb-entry img').count(), 0);
  await page.getByRole('searchbox').fill('onerror');
  assert.equal(await page.locator('.fb-entry').count(), 1);
  await page.getByRole('searchbox').fill('');
  await page.locator('.fb-entry').filter({hasText: /^tmp$/}).click();
  await page.waitForFunction(() => app.path === '/tmp' && !app.loading);
  await page.getByRole('searchbox').fill('no-such-file');
  assert.equal(await page.locator('.fb-table tbody tr').first().innerText(), '...');
  await page.locator('a.fb-parent-link').click();
  await page.waitForFunction(() => app.path === '/' && !app.loading);
  await page.locator('.fb-entry').filter({hasText: /^tmp$/}).click();
  await page.waitForFunction(() => app.path === '/tmp' && !app.loading);
  assert.equal(await page.locator('.fb-table tbody tr').filter({hasText: 'same.txt'}).locator('.fb-entry svg path').count(), 5, 'webd text file icon');
  assert.equal(await page.locator('input[type=file]').getAttribute('multiple'), '');
  await page.locator('input[type=file]').setInputFiles([
    {name: 'same.txt', mimeType: 'text/plain', buffer: Buffer.from('new')},
    {name: 'fail.txt', mimeType: 'text/plain', buffer: Buffer.from('failed')},
    {name: '中文.txt', mimeType: 'text/plain', buffer: Buffer.from('Chinese')},
    {name: 'empty.txt', mimeType: 'text/plain', buffer: Buffer.alloc(0)},
    {name: 'folder.txt', mimeType: 'text/plain', buffer: Buffer.from('blocked')}
  ]);
  await page.getByRole('button', {name: 'Overwrite', exact: true}).click();
  await page.waitForFunction(() => !app.running && app.tasks.length === 5 && !app.loading);
  assert.deepEqual(await page.evaluate(() => app.tasks.map(t => t.status)), ['done', 'error', 'done', 'done', 'error']);
  assert.equal(await page.evaluate(() => mock.maxActive), 1);
  assert.equal(await page.evaluate(() => mock.calls.every(c => c.path.startsWith('/tmp/') && c.session === 'test-session')), true);
  await page.locator('[data-task="2"]').getByRole('button', {name: 'Retry', exact: true}).click();
  await page.waitForFunction(() => !app.running && app.tasks[1].status === 'done' && !app.loading);
  assert.equal(await page.locator('[data-task="5"] .fb-task-status').innerText(), 'The destination exists and is not a regular file');

  // A running upload stays in /tmp while browsing /etc. New tasks capture /etc.
  await page.evaluate(() => {mock.delay = 120; app.enqueue([new File(['x'], 'captured.txt')]);});
  await page.evaluate(() => app.loadDirectory('/etc'));
  await page.evaluate(() => app.enqueue([new File(['x'], 'other.txt')]));
  await page.waitForFunction(() => !app.running && !app.loading);
  assert.deepEqual(await page.evaluate(() => mock.calls.slice(-2).map(c => c.path)), ['/tmp/captured.txt', '/etc/other.txt']);
  assert.equal(await page.evaluate(() => app.path), '/etc');

  // Stop pending uploads; the request already running is allowed to finish.
  await page.evaluate(() => app.enqueue([new File(['x'], 'first.txt'), new File(['x'], 'second.txt')]));
  await page.getByRole('button', {name: 'Stop queued uploads', exact: true}).click();
  await page.waitForFunction(() => !app.running && !app.loading);
  assert.deepEqual(await page.evaluate(() => app.tasks.slice(-2).map(t => t.status)), ['done', 'skipped']);

  // Conflict policy, including same-name duplicates within one selection.
  await page.evaluate(() => app.enqueue([new File(['x'], 'other.txt'), new File(['x'], 'other.txt')]));
  await page.getByRole('button', {name: 'Skip all', exact: true}).click();
  await page.waitForFunction(() => !app.running);
  assert.deepEqual(await page.evaluate(() => app.tasks.slice(-2).map(t => t.status)), ['skipped', 'skipped']);

  await page.getByRole('button', {name: 'Create directory', exact: true}).click();
  await page.getByRole('textbox', {name: 'Directory name'}).fill('-safe name');
  await page.getByRole('button', {name: 'Create', exact: true}).click();
  await page.waitForFunction(() => mock.exec);
  assert.deepEqual(await page.evaluate(() => mock.exec), ['/bin/mkdir', ['--', '/etc/-safe name']]);

  // Out-of-order directory replies must not replace the most recent navigation.
  await page.evaluate(async () => {mock.listDelay = 50; const old = app.loadDirectory('/tmp'); const latest = app.loadDirectory('/'); await Promise.all([old, latest]); mock.listDelay = 0;});
  assert.equal(await page.evaluate(() => app.path), '/');
  await page.evaluate(() => app.loadDirectory('/denied'));
  assert.match(await page.locator('.fb-list').innerText(), /Permission denied/);
  await page.evaluate(() => app.loadDirectory('/tmp'));
  await page.getByRole('button', {name: 'Size', exact: true}).click();
  assert.equal(await page.locator('th.fb-size').getAttribute('aria-sort'), 'ascending');
  assert.equal(await page.locator('.fb-entry').nth(1).innerText(), 'empty.txt');
  await page.locator('th.fb-name button').click();
  await page.locator('.fb-table tbody tr').filter({hasText: 'same.txt'}).getByRole('button', {name: 'Download', exact: true}).click();
  await page.waitForFunction(() => mock.download === '/tmp/same.txt');
  await page.locator('.fb-table tbody tr').filter({hasText: 'same.txt'}).getByRole('button', {name: 'Delete', exact: true}).click();
  await page.locator('#modal').getByRole('button', {name: 'Cancel', exact: true}).click();
  assert.equal(await page.evaluate(() => mock.removed), undefined);
  await page.locator('.fb-table tbody tr').filter({hasText: 'same.txt'}).getByRole('button', {name: 'Delete', exact: true}).click();
  await page.locator('#modal').getByRole('button', {name: 'Delete', exact: true}).click();
  await page.waitForFunction(() => mock.removed === '/tmp/same.txt' && !app.loading);
  await page.evaluate(async () => {
    ['photo.PNG', 'backup.tar.gz', 'config.json', 'guide.pdf', 'notes.docx', 'music.mp3', 'video.mp4', 'package.rpm'].forEach(name => mock.files.get('/tmp').push({name, type: 'file', size: 1024, mtime: 1700000000}));
    await app.loadDirectory('/tmp');
  });
  assert.equal(await page.locator('.fb-table tbody tr').filter({hasText: 'photo.PNG'}).locator('.fb-entry .fb-icon').evaluate(n => getComputedStyle(n).color), 'rgb(67, 184, 156)', 'webd image color and uppercase extension');
  assert.equal(await page.locator('.fb-table tbody tr').filter({hasText: 'photo.PNG'}).locator('svg rect').count(), 1, 'webd image shape');
  await page.screenshot({path: path.join(output, 'desktop-light.png'), fullPage: true});

  await page.evaluate(() => {document.body.style.color = '#ccc'; document.body.style.background = '#1e1e1e';});
  await page.addStyleTag({content: fs.readFileSync(base + 'themes/luci-theme-argon/htdocs/luci-static/argon/css/dark.css', 'utf8')});
  await page.waitForFunction(() => app.root.dataset.fbTheme === 'dark');
  await page.waitForFunction(() => getComputedStyle(document.querySelector('.fb-table td')).backgroundColor === 'rgb(39, 41, 44)');
  assert.equal(await page.locator('.luci-app-filebrowser > h2').evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(51, 51, 51)', 'title follows Argon dark heading styles');
  assert.equal(await page.locator('.fb-table td').first().evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(39, 41, 44)');
  await page.screenshot({path: path.join(output, 'desktop-dark.png'), fullPage: true});
  for (const width of [375, 320]) {
    await page.setViewportSize({width, height: 812});
    await page.waitForFunction(() => document.querySelector('.fb-parent-row td').colSpan === 3);
    await page.screenshot({path: path.join(output, 'mobile-' + width + '.png'), fullPage: true});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'mobile page overflow');
    assert.equal(await page.locator('.fb-mtime').first().isVisible(), false);
    assert.ok(await page.locator('.fb-name').first().evaluate(n => n.getBoundingClientRect().width) > 100, 'parent row does not create an extra mobile column');
  }
  assert.deepEqual(errors, []);
  assert.equal(assets.size, 0, 'CSS and SVG require no external resources');
  console.log('PASS: real LuCI DOM, directory navigation/search, filename text escaping, multi-file serial uploads, conflicts, retry, zero-byte/Chinese files, target capture, stop, mkdir, request races, light/dark and mobile layouts.');
  await browser.close();
})().catch(err => {console.error(err); process.exit(1);});
