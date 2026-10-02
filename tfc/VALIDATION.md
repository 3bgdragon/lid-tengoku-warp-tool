# Validation — TFC edition 1.0.0, 2026-10-03

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
