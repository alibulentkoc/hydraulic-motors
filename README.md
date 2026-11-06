# Hydraulic motors and oscillators: animated teaching site

Interactive cross-sections and 3D cutaways of hydraulic motor types, rotary actuators (oscillators), worked agricultural and industrial examples, and the core formulas. Plain HTML, CSS and JavaScript; no build step.

## Pages

| Page | Contents |
|---|---|
| `index.html` | Motor types: external gear, internal gear, gerotor, geroller (orbital), unbalanced vane, balanced vane, axial piston fixed and variable (swashplate), bent-axis piston, radial piston. Section or 3D view, symbol, and a calculator for each. |
| `oscillators.html` | Single-vane, double-vane, rack-and-pinion and helical rotary actuators, with calculators and animated applications (clamping, gate, transfer, unloading, indexing). |
| `applications.html` | Worked examples: planter vacuum fan, air cart fan, seed auger, grain cart, header reel, clean grain elevator, tillage rotor, thresher, concrete mixer, conveyor, injection-moulding screw. Published-data examples link to their sources. |
| `formulas.html` | Core formulas in pure, SI and US forms; interactive T = F × r pulley; a basic motor circuit; schematic symbols. |

Each motor has its own link, for example `index.html#geroller` or `oscillators.html#rack-pinion`.

## Publish on GitHub Pages

1. Create a new public repository, for example `hydraulic-motors`.
2. Upload the **contents** of this folder so that `index.html` is at the top level of the repository (not inside another folder).
3. Settings → Pages → Deploy from a branch → `main` / `(root)` → Save.
4. The site appears at `https://<user>.github.io/hydraulic-motors/` after a minute or two.

With Git:

```bash
cd path/to/hydraulic-motors
git init
git add .
git commit -m "Hydraulic motors site"
git branch -M main
git remote add origin https://github.com/<user>/hydraulic-motors.git
git push -u origin main
```

## Files

- `js/common.js` – units, formatting and geometry helpers
- `js/planar.js` – draws each machine as an SVG section and an extruded 3D cutaway from the same shapes
- `js/motors.js` – motor types: geometry, animation, teaching text and calculator
- `js/osc.js` – oscillator types and application scenes
- `js/apps.js` – worked application examples
- `js/nav.js` – the link bar shared by all pages

Drawings are simplified and not to scale. Calculations are ideal unless efficiencies are given; confirm with manufacturer data before selecting a motor.
