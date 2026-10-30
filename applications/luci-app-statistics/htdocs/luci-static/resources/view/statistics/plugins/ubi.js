/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';
'require fs';
'require form';

return baseclass.extend({
	title: _('UBI Plugin Configuration'),
	description: _('The UBI plugin monitors bad blocks and maximum erase counts on NAND flash devices.'),

	addFormOptions(s) {
		let o;

		o = s.option(form.Flag, 'enable', _('Enable this plugin'));

		o = s.option(form.DynamicList, 'Device', _('UBI devices'),
			_('Use device names such as ubi0 or regular expressions. The default expression selects all UBI devices, excluding volumes.'));
		o.default = '/^ubi[0-9]+$/';
		o.depends('enable', '1');
		o.load = function(section_id) {
			return L.resolveDefault(fs.list('/sys/class/ubi'), []).then(L.bind(function(entries) {
				for (let entry of entries) {
					if (/^ubi[0-9]+$/.test(entry.name))
						this.value(entry.name);
				}

				return this.super('load', [section_id]);
			}, this));
		};

		o = s.option(form.Flag, 'IgnoreSelected', _('Monitor all except specified'));
		o.default = '0';
		o.depends('enable', '1');
	},

	configSummary(section) {
		return _('UBI monitoring enabled');
	}
});
