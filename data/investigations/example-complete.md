---
# EXAMPLE ficha — fictional, for UI development only. Excluded from production and from the
# public export. Shows every field filled in; real fichas follow data/_template.md.
slug: example-complete
psi_id: null
experiment_name: Example Investigation (fictional, complete)
acronym: EXAMPLE-C
aliases: [EXAMPLE-C]
psi_url: null
curation_status: complete
curators: [pedro]
last_reviewed: 2026-11-14

fire_safety_pillar: [prevention, detection]
environment_tags: [iss, lunar_habitat]
gravity: [0g]
platform: iss
hardware: [msg]
material_class: [solid]
solid_form: [fabric]
fuels: ["Example fabric A", "Example fabric B"]
sample_geometry: "Example flat sample"

atmosphere:
  o2_percent: { min: 20, max: 35 }
  pressure_psi: { min: 8, max: 14 }
  diluents: [N2]
  flow_velocity_cm_s: { min: 5, max: 20 }
  flow_notes: "Example forced flow."
  evidence: "Fictional values for the example ficha."

sensors: ["Example camera"]
measured_variables: ["Example flame spread rate"]
variables_changed: ["O2 concentration", "flow velocity"]
variables_fixed: ["sample material"]
lunar_relevance: 3
prediction_tags: [high_oxygen, solid_flammability]
related: [example-partial]

earth_applications:
  sectors: [first_responders]
  spinoff_slugs: []
  transfer_type: conceptual

sources:
  - { label: "Example source", url: "https://example.com/" }
example: true
---

## Summary

This is a fictional example ficha used to develop the interface. It does not describe a real experiment.

## Why it matters for crew safety

- Example bullet about prevention.
- Example bullet about detection.
- Example bullet about lunar habitats.

## Earth impact

Example text describing a conceptual transfer to Earth.

## Key results

- Example result (source: example).

## Limitations

- Fictional data; no partial-gravity coverage.
