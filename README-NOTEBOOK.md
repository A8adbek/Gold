# Notebook Cave — prototype 0.1

A standalone offline Android game inside the Gold repository. The existing `app`
module and its gold-price widget are preserved. `notebook` installs separately as
`uz.asadbek.notebookcave`, with no Internet permission or external dependencies.

## Play / build

- GitHub Actions → Build Android APK → latest successful run → **NotebookCave-APK**.
- Extract the artifact ZIP and install `notebook-debug.apk` on Android 8+.
- Local build: Java 17, Gradle 8.10.2, Android SDK 35; run
  `gradle :notebook:assembleDebug`.
- Browser preview: serve `notebook/src/main/assets/` using a local static server.
- Drag anywhere in the playfield to steer horizontally and vertically; on desktop
  use arrows or WASD. Avoid solid obstacles; fly through rings to collect them.
- Pause with the top-right button. Backgrounding the app pauses the game.
- The lower-right energy-saving switch caps rendering at about 30 FPS and lowers
  canvas resolution. Normal mode targets 60 FPS, not guaranteed on every device.

## Implementation

Canvas 2D perspective renderer (2.5D), a small fixed pool of visible paper-tunnel
segments, procedural paper airplane, binder clips, erasers and crumpled paper.
No downloaded images, game engines, network requests, advertising or analytics.
Distance and ring counts reset each flight; distance record and quality preference
are saved locally. No background gameplay, audio or haptics in this first version.

This is an endless-flight prototype, not a full 3D simulation or a reproduction
of another game's levels. It does not yet include a launch slingshot, upgrades,
missions or sounds. Device FPS, battery drain and touch feel require real-phone QA.

## Tests

`node --test tests/flight.test.cjs`

Tests cover control bounds, collision crossing, ring scoring, restart, bounded
object population, frame-rate consistency and long-frame clamping.
