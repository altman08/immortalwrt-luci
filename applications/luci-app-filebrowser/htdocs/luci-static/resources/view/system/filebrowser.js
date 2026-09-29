'use strict';
'require view';
'require ui';
'require form';

var formData = {
	files: {
		root: null,
	}
};

/*
 * FileUpload is a standard LuCI widget. Some third-party themes do not style
 * its .cbi-filebrowser markup, so keep the layout local to this view instead
 * of relying on the active theme to provide it.
 */
const fileBrowserStyles = `
.luci-app-filebrowser {
	max-width: 100%;
}

.luci-app-filebrowser .cbi-filebrowser {
	min-width: 0;
	max-width: 100%;
	margin-top: .75rem;
	border: 1px solid var(--lighter, #e9ecef);
	border-radius: .5rem;
	background: var(--white, #fff);
	box-shadow: 0 2px 6px rgb(0 0 0 / 6%);
}

.luci-app-filebrowser .cbi-filebrowser.open {
	display: flex;
	flex-direction: column;
	opacity: 1;
	height: auto;
	overflow: hidden;
}

.luci-app-filebrowser .cbi-filebrowser > * {
	max-width: 100%;
	margin: 0;
	padding: .75rem 1rem;
	border-bottom: 1px solid var(--lighter, #e9ecef);
}

.luci-app-filebrowser .cbi-filebrowser > :last-child {
	border-bottom: 0;
}

.luci-app-filebrowser .cbi-filebrowser > p {
	color: var(--gray, #6c757d);
	white-space: normal;
	overflow-wrap: anywhere;
}

.luci-app-filebrowser .cbi-filebrowser > ul {
	max-height: min(65vh, 42rem);
	margin: 0;
	padding: .25rem;
	overflow: auto;
	list-style: none;
}

.luci-app-filebrowser .cbi-filebrowser > ul > li {
	display: grid;
	grid-template-columns: minmax(0, 1fr) auto auto;
	gap: .75rem;
	align-items: center;
	min-height: 2.75rem;
	padding: .5rem .75rem;
	border-radius: .375rem;
}

.luci-app-filebrowser .cbi-filebrowser > ul > li:hover {
	background: var(--lighter, #f5f5f5);
}

.luci-app-filebrowser .cbi-filebrowser .name {
	display: flex;
	align-items: center;
	gap: .5rem;
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
}

.luci-app-filebrowser .cbi-filebrowser .name img.middle {
	box-sizing: content-box;
	width: 1.25rem;
	height: 1.25rem;
	padding: .25rem;
	flex: 0 0 auto;
	border-radius: .375rem;
	background: #eef0ff;
	box-shadow: inset 0 0 0 1px rgb(94 114 228 / 12%);
	vertical-align: middle;
}

.luci-app-filebrowser .cbi-filebrowser .name img[src$="folder.svg"] {
	background: #fff4d6;
	box-shadow: inset 0 0 0 1px rgb(251 153 0 / 18%);
}

.luci-app-filebrowser .cbi-filebrowser .name img[src$="link.svg"] {
	background: #ddf8f3;
	box-shadow: inset 0 0 0 1px rgb(17 205 239 / 22%);
}

.luci-app-filebrowser .cbi-filebrowser .name a {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
	text-decoration: none;
}

.luci-app-filebrowser .cbi-filebrowser .mtime {
	color: var(--gray, #6c757d);
	font-size: .8125rem;
	white-space: nowrap;
}

.luci-app-filebrowser .cbi-filebrowser > ul > li > div:last-child,
.luci-app-filebrowser .cbi-filebrowser .upload {
	display: flex;
	flex-wrap: wrap;
	gap: .5rem;
	align-items: center;
}

.luci-app-filebrowser .cbi-filebrowser .btn {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	min-height: 2rem;
	padding: .375rem .75rem;
	border: 1px solid var(--primary, #5e72e4);
	border-radius: .375rem;
	background: var(--primary, #5e72e4);
	color: #fff;
	font-size: .8125rem;
	line-height: 1.2;
	text-decoration: none;
	white-space: nowrap;
	cursor: pointer;
}

.luci-app-filebrowser .cbi-filebrowser .btn:hover:not(:disabled) {
	filter: brightness(.94);
}

.luci-app-filebrowser .cbi-filebrowser .btn:disabled {
	opacity: .55;
	cursor: not-allowed;
}

.luci-app-filebrowser .cbi-filebrowser .cbi-button-positive {
	border-color: var(--success, #2dce89);
	background: var(--success, #2dce89);
}

.luci-app-filebrowser .cbi-filebrowser .cbi-button-negative {
	border-color: var(--danger, #f5365c);
	background: var(--danger, #f5365c);
}

.luci-app-filebrowser .cbi-filebrowser .upload {
	padding: .75rem 1rem;
	border-top: 1px solid var(--lighter, #e9ecef);
}

.luci-app-filebrowser .cbi-filebrowser .upload > div {
	flex: 1 1 12rem;
}

.luci-app-filebrowser .cbi-filebrowser .upload input[type="text"] {
	width: 100%;
	min-height: 2rem;
	padding: .375rem .625rem;
	border: 1px solid var(--lighter, #ced4da);
	border-radius: .375rem;
	background: var(--white, #fff);
	color: inherit;
}

@media (max-width: 700px) {
	.luci-app-filebrowser .cbi-filebrowser > ul > li {
		grid-template-columns: minmax(0, 1fr) auto;
		gap: .5rem;
	}

	.luci-app-filebrowser .cbi-filebrowser .mtime {
		display: none;
	}

	.luci-app-filebrowser .cbi-filebrowser > ul > li > div:last-child {
		grid-column: 1 / -1;
	}
}
`;

function ensureFileBrowserStyles() {
	if (document.getElementById('luci-app-filebrowser-styles'))
		return;

	document.head.appendChild(E('style', {
		'id': 'luci-app-filebrowser-styles',
		'type': 'text/css'
	}, [ fileBrowserStyles ]));
}

return view.extend({
	render: function() {
		let m, s, o;

		ensureFileBrowserStyles();

		m = new form.JSONMap(formData, _('File Browser'), '');

		s = m.section(form.NamedSection, 'files', 'files');

		o = s.option(form.FileUpload, 'root', '');
		o.root_directory = '/';
		o.browser = true;
		o.show_hidden = true;
		o.enable_upload = true;
		o.enable_remove = true;
		o.enable_download = true;

		return m.render().then((content) => {
			return E('div', { 'class': 'luci-app-filebrowser' }, [ content ]);
		});
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
})
