# 주문·재고·결제 통합 과제 비교

## 질문과 과제

기존 플래너·재고·장부보다 기능 간 의존성이 큰 프로젝트에서 Custom RALPH와 공식 `tool-ralph`의 차이가 드러나는가? 새 과제는 상품 저장, 주문별 재고 예약, 결제 거절 후 재시도, 결제 키의 전역 멱등성, 취소·환불, 이벤트 재생, 원자적 실패를 하나의 CLI로 구현하도록 했다. [전체 계약](acceptance/orders.md)과 [과제 지시문](runner/task-orders.txt)은 구현 시작 전에 고정했다. 구현 단계를 특정 Round에 묶지 않았다.

## 고정 조건과 검증

- 양쪽 모두 Bedrock Sonnet 4.5, 동일한 생성 Preset `experiment-ralph`(SHA-256 `424b9bc5bdee90bde43231028c910c2758efa00bb76626e0a0433544619730f5`), 최대 8 Round를 사용했다.
- 과제 SHA-256 `94f9901436feadcd135c729c2f85003fc024e71a6db0aaf4209a232413dd8fec`, 공개 테스트 SHA-256 `fcb1081b4aadbefe987a6a6cb83adcd6bbe1dc03e7a898993c6ef0db16e065db`, 종료 후 테스트 SHA-256 `db1808b1bd0837fcc3e06fcf1029e3f778134330aa330afc3d20c556e7e474af`가 두 manifest에서 일치한다. 초기 Workspace에는 구현이 없고 공개 계약·테스트만 있었다.
- 실행 중에는 [공개 테스트 18개](acceptance/orders.test.mjs)를 사용할 수 있었다. [추가 테스트 5개](acceptance/orders-heldout.test.mjs)는 Workspace에 넣지 않고 컨트롤러 종료 후 별도 고정 복사본에서 실행했다. 두 세트를 함께 실행한 최종 TAP 결과는 각 evidence의 `logs/final-acceptance.tap`에 있다.
- Custom은 구현 Child와 독립 테스트 Child, 호스트 공개 테스트를 실행했다. 공식 방식은 한 Worker가 구현과 테스트를 수행했다. 두 방식 모두 1회씩 실행했으며 실행 순서는 Custom 다음 공식이었다.

## 관찰 결과

| 항목 | Custom | 공식 `tool-ralph` |
|---|---:|---:|
| 컨트롤러 상태 | complete | complete |
| 시작한 Round | 1 | 1 |
| 실행 중 공개 테스트 | 18/18 | 18/18 |
| 종료 후 공개+추가 테스트 | 23/23 | 23/23 |
| 준비 기록부터 최종 검증 결과 기록까지 | 392.3초 | 333.7초 |
| 산출물 구성 | `cli.mjs`, `lib/` 4개 모듈 | `cli.mjs` 단일 파일 |

시간은 각 실행의 `manifest.json` 기록 시각부터 `logs/outcome.json` 기록 시각까지의 로컬 경과 시간이다. 컨트롤러 호출만 보면 Custom 376.9초, 공식 307.7초였다. 공식 방식이 이 단일 실행에서는 더 빨랐지만, 반복 실행과 순서 교차가 없어 일반적인 속도 우위를 주장하지 않는다.

둘 다 공개·추가 테스트의 기능 조건을 만족했다. 단, 과제 지시문과 계약은 `lib/`의 응집된 모듈을 요구했는데 공식 산출물에는 `lib/`가 없었다. 이는 파일 구조를 검사하지 않은 테스트에서 포착되지 않은 **명시적 구조 요구 미준수**다. Custom 산출물에는 `lib/command.mjs`, `lib/handlers.mjs`, `lib/state.mjs`, `lib/storage.mjs`가 있다. 이 차이를 테스트 성공률 차이로 계산하지 않는다.

이번 과제는 이전 과제보다 기능 의존성이 크지만, 두 Worker 모두 첫 Round에서 공개 테스트를 통과했다. 따라서 복수 Round에서 실패 인계·수정·회귀 방지 능력이 어떻게 다른지는 이 한 쌍에서 관찰되지 않았다. 더 어려운 한 과제만으로 우위를 주장할 수 없으며, 같은 난도의 여러 과제와 반복 실행, 지시문 준수의 별도 채점이 필요하다.

## 근거와 재현

- [Custom manifest와 실행 근거](evidence/orders-custom/manifest.json), [공식 manifest와 실행 근거](evidence/orders-official/manifest.json)
- [Custom 최종 TAP](evidence/orders-custom/logs/final-acceptance.tap), [공식 최종 TAP](evidence/orders-official/logs/final-acceptance.tap)
- [Custom 산출물](evidence/orders-custom/workspace/cli.mjs), [공식 산출물](evidence/orders-official/workspace/cli.mjs)
- 두 방식의 `native-summary.json`에는 원본 세션에서 추출한 Child 역할, Round, 도구 사용 시점이 있다. 자격증명은 evidence에 복사하지 않았다.

```sh
export BEDROCK_ENV=/absolute/path/to/chatbot-v2/.env
export DSH_PERMISSION_MODE=danger-full-access
RALPH_SCENARIO=orders node workspace/week2/kimdahyeon977/runner/run.mjs custom
RALPH_SCENARIO=orders node workspace/week2/kimdahyeon977/runner/run.mjs official
```
