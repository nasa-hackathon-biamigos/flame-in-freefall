---
# Ficha template (docs/SPEC.md §6.2). Copy to data/investigations/<slug>.md, or run
# `pnpm data:scaffold PSI-XX` to get this file with the PSI identification pre-filled.
# Rule of gold: a number without a source does not go in. Unknown = null (UI shows "not reported").
slug: example-slug                          # kebab-case, unique, must equal the file name
psi_id: null                                # e.g. "PSI-102" — required for partial/complete
experiment_name: null                       # official PSI title
acronym: null                               # e.g. SAME
aliases: []                                 # other names the chat should match, e.g. [SAME]
psi_url: null                               # https://psi.nasa.gov/physci/repo/data/investigations/PSI-XX
curation_status: draft                      # draft -> partial -> complete (see README "Curation workflow")
curators: []                                # e.g. [juliana]
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
related: []                                 # slugs of related fichas, e.g. [same-r]

earth_applications:                         # set the whole block to null if there is none
  sectors: []                               # first_responders, mining, buildings, aviation, manufacturing, healthcare, other
  spinoff_slugs: []                         # files in data/spinoffs/
  transfer_type: null                       # direct_spinoff | conceptual | dual_use_hardware

sources:                                    # complete needs 1+ source with a url
  - { label: "NASA PSI entry", url: null }
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
