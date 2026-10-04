# Compatibility candidate 1.2.0-rc.2 — 2026-10-04

Compatibility candidate, 2026-10-04; reviewed Steam build 25386710. Actual Nico DB Mod Manager 0.10.1 and TFC Installer 2.5.6.0 engines were tested separately from S3er0i9ng Mod Manager 1.3.20. File-copy tests passed; this update has NOT been retested through the GUI or in live gameplay. Unknown/conflicting layouts remain blocked. External managers can still overwrite files from cached originals; detected preset loss requires selected-feature reinstallation, not an old whole-file restore.

[Complete interoperability evidence](COMPATIBILITY-VALIDATION.md). Final recovery-journal/standalone-mode safety regression tests are also bundled.

## Historical validation below

# Validation — TFC edition 1.0.0, 2026-10-03

## Four-mod preflight update — 2026-10-04 (included in this compatibility candidate)

Repository-level evidence is in `COMPATIBILITY-VALIDATION.md` at the repository
root; that document is not required to run the separate TFC ZIP.
The generated-package workflow preserves reviewed independent edits before
TFC writes, then validates merged bodies and registered feature states before
native writes. Installing static templates directly bypasses this workflow.
The new actual-file suite passed 17/17 using E-drive disposable copies.

## Local instruction-scoped update — 2026-10-04 (included in this compatibility candidate)

- Actual TFC Installer 2.5.6.0 PackageUpdater serialized/reopened a combined
  warp + Faster Drops Initialize payload. The manager's verified byte change
  at serialized offset 23626 (0x14 → 0) was merged into an existing TFC object;
  this was not a claim that the manager itself permits that installation order.
- The old whole-function hash rejected this sample; the scoped verifier accepts
  it while verifying warp's instruction contexts. Identity, size, header and
  owned-context conflicts are rejected.
- Native enable, repeated enable, disable, failure recovery and process-exit
  recovery passed on disposable copies. UPK snapshots remained byte-identical.
- The real MASTER DB copy test preserved unrelated shop rows. No live game or
  save was changed. In-game verification of this new combination is pending.
- All four independently bundled TFC companions accepted the merged sample and
  rejected an owned-instruction conflict. Warp enable → vending enable → M2G
  sync → guard sync → selective native removal retained identical UPK snapshots.
- TFC's whole-function `.PackagePatch` replacement behavior is unchanged;
  arbitrary same-object installation order/merging is not certified compatible.

Reviewed Steam build 25386710, package version 861/19.

- Actual UPK Explorer / TFC Installer 2.5.6.0 UPK.Utils.dll and native LZO used.
- BrgGame patches: guard 7, warp 2, M2G 1, vending 11 objects; all 21 are disjoint.
- All 24 orders serialized/reopened and retained every expected object payload.
- Guard common package: 5 objects; warp map: 11 updates, 439 names / 224 exports.
- Companion tests: native installation/removal orders, unrelated edit preservation, failure and actual child-process termination recovery.
- Actual MASTER DB copy: 106 materials inserted/removed; unrelated shop rows preserved.
- Real reinstalled game: all four applied via actual TFC PackageUpdater; object readback, EXE links and DB integrity passed.
- The user launched the game and confirmed successful operation on 2026-10-03.

The real installation used TFC's engine directly with a separate full-file backup, not TFC GUI installation history. Complete GUI install/uninstall is a separate validation scope.
This confirmation does not prove every boss, weapon, daily restock cycle, foreign mod or other build. Same-object edits can conflict.

## Local full-uninstall fix validation — 2026-10-04

The previous companion incorrectly rejected TFC full uninstall because several
recorded presets disappeared together. The new explicit removal path proves all
four mods' owned components OFF under the operation lock before accepting that
state. Ordinary relinking/installation and partial unexpected loss remain strict.
This follow-up fix is included in tfc-v1.2.0-rc.2. The earlier rc.1 ZIP does
not include it. Standalone code and its separately published ZIPs are unchanged.

On Steam build 25386710, a disposable fixture retained the EXE/DB/controller
state from installing all four published TFC packages with the actual TFC
2.5.6.0 engine. Its four original UPKs were restored to reproduce full uninstall.
This reproduces the resulting file state; it is not a TFC GUI uninstall test.

The common-runtime integration suite `tests/removal.test.js` passed 12/12:

- Each guard/warp/M2G/vending removal command completes full uninstall; a second
  call is a no-op and leaving TFC mode succeeds.
- Unrelated EXE edits, Nico file-check OFF names and unrelated DB row changes
  survive. Only the recorded 106 material rows are removed. UPK hashes and the
  fixture save remain unchanged.
- Ordinary change/relink rejects simultaneous loss; explicit off-all accepts
  only all-OFF. Missing older UPK receipts do not waive the all-component proof.
  Invalid duplicate receipts, installed components and partial loss are rejected.
- Selective guard removal retains an enabled vending native component/catalog.
- Injected interruptions before commit, after EXE and after DB recover the
  exact prior EXE/DB/state and allow safe retry.
- Owned-native conflicts, changed recorded catalog rows, SQLite journals and
  transaction locks still reject writes.

The runtime, CLI and removal test copies are byte-identical in all four repos.
Combined default standalone/TFC regression runs passed: warp 117, guard 84,
M2G 93, vending 115 (409 passed, 107 optional integration skips, zero failures).
The 12 actual-file removal tests above were run separately without skips.
Sandbox task-list/temporary-EXE restrictions required rerunning these checks
outside the sandbox; the reruns passed without weakening production checks.

Reproduce using Node.js 22.13+ with `LID_TFC_REMOVAL_SOURCE` pointing to a
disposable all-OFF-UPK fixture that still has the all-installed controller
state/EXE/DB; optionally set `LID_TFC_TEST_ROOT` to a test directory, then run
`node --test tests/removal.test.js` from the TFC folder.
The source fixture and real installation are not mutated. This follow-up did
not launch gameplay; all six real game-file hashes and save hashes still match
the clean reinstall baseline.
