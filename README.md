# LUMEN – The Lost Lighthouse

A small WebGL game (Three.js, no build step) rebuilt from the generated clip `LUMEN.mp4`
(`minimax/h3-max/text-to-video`). A girl with a lantern crosses floating islands at night. Shadow creatures
hold each island; raising the lantern sends a ring of light over the grass that dissolves them, lights the
island and raises a path of stones to the next one. On the last island she lights the far lighthouse and the
night turns into a golden dawn.

## Play

```bash
python3 -m http.server 8000
```

Open http://127.0.0.1:8000/ in a desktop browser.

- **WASD / arrows**: walk
- **Space** (hold, release): raise the lantern; the longer you hold, the wider the ring of light
- **Enter**: start · **R**: play again at the end · gamepad: left stick, A, Start

Shadows creep toward the light and sap the lantern when they touch her; if it goes out she wakes on the last
lit island. The lantern refills while it is lowered. Four islands to free (the dots top right), then stand in
the ring on the last island and raise the lantern.

URL parameters for tests: `?autostart`, `?seed=N`, `?island=N` (start on island N with the previous ones lit),
`?dawn` (jump to the ending), `?camd=N` (camera distance), `?manual` (fixed 1/30 s steps driven by
`window.__step()`, used by the offline playtest). `window.__game.state` exposes read-only state.

## How it was made

1. **Study** (`study/`): 41 frames every 0.25 s, contact sheet and palette from the video; the spec is in
   `SPEC.md` (camera, hero, mechanic, key moments, palette, light, materials).
2. **Assets**: every image, model and sound comes from fal, made from the video's own frames as references
   (see the table below). Concepts and cutouts are kept in `assets/src/` (as WebP); the GLBs in `assets/models/`
   are the fal outputs with textures re-encoded to WebP and, for the stones / far islands, a decimated copy.
3. **Game** (`index.html`): Three.js 0.160 (vendored in `lib/three/`), ACES tone mapping, exponential fog,
   bloom, one grade pass (teal lift at night, warm gain at dawn), vignette and grain; skinned hero with Meshy
   clips (idle, walk, cast, victory) blended by an AnimationMixer; point-light shadows from the lantern;
   particle pools for sparks, motes and shadow smoke; instanced fern cards and cloud billboards.
4. **Verify**: `tools/play_offline.mjs` plays the whole game with the keyboard and films it; side-by-side
   pairs with the video are in `verify/`.

## fal assets (32 calls)

| File(s) | Endpoint | From |
|---|---|---|
| `src/hero_concept`, `src/hero_nolantern` | `fal-ai/nano-banana-pro/edit` | frames f_005, f_038 |
| `src/hero_cutout` | `fal-ai/birefnet/v2` | hero_nolantern |
| hero mesh (A-pose) | `meshy/v7.1/image-to-3d` | hero_cutout |
| `models/hero.glb` (Idle, Walking_Woman, Skill_01, Victory_Cheer, running) | `fal-ai/meshy/rigging/multi-animation` | hero mesh |
| `src/lantern_concept`, `src/lantern_cutout`, `models/lantern.glb` | `nano-banana-pro/edit` → `birefnet/v2` → `tripo3d/h3.1/image-to-3d` | hero_concept |
| `src/shadow_concept`, `src/shadow_cutout`, `models/shadow.glb` | `nano-banana-pro/edit` → `birefnet/v2` → `tripo3d/h3.1/image-to-3d` | f_005, f_009 |
| `src/island_concept`, `src/island_cutout`, `models/island.glb`, `models/island_lo.glb` | `nano-banana-pro/edit` → `birefnet/v2` → `tripo3d/h3.1/image-to-3d` | f_013, f_017 |
| `src/lighthouse_concept`, `src/lighthouse_cutout`, `models/lighthouse.glb` | `nano-banana-pro/edit` → `birefnet/v2` → `fal-ai/hunyuan-3d/v3.1/pro/image-to-3d` | f_033, f_038 |
| `src/ferns_concept`, `src/ferns_cutout` → `tex/ferns.webp` | `nano-banana-pro/edit` → `birefnet/v2` | f_017, f_038 |
| `src/sky_night` → `tex/sky_night.webp` | `nano-banana-pro/edit` | f_001, f_025 |
| `src/sky_dawn` → `tex/sky_dawn.webp` | `nano-banana-pro/edit` | sky_night, f_038 |
| `src/clouds_concept` → `tex/clouds.webp` | `nano-banana-pro/edit` | f_038 |
| `audio/pulse, dissolve, step, wind, bridge, ignite, whisper, charge` | `fal-ai/elevenlabs/sound-effects/v2` | text prompts |
| `audio/music_night, music_dawn` | `elevenlabs/music/v2.5` (instrumental) | text prompts |

Calls per endpoint: nano-banana-pro/edit 10, elevenlabs sound-effects v2 8, birefnet v2 6, tripo3d h3.1 3,
elevenlabs music v2.5 2, meshy v7.1 1, meshy rigging 1, hunyuan-3d v3.1 pro 1. Full prompts and arguments are
in `assets/src/fal_log.json` and `assets/audio/fal_log.json` (file names there are the raw downloads, before
WebP conversion and GLB optimization).

Not generated: the glow of particles, the light ring, the god rays and the eye glints are shaders or
procedural sprites, not images.

## Verification

- `verify/take.mp4`: a full playthrough (52 s at 30 fps, 960×540), with the fixes for walking, bridges,
  the ring, hopping shadows and ferns. `tools/play_offline.mjs` plays it with the keyboard and reads only
  `window.__game.state`: it frees the 4 islands (all four lit at 36 s), crosses every bridge, lights the
  beacon at about 42 s, and the dawn follows. The take has 0 console errors, the hero never falls, and the
  light goes out 0 times. The liveliest 10 s window is 26 → 36 s (`best_window.py`). `verify/take_sheet.jpg`
  shows one frame every 2 s; `verify/walk_check.mp4` is a close-up of the run cycle.
- `verify/pairs.jpg`: the video (left) next to the game (right) at the start, the ring of light and the dawn.
  `verify/g_*.png` are 1344×768 stills.
- Frame rate: this container has no GPU (headless SwiftShader renders 4 to 5 fps), so the take was rendered
  in `?manual` mode, one fixed 1/30 s step per frame. It was not measured on real hardware. The scene is about
  230k triangles and about 110 draw calls, with one point-light shadow (lantern) and one directional shadow
  at dawn.

## What differs from the video

- The camera follows from behind and above, like the video, but is a little closer, so the hero stays
  readable while you play.
- The island tops are flat rather than domed, and the ferns are camera-facing cards, not 3D plants.
- The shadows look like the video's bramble creatures but have no rig: they move in squashing hops, turn
  and dissolve.
- The lighthouse is visible far away from the start, so the goal reads. In the video it shows up only at the
  end.
- The night sky is a little more cyan and the far rocks are crisper than in the video.
