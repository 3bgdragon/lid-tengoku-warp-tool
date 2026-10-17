# Foreign UI instructions and vending/91836 — 2026-10-17

This source fix applies to the shared standalone ownership reader and the separate
TFC runtime. No game assets, EXE hooks, DB recipes, saves or preset values change.

## What is fixed

TFC preparation previously required the entire uninstalled vending function
`BrgUIMenu_SkillExchange.Tick` (zero-based export 91836) to equal its stock body.
An independent equal-size UI edit could therefore stop warp preparation with
`Existing mod has conflicting instructions: vending/91836`, even without an
installed vending preset.

Only its reviewed OFF layout is now eligible for preservation: exact function
length, header, branch operands/opcodes, bridge insertion context and trailer
must match the reviewed evidence. Independent bytes outside these regions are
kept exactly, not replaced by a stock function. The adjacent evidence file is
self-contained so a TFC-only ZIP does not depend on a standalone checkout.

- Preparing/installing a different mod preserves eligible UI bytes and records
  their exact body in the existing post-install proof.
- A damaged ON body, partial vending bridge, lost recorded preset, resized
  function or protected-region conflict is still rejected before writes.
- Enabling a length-changing vending preset over a foreign UI body is still
  blocked: this fix does not implement arbitrary bytecode relocation.
- Regenerate a game-specific TFC preparation folder with the updated runtime;
  an old prepared folder contains the old validator.

## Validation and limits

Eight regression cases run in each edition: eligible OFF preservation, unsafe
ON merge refusal, damaged ON rejection, protected header/context/branch/trailer
rejection, and resized/other-function rejection.

All four repositories' combined standalone/TFC regression suites passed:
475 passed, 0 failed, 119 optional fixture-dependent cases skipped. These skips
are not counted as successful integration tests.

On disposable build 25767944 copies, an independent equal-size UI mutation
reproduced the exact error using the old released TFC runtime. The actual TFC
2.5.6.0 package-processing engine then installed M2G and warp using the updated
runtime, preserving the UI body, M2G, DB and valid EXE package links. Repeated
finish was a no-op; post-install proof loss, active vending damage and an unsafe
vending merge remained blocked. Standalone M2G/warp install and selective
removal also preserved the UI body. Eleven integration checks passed.

The mutation is a synthetic regression fixture, not the reporter's package or
an installed HUD Tweak binary. No live game, save or gameplay was tested in this
run. This does not certify all foreign modifications or prove which external
mod caused the report. Existing managers can still overwrite files outside our
transaction; the exact post-install proof detects such losses.
