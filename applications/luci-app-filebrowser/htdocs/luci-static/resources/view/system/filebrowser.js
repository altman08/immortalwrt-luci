'use strict';
'require view';
'require ui';
'require fs';
'require request';
'require dom';

// File type and toolbar SVGs adapted from webd/web/src/components/Icon.tsx.
// Controls not present in webd retain Lucide SVGs under the following license.
/*
ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted, provided that the above
copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

---

The following Lucide icons are derived from the Feather project:

airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out

The MIT License (MIT) (for the icons listed above)

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
const fileBrowserIcons = {
	"folder": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"currentColor\"><path d=\"M9 3a1 1 0 0 1 .608.206l.1.087L12.414 6H19a3 3 0 0 1 2.995 2.824L22 9v8a3 3 0 0 1-2.824 2.995L19 20H5a3 3 0 0 1-2.995-2.824L2 17V6a3 3 0 0 1 2.824-2.995L5 3h4z\"></path></svg>",
	"file": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z\"></path></svg>",
	"txt": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z\"></path><path d=\"M9 9h1\"></path><path d=\"M9 13h6\"></path><path d=\"M9 17h6\"></path></svg>",
	"img": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><circle cx=\"8.5\" cy=\"8.5\" r=\"1.5\"></circle><path d=\"M21 15l-5-5L5 21\"></path></svg>",
	"zip": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z\"></path><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"17\"></line><polyline points=\"9 14 12 17 15 14\"></polyline></svg>",
	"pdf": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M5 12V5a2 2 0 0 1 2-2h7l5 5v4\"></path><path d=\"M5 18h1.5a1.5 1.5 0 0 0 0-3H5v6\"></path><path d=\"M17 18h2\"></path><path d=\"M20 15h-3v6\"></path><path d=\"M11 15v6h1a2 2 0 0 0 2-2v-2a2 2 0 0 0-2-2h-1z\"></path></svg>",
	"doc": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2z\"></path><path d=\"M9 9h6\"></path><path d=\"M9 13h6\"></path><path d=\"M9 17h4\"></path></svg>",
	"mp3": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M9 18V5l12-2v13\"></path><circle cx=\"6\" cy=\"18\" r=\"3\"></circle><circle cx=\"18\" cy=\"16\" r=\"3\"></circle></svg>",
	"mp4": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"2\" y=\"3\" width=\"20\" height=\"14\" rx=\"2\"></rect><path d=\"M8 21h8\"></path><path d=\"M12 17v4\"></path><polygon points=\"10 8 16 11 10 14 10 8\"></polygon></svg>",
	"code": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M14 3v4a1 1 0 0 0 1 1h4\"></path><path d=\"M5 12V5a2 2 0 0 1 2-2h7l5 5v4\"></path><path d=\"M5 15l2 2-2 2\"></path><path d=\"M9 21h6\"></path><path d=\"M19 15l-2 2 2 2\"></path></svg>",
	"exe": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"20\" height=\"20\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><rect x=\"3\" y=\"3\" width=\"18\" height=\"18\" rx=\"2\"></rect><path d=\"M9 9h.01\"></path><path d=\"M15 9h.01\"></path><path d=\"M9 15h6\"></path></svg>",
	"search": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"M21 21l-4.35-4.35\"></path></svg>",
	"upload": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\"></path><polyline points=\"17 8 12 3 7 8\"></polyline><line x1=\"12\" y1=\"3\" x2=\"12\" y2=\"15\"></line></svg>",
	"newfolder": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><path d=\"M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z\"></path><line x1=\"12\" y1=\"11\" x2=\"12\" y2=\"17\"></line><line x1=\"9\" y1=\"14\" x2=\"15\" y2=\"14\"></line></svg>",
	"delete": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"15\" height=\"15\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\"><polyline points=\"3 6 5 6 21 6\"></polyline><path d=\"M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6\"></path><path d=\"M10 11v6\"></path><path d=\"M14 11v6\"></path><path d=\"M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2\"></path></svg>",
	"close": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"14\" height=\"14\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\"><line x1=\"18\" y1=\"6\" x2=\"6\" y2=\"18\"></line><line x1=\"6\" y1=\"6\" x2=\"18\" y2=\"18\"></line></svg>",
	"download": "<!-- @license lucide-static v1.56.0 - ISC -->\n<svg\n  class=\"lucide lucide-download\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M12 15V3\" />\n  <path d=\"M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4\" />\n  <path d=\"m7 10 5 5 5-5\" />\n</svg>\n",
	"refresh": "<!-- @license lucide-static v1.56.0 - ISC -->\n<svg\n  class=\"lucide lucide-refresh-cw\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8\" />\n  <path d=\"M21 3v5h-5\" />\n  <path d=\"M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16\" />\n  <path d=\"M8 16H3v5\" />\n</svg>\n",
	"link": "<!-- @license lucide-static v1.56.0 - ISC -->\n<svg\n  class=\"lucide lucide-link\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <path d=\"M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71\" />\n  <path d=\"M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71\" />\n</svg>\n",
	"stop": "<!-- @license lucide-static v1.56.0 - ISC -->\n<svg\n  class=\"lucide lucide-square\"\n  xmlns=\"http://www.w3.org/2000/svg\"\n  width=\"24\"\n  height=\"24\"\n  viewBox=\"0 0 24 24\"\n  fill=\"none\"\n  stroke=\"currentColor\"\n  stroke-width=\"2\"\n  stroke-linecap=\"round\"\n  stroke-linejoin=\"round\"\n>\n  <rect width=\"18\" height=\"18\" x=\"3\" y=\"3\" rx=\"2\" />\n</svg>\n"
};

const fileIconColors = {
	"img": "#43b89c",
	"zip": "#9b59b6",
	"pdf": "#e74c3c",
	"doc": "#2980b9",
	"mp4": "#e67e22",
	"mp3": "#1abc9c",
	"code": "#27ae60",
	"exe": "#7f8c8d",
	"txt": "#95a5a6",
	"file": "#7f8c8d",
	"folder": "#f5a623"
};

const fileIconTypes = {
	"img": [
		"jpg",
		"jpeg",
		"png",
		"gif",
		"bmp",
		"ico",
		"webp",
		"svg"
	],
	"zip": [
		"zip",
		"rar",
		"tar",
		"gz",
		"7z",
		"bz2",
		"bzip2",
		"xz",
		"iso",
		"cab",
		"tgz"
	],
	"doc": [
		"doc",
		"docx",
		"xls",
		"xlsx",
		"ppt",
		"pptx",
		"odt",
		"ods",
		"odp"
	],
	"code": [
		"js",
		"ts",
		"json",
		"css",
		"html",
		"htm",
		"php",
		"java",
		"py",
		"c",
		"h",
		"cpp",
		"hpp",
		"sh",
		"bat",
		"cmd",
		"conf",
		"cfg",
		"ini",
		"xml",
		"yaml",
		"yml",
		"toml"
	],
	"txt": [
		"txt",
		"log",
		"md",
		"csv",
		"lst",
		"patch",
		"diff",
		"inf"
	],
	"mp4": [
		"mp4",
		"mkv",
		"avi",
		"mov",
		"flv",
		"webm",
		"wmv",
		"asf",
		"mpg",
		"mpeg"
	],
	"mp3": [
		"mp3",
		"wav",
		"ogg",
		"flac",
		"aac",
		"wma",
		"opus",
		"m4a"
	],
	"exe": [
		"exe",
		"msi",
		"dmg",
		"apk",
		"deb",
		"rpm"
	],
	"pdf": [
		"pdf"
	]
};

const fileBrowserStyles = `
.luci-app-filebrowser {
	--fb-surface: #fff;
	--fb-muted-surface: #f6f7f8;
	--fb-text: #25282b;
	--fb-muted: #626970;
	--fb-border: #dde1e5;
	--fb-hover: #edf4fa;
	--fb-accent: #176ea6;
	--fb-danger: #b92c3a;
	--fb-transition: .15s ease;
	color: var(--fb-text);
	min-width: 0;
}
.luci-app-filebrowser[data-fb-theme="dark"] {
	--fb-surface: #27292c;
	--fb-muted-surface: #303337;
	--fb-text: #e0e3e6;
	--fb-muted: #a9afb6;
	--fb-border: #45494e;
	--fb-hover: #353e46;
	--fb-accent: #7dc4ee;
	--fb-danger: #ff8b95;
	color-scheme: dark;
}
.luci-app-filebrowser *, .luci-app-filebrowser *::before, .luci-app-filebrowser *::after { box-sizing: border-box; }
.luci-app-filebrowser .fb-toolbar,
.luci-app-filebrowser .fb-filterbar,
.luci-app-filebrowser .fb-queue-header {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
	padding: 12px 0;
	border-bottom: 1px solid var(--fb-border);
}
.luci-app-filebrowser .fb-breadcrumb {
	display: flex;
	align-items: center;
	gap: 8px;
	flex: 1 1 180px;
	min-width: 0;
	overflow-x: auto;
	white-space: nowrap;
	font-size: 14px;
}
.luci-app-filebrowser .fb-breadcrumb a { color: var(--fb-text); transition: color var(--fb-transition); }
.luci-app-filebrowser .fb-separator { color: var(--fb-muted); }
.luci-app-filebrowser .fb-icon {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	flex: 0 0 18px;
	width: 18px;
	height: 18px;
}
.luci-app-filebrowser .fb-button {
	display: inline-flex;
	align-items: center;
	justify-content: center;
	gap: 6px;
	min-width: 34px;
	min-height: 34px;
	height: 34px;
	padding: 7px;
	margin: 0;
	border: 1px solid var(--fb-border);
	border-radius: 5px;
	background: var(--fb-surface);
	color: var(--fb-text);
	font: inherit;
	font-size: 13px;
	line-height: 18px;
	cursor: pointer;
	box-shadow: none;
	position: relative;
	transition: background-color var(--fb-transition), color var(--fb-transition), border-color var(--fb-transition);
}
.luci-app-filebrowser .fb-button:hover:not(:disabled) { background: var(--fb-hover); color: var(--fb-accent); }
.luci-app-filebrowser .fb-button:active:not(:disabled) { background: var(--fb-hover); color: var(--fb-accent); border-color: var(--fb-accent); }
.luci-app-filebrowser .fb-button:disabled { opacity: .45; cursor: not-allowed; }
.luci-app-filebrowser .fb-button[data-tip]::after {
	content: attr(data-tip);
	position: absolute;
	bottom: calc(100% + 6px);
	left: 50%;
	transform: translateX(-50%);
	padding: 4px 8px;
	border-radius: 5px;
	background: rgba(30, 30, 30, .9);
	color: #fff;
	font-size: 12px;
	line-height: 18px;
	white-space: nowrap;
	pointer-events: none;
	opacity: 0;
	transition: opacity var(--fb-transition);
	z-index: 2;
}
.luci-app-filebrowser .fb-button[data-tip]:focus-visible::after { opacity: 1; }
@media (hover: hover) {
	.luci-app-filebrowser .fb-button[data-tip]:hover:not(:disabled)::after { opacity: 1; }
	.luci-app-filebrowser .fb-table tbody tr:hover td { background: var(--fb-hover); }
}
.luci-app-filebrowser button:focus-visible,
.luci-app-filebrowser a:focus-visible,
.luci-app-filebrowser input:focus-visible { outline: 2px solid var(--fb-accent); outline-offset: 2px; }
.luci-app-filebrowser .fb-summary { flex: 1 1 180px; font-size: 13px; color: var(--fb-muted); }
.luci-app-filebrowser .fb-search { display: flex; align-items: center; gap: 6px; color: var(--fb-muted); max-width: 100%; }
.luci-app-filebrowser .fb-search input {
	width: 220px;
	max-width: 100%;
	min-width: 0;
	margin: 0;
	padding: 7px 10px;
	border: 1px solid var(--fb-border);
	border-radius: 5px;
	background: var(--fb-surface);
	color: var(--fb-text);
	font-size: 13px;
	transition: border-color var(--fb-transition), box-shadow var(--fb-transition);
}
.luci-app-filebrowser .fb-list { overflow: auto; max-height: 65vh; min-height: 140px; background: var(--fb-surface); }
.luci-app-filebrowser .fb-table { width: 100%; table-layout: fixed; border-collapse: collapse; margin: 0; }
.luci-app-filebrowser .fb-table th,
.luci-app-filebrowser .fb-table td {
	padding: 6px 10px;
	height: 42px;
	border: 0;
	border-bottom: 1px solid var(--fb-border);
	background: var(--fb-surface);
	color: var(--fb-text);
	text-align: left;
	vertical-align: middle;
	font-size: 13px;
	transition: background-color var(--fb-transition);
}
.luci-app-filebrowser .fb-table th { position: sticky; top: 0; z-index: 1; background: var(--fb-muted-surface); height: 36px; font-weight: 500; }
.luci-app-filebrowser .fb-table th button { border: 0 !important; background-color: transparent !important; color: inherit; font: inherit; padding: 0; cursor: pointer; box-shadow: none; }
.luci-app-filebrowser .fb-table .fb-size { width: 100px; text-align: right; color: var(--fb-muted); white-space: nowrap; }
.luci-app-filebrowser .fb-table .fb-mtime { width: 190px; color: var(--fb-muted); white-space: nowrap; }
.luci-app-filebrowser .fb-table .fb-actions { width: 100px; text-align: right; }
.luci-app-filebrowser .fb-table tbody tr:active td,
.luci-app-filebrowser .fb-table tbody tr:focus-within td { background: var(--fb-hover); }
.luci-app-filebrowser .fb-entry { display: flex; align-items: center; gap: 8px; min-width: 0; color: var(--fb-text); text-decoration: none; transition: color var(--fb-transition); }
.luci-app-filebrowser .fb-parent-link { display: inline-flex; align-items: center; min-height: 30px; color: var(--fb-muted); text-decoration: none; transition: color var(--fb-transition); }
.luci-app-filebrowser a.fb-parent-link:hover { color: var(--fb-accent); }
.luci-app-filebrowser .fb-icon svg { display: block; max-width: 100%; max-height: 100%; }
.luci-app-filebrowser .fb-entry .fb-icon { flex-basis: 20px; width: 20px; height: 20px; }
.luci-app-filebrowser .fb-directory:hover { color: var(--fb-accent); }
.luci-app-filebrowser .fb-filename { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.luci-app-filebrowser .fb-action-group { display: flex; justify-content: flex-end; gap: 4px; }
.luci-app-filebrowser .fb-actions .fb-button { border-color: transparent !important; background-color: transparent !important; }
.luci-app-filebrowser .fb-button.fb-delete:hover { color: var(--fb-danger); }
.luci-app-filebrowser .fb-message { padding: 24px 12px; text-align: center; overflow-wrap: anywhere; }
.luci-app-filebrowser .fb-error { color: var(--fb-danger); }
.luci-app-filebrowser .fb-queue { margin-top: 20px; border-top: 1px solid var(--fb-border); }
.luci-app-filebrowser .fb-queue[hidden] { display: none; }
.luci-app-filebrowser .fb-queue-header strong { flex: 1 1 150px; font-size: 14px; }
.luci-app-filebrowser .fb-tasks { list-style: none; padding: 0; margin: 0; max-height: 320px; overflow: auto; }
.luci-app-filebrowser .fb-tasks li { display: grid; grid-template-columns: minmax(0, 1fr) minmax(80px, 220px) 74px; gap: 12px; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--fb-border); }
.luci-app-filebrowser .fb-task-info { min-width: 0; font-size: 13px; }
.luci-app-filebrowser .fb-task-info small { display: block; color: var(--fb-muted); overflow-wrap: anywhere; }
.luci-app-filebrowser .fb-task-info progress { display: block; width: 100%; height: 5px; margin-top: 6px; accent-color: var(--fb-accent); }
.luci-app-filebrowser .fb-task-status { font-size: 12px; overflow-wrap: anywhere; }
@keyframes fb-filebrowser-enter {
	from { opacity: 0; transform: translateY(4px); }
	to { opacity: 1; transform: translateY(0); }
}
.luci-app-filebrowser .fb-enter { animation: fb-filebrowser-enter .15s ease both; }
@media (prefers-reduced-motion: reduce) {
	.luci-app-filebrowser .fb-enter { animation: none; }
	.luci-app-filebrowser .fb-button,
	.luci-app-filebrowser .fb-button::after,
	.luci-app-filebrowser .fb-table td,
	.luci-app-filebrowser .fb-entry,
	.luci-app-filebrowser .fb-breadcrumb a,
	.luci-app-filebrowser .fb-parent-link,
	.luci-app-filebrowser .fb-search input { transition: none; }
}
@media (max-width: 700px) {
	.luci-app-filebrowser .fb-table .fb-mtime { display: none; }
	.luci-app-filebrowser .fb-table .fb-size { width: 72px; font-size: 12px; }
	.luci-app-filebrowser .fb-table .fb-actions { width: 84px; padding: 4px; }
	.luci-app-filebrowser .fb-table th, .luci-app-filebrowser .fb-table td { padding: 6px; }
	.luci-app-filebrowser .fb-breadcrumb { flex-basis: 100%; }
	.luci-app-filebrowser .fb-search { width: 100%; }
	.luci-app-filebrowser .fb-search input { flex: 1; width: auto; }
	.luci-app-filebrowser .fb-tasks li { grid-template-columns: minmax(0, 1fr) 74px; gap: 6px; }
	.luci-app-filebrowser .fb-task-status { grid-column: 1; grid-row: 2; }
	.luci-app-filebrowser .fb-tasks .fb-action-group { grid-column: 2; grid-row: 1 / span 2; }
}
`;

const iconTemplates = Object.create(null);

function fileIcon(name) {
	const extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase();
	return Object.keys(fileIconTypes).find(type => fileIconTypes[type].includes(extension)) || 'file';
}


// LuCI's E() treats plain strings as HTML; filenames and errors must be text.
function el(tag, attributes, children) {
	return E(tag, attributes, (Array.isArray(children) ? children : [ children ])
		.filter(child => child != null)
		.map(child => typeof child === 'string' || typeof child === 'number' ? document.createTextNode(String(child)) : child));
}

function icon(name) {
	if (!iconTemplates[name]) {
		const parsed = new DOMParser().parseFromString(fileBrowserIcons[name] || fileBrowserIcons.file, 'image/svg+xml');
		iconTemplates[name] = document.importNode(parsed.documentElement, true);
		iconTemplates[name].setAttribute('aria-hidden', 'true');
		iconTemplates[name].setAttribute('focusable', 'false');
	}
	return el('span', { 'class': 'fb-icon', 'aria-hidden': 'true',
		'style': fileIconColors[name] ? 'color: ' + fileIconColors[name] : null }, iconTemplates[name].cloneNode(true));
}

function button(name, label, action, text) {
	return el('button', { 'type': 'button', 'class': 'fb-button', 'data-tip': text ? null : label, 'aria-label': label, 'click': action },
		text ? [ icon(name), el('span', {}, label) ] : [ icon(name) ]);
}

function join(path, name) { return (path === '/' ? '/' : path + '/') + name; }
function validName(name) { return name !== '' && name !== '.' && name !== '..' && !/[\/\x00]/.test(name); }
function size(bytes) { return Number.isFinite(bytes) ? '%1024mB'.format(bytes) : '-'; }

return view.extend({
	render: function() {
		if (!document.getElementById('filebrowser-css'))
			document.head.appendChild(el('style', { 'id': 'filebrowser-css' }, fileBrowserStyles));
		this.path = '/';
		this.entries = [];
		this.tasks = [];
		this.taskId = this.batchId = this.listId = 0;
		this.sortKey = 'name';
		this.sortAscending = true;
		this.running = this.loading = false;
		this.filter = '';
		this.dialogTail = Promise.resolve();
		this.breadcrumb = el('nav', { 'class': 'fb-breadcrumb', 'aria-label': _('Folder path') });
		this.summary = el('span', { 'class': 'fb-summary', 'aria-live': 'polite' });
		this.list = el('div', { 'class': 'fb-list' });
		this.queue = el('section', { 'class': 'fb-queue', 'aria-label': _('Upload queue'), 'hidden': '' });
		this.fileInput = el('input', { 'type': 'file', 'multiple': '', 'hidden': '', 'change': (ev) => {
			const files = Array.from(ev.currentTarget.files || []);
			ev.currentTarget.value = '';
			this.enqueue(files);
		} });
		this.uploadButton = button('upload', _('Upload files'), () => this.fileInput.click(), true);
		this.mkdirButton = button('newfolder', _('Create directory'), () => this.createDirectory());
		this.searchInput = el('input', { 'type': 'search', 'placeholder': _('Search files'), 'aria-label': _('Search files'), 'input': (ev) => {
			this.filter = ev.target.value;
			if (!this.loading) this.renderList();
		} });
		this.root = el('div', { 'class': 'cbi-map luci-app-filebrowser' }, [
			el('h2', { 'name': 'content' }, _('File Browser')),
			el('div', { 'class': 'fb-content' }, [
				el('div', { 'class': 'fb-toolbar' }, [ this.breadcrumb,
					button('refresh', _('Refresh'), () => this.loadDirectory(this.path)), this.mkdirButton, this.uploadButton, this.fileInput ]),
				el('div', { 'class': 'fb-filterbar' }, [ this.summary, el('label', { 'class': 'fb-search' }, [ icon('search'), this.searchInput ]) ]),
				this.list, this.queue
			])
		]);
		// The actual theme foreground also reflects Argon's forced dark mode.
		const syncTheme = () => {
			const rgb = getComputedStyle(document.body).color.match(/[\d.]+/g);
			const dark = rgb && (Number(rgb[0]) * .299 + Number(rgb[1]) * .587 + Number(rgb[2]) * .114) > 150;
			this.root.setAttribute('data-fb-theme', dark ? 'dark' : 'light');
		};
		syncTheme();
		this.themeObserver = new MutationObserver(syncTheme);
		[ document.documentElement, document.body ].forEach(node => this.themeObserver.observe(node, {
			attributes: true, attributeFilter: [ 'class', 'style', 'data-theme', 'data-darkmode' ]
		}));
		this.themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
		this.themeMedia.addEventListener('change', syncTheme);
		this.mobileMedia = window.matchMedia('(max-width: 700px)');
		this.mobileMedia.addEventListener('change', () => {
			this.list.querySelectorAll('td[colspan]').forEach(cell => { cell.colSpan = this.mobileMedia.matches ? 3 : 4; });
		});
		this.loadDirectory('/');
		return this.root;
	},

	loadDirectory: async function(path) {
		const id = ++this.listId;
		this.loading = true;
		this.uploadButton.disabled = this.mkdirButton.disabled = true;
		dom.content(this.list, el('p', { 'class': 'fb-message spinning' }, _('Loading directory contents...')));
		try {
			const entries = await fs.list(path);
			if (id !== this.listId) return;
			this.path = path;
			this.entries = entries;
			this.filter = this.searchInput.value = '';
			this.renderBreadcrumb();
			this.renderList(true);
		} catch (err) {
			if (id === this.listId) {
				dom.content(this.list, el('p', { 'class': 'fb-message fb-error' }, _('Unable to list directory: %s').format(err.message)));
				this.summary.textContent = '';
			}
		} finally {
			if (id === this.listId) {
				this.loading = false;
				this.uploadButton.disabled = this.mkdirButton.disabled = false;
			}
		}
	},

	renderBreadcrumb: function() {
		const parts = this.path.split('/').filter(Boolean);
		const nodes = [ el('a', { 'href': '#', 'click': (ev) => { ev.preventDefault(); this.loadDirectory('/'); } }, '/') ];
		parts.forEach((part, index) => {
			const path = '/' + parts.slice(0, index + 1).join('/');
			if (index) nodes.push(el('span', { 'class': 'fb-separator' }, '/'));
			nodes.push(el('a', {
				'href': '#', 'title': path, 'click': (ev) => { ev.preventDefault(); this.loadDirectory(path); }
			}, part));
		});
		dom.content(this.breadcrumb, nodes);
	},

	renderList: function(animate) {
		const filtered = this.entries.filter(entry => entry.name.toLowerCase().includes(this.filter.toLowerCase()));
		filtered.sort((a, b) => {
			const directories = Number(b.type === 'directory') - Number(a.type === 'directory');
			const comparison = this.sortKey === 'name' ? L.naturalCompare(a.name, b.name) : (a[this.sortKey] || 0) - (b[this.sortKey] || 0);
			return directories || comparison * (this.sortAscending ? 1 : -1);
		});
		const folders = this.entries.filter(entry => entry.type === 'directory').length;
		this.summary.textContent = _('%s directories, %s files').format(folders, this.entries.length - folders) + (this.filter ? ' / ' + _('%s matches').format(filtered.length) : '');
		const headings = [ [ 'name', _('Name') ], [ 'size', _('Size') ], [ 'mtime', _('Modified') ] ].map(([key, label]) => el('th', {
			'scope': 'col', 'class': 'fb-' + key,
			'aria-sort': key === this.sortKey ? (this.sortAscending ? 'ascending' : 'descending') : 'none'
		}, el('button', { 'type': 'button', 'click': () => {
			this.sortAscending = this.sortKey === key ? !this.sortAscending : true;
			this.sortKey = key; this.renderList();
		} }, label + (key === this.sortKey ? (this.sortAscending ? ' \u2191' : ' \u2193') : ''))));
		headings.push(el('th', { 'scope': 'col', 'class': 'fb-actions' }, _('Actions')));
		const rows = filtered.map(entry => {
			const path = join(this.path, entry.name);
			const directory = entry.type === 'directory';
			const linkedDirectory = entry.type === 'symlink' && entry.target && entry.target.type === 'directory';
			const downloadable = entry.type === 'file' || (entry.type === 'symlink' && entry.target && entry.target.type === 'file');
			const contents = [ icon(directory ? 'folder' : entry.type === 'symlink' ? 'link' : fileIcon(entry.name)),
				el('span', { 'class': 'fb-filename', 'title': entry.name }, entry.name) ];
			const actions = [];
			if (downloadable) actions.push(button('download', _('Download'), () => this.download(path, entry.name)));
			const remove = button('delete', _('Delete'), () => this.remove(path, entry));
			remove.classList.add('fb-delete'); actions.push(remove);
			return el('tr', { 'class': animate ? 'fb-enter' : '' }, [
				el('td', { 'class': 'fb-name' }, directory || linkedDirectory ? el('a', {
					'href': '#', 'class': 'fb-entry fb-directory', 'click': (ev) => { ev.preventDefault(); this.loadDirectory(path); }
				}, contents) : el('span', { 'class': 'fb-entry' }, contents)),
				el('td', { 'class': 'fb-size' }, directory ? '-' : size(entry.size)),
				el('td', { 'class': 'fb-mtime' }, entry.mtime > 0 ? new Date(entry.mtime * 1000).toLocaleString() : '-'),
				el('td', { 'class': 'fb-actions' }, el('div', { 'class': 'fb-action-group' }, actions))
			]);
		});
		const columns = this.mobileMedia.matches ? 3 : 4;
		if (!rows.length) rows.push(el('tr', {}, el('td', { 'colspan': columns, 'class': 'fb-message' }, this.filter ? _('No matching files') : _('No entries in this directory'))));
		const parentPath = this.path.replace(/\/[^/]+$/, '') || '/';
		const parent = this.path === '/' ? el('span', { 'class': 'fb-parent-link', 'aria-disabled': 'true', 'title': _('Parent directory') }, '...') : el('a', {
			'class': 'fb-parent-link', 'href': '#', 'title': _('Parent directory'), 'aria-label': _('Parent directory'),
			'click': (ev) => { ev.preventDefault(); this.loadDirectory(parentPath); }
		}, '...');
		rows.unshift(el('tr', { 'class': 'fb-parent-row' }, el('td', { 'colspan': columns }, parent)));
		dom.content(this.list, el('table', { 'class': 'fb-table' }, [ el('thead', {}, el('tr', {}, headings)), el('tbody', {}, rows) ]));
	},

	ask: function(title, content, choices) {
		// LuCI has one modal container; serialize upload and file action prompts.
		this.dialogTail = this.dialogTail.then(() => new Promise(resolve => {
			ui.showModal(title, [ content, el('div', { 'class': 'right' }, choices.map(choice => el('button', {
				'type': 'button', 'class': 'btn', 'style': 'margin: .25rem',
				'click': () => { ui.hideModal(); resolve(choice[0]); }
			}, choice[1]))) ]);
		}));
		return this.dialogTail;
	},

	createDirectory: async function() {
		const path = this.path;
		const input = el('input', { 'type': 'text', 'class': 'cbi-input-text', 'placeholder': _('Directory name'), 'aria-label': _('Directory name') });
		if (!await this.ask(_('Create directory'), input, [ [false, _('Cancel')], [true, _('Create')] ])) return;
		if (!validName(input.value)) return this.notify(_('Invalid directory name'));
		try {
			const result = await fs.exec('/bin/mkdir', [ '--', join(path, input.value) ]);
			if (result.code !== 0) throw new Error(result.stderr || _('Failed to create directory'));
			if (!this.loading && this.path === path) await this.loadDirectory(path);
		} catch (err) { this.notify(err.message); }
	},

	remove: async function(path, entry) {
		const message = entry.type === 'directory' ? _('Delete directory "%s" and all its contents?') : _('Delete "%s"?');
		if (!await this.ask(_('Delete'), el('p', {}, message.format(entry.name)), [ [false, _('Cancel')], [true, _('Delete')] ])) return;
		try { await fs.remove(path); await this.loadDirectory(this.path); }
		catch (err) { this.notify(err.message); }
	},

	download: async function(path, name) {
		try {
			const blob = await fs.read_direct(path, 'blob');
			const url = URL.createObjectURL(blob);
			const anchor = el('a', { 'href': url, 'download': name, 'hidden': '' });
			document.body.appendChild(anchor); anchor.click(); anchor.remove();
			window.setTimeout(() => URL.revokeObjectURL(url), 1000);
		} catch (err) { this.notify(_('Download failed: %s').format(err.message)); }
	},

	notify: function(message) { ui.addNotification(null, el('p', {}, message), 'error'); },

	enqueue: function(files) {
		if (this.loading) return;
		const batch = ++this.batchId;
		files.forEach(file => this.tasks.push({ id: ++this.taskId, file: file, size: file.size, name: file.name, directory: this.path,
			status: 'pending', progress: 0, error: '', batch: batch }));
		this.renderQueue(); this.runQueue();
	},

	runQueue: async function() {
		if (this.running) return;
		this.running = true;
		const policies = new Map();
		const changed = new Set();
		try {
			let task;
			while ((task = this.tasks.find(item => item.status === 'pending'))) {
				task.status = 'uploading'; this.renderQueue();
				try {
					if (!validName(task.name)) throw new Error(_('Invalid filename'));
					const entries = await fs.list(task.directory);
					const existing = entries.find(entry => entry.name === task.name);
					if (existing && existing.type !== 'file') throw new Error(_('The destination exists and is not a regular file'));
					if (existing) {
						let policy = policies.get(task.batch);
						if (!policy) {
							policy = await this.ask(_('File already exists'), el('p', {}, join(task.directory, task.name)), [
								['skip', _('Skip')], ['overwrite', _('Overwrite')], ['skip-all', _('Skip all')], ['overwrite-all', _('Overwrite all')]
							]);
							if (policy.endsWith('-all')) policies.set(task.batch, policy);
						}
						if (policy.startsWith('skip')) { task.status = 'skipped'; task.file = null; continue; }
					}
					const data = new FormData();
					data.append('sessionid', L.env.sessionid);
					data.append('filename', join(task.directory, task.name));
					data.append('filedata', task.file);
					// Failed uploads may still have partially written the destination.
					changed.add(task.directory);
					const response = await request.post(L.env.cgi_base + '/cgi-upload', data, {
						timeout: 0, progress: (ev) => {
							task.progress = ev.total > 0 ? Math.min(ev.loaded / ev.total, 1) : 0;
							const progress = this.queue.querySelector('[data-task="' + task.id + '"] progress');
							if (progress) progress.value = task.progress;
						}
					});
					if (!response.ok) throw new Error(_('Upload request failed (HTTP %s)').format(response.status));
					const reply = response.json();
					if (!reply || reply.failure || reply.size !== task.file.size) throw new Error(reply && reply.message || _('Invalid upload response'));
					task.status = 'done'; task.progress = 1; task.file = null;
				} catch (err) { task.status = 'error'; task.error = err.message; }
				finally { this.renderQueue(); }
			}
		} finally {
			this.running = false; this.renderQueue();
			if (!this.loading && changed.has(this.path)) await this.loadDirectory(this.path);
		}
	},

	renderQueue: function() {
		this.queue.hidden = this.tasks.length === 0;
		const labels = { pending: _('Waiting'), uploading: _('Uploading'), done: _('Completed'), error: _('Failed'), skipped: _('Skipped') };
		const stop = button('stop', _('Stop queued uploads'), () => {
			this.tasks.filter(task => task.status === 'pending').forEach(task => { task.status = 'skipped'; task.file = null; }); this.renderQueue();
		}, true);
		stop.disabled = !this.tasks.some(task => task.status === 'pending');
		const clear = button('close', _('Clear finished'), () => {
			this.tasks = this.tasks.filter(task => task.status === 'pending' || task.status === 'uploading' || task.status === 'error'); this.renderQueue();
		}, true);
		const completed = this.tasks.filter(task => task.status !== 'pending' && task.status !== 'uploading').length;
		dom.content(this.queue, [
			el('div', { 'class': 'fb-queue-header' }, [ el('strong', {}, _('Upload queue') + ' (' + completed + '/' + this.tasks.length + ')'), stop, clear ]),
			el('ul', { 'class': 'fb-tasks' }, this.tasks.map(task => {
				const actions = [];
				if (task.status === 'error') actions.push(button('refresh', _('Retry'), () => {
					task.status = 'pending'; task.progress = 0; task.error = ''; this.renderQueue(); this.runQueue();
				}));
				if (task.status !== 'uploading') actions.push(button('close', _('Remove from queue'), () => {
					this.tasks = this.tasks.filter(item => item.id !== task.id); this.renderQueue();
				}));
				return el('li', { 'data-task': task.id, 'class': task.status === 'error' ? 'fb-error' : '' }, [
					el('div', { 'class': 'fb-task-info' }, [ el('span', { 'class': 'fb-filename', 'title': task.name }, task.name),
						el('small', {}, task.directory + ' / ' + size(task.size)), el('progress', { 'max': '1', 'value': task.progress, 'aria-label': _('Upload progress') }) ]),
					el('span', { 'class': 'fb-task-status', 'role': 'status' }, task.error || labels[task.status]),
					el('div', { 'class': 'fb-action-group' }, actions)
				]);
			}))
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
