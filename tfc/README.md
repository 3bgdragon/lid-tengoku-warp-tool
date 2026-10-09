# Tengoku Start-Floor Selector — TFC edition

> Steam build 25767944 RC: [validation and limitations](BUILD-25767944-VALIDATION.md). File/engine tests completed; new-build live gameplay pending. / 새 빌드 파일·처리 엔진 검증 완료, 실게임 검증 전.

[한국어 사용법](START-HERE.ko.md)

**TFC-only prerelease: tfc-v1.2.1-rc.1.** Download the attached `*-tfc-v1.2.1-rc.1.zip`, not the Source code ZIP. This distribution includes its own launcher/runtime and no standalone launcher.

Requires Node.js **22.13+** and TFC Installer **2.5.6.0**. Reviewed Steam build **25386710**.

Select floor 51 / 101 / 201 / 301 at standard Tengoku entry. The map/table component requires TFC Installer; Nico alone cannot apply that component.

Compatibility candidate, 2026-10-04; reviewed Steam build 25386710. Actual Nico DB Mod Manager 0.10.1 and TFC Installer 2.5.6.0 engines were tested separately from S3er0i9ng Mod Manager 1.3.20. File-copy tests passed; this update has NOT been retested through the GUI or in live gameplay. Unknown/conflicting layouts remain blocked. External managers can still overwrite files from cached originals; detected preset loss requires selected-feature reinstallation, not an old whole-file restore.

## Install

Close the game and back up your save. If switching from standalone, remove/restore standalone patches with their original tools first. Never mix modes or manually delete state receipts.

1. Run **run-tfc.bat → 5. Prepare compatible TFC package**.
2. Install the **new prepared folder** through TFC immediately.
3. Run **run-tfc.bat in that prepared folder → 1. Finish installation**.

Enter the game folder or BrgGame-Steam.exe path when asked. If game files change before installing, prepare again from the original source/preset. Installing static templates directly bypasses conflict protection. Finish verifies all recorded function bodies (including other mods), then performs hash relinking and the required native setup. No second Sync step is needed.

## Remove / change settings

Remove this UPK mod with TFC while the game is closed, then run its **run-tfc.bat → 2. Finish removal**. Do not use **Uninstall all** merely to remove one mod.

If you intentionally use TFC **Uninstall all**, run **2. Finish removal** from any of the four updated TFC tools afterward. It verifies every guard/warp/M2G/vending owned component is OFF before disabling both native components, removing only recorded material catalog rows and relinking current packages. UPKs, saves and unrelated EXE/DB edits are preserved. Repeating this step is safe. Partial unexpected preset loss or unknown conflicts still stop; installation and ordinary relinking never silently accept complete loss.

## Compatibility and recovery

- **3. Check connection** checks files/settings, not gameplay.
- Reviewed independent equal-size function edits are merged. Owned-byte/context conflicts stop; resized functions require exact reviewed bodies. Arbitrary branches/table edits are not guessed.
- Nico file-check OFF names remain OFF. Unknown resource names and native EXE conflicts still fail.
- If TFC reports `Gap ... between two disk data blocks`, use **4. Advanced → 5. Repair UPK block layout**, then prepare again. This separately confirmed repair backs up EXE/UPKs, relocates existing compressed frames without changing logical data, and relinks hashes. It does not change saves or DB.
- If interrupted, use **4. Advanced → 3. Recover interrupted operation** before retrying. Pending journals block preparation, native writes and leaving TFC mode.
- An external manager may rebuild from an older cached original and lose a preset. Reinstall only that selected preset through a newly prepared package; do not restore an old whole UPK over other mods. Multiple simultaneous losses or unknown map changes may need manual reconciliation.

Normal companion operations change only EXE/DB, never UPKs or saves; the explicitly confirmed layout repair is the only UPK-write exception. TFC manages feature installation/removal. Each package enables only its own mod; shared verification code does not enable other mods.

Native backups: `<game-parent>/LET-IT-DIE-TFC-backups`. Layout repair backups: `<game-parent>/LET-IT-DIE-TFC-layout-backups`. Keep `<game>/LID-TFC-State`. File restoration does not undo purchases, decals, ammo or save progress.

See [COMPANION.md](COMPANION.md), [VALIDATION.md](VALIDATION.md) and [COMPATIBILITY-VALIDATION.md](COMPATIBILITY-VALIDATION.md). This is not universal compatibility certification.
