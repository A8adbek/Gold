# Notebook Cave — prototype 0.2

A standalone offline Android game inside the Gold repository. The existing `app`
module and its gold-price widget are preserved. `notebook` installs separately as
`uz.asadbek.notebookcave`, with no Internet permission or external dependencies.

## Play / build

- GitHub Actions → Build Android APK → latest successful run → **NotebookCave-APK**.
- Extract the artifact ZIP and install `notebook-debug.apk` on Android 8+.
- Local build: Java 17, Gradle 8.10.2, Android SDK 35; run
  `gradle :notebook:assembleDebug`.
- Browser preview: serve `notebook/src/main/assets/` using a local static server.
- Choose launch elevation with the slider, pull the launch circle down and release.
  Pull length sets launch speed; sideways pull sets initial heading.
- In flight, drag left/right to bank, up/down to adjust pitch. Release to neutral
  trim. Settings include sensitivity and inverted pilot-style pitch controls.
  Desktop: Enter launches; arrows or WASD steer; Escape/Space pauses.
- Pause with the top-right button. Backgrounding the app pauses the game.
- The settings-panel energy-saving switch caps rendering at about 30 FPS and lowers
  canvas resolution. Normal mode targets 60 FPS, not guaranteed on every device.

## Implementation

Canvas 2D renderer projecting world-space 3D geometry, a damped chase camera,
recycled tunnel segments, procedural paper plane, clips, erasers and folded paper.
Fixed 120 Hz flight integration models gravity, lift, drag, pitch/roll response,
post-stall lift loss, glide, banked turns and soft/hard landings. See
[FLIGHT-MODEL.md](FLIGHT-MODEL.md) for assumptions, sources and limitations.
No downloaded images, game engines, network requests, advertising or analytics.
Distance, time and rings reset each flight. Distance record, sensitivity,
inversion and quality preferences are saved locally. No background gameplay.

Flights end on landing or collision; rings never add energy. The cave descends
gently to allow longer glides. This is a simplified controllable paper glider,
not a validated real-aircraft simulator or an exact copy of Epic Plane's physics.
No upgrades, missions or sounds yet. Device FPS, battery drain and touch feel
require real-phone QA. APK is a debug build; CI runners may use different debug
signing keys, so Android may require uninstalling an older prototype first (which
clears its local records/settings).

## Tests

`node --test tests/flight.test.cjs`

Tests cover launch, control inertia, energy dissipation, dive acceleration, stall
and recovery, landings, swept collisions, bounded world objects and identical
trajectories at 30/60/120 FPS. `node tests/browser.cjs` additionally checks touch
launch, steering/cancellation, pause/resume, results/restart and saved settings.
Install Playwright 1.58.2 and its Chromium browser for that optional local test.
CI also uploads screenshots as **NotebookCave-Screenshots**.
