# Task 3·4: 프로젝트 플래너와 동일 Preset 비교

## 질문과 과제

Custom RALPH와 공식 `tool-ralph`에 같은 Node.js 프로젝트 플래너 과제를 주었다. 프로젝트와 작업 생성·조회, 작업 간 의존성 그래프, 순환·중복·교차 프로젝트 참조 거부, 실행 가능한 작업 계산, 완료 상태 전이, 프로젝트 집계, JSON 저장과 오류 시 기존 데이터 보존을 포함한다. 구현 지시문은 `cli.mjs`, `lib/store.mjs`, `lib/planner.mjs` 세 모듈을 요구한다.

[전체 계약](acceptance/planner.md)과 [고정 테스트 11개](acceptance/planner.test.mjs)를 먼저 준비했다. [동일한 작업 지시문](runner/task-planner.txt)은 세 구현 단계를 제시한다. 매 Round 전체 테스트를 실행하고, 다음 Round에는 공유 Workspace와 이전 실패를 전달한다. 이 단계는 의도된 작업 순서이며 실행 결과가 실제로 준수했는지는 아래에서 별도로 확인한다.

## 비교 조건

| 조건 | Custom | 공식 |
|---|---|---|
| 모델 | `amazon-bedrock` / Sonnet 4.5 | 동일 |
| Preset ID | `experiment-ralph` | 동일 |
| 생성 Preset SHA-256 | `f4af4c353d23e3544184696a2311927cb9a571f7a2b0847c2889239260eb20a7` | 동일 |
| 작업 지시문 SHA-256 | `fd9b9e82642b442b96c7285c3875d861e3a40cd3b589022b0b36b4d4950b7c83` | 동일 |
| 테스트 SHA-256 | `07bb2fa333ae590d66a3320b72fa6b89f6aabcf213a10679d0ea375e4ba5f398` | 동일 |
| 초기 Workspace | 동일한 `acceptance/` 파일만 존재 | 동일 |
| 최대 Round | 5 | 5 |
| 실행 권한 | `danger-full-access` | 동일 |

동일 Preset은 `persona`, `tool-bash`, `tool-fs`, 격리된 workflow engine의 공식 `tool-ralph`, `tool-cordis`를 포함한다. Custom은 Creator에 정의한 자체 반복 도구를 호출하고 Child에게 역할별 도구 제한을 추가한다. 공식은 같은 Preset에서 `tool-ralph`를 호출한다. 두 방식의 Child 수와 검증 구조는 설계상 다르다. [Custom manifest](evidence/planner-custom/manifest.json), [공식 manifest](evidence/planner-official/manifest.json), 각 실행의 [`agent.cordis.yml`](evidence/planner-custom/preset/agent.cordis.yml)과 [공식 사본](evidence/planner-official/preset/agent.cordis.yml)으로 입력 동일성을 확인할 수 있다.

Bedrock 키와 리전은 로컬 `chatbot-v2/.env`의 `BEDROCK_ACCESS_KEY`, `BEDROCK_SECRET_KEY`, `BEDROCK_REGION`을 실행 프로세스 안에서 `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`에 연결했다. 키 값은 레포나 증거 폴더에 복사하지 않았다. 모델 경로만 담은 [재현용 패치](runner/bedrock.patch.yml)를 제공한다.

## 실제 Round 결과

| 실행 | Round 1 | Round 2 | Round 3 | 최종 |
|---|---|---|---|---|
| Custom | 구현 Child가 지시된 1단계를 넘어 **3단계 기능을 모두 구현**. 독립 테스트와 호스트가 10/11 통과, `1e0` ID 수용 실패를 확인 | 새 구현 Child가 ID 검증 수정. 새 테스트 Child와 호스트 11/11 통과 | 실행하지 않음 | `complete`, 외부 고정 테스트 11/11 |
| 공식 | 작업 Child가 프로젝트·작업 생성·조회 구현, 실제 6/11 통과 후 `continue` | 의존성·ready 구현, 실제 8/11 통과 후 `continue` | 완료·report 구현 후 10/11 실패를 보고 수정, 실제 11/11 통과 후 `complete` | `complete`, 외부 고정 테스트 11/11 |

