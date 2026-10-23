# Steam update left old mod state / Steam 업데이트 후 구버전 기록

Only use this standalone recovery when Steam replaced the game files with the reviewed clean build 25923506 but `LID-Mod-State` still records old patches. It is not a generic conflict bypass. TFC recovery is a separate explicit mode: from the TFC edition use `--tfc` for inspection and `--tfc --archive` for preserving old `LID-TFC-State`; never mix the two active receipt types.

Close the game. From this tool folder, inspect without writing:

```text
node recover-updated-state.js "C:\Program Files (x86)\Steam\steamapps\common\LET IT DIE"
```

If the result says `recoverable: true`, explicitly preserve/archive the old state:

```text
node recover-updated-state.js "C:\Program Files (x86)\Steam\steamapps\common\LET IT DIE" --archive
```

The entire old `LID-Mod-State` folder, including its state, blobs, generations and backups, moves to the displayed `LET-IT-DIE-Archived-Mod-State` folder beside the game installation. No game or save file is rewritten. Then reapply the updated standalone tools. Do not restore old-build whole-file backups over the updated game. Keep a separate save backup.

All six scoped game files must match independently reviewed new stock hashes. Mixed patches, unknown edits, malformed receipts, running games, DB sidecars or pending operations are refused. Do not manually delete state to bypass that refusal; share the diagnostics instead. A later game build needs its own reviewed profile.

## 한국어

Steam 업데이트가 게임 파일은 새 순정으로 바꿨지만 구버전 기록만 남긴 경우입니다. 위 첫 명령은 읽기 전용 확인이며, `recoverable: true`일 때만 `--archive`를 붙여 명시적으로 보존 이관합니다. 폴더·EXE 경로를 실제 설치 위치에 맞추세요.

기존 백업·블롭·기록 전체가 게임 폴더 옆의 `LET-IT-DIE-Archived-Mod-State` 아래에 보존됩니다. 게임·세이브는 변경하지 않습니다. 이후 새 일반판 모드를 다시 적용하세요. TFC 전환 기능이 아니며 다른 모드와 섞인 상태를 강제로 허용하지 않습니다. 거부되면 기록을 삭제하지 말고 로그를 공유하세요.
