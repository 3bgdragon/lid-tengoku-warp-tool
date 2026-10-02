# TFC companion — 1.0.0

Requires Node.js 22.13+. The companion never rewrites UPKs or saves.
Keep the game closed during both the TFC and companion steps.

For normal use, follow [the quick guide](START-HERE.ko.md).
The first menu is now: **1 Finish installation, 2 Finish removal, 3 Check connection, 4 Advanced**.
The low-level commands described below are retained in Advanced or the command line.
Option 1 combines hash relinking with this mod's required native setup.

- **Sync package hashes:** reconnect EXE to current TFC UPKs after any UPK change.
- **Enable / Disable native component:** controls this mod's warp or vending native component only. Guard/M2G require Sync only.
- **Restore previous native settings:** restores prior native configuration, not an old whole game image; refuses intervening EXE/DB edits.
- **Recover interrupted operation:** restores recorded before-state only if current bytes and UPKs match the transaction.
- **Status:** shows native warp/vending settings, not TFC's full UPK installation list.
- **Leave TFC mode:** after both native components are disabled and TFC UPKs uninstalled; keeps backups/baseline blobs.

Backups survive re-downloading the repository:
`<game-parent>/LET-IT-DIE-TFC-backups/<installation-id>/<timestamp-id>/`.
Shared state: `<game>/LID-TFC-State`. Do not delete it manually.
Standalone and TFC receipts are mutually exclusive.

Compatible unrelated EXE edits are preserved. Conflicting owned bytes, changed sections/overlays, SQLite journals, altered owned catalog rows and missing required TFC objects fail closed.
Vending removes only recorded material rows. TFC restores UPKs; companion restores native settings.
Neither undoes purchases, attached decals, ammo or save data.

See [README.md](README.md) and [VALIDATION.md](VALIDATION.md).
