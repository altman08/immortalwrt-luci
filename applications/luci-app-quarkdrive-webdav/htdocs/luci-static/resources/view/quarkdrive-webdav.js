'use strict';
'require form';
'require poll';
'require rpc';
'require uci';
'require view';

const callServiceList = rpc.declare({
	object: 'service',
	method: 'list',
	params: ['name'],
	expect: { '': {} }
});

function getServiceStatus() {
	return L.resolveDefault(callServiceList('quarkdrive-webdav'), {}).then(function(res) {
		try {
			return res['quarkdrive-webdav'].instances['quarkdrive-webdav'].running;
		} catch (e) {
			return false;
		}
	});
}

function renderStatus(isRunning, port) {
	const template = '<em><span style="color:%s"><strong>%s %s</strong></span></em>';
	if (!isRunning)
		return template.format('red', _('QuarkDrive WebDAV'), _('NOT RUNNING'));

	const url = '//%s:%s/'.format(window.location.hostname, port);
	const button = String.format('&#160;<a class="btn cbi-button" href="%s" target="_blank" rel="noreferrer noopener">%s</a>',
		url, _('Open WebDAV Server'));
	return template.format('green', _('QuarkDrive WebDAV'), _('RUNNING')) + button;
}

return view.extend({
	load() {
		return uci.load('quarkdrive-webdav');
	},

	render() {
		const port = uci.get('quarkdrive-webdav', 'config', 'port') || '8080';
		let m, s, o;

		m = new form.Map('quarkdrive-webdav', _('QuarkDrive WebDAV'),
			_('Expose files in your QuarkDrive as a WebDAV server. A valid QuarkDrive cookie is required.'));

		s = m.section(form.TypedSection);
		s.anonymous = true;
		s.render = function() {
			poll.add(function() {
				return getServiceStatus().then(function(isRunning) {
					const status = document.getElementById('service_status');
					if (status)
						status.innerHTML = renderStatus(isRunning, port);
				});
			});

			return E('div', { class: 'cbi-section', id: 'status_bar' }, [
				E('p', { id: 'service_status' }, _('Collecting data…'))
			]);
		};

		s = m.section(form.NamedSection, 'config', 'quarkdrive_webdav');

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = o.disabled;
		o.rmempty = false;

		o = s.option(form.Value, 'quark_cookie', _('QuarkDrive Cookie'));
		o.password = true;
		o.rmempty = false;
		o.description = _('Copy the complete cookie from a logged-in QuarkDrive browser session.');

		o = s.option(form.Value, 'auth_user', _('WebDAV username'));
		o.description = _('Leave both username and password empty to disable WebDAV authentication.');
		o.validate = function(sectionId, value) {
			const password = this.map.lookupOption('auth_password', sectionId)[0].formvalue(sectionId);
			if ((value && !password) || (!value && password))
				return _('WebDAV username and password must be specified together.');
			return true;
		};

		o = s.option(form.Value, 'auth_password', _('WebDAV password'));
		o.password = true;
		o.depends('auth_user', /.+/);
		o.validate = function(sectionId, value) {
			const username = this.map.lookupOption('auth_user', sectionId)[0].formvalue(sectionId);
			if ((username && !value) || (!username && value))
				return _('WebDAV username and password must be specified together.');
			return true;
		};

		o = s.option(form.Value, 'host', _('Listen address'));
		o.datatype = 'ipaddr';
		o.placeholder = '0.0.0.0';

		o = s.option(form.Value, 'port', _('Listen port'));
		o.datatype = 'port';
		o.placeholder = '8080';

		o = s.option(form.Value, 'root', _('Root directory'));
		o.placeholder = '/';

		o = s.option(form.Flag, 'read_only', _('Read-only mode'));
		o.description = _('Prevent uploads, changes, and deletions through WebDAV.');

		o = s.option(form.Flag, 'auto_index', _('Generate directory index'));
		o.description = _('Enable directory listings for browser requests.');

		o = s.option(form.Flag, 'no_trash', _('Delete permanently'));
		o.description = _('Delete files permanently instead of moving them to the trash.');

		o = s.option(form.Value, 'read_buffer_size', _('Download buffer size'));
		o.datatype = 'uinteger';
		o.placeholder = '10485760';
		o.description = _('Buffer size in bytes used for reading and downloading files.');

		o = s.option(form.Value, 'upload_buffer_size', _('Upload buffer size'));
		o.datatype = 'uinteger';
		o.placeholder = '16777216';
		o.description = _('Buffer size in bytes used for uploads.');

		o = s.option(form.Value, 'cache_size', _('Directory cache size'));
		o.datatype = 'uinteger';
		o.placeholder = '1000';

		o = s.option(form.Value, 'cache_ttl', _('Directory cache TTL'));
		o.datatype = 'uinteger';
		o.placeholder = '600';
		o.description = _('Directory cache expiration time in seconds.');

		o = s.option(form.Value, 'refresh_cache_secs_interval', _('Cache refresh interval'));
		o.datatype = 'uinteger';
		o.placeholder = '300';
		o.description = _('Clear the directory cache periodically.');

		o = s.option(form.Value, 'upload_wait_timeout', _('Upload completion timeout'));
		o.datatype = 'uinteger';
		o.placeholder = '280';
		o.description = _('Maximum seconds to wait for an upload before returning success; set to 0 to wait indefinitely.');

		o = s.option(form.Value, 'strip_prefix', _('URL prefix to strip'));
		o.description = _('Remove this prefix from incoming request paths.');

		o = s.option(form.Value, 'tls_cert', _('TLS certificate file'));
		o.description = _('Both certificate and private key must be configured to enable HTTPS.');
		o.validate = function(sectionId, value) {
			const key = this.map.lookupOption('tls_key', sectionId)[0].formvalue(sectionId);
			if ((value && !key) || (!value && key))
				return _('TLS certificate and private key must be specified together.');
			return true;
		};

		o = s.option(form.Value, 'tls_key', _('TLS private key file'));
		o.depends('tls_cert', /.+/);
		o.validate = function(sectionId, value) {
			const cert = this.map.lookupOption('tls_cert', sectionId)[0].formvalue(sectionId);
			if ((cert && !value) || (!cert && value))
				return _('TLS certificate and private key must be specified together.');
			return true;
		};

		o = s.option(form.Flag, 'skip_upload_same_size', _('Skip same-size uploads'));
		o.description = _('Do not upload a file when a same-size file already exists.');

		o = s.option(form.Flag, 'prefer_http_download', _('Prefer HTTP downloads'));

		o = s.option(form.Flag, 'redirect', _('Enable redirects when possible'));

		o = s.option(form.Flag, 'debug', _('Enable debug logging'));

		o = s.option(form.Flag, 'no_self_upgrade', _('Disable self upgrade'));
		o.default = o.enabled;
		o.description = _('Prevent the service from attempting to update itself.');

		return m.render();
	}
});
