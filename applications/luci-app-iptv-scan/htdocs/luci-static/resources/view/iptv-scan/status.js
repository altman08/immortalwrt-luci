'use strict';
'require view';
'require rpc';
'require ui';
'require poll';

const callStatus = rpc.declare({
	object: 'luci.iptv-scan',
	method: 'status',
	expect: {}
});

const callStart = rpc.declare({
	object: 'luci.iptv-scan',
	method: 'start',
	expect: {}
});

return view.extend({
	load() {
		return callStatus();
	},

	render(status) {
		const self = this;
		const badge = E('span', {
			id: 'iptv-scan-status',
			class: 'label ' + (status.running ? 'success' : 'notice')
		}, status.running ? _('Running') : _('Idle'));
		const log = E('pre', {
			id: 'iptv-scan-log',
			style: 'max-height: 32em; overflow: auto; padding: 1em; background: var(--background-color-high, #f5f5f5); white-space: pre-wrap;'
		}, status.log || _('No scan log is available yet.'));
		const start = E('button', {
			class: 'btn cbi-button cbi-button-apply',
			id: 'iptv-scan-start',
			disabled: status.running,
			click: ui.createHandlerFn(this, function() {
				start.disabled = true;
				return callStart().then(function(result) {
					if (result.error)
						ui.addNotification(null, E('p', {}, result.error), 'error');
					else
						ui.addNotification(null, E('p', {}, _('The IPTV multicast scan has started.')), 'info');
					return self.update();
				}).catch(function(error) {
					start.disabled = false;
					ui.addNotification(null, E('p', {}, _('Unable to start scan: ') + error.message), 'error');
				});
			})
		}, _('Start scan'));

		poll.add(function() {
			return self.update();
		}, 2);

		return E('div', { class: 'cbi-map' }, [
			E('h2', {}, _('IPTV Multicast Scan Task')),
			E('div', { class: 'cbi-section' }, [
				E('div', { style: 'display:flex; gap:1em; align-items:center; flex-wrap:wrap;' }, [
					E('strong', {}, _('Status') + ':'),
					badge,
					start,
					E('a', { class: 'btn cbi-button', href: L.url('admin/services/iptv-scan/settings') }, _('Scan settings'))
				]),
				E('p', { id: 'iptv-scan-output', style: 'margin-top: 1em;' }, this.outputText(status))
			]),
			E('div', { class: 'cbi-section' }, [
				E('h3', {}, _('Scan log')),
				log
			])
		]);
	},

	outputText(status) {
		const links = [];
		if (status.m3u_available)
			links.push(E('a', { href: '/iptv.m3u', target: '_blank', rel: 'noopener' }, _('Open M3U playlist')));
		if (status.txt_available)
			links.push(E('a', { href: '/iptv.txt', target: '_blank', rel: 'noopener' }, _('Open TXT playlist')));
		return links.length ? [ _('Generated playlist:'), ' ', ...links.flatMap(function(link, index) { return index ? [' | ', link] : [link]; }) ] : _('No playlist has been generated yet.');
	},

	update() {
		return callStatus().then(L.bind(function(status) {
			const badge = document.getElementById('iptv-scan-status');
			const start = document.getElementById('iptv-scan-start');
			const log = document.getElementById('iptv-scan-log');
			const output = document.getElementById('iptv-scan-output');
			if (badge) {
				badge.textContent = status.running ? _('Running') : _('Idle');
				badge.className = 'label ' + (status.running ? 'success' : 'notice');
			}
			if (start)
				start.disabled = !!status.running;
			if (log) {
				log.textContent = status.log || _('No scan log is available yet.');
				log.scrollTop = log.scrollHeight;
			}
			if (output) {
				output.replaceChildren(...(Array.isArray(this.outputText(status)) ? this.outputText(status) : [this.outputText(status)]));
			}
		}));
	}
});
