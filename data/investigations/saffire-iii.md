---
# Skeleton generated from NASA PSI PSI-100 (fetched 2026-11-14) by `pnpm data:scaffold`.
# Read the PSI text in data/raw/psi/PSI-100.json (objectives, hypothesis, approach,
# research impacts, experimental tables, publications) and fill in the fields below.
# What PSI says (hints, not decisions):
#   platform: "International Space Station (ISS)"
#   hardware: "Saffire III enclosure in Cygnus"
#   area: "Combustion Science" / "Spacecraft Fire Safety"
#   related: PSI-99 (saffire-ii), PSI-98 (saffire-i)
# When identification + pillar are reviewed, change curation_status to partial.
slug: saffire-iii
psi_id: "PSI-100"
experiment_name: "Spacecraft Fire Experiment-III"
acronym: "SAFFIRE-III"
aliases: ["SAFFIRE-III"]
psi_url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-100"
curation_status: draft
curators: [anna]
last_reviewed: null                         # YYYY-MM-DD

fire_safety_pillar: []                      # 1+ of: prevention, detection, suppression
environment_tags: []                        # 0+ of: iss, lunar_habitat, pressurized_rover, spacecraft_cabin, spacesuit
gravity: []                                 # 1+ of: 0g, 1g, partial_future
platform: null                              # iss | cygnus | ground_lab | drop_tower | parabolic_flight | other
hardware: []                                # 0+ of: cir, mdca, msg, spice_duct, same_hardware, cygnus_saffire, other
material_class: []                          # 1+ of: solid, liquid_droplet, gaseous, smoke_aerosol
solid_form: []                              # only if material_class has solid: fabric, sheet, rod_cylinder, foam, wire_insulation, other
fuels: []                                   # free text, e.g. ["Kapton", "Teflon"]
sample_geometry: null                       # free text

atmosphere:
  o2_percent: { min: null, max: null }      # % by volume, 0–100
  pressure_psi: { min: null, max: null }    # psia, >0–30
  diluents: []                              # e.g. [N2, CO2, He]
  flow_velocity_cm_s: { min: null, max: null }
  flow_notes: null
  evidence: null                            # where the numbers came from (PSI section, table, paper, URL)

sensors: []
measured_variables: []
variables_changed: []                       # what varied in the experiment
variables_fixed: []                         # what was held fixed
lunar_relevance: null                       # 0–3: how directly it informs a lunar habitat
prediction_tags: []                         # see data/vocab.yaml (Caio)
related: [saffire-ii, saffire-i]

earth_applications:                         # set the whole block to null if there is none
  sectors: []                               # first_responders, mining, buildings, aviation, manufacturing, healthcare, other
  spinoff_slugs: []                         # files in data/spinoffs/
  transfer_type: null                       # direct_spinoff | conceptual | dual_use_hardware

sources:                                    # complete needs 1+ source with a url
  - { label: "NASA PSI PSI-100", url: "https://psi.nasa.gov/physci/repo/data/investigations/PSI-100" }
example: false                              # true = demo ficha, never shipped to production
---
## Summary

<!-- 2–4 sentences in English: what the experiment did. -->

## Why it matters for crew safety

<!-- 3–5 bullets: fire-safety reading (prevention / detection / suppression; ISS / Moon). -->

## Earth impact

<!-- 2–4 sentences: transfer to Earth, or "conceptual" explaining the link. -->

## Key results

<!-- Bullets with citable results, each with its origin (PSI section, paper, URL). -->

## Limitations

<!-- What this experiment does NOT answer (e.g. partial gravity, scale). -->
