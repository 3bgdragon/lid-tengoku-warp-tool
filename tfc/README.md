# Tengoku Warp — TFC edition

[한국어 사용법](START-HERE.ko.md)

**TFC-only release: tfc-v1.1.0.** Download the attached `*-tfc-v1.1.0.zip` asset, not GitHub's source-code ZIP.
This ZIP has its own launcher and runtime. The standalone release and root launcher are a different distribution and are not included here.

Steam build **25386710**. Requires Node.js **22.13+** and TFC Installer **2.5.6.0**.

Select standard Tengoku entry at floor 51 / 101 / 201 / 301.

## Install

Close the game and back up your save. Remove standalone patches with their original tools before switching; do not mix installation modes.

1. Install this **tfc folder** through TFC.
2. Run **tfc/run-tfc.bat → 1. Finish installation**.
Launch the game after completion. Enter the game folder or BrgGame-Steam.exe path when asked.
Finish installation performs the required hash relinking and native setup together; no additional Sync step is needed.

## Remove

Remove the UPK mod with TFC while the game is closed, then run its **run-tfc.bat → 2. Finish removal**.

## Troubleshooting only

- **3. Check connection**: checks EXE links; not a full gameplay or UPK-preset status report.
- **4. Advanced**: refresh hash links after another TFC UPK mod changes files, restore previous native settings, or recover an interrupted operation.

All needed runtime files are inside `tfc/` or the generated mod folder. Companion does not rewrite UPKs or saves.
TFC manages UPK backups; companion manages EXE/DB settings. Backups are at `<game-parent>/LET-IT-DIE-TFC-backups`.
Keep `<game>/LID-TFC-State`; never delete receipts manually. Purchases, decals and ammo/save changes are not undone.
Each mod's UPK payloads remain separate. Foreign edits to the same objects can conflict.

See [COMPANION.md](COMPANION.md) for recovery details and [VALIDATION.md](VALIDATION.md) for test coverage.