Custom은 구현 2명과 테스트 2명, 공식은 작업 Child 3명을 생성했다. 공식의 Round별 통과 수는 보관된 native session의 `bash` 도구 출력과 구조화 보고에서 확인했다. Custom의 Round별 통과 수는 별도 테스트 Child 보고와 호스트가 실행한 고정 테스트 결과에 근거한다. 양쪽 모두 초기 테스트와 명세 파일의 hash가 마지막까지 같았고, 외부 고정 사본으로 다시 실행한 11개 테스트가 모두 통과했다.

[Custom Round별 결과](evidence/planner-custom/logs/controller-result.json) · [공식 Round별 결과](evidence/planner-official/logs/controller-result.json) · [Custom 최종 TAP](evidence/planner-custom/logs/final-acceptance.tap) · [공식 최종 TAP](evidence/planner-official/logs/final-acceptance.tap) · [Custom Child 기록](evidence/planner-custom/native-summary.json) · [공식 Child 기록](evidence/planner-official/native-summary.json)

최종 구현 전체는 각 증거 폴더의 `workspace/cli.mjs`와 `workspace/lib/`에 보관했다: [Custom](evidence/planner-custom/workspace/cli.mjs), [공식](evidence/planner-official/workspace/cli.mjs). 실행 종료 상태는 [Custom](evidence/planner-custom/logs/outcome.json), [공식](evidence/planner-official/logs/outcome.json)에 있다.

## 해석과 한계

두 방식은 **같은 Preset, 모델, 작업 지시문, 테스트**를 썼다. 공식은 지시된 세 단계를 실제로 밟았다. Custom은 첫 Round에 후속 기능까지 구현했으므로 2 Round를 계획대로 단계적 구현한 결과로 소개하지 않는다. Custom의 두 번째 Round는 실제 발견된 ID 검증 오류를 수정한 Round다.

한 작업의 단일 실행 결과이며 모델 호출 수, Child 역할, 완료 판단이 다르다. Round 수나 토큰 차이를 컨트롤러 하나의 일반적 성능 우위로 해석할 수 없다. 공식 컨트롤러의 완료는 작업 Child 보고에 의존하고, 최종 외부 테스트는 별도로 확인했다. Custom은 독립 테스트 Child와 호스트 테스트 성공을 종료 조건으로 사용한다.

## 재현

레포 루트에서 AWS 표준 자격증명·리전을 실행 환경에 제공하거나 `BEDROCK_ENV`에 Bedrock 키·리전이 있는 `.env`의 절대 경로를 지정한다. 실행기는 필요한 세 값만 읽어 AWS 변수명으로 연결한다. [모델 패치](runner/bedrock.patch.yml)는 기본으로 적용된다. 이 실험에서는 `DSH_PERMISSION_MODE=danger-full-access`로 테스트 Child의 Node 실행을 허용했다. 두 명령은 별도 실행 폴더를 만들며 모델 요청을 수행한다.

```sh
export BEDROCK_ENV=/absolute/path/to/.env
export DSH_PERMISSION_MODE=danger-full-access
RALPH_SCENARIO=planner node workspace/week2/kimdahyeon977/runner/run.mjs custom
RALPH_SCENARIO=planner node workspace/week2/kimdahyeon977/runner/run.mjs official
```

각 실행의 `manifest.json`에서 Preset·작업·테스트 hash를 대조하고 `logs/outcome.json`의 `controllerStatus`, `frozenUnchanged`, `acceptance.exitCode`를 확인한다. 모델 요청 없이 Preset 마운트와 Creator 활성화만 확인하려면 명령 끝에 `--check`를 붙인다.
