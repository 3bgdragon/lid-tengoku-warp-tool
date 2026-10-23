# Steam build 25923506 — compatibility validation

Date: 2026-10-23 (Asia/Seoul). Candidate source; live gameplay on this build remains unverified. No commit, push or release is implied by this report.

## Inputs and cause

Steam manifest build: 25923506, depot 794601 manifest 5609702469581107662. EXE SHA-256: f33e91e6e8d58566bfabad8d01cd0486586a0d43fe1c58e65fc6485a417bddfd.

BrgGame exports changed 173671 -> 173715, names 79169 -> 79186 and imports 12291 -> 12290. Matching only a new whole-file hash would not repair the changed function and reference positions. Old catalogs and native profiles remain separate.

## Changes

Warp has new native hook/dependency locations, reversible native/map assets, KO/EN map profiles and scoped BrgGame objects. The new Heaven map preserves 90 update bytes in unowned objects. TFC refuses unknown changes to 213 unowned map objects before applying its table-bearing template.

All four tools retain metadata, owned-instruction, native dependency, receipt and post-write checks. Unknown external edits are not assumed safe. The new TFC templates are selected through a digest-checked registry; the old templates remain for old builds. The standalone and TFC editions remain separate. Runtime still requires only Node.js; analyst Python/C#/UELib are not runtime dependencies.

Steam may replace the game files but leave an old standalone or TFC receipt. Explicit recover-updated-state.js inspection/archive is available only for six exact reviewed stock files. It preserves the entire old state folder beside the installation, never restores old game bytes, never runs automatically, and refuses mixed files, pending operations, filesystem links, game execution and races. See RECOVER-STEAM-UPDATE.md. A current-build pristine no-op TFC receipt is not misclassified as an old build.

## Evidence and executed checks

- Unique full-object-path mapping of 21 BrgGame functions. Token-aware old stock relocation reproduces every complete new stock body exactly. 88 new preset bodies have separate metadata/SHA-256 evidence.
- Independent UE decoding of 21 representative enabled functions: 19,095 token shapes/positions retained and all 848 branch destinations land on token boundaries.
- Ghidra independently identifies the 2,469-byte floor function and 370-byte request function. Native relocation checks three hook windows, 181 reachable instructions and 65 relocations; import identities are matched rather than uniformly shifted. The one changed later virtual-call slot in the floor function is explicitly reviewed, not masked arbitrarily.
- New native execution with explicit engine/API stubs: 24 warp cases, 15 bootstrap cases and 12 selector-loop cases. This does not exercise actual engine streaming, combat, clock or save persistence.
- Disposable new-build standalone copies: all four individual tools (20 checks) and forward/reverse installation sequences (28 checks), including reapply, selective removal and byte-exact six-file transaction restoration.
- Actual TFC 2.5.6.0 processing: all four individual tools (20 checks), forward/reverse sequences (28 checks), plus all 15 valid guard option configurations. Actual output bodies are checked; a reported update count alone is not installation proof.
- Broad regression batch: 563 passed, 0 failed, 109 optional fixture-dependent cases skipped. Additional new-build/catalog, recovery and scoped-option tests are run separately after narrow follow-up fixes. Runs overlap and must not be summed as unique tests.
- Final revised-source suites: 594 passed, 0 failed, 108 optional fixture-dependent cases skipped across the four standalone and four TFC test suites. The older shared-tool rejection assumption and non-owned ammo Tick assumptions were corrected with explicit preservation assertions; original failed-run logs remain in the private workspace. The selected final result paths are recorded in final-results.json.
- Save multitool validation is documented separately in its repository: no runtime code change was needed for the new DB/save-copy checks.
- Follow-up focused batch: 207 passed, 0 failed, 78 optional cases skipped. The new-build KO/EN vending matrix covers all eight materials/decal/ammo/full selections, reapply, selective removal and exact backup restoration. Old/new KO/EN decals-only probes also passed. These batches overlap with the broad suite.
- The four standalone tools share the same reviewed vending composition protocol, including ammo-only feature ownership. A feature that does not own the decal Tick bridge must preserve it byte-for-byte; enabling the decal bridge still refuses unknown conflicting instructions.
- After that common protocol update, the new-build full forward/reverse standalone batch passed again (28 checks). New-build KO/EN ammo-only cross-tool batches passed 24 checks and the old-build KO regression passed 12; the synthetic unowned Tick, selected ammo functions and exact reverse backup restoration were checked separately.

Private test evidence is in the task workspace lid-build-25923506-check (input-manifest.json, native-address-analysis.json, native-relocation-proof.json, native-execution-summary.json, package-analysis/REPORT.md and result JSONs). No raw user save, private diagnostic, full EXE/UPK/DB or analyst binaries are bundled with this mod.

REA static evidence: floor ev_ee15848c4f4119efef891c08087396c6e1415104d585003448b22bf2caaa1e30; request ev_6f26aa8608707dd1de76993850c867f9285b6003f9a494646bd77d6892d2db65. These are static observations, not gameplay recordings.

## Remaining boundaries

Live travel/combat/guard, purchase/decal/ammo persistence and reporter environments still need in-game confirmation. Arbitrary new third-party mods and new Nico-manager GUI combinations are not certified by this batch. No live installation or save was changed during validation; use the updated tool for explicit recovery/reapplication rather than deleting state or restoring an old-build snapshot.
