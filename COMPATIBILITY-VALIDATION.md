# Compatibility release-candidate checks — 2026-10-04

Scope: reviewed Steam build 25386710; standalone and separate TFC editions.
No live installation or save was written during these tests.

## Release scope: reviewed file-level interoperability

Nico DB Mod Manager 0.10.1, official source commit
`984be7ba5ff162d7639c4376fb3e118fe6171133`, was tested separately from
S3er0i9ng's Mod Manager 1.3.20. They are different tools.

- Nico's real parser opened both current TFC-patched BrgGame/common packages.
- Its real Instant Drops asset runner initially retained all four owned features.
- Nico's file-check OFF renames entries to `.upX`/`.upY`. The scanner now
  reads PE RCDATA 1010, recognizes only those reviewed aliases, requires the
  complete duplicate count and rejects mixed ON/OFF entries. OFF names survive
  relinking/native operations. Unknown names or native-byte conflicts still fail.
  The actual Nico OFF output and all eight bundled readers passed these checks.
- After a later external M2G disable, Nico reapplied its kept original and
  re-enabled M2G without reporting a conflict. The saved-original cross-tool
  ownership problem remains in the external manager. Our controller detects the
  lost recorded preset before EXE/DB writes; targeted TFC preset reinstallation
  was tested, preserving Nico Instant Drops and OFF names. We cannot prevent an
  external manager from overwriting a package outside our transaction.
- Nico's resulting byte-patched UPK was rejected by actual TFC 2.5.6.0 with
  `Gap of 258628B detected between two disk data blocks`.
  An explicit repair is now available under TFC Advanced → 5. It backs up EXE
  and BrgGame/common UPKs, moves existing compressed frames without changing
  logical data, then relinks EXE hashes without re-enabling OFF checks. Actual
  TFC read/apply, idempotence and injected interruption recovery passed on
  Nico-generated files. Lost presets are reported, not silently adopted.
- Nico accepted guard, M2G, vending and warp-BrgGame default TFC payloads in
  its actual transformer, but refused warp's map because it changes/adds
  package tables. That component still requires TFC Installer.

These are disposable-copy engine tests, NOT GUI or gameplay passes. Windows
computer-use initialization failed twice (`failed to write kernel assets`,
OS error 3), so GUI and in-game testing remain pending. This compatibility update is published as a prerelease with these limits.
The positive suites below do not certify universal compatibility or gameplay.

## Safety rules

Standalone selected recovery: if an external manager resets a
recorded guard or M2G preset, close the game and run
`upk-compat.bat "<game folder>" --reapply=guard` or `--reapply=m2g`.
It restores only recorded reviewed functions, keeps independent edits and OFF
names, and makes a transaction backup. Unknown instructions still stop.
It does not guess missing warp map tables; those require TFC.

- Check owned function identity, supported layout, instruction bytes and required
  context before writing. Unknown/conflicting cases stop rather than overwrite.
- Preserve independent bytes for reviewed equal-size edits. Length-changing
  functions require an exact reviewed body; arbitrary branches are not relocated.
- Standalone stages package/EXE changes and verifies owned functions and other
  mods' functions before committing. Existing backup/receipt conflict guards remain.
- TFC option 5 prepares a game-specific package without writing game files.
  Install it immediately with TFC, then finish from the generated folder.
  Finish checks all recorded merged bodies, including unselected features, and
  previously registered settings before changing EXE/DB files. Prepare again
  after intentional later edits. TFC installs/removes features; the explicitly
  confirmed layout repair only relocates existing compressed frames.

## Evidence

- Final release safety tests also reject package preparation or TFC detach while
  either recovery journal exists, and preparation while a standalone receipt is
  active. Four new regression cases are bundled in each TFC edition.

- Four standalone regression suites (after Nico fixes): 296 cases, 267 passed, zero failures,
  29 optional fixture cases skipped. Test temporary files were on E drive.
- Actual Nico OFF/resource validation passed in all eight bundled readers.
- Actual Nico UPK gap repair, exact interruption recovery, idempotence and
  subsequent TFC engine application passed. The test retained Instant Drops
  and OFF names through targeted M2G preset reinstallation.
- Standalone recorded M2G-only recovery restored its prior preset while
  preserving other functions and Nico OFF names.
- TFC regression suite: 16 passed, zero failures, one optional DB case skipped.
- Final Nico/standalone sequence: ten steps passed (all four enables, actual
  Nico Instant Drops + OFF, guard setting change, all four selective removals).
  Instant Drops and OFF names survived; source files were unchanged.
- Final TFC repair/full-function-proof suite: four passed, zero failures,
  zero skips, including unselected-function loss detection.
- Actual-copy standalone sequence passed nine steps: enable all four, change
  guard settings while all are active, then remove each mod separately. Faster
  Drops remained intact throughout; all four owned BrgGame states ended off.
  Read-only source hashes stayed unchanged.
- Actual TFC Installer 2.5.6.0 engine applied all four prepared packages over
  Mod Manager 1.3.20 Faster Drops files. Selected bodies and other mod functions
  passed readback checks; Faster Drops' independent instruction stayed intact.
- Simulated later removal of the recorded M2G function was rejected by all four
  independently bundled companions before EXE, DB or receipt writes.
- Actual-file TFC suite passed 17/17 on E-drive disposable copies, including
  interrupted writes, child-process termination, selective native removal and
  a real MASTER DB copy with unrelated rows preserved.
- Existing four-default-mod TFC order tests passed all 24 orders. Separate
  same-object foreign-edit probes reproduced overwrite by static full-function
  templates, motivating the preparation workflow.

## Limits

An external TFC installer cannot be forced to run this preflight. Directly
installing static templates or changing files between preparation and installation
bypasses its pre-write protection. Regenerate from the original source/preset.
Unknown map-table changes and external edits made after a standalone receipt
can still be blocked conservatively. This is not a universal foreign-mod merger.
File verification is not new gameplay certification. Standalone and TFC release-candidate ZIPs are separate. The TFC ZIP includes
this evidence; live gameplay and GUI validation remain pending.
