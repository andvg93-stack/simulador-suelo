# Soil Contamination Simulator (Cd²⁺)

A browser-based teaching simulator for **Soil Physical Chemistry – Cadmium contamination**.

## Run locally

```bash
npm start
```

This starts a local static server; open http://localhost:5173 in your browser.

## What it includes

- 4-zone layout:
  - Header
  - Left controls panel
  - Center 2D conceptual soil profile
  - Right panel with indicators, charts, and auto-explanation
- 12-week discrete simulation with:
  - **Run Simulation** (full run)
  - **Step Forward** (one week)
  - **Reset** (back to week 0 defaults)
  - **Export Results** (JSON download)

## Model assumptions (didactic)

- Cd is partitioned weekly into dissolved / adsorbed / immobilized fractions.
- Lower pH increases dissolved Cd (higher mobility).
- Higher pH, CEC, clay tendency, and OM increase adsorption and reduce dissolved pool.
- Rainfall + permeability increase leaching from surface to deeper soil.
- Shallow groundwater increases groundwater risk score.
- Interventions:
  - Lime gradually raises pH.
  - Biochar/Compost increases adsorption capacity.
  - Vegetative cover affects explanation/transport context (not leaching directly in MVP).

## Tweak constants/ranges

- Defaults and categorical factors: `src/constants.js`
- Partitioning, leaching, risk formulas, clamping: `src/model.js`
- UI ranges/labels: `index.html`

## Automated checks

Run:

```bash
npm test
```

Checks include:

- Fractions sum to ~1.
- Increasing pH decreases dissolved fraction.
- Increasing rainfall increases weekly leaching.
- Default run length is 12 weeks (+ initial week 0).
