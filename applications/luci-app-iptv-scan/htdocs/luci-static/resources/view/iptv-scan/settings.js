'use strict';
'require view';
'require form';
'require uci';
'require rpc';

const callInterfaces = rpc.declare({
	object: 'luci.iptv-scan',
	method: 'interfaces',
	expect: { interfaces: [] }
});

return view.extend({
	load() {
		return Promise.all([
			uci.load('iptv-scan'),
			callInterfaces()
		]);
	},

	render(data) {
		const interfaces = data[1].interfaces || [];
		let m, s, o;

		m = new form.Map('iptv-scan', _('IPTV Multicast Scanner'),
			_('Detect IPTV multicast streams available on a selected network interface and create player playlists.'));

		s = m.section(form.NamedSection, 'main', 'settings', _('Basic Settings'));
		s.anonymous = true;

		o = s.option(form.ListValue, 'interface', _('Scan interface'),
			_('Select the logical interface that receives the IPTV network, such as wan or iptv.'));
		o.rmempty = false;
		interfaces.forEach(function(name) {
			o.value(name);
		});
		const current = uci.get('iptv-scan', 'main', 'interface');
		if (current && !interfaces.includes(current))
			o.value(current, '%s (%s)'.format(current, _('current value')));

		o = s.option(form.Value, 'timeout', _('Receive timeout'),
			_('Seconds to wait for each multicast stream. A larger value improves detection reliability but makes scanning slower.'));
		o.datatype = 'range(0.1,10)';
		o.placeholder = '0.5';
		o.rmempty = false;

		o = s.option(form.ListValue, 'url_scheme', _('Playlist protocol'),
			_('Protocol prefix written to generated playlist addresses.'));
		o.value('rtp', 'rtp://');
		o.value('udp', 'udp://');
		o.default = 'rtp';
		o.rmempty = false;

		s = m.section(form.NamedSection, 'main', 'settings', _('Scan Ranges'));
		s.anonymous = true;
		o = s.option(form.DynamicList, 'ranges', _('Multicast ranges'),
			_('One range per line. Use a three-octet multicast prefix followed by a port, for example 239.81.0.:4056. Each range scans addresses 1 through 255.'));
		o.rmempty = false;
		o.datatype = 'list(string)';

		s = m.section(form.NamedSection, 'main', 'settings', _('Files and Metadata'));
		s.anonymous = true;

		o = s.option(form.Value, 'channel_map_file', _('Channel mapping file'),
			_('Optional name mapping file. Each non-comment line uses the format: Channel name,239.1.2.3:1234.'));
		o.default = '/etc/iptv-scan/channels.txt';
		o.rmempty = false;

		o = s.option(form.Value, 'output_m3u', _('M3U output file'),
			_('Generated M3U playlist path. The default location is available through the router web server.'));
		o.default = '/www/iptv.m3u';
		o.rmempty = false;

		o = s.option(form.Value, 'output_txt', _('TXT output file'),
			_('Generated TXT playlist path.'));
		o.default = '/www/iptv.txt';
		o.rmempty = false;

		o = s.option(form.Value, 'epg_url', _('EPG URL'),
			_('Optional XMLTV EPG URL written into the M3U header.'));
		o.datatype = 'or(uciname,string)';
		o.rmempty = true;

		o = s.option(form.Value, 'logo_base', _('Channel logo base URL'),
			_('Optional base URL for channel logos. The scanner appends the channel name and .png suffix.'));
		o.rmempty = true;

		return m.render();
	}
});
