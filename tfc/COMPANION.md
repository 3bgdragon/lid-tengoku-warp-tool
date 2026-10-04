# TFC companion — 1.2.0-rc.2

Requires Node.js 22.13+. Normal companion operations never rewrite UPKs or saves.
The separately confirmed Advanced → 5 interoperability repair only relocates
existing compressed UPK frames and updates EXE package links, with backups.
It does not edit logical game data, saves or DB. Advanced → 3 recovers an
interrupted layout repair before further installation.
Keep the game closed during both the TFC and companion steps.

For normal use, follow [the quick guide](START-HERE.ko.md).
The first menu is now: **1 Finish installation, 2 Finish removal, 3 Check connection, 4 Advanced, 5 Prepare compatible TFC package**.
The low-level commands described below are retained in Advanced or the command line.
Option 1 combines hash relinking with this mod's required native setup.

- **Sync package hashes:** reconnect EXE to current TFC UPKs after any UPK change.
- **Finish removal (`off` / `removed`):** after TFC removal, verifies the selected UPK component is OFF and normally disables only its native component. If all four mods' owned UPK components are OFF, it safely finalizes TFC full uninstall by disabling both native components and deleting only recorded material catalog rows. Other EXE/DB edits, UPKs and saves are preserved. Unknown conflicts and partial unexpected preset losses still stop.
- **Explicit full removal (`off-all`):** requires every owned UPK component OFF; refuses while any component remains installed. Ordinary change/relink never bypasses recorded preset-loss checks.
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
