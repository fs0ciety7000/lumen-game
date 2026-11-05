// Offline playtest: plays LUMEN with the keyboard, one fixed 1/30 s step per frame, and films every frame.
// Used where no GPU is available (headless SwiftShader renders a few fps): the game runs in ?manual mode,
// so the take shows real game time at 30 fps. The scenario only presses keys and reads window.__game.state.
//
//   node tools/play_offline.mjs "http://127.0.0.1:8000/?manual" -o take.mp4 --frames 1500 --size 1280x720
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv.splice(i, 2)[1] : d; };
const out = opt('-o', 'take.mp4'), frames = +opt('--frames', 900), every = +opt('--every', 1);
const [W, H] = opt('--size', '1280x720').split('x').map(Number);
const url = argv[0];
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require(process.env.PW || '/opt/node-tools/node_modules/playwright')); }

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: W, height: H } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => m.type() === 'error' && errors.push(m.text()));
await page.goto(url, { waitUntil: 'load', timeout: 120000 });
await page.waitForFunction(() => window.__step, null, { timeout: 120000 });

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lumen-take-'));
const held = new Set();
async function setKeys(want) {
  for (const k of [...held]) if (!want.has(k)) { await page.keyboard.up(k); held.delete(k); }
  for (const k of want) if (!held.has(k)) { await page.keyboard.down(k); held.add(k); }
}
function steer(s, tx, tz, keys, dead = .35) {
  const dx = tx - s.x, dz = tz - s.z, l = Math.hypot(dx, dz) || 1;
  if (dz / l < -dead) keys.add('ArrowUp'); if (dz / l > dead) keys.add('ArrowDown');
  if (dx / l > dead) keys.add('ArrowRight'); if (dx / l < -dead) keys.add('ArrowLeft');
}

// a good player: walk to the next shadows, raise the lantern when they are close, cross the bridges,
// light the beacon, then stand and watch the dawn
let charge = 0, cool = 0, stuck = 0, last = null, side = 0, log = [];
let s = await page.evaluate(() => window.__step(1));
if (s.phase === 'title') { await page.keyboard.press('Enter'); s = await page.evaluate(() => window.__step(2)); }
for (let f = 0; f < frames; f++) {
  const keys = new Set();
  if (s.phase === 'play' && s.dawn === 0) {
    const hunting = s.shadowsHere > 0 && s.nearest;
    if (cool > 0) cool--;
    if (charge > 0) {                                   // holding the lantern up, then let go
      charge--; if (charge > 0) keys.add('Space'); else cool = 6;
      if (s.nearest && s.nearest.dist > 2.2) steer(s, s.nearest.x, s.nearest.z, keys);
    } else if (cool > 0) {
      if (hunting) steer(s, s.nearest.x, s.nearest.z, keys);
    } else if (hunting && s.nearest.dist < 4.2 && s.energy > .5) {
      charge = 18 + Math.round(Math.min(12, s.shadowsHere * 3)); keys.add('Space');
    } else if (hunting) {
      steer(s, s.nearest.x, s.nearest.z, keys);
    } else if (s.target.island === 5 && Math.hypot(s.x - s.target.x, s.z - s.target.z) < 1.2) {
      charge = 24; keys.add('Space');
    } else steer(s, s.target.x, s.target.z, keys);
    // unstick around boulders: sidestep for a moment
    if (last && keys.size && !keys.has('Space') && Math.hypot(s.x - last.x, s.z - last.z) < .01) stuck++; else stuck = Math.max(0, stuck - 1);
    if (stuck > 8) { side = 14; stuck = 0; }
    if (side > 0) { side--; keys.add(Math.sin(f) > 0 ? 'ArrowLeft' : 'ArrowRight'); }
  }
  last = s;
  await setKeys(keys);
  s = await page.evaluate(() => window.__step(1));
  if (f % every === 0) await page.screenshot({ path: path.join(dir, String(f / every | 0).padStart(5, '0') + '.jpg'), type: 'jpeg', quality: 88 });
  if (f % 60 === 0) { log.push(`${f} ${JSON.stringify(s)}`); console.log(f, s.phase, 'island', s.island, 'cleared', s.cleared, 'energy', s.energy, 'dawn', s.dawn); }
}
await setKeys(new Set());
await browser.close();
execFileSync('ffmpeg', ['-v', 'error', '-y', '-framerate', String(30 / every), '-i', path.join(dir, '%05d.jpg'),
  '-vf', `fps=30,format=yuv420p`, '-c:v', 'libx264', '-crf', '19', path.resolve(out)]);
fs.rmSync(dir, { recursive: true, force: true });
console.log('take', out, 'frames', frames, 'errors', errors.length ? errors.slice(0, 10) : 'none');
