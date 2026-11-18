# LET IT DIE 5.0.6.0 / Steam build 26639365 compatibility candidate

Date: 2026-11-19. Release-candidate validation record. These checks were performed before publication and do not imply live gameplay verification.

## Observed inputs and implementation

The installation reports Steam build 26639365 / depot manifest 7997761655594972160. All six scoped files changed. EXE SHA-256: 6cfadbba9da3e2f3b3a4463194d247a50d2537a3ad704174730a0bbf899e42ca. New stock master DB: db9a81a1eb05036eb7171a993958d17a048889491fb2326cd5d686e8e010fd7a. Old profiles/catalogs remain separate.

Warp uses new native hooks, reversible map assets and KO/EN selector profiles. New unrelated map bytes remain intact.

The BrgGame export count is 173769 (previously 173715). Twenty-two owned full-object paths were matched uniquely. The new 95-preset catalog does not merely accept a new hash: it records current headers, object identities, names/references and exact owned instructions. Unknown incompatible edits remain blocked.

The new vanilla vending program really changed: SetupTopMenu +120 bytes, TickASync +1359 bytes, new disassembly menu/state branches and StartShop state base 23. The reconstructed programs preserve every new vanilla instruction through inverse-removal checks. Ordinary mState 7 and the native Deathroid state branch remain unchanged. A targeted menu-index/definition prefix fixes the hidden-Bloodnium Deathroid row mapping, so native Deathroid selection and locking retain the correct row; buy-only Tower menus retain their separate mapping. The independent actual-insertion interpreter tests exercise menu selection, decal modal open/close, ammo selection/confirmation, payment/cancel and save-once paths.

Native support uses unique full-function normalized matching, not a uniform address shift. Three warp hook windows, 181 reachable generated instructions and 65 relocations were checked; imported APIs are matched by DLL/symbol identity. Ten dependency functions were matched completely. The saved-shop initializer (46 bytes), constructor (278 bytes) and serializer (7161 bytes) also match completely after relative relocation normalization: the initializer passes global+8 and the serializer's +0x84/+0x94 members confirm global+0x8c/+0x9c. This is static layout evidence, not observed gameplay.

Steam-update recovery explicitly preserves old state/backups instead of deleting them. It recognizes exact six-file stock profiles for 26639365 and 25923506, reports the actually matched build and pins that profile throughout an archive operation. Even switching between two reviewed stock builds during the operation is rejected as a race. Mixed/modified files, running games, filesystem links and pending operations remain blocked. Detection short-circuits as soon as no reviewed profile matches (avoiding unnecessary package reads for an already-patched EXE); a positive result still requires all six exact hashes, with no caching or race-check reduction.

## Executed checks and evidence

Final nine-suite batch after the conditional UI fix: **726 passed, 0 failed, 112 optional/fixture-dependent skipped** (`unit-results-QKMRKR/results.json`). This includes all four standalone suites, four TFC suites and the save-tool suite; overlapping focused batches below are not added as unique tests.

- Independent REA/Ghidra native observations: floor function 2469 bytes at 0x1412135d0 (ev_f79ea2ce955ddda00cf394eb363aa0f237f072b87217ff5a87a55394546847c7), request function 370 bytes at 0x141103170 (ev_7b4633814ef4176a100b2bbe962b5bf33c43d3c90384a46f5539d3acb8d62424), and shop serializer at 0x140eeeb00 (parent ev_2151a3664126a34ea7a8a3662cfedbaf343b0daaa0e7038f377382aa22c1be3e). The serializer's complete 27863-character pseudocode was read through two retained views after the full dossier exceeded transport limits; that was a transport boundary, not a truncated analysis. Static pseudocode is not execution evidence.
- Actual new-file standalone individual application/reapplication/removal/exact six-file backup restoration: 20 checks passed.
- Final frozen-source standalone forward/reverse combinations: 28 checks passed, including exact six-file backup restoration. Korean/English ammo-only and decals-only chains with all other three mods: 48 checks passed, including all four exact restorations.
- Actual TFC 2.5.6 engine: four individual modes (20 checks, vending repeated after the final UI/template fix) and final forward/reverse four-mod combinations (28 checks) passed. The new vending template has 12 objects. TFC removal verifies package feature state, preserved DB data, native OFF and metadata detach; it does not claim byte-identical restoration of serialized UPK containers.
- Native code execution with explicit API/engine stubs: 24 warp + 15 bootstrap + 12 selector cases passed. Real streaming, real clocks, input and persistence are not exercised.
- Independent UELib decoding: all 95 new presets, 67,903 token records and 5,098 branch-boundary checks passed.
- Actual-insertion KO/EN full/ammo navigation/payment/cancel/save interpreter matrix: 58 passed, two intentional decal-only exclusions; separate KO/EN decal-only flows also passed.
- Actual complete new-stock UI programs (not mocked row counts): 48 conditional cases passed across Korean/English, full/decal/ammo modes, buy-only/normal menus, hidden/visible Bloodnium and locked/unlocked Deathroid entries. The original hidden-menu mapping defect is reproduced in a separate baseline test.
- Actual TFC 2.5.6 engine/configuration processing: all 15 valid guard configurations passed.
- Additional native/recovery checks include old-profile archiving and a two-reviewed-build race refusal. Combined standalone/TFC chains, partial modes and final broad suites have separate result JSONs in the private task workspace. Do not count an incomplete run as passed or sum overlapping batches as unique cases.
- The save tool separately guards external old whole-DB fighter restoration before any write, preserving the new item schema/Deathroid data. See its own validation report.

Private evidence: input-manifest.json, native-address-analysis.json, native-relocation-proof.json, native-bootstrap-layout-proof.json, native-execution-summary.json, package-analysis/REPORT.md, token-proof.json, guard-options-results.json and the final integration/unit result JSONs. No complete game executable/package/DB, raw save, private diagnostic, analyst DLL or Python runtime is shipped as a mod dependency.

## Boundaries

Standalone and TFC remain separate installation methods. TFC writes UPK components; its native companion writes only its scoped EXE/DB components. This mod's shared compatibility data does not automatically enable other mods. Keep state and independent save backups; never restore an old-build whole-file snapshot over an updated game.

Real game combat/travel/Just Guard, Deathroid disassembly, purchases, daily reset and saved/relogin persistence still need user confirmation. Arbitrary third-party or Nico-manager GUI combinations are not certified. All mutation tests used disposable copies; live game/save/state were untouched. Publication status is recorded on GitHub; this report describes the pre-publication offline validation.
