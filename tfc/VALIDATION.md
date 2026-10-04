# Compatibility candidate 1.2.0-rc.1 — 2026-10-04

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
