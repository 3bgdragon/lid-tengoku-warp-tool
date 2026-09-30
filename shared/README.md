# Shared composition protocol — development preview

This identical bundle ships in the warp, Just Guard, M2G and vending tools.
No other checkout or Python is needed at runtime. The vending recipe currently
targets Steam build 25386710; unknown code is not automatically authorized.
Use Node.js 22.5+ for legacy vending registration and material DB operations.

## Ownership and safety

- The existing canonical warp/JG/M2G builders remain responsible for their changes.
- A verified vending layer is separated in a temporary six-file copy, the requested
  operation runs there, and vending is rebuilt on the resulting canonical pair.
- Actual files are checked again immediately before installation. Changed files
  are verified afterward; partial installation and receipt-write failures roll back.
- A writer lock rejects overlapping operations. Foreign changes, unknown code,
  damaged receipts/baselines and DB recovery sidecars are rejected, not overwritten.
- Selective vending removal deletes only its 106 recorded, unchanged material rows.
  Other DB rows and mods are preserved. Full snapshot restore requires exact current
  after-hashes and is deliberately blocked after later changes.
- Saves, stock timers and purchase/ammo/decal history are not edited by this protocol.

The visible `<game>/LID-Mod-State` stores receipts, baselines, snapshots and backups.
Do not delete it when replacing a tool ZIP. Matching legacy vending backups can be
registered with vending option 8; `LID_VENDING_BACKUP_DIR` overrides their location.
Missing original backups cannot be reconstructed by guessing.

## Verified on 2026-09-30

- All 24 installation orders of V/W/G/M passed on real-file workspace copies.
  Every order produced identical SHA-256 hashes for all six game files.
- After each order, removal in W/M/G/V order restored all five original binaries
  and all original automatic-shop rows. DB page layout need not be byte-identical
  after selective row deletion.
- Separate final-bundle representative roundtrip passed.
- All 24 removal orders passed (96 selective removals); every remaining mod subset
  had order-independent binary hashes and automatic-shop rows.
- The 512-state settings matrix passed: 64 canonical guard/warp/M2G profiles,
  384 active-vending combinations and 128 language-neutral stock states. The matrix
  reused 64 byte-identical validated menu recipes while rebuilding and checking
  each distinct executable and its actual package links.
- All 32 shared guard-setting transitions preserved active warp/M2G/vending layers.
  A separate foreign-script preservation roundtrip and damaged companion-package
  rejection tests also passed after the final package-link safety changes.
- Legacy registration changed no game bytes; material-only, decal and ammo feature
  transitions, language rebuilding and repeated identical application passed.
- Shared full restore, blocking stale restore, and vending removal while preserving
  warp/M2G passed on real-file copies.
- Four repository regression suites: 184 passed, 0 failed, 8 conditional tests skipped.
  The latest-build conditional Just Guard test was additionally run on real-file
  copies: all 16 settings, duplicate settings and exact restores passed.
  Fault tests include second-file install failure and receipt-write failure.
- Hard process exits during staging and after the first file install retain the
  lock/evidence and block blind retry. This is fail-closed behavior, not automatic
  interruption recovery or a physical power-loss test. Keep the state folder and
  report logs; do not blindly delete its lock or force an old whole-file restore.
- A tampered owned material row rolls back row deletion. Actual package links are
  checked even for a known exact EXE; changed companion packages block application.
- Verified identical M2G application is now a no-op, without a new backup or orphan
  baseline generation. No-op verification still detects intervening file changes.
- Each repository contains the same kernel and safety tests. Game installation and
  saves were not patched by these integration tests.

These are file/protocol tests, not gameplay or combat validation of the new paths.
They do not promise support for future builds or arbitrary third-party patches.

Developer reproduction from the vending checkout, with all four sibling checkouts:

```text
node --no-warnings dev/test-shared-composition.js --all --source "stock game copy"
node --no-warnings dev/test-shared-composition.js --extras --source "stock game copy"
node --no-warnings dev/test-shared-composition.js --removals --source "stock game copy"
node --no-warnings dev/test-shared-composition.js --matrix --source "stock game copy"
```

`--db "stock masters.db"` selects a separate source DB if needed. Sources are only
read; generated copies live under `.work`. The developer bundler is
`dev/build-shared-layers.js`; preserve identical kernel and test bytes across peers.
