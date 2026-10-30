/* Licensed to the public under the Apache License 2.0. */

'use strict';
'require baseclass';

return baseclass.extend({
	title: _('UBI'),

	rrdargs(graph, host, plugin, plugin_instance, dtype) {
		const types = graph.dataTypes(host, plugin, plugin_instance);
		const metrics = [
			{
				type: 'bad_peb_count',
				title: '%H: UBI %di - Bad blocks',
				vlabel: 'Blocks',
				legend: 'Bad blocks',
				format: '%5.0lf',
				color: 'ff0000'
			},
			{
				type: 'max_ec',
				title: '%H: UBI %di - Maximum erase count',
				vlabel: 'Erase cycles',
				legend: 'Maximum erase count',
				format: '%5.0lf',
				color: '0000ff'
			},
			{
				type: 'percent',
				title: '%H: UBI %di - Bad blocks / reserved blocks',
				vlabel: 'Percent',
				legend: 'Bad blocks / reserved blocks',
				format: '%5.1lf%%',
				color: 'ff9900'
			}
		];

		return metrics.filter(function(metric) {
			return types.indexOf(metric.type) > -1;
		}).map(function(metric) {
			return {
				per_instance: true,
				title: metric.title,
				vlabel: metric.vlabel,
				number_format: metric.format,
				y_min: '0',
				alt_autoscale_max: true,
				data: {
					types: [ metric.type ],
					options: {
						[metric.type]: {
							title: metric.legend,
							color: metric.color,
							noarea: true
						}
					}
				}
			};
		});
	}
});
