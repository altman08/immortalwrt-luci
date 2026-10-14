# Browser checks

Requires Node.js 20 or newer. From this directory:

```sh
npm install
npx playwright install chromium
npm test
```

The checks load the repository's LuCI DOM implementation and Argon styles,
with simulated filesystem and upload APIs. They cover navigation, sorting,
filtering, filename escaping, upload conflicts, retries, directory capture,
stopping queued uploads, mkdir, download/delete actions, and desktop/mobile
light/dark rendering. Screenshots are written to `results/`.
They also verify that CSS and SVG are embedded in the view and that file
type icons use webd's shapes and colors without external asset requests.
The heading is compared with LuCI's standard map heading, and the `...`
parent entry is checked at the root and while filtering a subdirectory.

These checks do not replace testing CGI uploads and rpcd permissions on an
actual router. Test dependencies are not included in the LuCI package.
