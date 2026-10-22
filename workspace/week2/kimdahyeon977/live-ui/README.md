# Coding RALPH 실행 대시보드

Custom Coding RALPH가 쓰는 JSONL 이벤트를 읽어 실행 상태, 라운드, 구현·테스트 Child, 호스트 테스트 결과, 다음 라운드로 넘긴 피드백을 보여준다. 열린 화면은 SSE로 새 이벤트를 받아 새로고침 없이 갱신된다. 앱 실행에는 Node.js만 필요하다.

`workspace/week2/kimdahyeon977`에서 검증된 실행 기록을 열려면:

```bash
PORT=43117 RALPH_EVENTS_FILE="$PWD/evidence/live-ui-haiku-test-details/live/events.jsonl" node live-ui/server.mjs
```

주소: <http://127.0.0.1:43117/>. 새 실행을 실시간으로 보려면 `RALPH_EVENTS_FILE`을 그 실행의 `live/events.jsonl`로 지정한다. `PORT=0`은 사용 가능한 포트를 골라 `READY <port>`를 출력한다.

앱 코드는 Bedrock Haiku 4.5를 사용한 Custom Coding RALPH Child가 생성·수정했다. 수동으로 앱 코드를 편집하지 않았다. 각 실행의 컨트롤러 결과, 고정 테스트, 모델 설정, 이벤트 로그, 생성 코드는 `evidence/live-ui-haiku-*`에 보관했다.

| 실행 | 확인된 결과 |
|---|---|
| `first` | 첫 구현. 보이는 테스트 6/6, 추가 테스트에서 이벤트 순서 결함 발견 |
| `repair` | 순서 결함 수정. 10/10, 브라우저에서 HTML 삽입 결함 발견 |
| `hardening` | HTML 삽입 수정 및 단계 연결 화면. 12/12 |
| `layout` | 파일 교체와 가로 넘침 수정. 15/15, 모바일 가독성 문제 확인 |
| `readability-blocked` | 모바일 화면과 접힌 보고서 구현. 테스트 16/16, 테스트 Child의 구조화된 결과 제출 누락으로 컨트롤러 `blocked` |
| `final` | 동일 앱을 다시 검증. 컨트롤러 `complete`, 고정·추가 테스트 16/16 |
| `test-details` | 호스트 테스트 단계에 `<details>`로 실제 TAP 테스트명·실패 내용 표시, 서버 시작 후 생성된 이벤트 파일 추적. 1라운드 `complete`, 고정 16 + 추가 3 = 19/19 |
