/**
 * TRIOS OG image generator.
 *
 * Renders landing/og/template.html with Electron (already a project dep —
 * works fully offline) and screenshots it to a PNG.
 *
 * Usage:
 *   npx electron landing/og/generate.mjs [options]
 *
 * Options (all optional):
 *   --out=assets/og.png      Output path, relative to the landing/ folder
 *   --title="A | *B*"        Headline. "|" = line break, *phrase* = gradient
 *   --sub="..."              Sub-headline
 *   --badge="..."            Pill text near the top
 *   --footLeft="..."         Bottom-left footer text
 *   --theme=dark|light       Color theme (default: dark)
 *   --width=1200             Logical width  (default 1200)
 *   --height=630             Logical height (default 630)
 *   --scale=2                Pixel density  (default 2 → crisp 2400×1260)
 *
 * Example:
 *   npx electron landing/og/generate.mjs --out=assets/og.png \
 *     --title="The complete school, | *running entirely offline.*"
 */
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';
import { writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';

const electronModule = createRequire(import.meta.url)('electron');

// When launched as plain Node (e.g. ELECTRON_RUN_AS_NODE=1 in the environment,
// which `npm run og` inherits), `require('electron')` is just the path string.
// Re-launch ourselves under the real Electron runtime with that var stripped.
if (typeof electronModule === 'string') {
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const child = spawn(
    electronModule,
    [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    { stdio: 'inherit', env }
  );
  child.on('exit', (code) => process.exit(code ?? 0));
  child.on('error', (err) => { console.error('Failed to launch Electron:', err); process.exit(1); });
} else {
  await main(electronModule);
}

async function main({ app, BrowserWindow }) {

const __dirname = dirname(fileURLToPath(import.meta.url));
const LANDING_DIR = resolve(__dirname, '..');

const args = Object.fromEntries(
  process.argv.slice(2)
    .filter(a => a.startsWith('--'))
    .map(a => {
      const i = a.indexOf('=');
      return i === -1 ? [a.slice(2), true] : [a.slice(2, i), a.slice(i + 1)];
    })
);

const WIDTH  = Number(args.width)  || 1200;
const HEIGHT = Number(args.height) || 630;
const SCALE  = Number(args.scale)  || 1;
const OUT    = resolve(LANDING_DIR, args.out || 'assets/og.png');

// Build the template URL with the customization query string.
const params = new URLSearchParams();
for (const key of ['title', 'sub', 'badge', 'footLeft', 'theme']) {
  if (typeof args[key] === 'string') params.set(key, args[key]);
}
const templateUrl =
  pathToFileURL(resolve(__dirname, 'template.html')).href +
  (params.toString() ? `?${params}` : '');

app.commandLine.appendSwitch('force-device-scale-factor', String(SCALE));
app.disableHardwareAcceleration();

// NOTE: do not use top-level `await app.whenReady()` — in Electron ESM mains
// that can deadlock app startup. Use the callback form instead.
async function run() {
  const win = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    useContentSize: true,
    show: false,
    frame: false,
    backgroundColor: '#020617',
    webPreferences: {
      offscreen: false,
      contextIsolation: true,
      backgroundThrottling: false,
      // Lets a never-shown window still render, so capturePage() works.
      paintWhenInitiallyHidden: true,
    },
  });

  await win.loadURL(templateUrl);
  // Guarantee at least one paint pass without flashing a visible window.
  win.showInactive();
  win.setOpacity(0);
  win.setPosition(-10000, -10000);

  // Wait for fonts + the logo image to settle (template sets window.__ogReady).
  const deadline = Date.now() + 8000;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const ready = await win.webContents.executeJavaScript('window.__ogReady === true').catch(() => false);
    if (ready || Date.now() > deadline) break;
    await new Promise(r => setTimeout(r, 120));
  }
  await new Promise(r => setTimeout(r, 250)); // final paint settle

  // Capture, then force exact OG dimensions (host DPI scaling can otherwise
  // make the raw capture an off-spec size / aspect ratio).
  const captured = await win.webContents.capturePage();
  const image = captured.resize({
    width: WIDTH * SCALE,
    height: HEIGHT * SCALE,
    quality: 'best',
  });
  const png = image.toPNG();

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(OUT, png);

  const { width, height } = image.getSize();
  console.log(`OK OG image written: ${OUT}  (${width}x${height}px, ${(png.length / 1024).toFixed(0)} KB)`);
}

app.whenReady()
  .then(run)
  .then(() => app.exit(0))
  .catch((err) => {
    console.error('OG generation failed:', err);
    app.exit(1);
  });

} // end main()
