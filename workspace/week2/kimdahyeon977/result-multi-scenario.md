# RALPH 세 과제 비교: 관찰된 차이와 한계

## 실험 질문

동일한 모델·Preset·과제별 지시문·고정 테스트를 주었을 때, Custom RALPH의 독립 테스트 Child와 호스트 검증이 어떤 차이를 만드는가? 프로젝트 플래너, 재고 상태 전이 CLI, CSV 거래 장부 CLI를 각각 Custom과 공식 `tool-ralph`로 한 번씩 실행했다. 이 가운데 재고와 장부 과제에는 구현 단계 순서를 지정하지 않았다.

## 조건

- 두 방식 모두 Bedrock Sonnet 4.5, 생성 Preset `experiment-ralph`(SHA-256 `f4af4c353d23e3544184696a2311927cb9a571f7a2b0847c2889239260eb20a7`), 최대 5 Round를 사용했다.
- 각 과제의 Custom·공식 실행은 같은 지시문과 고정 테스트, 같은 초기 파일을 사용했다. 초기 Workspace에는 구현 코드가 없었다. [플래너 보고서](result-planner.md), [재고 Custom manifest](evidence/inventory-custom/manifest.json), [재고 공식 manifest](evidence/inventory-official/manifest.json), [장부 Custom manifest](evidence/ledger-custom/manifest.json), [장부 공식 manifest](evidence/ledger-official/manifest.json)의 해시로 확인했다.
- Custom은 Round마다 구현 Child, 독립 테스트 Child, 호스트 테스트를 순서대로 실행한다. 공식은 Round마다 작업 Child가 구현과 테스트를 수행한다. 두 방식 모두 종료 후 별도 고정 테스트로 최종 산출물을 검증했다.
- 모델 실행은 과제별·방식별 한 번씩이었다. Round별 시간·Child 수가 같도록 강제하지 않았다. Bedrock 자격증명은 로컬 `chatbot-v2/.env`에서 메모리로만 읽었다.

## 결과

| 과제 | Custom Round별 전체 테스트 | 공식 Round별 전체 테스트 | 최종 외부 검증 | 관찰된 원인 |
|---|---|---|---|---|
| 프로젝트 플래너 | 10/11 → 11/11 (2 Round) | 6/11 → 8/11 → 11/11 (3 Round) | 양쪽 11/11 | Custom 구현 Child가 첫 Round에 단계 지시를 건너뛰고 모든 기능을 구현. 두 방식 모두 `1e0` ID 검증 문제를 수정 |
| 재고 상태 전이 | 10/10 (1 Round) | 10/10 (1 Round) | 양쪽 10/10 | 양쪽 첫 Round에 전체 계약 충족 |
| CSV 거래 장부 | 9/10 → 10/10 (2 Round) | 10/10 (1 Round) | 양쪽 10/10 | Custom에서 `1e0` 금액 수용 오류를 독립 테스트 Child와 호스트가 확인하고 다음 Round에 수정. 공식은 첫 Round에 형식 검증까지 통과 |

재고·장부 실행은 각 방식의 과제·테스트·Preset 해시가 쌍으로 일치했고, 고정 파일 변경이 없었다. [재고 Custom 결과](evidence/inventory-custom/logs/controller-result.json), [재고 공식 결과](evidence/inventory-official/logs/controller-result.json), [장부 Custom 결과](evidence/ledger-custom/logs/controller-result.json), [장부 공식 결과](evidence/ledger-official/logs/controller-result.json), 각 폴더의 `logs/final-acceptance.tap`과 `native-summary.json`에 실행 근거를 보관했다. 보관한 네 CLI를 다시 독립 실행해 각각 10/10을 확인했다. 기존 자동 테스트도 61/61 통과했다.

실행 시작부터 종료 이벤트까지 관찰된 시간은 플래너 Custom 199.0초·공식 323.1초, 재고 Custom 94.8초·공식 119.2초, 장부 Custom 221.4초·공식 119.5초였다. 각 과제당 한 번의 실행이고 Child 구성과 테스트 호출 횟수가 달라 시간 차이를 일반적인 속도 차이로 해석하지 않는다. 지시문에는 Round당 전체 테스트 한 번을 요구했지만, 새 과제의 Child들은 실제로 일부 테스트를 반복 실행했다. 실행기는 테스트 호출 횟수를 강제하지 않았으므로 시간·사용량 비교의 통제 수준에 한계가 있다.

## Custom의 강점으로 확인된 것

Custom의 **독립 검증과 종료 판정**은 실제로 작동했다. 플래너와 장부에서 구현 Child가 기능을 끝냈다고 보고한 뒤 별도 테스트 Child가 실패를 찾았고, 호스트 테스트가 같은 실패를 재확인했다. 컨트롤러는 통과로 종료하지 않고 실패 내용을 다음 구현 Child에 전달했다. 구현 보고만으로 완료를 선언하지 않는다는 설계상의 차이를 실행 기록으로 확인한 셈이다.

공식 방식도 작업 Child가 테스트를 수행했고 세 과제의 최종 외부 테스트를 모두 통과했다. 이번 세 실행에서는 **Custom의 최종 정확도 우위나 적은 Round 수가 확인되지 않았다**. 장부 과제에서는 공식이 더 적은 Round로 끝났다. 플래너의 Custom Round 수는 단계 지시 위반의 영향을 받았으므로 속도 비교 근거에서 제외해야 한다.

## 다음 비교에서 보완할 점

같은 과제의 반복 실행을 늘리고, 미리 정한 성공률·잘못된 완료 선언·복구 Round·모델 사용량을 함께 기록해야 한다. 단계별 진행을 평가하려면 컨트롤러가 현재 단계의 범위와 통과 조건을 기계적으로 확인해야 한다. 이번 플래너에서는 지시문만으로 단계를 강제하지 못했다. 세 과제의 단일 실행 결과는 검증 경로의 동작 증거이며 통계적인 성능 비교는 아니다.

## 재현

레포 루트에서 Bedrock 자격증명을 실행 환경에 제공하거나 `BEDROCK_ENV`에 로컬 `.env`의 절대 경로를 지정한다. 모델 경로는 [재현용 패치](runner/bedrock.patch.yml)에 있다. 각 명령은 별도 실행 디렉터리를 만들고 모델 요청을 수행한다.

```sh
export BEDROCK_ENV=/absolute/path/to/chatbot-v2/.env
export DSH_PERMISSION_MODE=danger-full-access
RALPH_SCENARIO=inventory node workspace/week2/kimdahyeon977/runner/run.mjs custom
RALPH_SCENARIO=inventory node workspace/week2/kimdahyeon977/runner/run.mjs official
RALPH_SCENARIO=ledger node workspace/week2/kimdahyeon977/runner/run.mjs custom
RALPH_SCENARIO=ledger node workspace/week2/kimdahyeon977/runner/run.mjs official
```
