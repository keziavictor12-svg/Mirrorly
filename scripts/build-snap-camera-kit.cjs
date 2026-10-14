// Bundles @snap/camera-kit (installed from npm) into one browser ES module.
// The output is Snap confidential software under the Snap Developer Terms, so
// it is written to a git-ignored folder and must never be committed.
const path = require('node:path');
const esbuild = require('esbuild');

const outfile = path.join(__dirname, '..', 'public', 'vendor', 'snap', 'camera-kit.mjs');
esbuild.build({
  stdin: {
    contents: "export * from '@snap/camera-kit';",
    resolveDir: path.join(__dirname, '..'),
    loader: 'js'
  },
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: ['chrome95', 'edge95', 'safari16'],
  minify: true,
  legalComments: 'external',
  outfile
}).then(() => console.log('Snap Camera Kit bundle written to ' + path.relative(process.cwd(), outfile)))
  .catch((error) => { console.error(error); process.exit(1); });
