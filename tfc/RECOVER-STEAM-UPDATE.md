# TFC state after a Steam update / Steam 업데이트 후 TFC 기록

Close the game. If Steam replaced all game files with reviewed clean build 25923506 but old `LID-TFC-State` remains, inspect from this TFC folder:

```text
node recover-updated-state.js "C:\Program Files (x86)\Steam\steamapps\common\LET IT DIE" --tfc
```

Only when the check returns `recoverable: true`, repeat with `--tfc --archive`. This preserves the entire old TFC state, native bases and backups at the displayed sibling `LET-IT-DIE-Archived-Mod-State` path. No EXE, UPK, DB or save is rewritten. Then prepare and install the new TFC patches normally.

This is explicit state recovery, not TFC uninstall or restoration of old-build game files. All six game files must match reviewed new stock. Mixed standalone/TFC receipts, other mods, pending operations, DB sidecars and changed files remain blocked. Do not delete receipts or restore old whole-file backups to bypass a refusal.

게임을 종료하고 위 명령으로 먼저 읽기 전용 확인하세요. `recoverable: true`일 때만 `--archive`를 추가합니다. 이전 TFC 기록·원본·백업 전체를 표시된 경로에 보존하고 게임·세이브는 변경하지 않습니다. 이후 새 TFC 패키지를 준비·설치하세요. 일반판과 TFC 기록이 섞인 상태는 강제 처리하지 않습니다.
