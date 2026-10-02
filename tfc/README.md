# Tengoku Start-Floor Selector — TFC edition 1.0.0

Supported and playtested: Steam build **25386710**. Requires TFC Installer 2.5.6.0 and Node.js **22.13+**.

Standard Tengoku selection: 51 / 101 / 201 / 301. Floor 22 elevator and Neo Tengoku are unchanged.

## Installation

1. Close the game; back up your save separately.
2. Remove an existing standalone patch with its original tool before switching. Do not delete receipts manually.
3. In TFC, select the game folder and **this `tfc` folder** as the mod folder (contains ModInfo.xml, GameProfile.xml and Game/).
4. Install its UPK patch with TFC.
5. Run **`tfc/run.bat`**, enter the game folder or EXE path, choose **Enable native component / 보조 기능 켜기**.
6. After any TFC UPK installation/removal, run **Sync package hashes** before launching.

TFC handles UPKs; the companion handles EXE hash links and warp/vending native EXE/DB components.
Each ZIP contains only this mod's UPK edits. No whole game UPKs, EXE, DB or saves are shipped.
All four companions preserve the other companion's current native setting.

## Removal and backups

Close the game. Remove this mod's UPK through TFC, then run its companion:
guard/M2G use **Sync**; warp/vending use **Disable native component**.
Do not launch between steps. Removing all four requires disabling both native components and syncing after TFC removal.

TFC manages UPK backups; the companion manages EXE/DB settings and recovery only.
Backups: `<game-parent>/LET-IT-DIE-TFC-backups/<installation-id>/<timestamp-id>/`.
Shared receipt/baseline: `<game>/LID-TFC-State` — keep it.
File restoration does not undo gameplay purchases, decal changes or ammo refills.

## Separate from standalone

Everything needed is inside `tfc/`, including its own `runtime/`.
Existing standalone launchers and releases remain separate. Do not mix installation modes on the same game.
The root tool refuses an active TFC receipt instead of overwriting it.
TFC patches replace object payloads: foreign mods editing the **same object** may conflict.
See [COMPANION.md](COMPANION.md) and [VALIDATION.md](VALIDATION.md).

## 한국어 빠른 안내

게임 종료 후 세이브를 별도 백업하세요. 기존 독립 실행 패치는 해당 도구로 먼저 제거하세요.
TFC에서 이 `tfc` 폴더를 모드 폴더로 선택해 적용한 뒤, 이 폴더의 `run.bat`를 실행하세요.
가드·M2G는 1번 해시 연결, 워프·자판기는 2번 보조 기능 켜기를 선택합니다.
다른 TFC 패치 적용·제거 후에는 해시 연결을 다시 실행하세요.
제거는 TFC에서 UPK 제거 후 워프·자판기 보조 기능 끄기 또는 가드·M2G 해시 연결 순서입니다.
기존 루트 도구와 혼용하거나 상태·백업 폴더를 수동 삭제하지 마세요.
