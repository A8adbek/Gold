# Flight model 0.2 — rationale and validation boundaries

This is a lightweight, reduced-order **coordinated glider model** for a game.
It is not a measured digital twin, CFD solver, full six-degree-of-freedom aircraft
simulator, flight-training aid, or a reconstruction of Epic Plane's proprietary
code. Canvas rendering does not determine physical state.

## Research informing the design

1. Epic Plane Evolution, developer's Google Play description: launch pull controls
   initial speed/angle, airborne pitch control affects range. This motivates the
   interaction loop only; exact controller gains and physics are not public here.
   https://play.google.com/store/apps/details?id=com.WalkTalk.FlightMaster
2. Li, Goodwill, Wang & Ristroph (2022), *Centre of mass location, flight modes,
   stability and dynamic modelling of gliders*, Journal of Fluid Mechanics.
   doi:10.1017/jfm.2022.89. Thin-plate experiments connect mass distribution and
   aerodynamic restoring moments to steady glide, oscillation and diving.
   https://doi.org/10.1017/jfm.2022.89
3. Ng Bing Feng et al. (2009), *On the Aerodynamics of Paper Airplanes*,
   AIAA 2009-3958. Measurements of one dart design show approximately 5 m/s cruise
   and high-angle stall near 30 degrees. These values are **design-specific**.
   https://lactea.ufpr.br/wp-content/uploads/2018/08/On_the_Aerodynamics_of_Paper_Airplanes.pdf
4. NASA Glenn, Lift to Drag (L/D) Ratio: steady, still-air glide range per height
   lost follows L/D. Height/velocity are finite energy sources without thrust.
   https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/lift-to-drag-l-d-ratio/
5. FAA Glider Flying Handbook, Chapter 3: lift, drag, weight, coordinated turns,
   angle of attack, stall and stability.
   https://www.faa.gov/regulations_policies/handbooks_manuals/aviation/glider_handbook/gfh_chapter_3.pdf

These sources informed the design; no claim is made that their experimental
coefficients transfer exactly to this plane. The JFM plate model has not been
ported wholesale. Its mass-balance findings motivate our fixed stable trim;
there is no adjustable center of mass or paper-flex simulation in this version.

## State and forces

World coordinates are metres: x right, y up, z along the cave. Mass is 0.005 kg,
reference wing area 0.018 m², air density 1.225 kg/m³, gravity 9.81 m/s². These are
explicit game calibration parameters, not measured properties of an uploaded
folded paper model. Launch speed spans 3.8–8.0 m/s. There is no subsequent thrust.

At each step, gamma = atan2(vy, horizontal speed); alpha = pitch − gamma.
Dynamic pressure is q = 0.5 rho V². L = q S CL; D = q S CD. Lift acts perpendicular
to velocity and is rotated by bank; drag opposes velocity; weight points down.
Before stall, CL = 2.15 alpha. Beyond |alpha| = 30°, CL smoothly decays and an
additional separated-flow drag term grows. CD includes a positive baseline and
a CL² term. This empirical curve is chosen for plausible game behaviour, not
copied from digitized experimental data.

Heading follows the horizontal velocity (coordinated-flight approximation).
Pitch and roll have damped angular response to bounded virtual elevon commands.
Neutral input restores the selected trim angle/bank, not altitude or speed. A
real passive paper plane has no remotely actuated controls: virtual elevons and
bank stabilization are deliberate playability assumptions. Adverse yaw, rudder,
sideslip dynamics, elastic flapping, gusts and ground effect are omitted.

Integration uses a fixed 1/120 s step with midpoint translational forces.
Rendering is independently capped near 60 or 30 FPS. Long frame gaps are capped
at 0.25 s; application lifecycle pauses explicitly and discards elapsed idle time.
The camera interpolates position and heading and only partly follows pitch.

## Gameplay constraints

- The cave floor has an average downward slope of 0.14 m/m with a gentle ripple.
  This is environment geometry, not upward wind or hidden propulsion.
- Rings award score only. Airspeed and total energy are unaffected by collection.
- Obstacles use conservative expanded boxes and swept segment intersection.
  Paper wing span contributes to collision clearance; decorative clip tethers
  are not physical colliders. Folded paper uses a conservative box collider.
- Floor contact uses the velocity relative to the floor slope. Soft landing
  requires normal approach speed below 0.85 m/s, horizontal speed below 6.5 m/s,
  bank below 0.35 radians and no active stall; other impacts end as crashes.
  Landing thresholds are game design choices, not aviation safety limits.
- World position is not clamped to a screen rectangle. Flying into a wall or
  ceiling ends the attempt. Moving backwards is possible after extreme controls.
- Record is maximum completed attempt forward range, not cumulative path length.

## Verification

Automated tests check no artificial energy gain in still air, lift perpendicular
to airflow, launch power, dive tradeoff, stall/recovery, finite state, neutral
landing, collision sweep, and numerical equivalence across render frame rates.
Touch/browser checks exercise cancellation, pause, settings persistence and
relaunch. These checks do not establish real-world aerodynamic accuracy or FPS
and battery performance on the user's phone.
