# 공격 중 멈춤 실측 — 2026-09-05

게임 PID 70832, 주 실행 스레드 67004. 게임 파일/세이브 수정 없이 짧은 스레드 정지·재개로 레지스터와 스택을 채집했다. 이후 함수 객체/이름 테이블은 읽기만 했다.

## 직접 확인한 원인

`IsCanGuardState`의 실행 중 스크립트 시작은 `06 17 00`이다. 즉 Jump의 목적지는 런타임 스크립트 +0x17이다. 해당 위치는 True 토큰(0x27)이고, 다음 +0x18은 조건식의 EndFunctionParms(0x16)이다. 실제 프레임의 Code 포인터는 반복 채집에서 +0x18/+0x19에 머물렀다.

엔진 토큰 테이블 RVA 0x28360a0의 0x16 핸들러는 RVA 0xe7630이다. 이 함수는 `dec qword ptr [rdx+0x24]` 후 반환하므로, 명령 실행 루프가 증가시킨 Code를 다시 같은 토큰으로 되돌린다. 함수 본문 최상위에서 이 토큰으로 진입해 무한 반복한다. CPU 증가와 무응답, 예외 로그 부재를 함께 설명한다.

반복 실행 RIP RVA는 0x10edc9/0x10edd2/0x10eddc. 해당 엔진 루프는 토큰을 읽고 포인터를 증가시킨 후 핸들러를 호출한다.

## 실제 FFrame PreviousFrame 연결

NotifyTick (BrgAnimNotify_AttackSword) → CheckAttackRay → TakeAttack → TakeAttack → TakeDamage → TakeDamage → IsCanGuard → IsCanGuardState.

상위 가드/피해 프레임의 Object 이름은 BrgPawn_Treasure였고 공격 프레임은 BrgPawn_CustomCharaPlayer였다. 단순 스택 포인터 후보가 아니라 FFrame의 Node/PreviousFrame 및 실행 중 GNames를 읽어 확인했다.

## 범위와 다음 조치

직접 멈춘 곳은 텐고쿠 이동 훅이 아니라 가드 판정 스크립트의 잘못된 분기다. 최신 텐고쿠 적용 전후 BrgGame.upk SHA-256이 같았으므로 이 적용에서 해당 스크립트를 바꾸지는 않았다. 다만 이 기록만으로 어느 과거 수정 작업에서 잘못된 바이트가 만들어졌는지는 확정하지 않는다.

수정 시에는 기존 IsCanGuardState의 의도한 조건을 원본/수정본과 비교해 올바른 토큰 경계로 분기하도록 해야 한다. 단순 주소 추측으로 변경하지 않는다. 이번 요청에서는 진단만 수행했으며 실게임 수정/종료는 하지 않았다.
