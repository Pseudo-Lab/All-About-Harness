# Week 2 — 검증 기반 Coding RALPH

확정한 요구사항과 고정 테스트를 받아 구현 → 독립 테스트 → 수정의 반복을 제어하는 Custom Plugin이다. 구현 에이전트의 완료 선언 대신 별도 테스트 에이전트의 결과와 실제 테스트 실행 결과를 종료 기준으로 사용한다.

[프로젝트 플래너 실행·비교 보고서](result-planner.md): 동일 Preset에서 Custom과 공식 `tool-ralph`를 실행했다. 두 최종 산출물 모두 고정 테스트 11개를 통과했으며, Round별 구현·검증 결과를 기록했다.

[초기 실행 기록](result.md): 기존 실험의 조건과 결과를 별도로 보관한다.

## 확정 범위와 구현 계획

[명세와 계획](spec.md)은 grill-me 인터뷰에서 확정했다. 실습 대상은 Node.js CLI 할 일 관리 도구이며 추가·조회·완료 처리와 JSON 파일 저장을 지원한다. [고정 테스트 명세](acceptance/README.md)와 [테스트 코드](acceptance/todo.test.mjs)를 구현 전에 작성했다.

각 Round는 새 구현 Child와 새 테스트 Child를 차례로 실행한다. 작업 파일은 공유 Workspace에 남기고 이전 검증 결과를 다음 구현 Child에 전달한다. 최대 5 Round이며 테스트 통과 시 완료, 한도 소진 시 미완료, 실행 환경 오류나 테스트 변경 시 중단한다. 공식 `tool-ralph`를 호출하는 래퍼가 아닌 자체 반복 제어다.

## 파일 구성

- `plugin/`: 반복 제어와 Harness 연결.
- `preset/`: Custom Agent Preset과 설치 설정.
- `acceptance/`: 고정된 CLI 계약 테스트.
- `example/cli.mjs`: 계약을 만족하는 참고 구현. 비교 실험의 초기 Workspace에는 포함하지 않는다.
- `tests/`: 별도 서브에이전트가 작성·실행하는 Plugin 검증과 기록.
- `runner/`: 동일 초기 상태로 실제 Custom·공식 실행을 준비하는 스크립트.

## 설치와 실행

실제 Harness Preset 등록과 Creator Mode 활성화 절차는 [실행 안내](runner/README.md)에 있다. 로컬 Harness checkout의 기존 빌드와 모델 설정을 사용하며, 실행마다 별도의 `DSH_HOME`과 작업 폴더를 만든다.

```sh
node workspace/week2/kimdahyeon977/runner/run.mjs custom --check
node workspace/week2/kimdahyeon977/runner/run.mjs custom
node workspace/week2/kimdahyeon977/runner/run.mjs official
```

`--check`는 모델 호출 없이 실제 Preset 로딩과 `cordis_define` → `cordis_run`을 확인한다. Custom 실행은 `plugin/core.mjs` 전체를 `creator.host.js`에 삽입한 소스를 `cordis_define`에 제출한다. 따라서 반복문·상태 전달·완료 판단은 Creator VM 안에서 실행된다. `plugin/index.mjs`의 `createRuntime`은 Child 생성·정리, 파일 hash와 테스트 실행만 제공한다. 이 경로에는 정적 `custom_ralph` 도구를 등록하지 않는다. 공식 비교만 별도 동적 진입점에서 공식 `ralph`를 호출한다. 실제 제출 소스는 각 실행 폴더의 `creator.host.js`와 정의 로그에 보관한다.

기존 파일 기반 호환 Preset만 생성하려면 다음 명령을 사용한다. 이 명령은 원본 템플릿과 사용자 홈을 변경하지 않고 `preset/generated/`에 설정을 만든다. 실제 마운트 시 호스트는 `subagents`와 `spawn`, 파일·셸 실행 서비스와 모델 경로를 제공해야 한다.

```sh
node workspace/week2/kimdahyeon977/plugin/install.mjs \
  deepseek-harness /absolute/workspace acceptance acceptance/todo.test.mjs
```

## CLI 사용

```sh
node workspace/week2/kimdahyeon977/example/cli.mjs add '과제 제출'
node workspace/week2/kimdahyeon977/example/cli.mjs list
node workspace/week2/kimdahyeon977/example/cli.mjs complete 1
```

저장 파일은 `TODO_FILE` 환경변수로 지정한다. 기본값은 실행 디렉터리의 `todos.json`이다. 테스트는 임시 저장 파일과 새 프로세스를 사용한다.

```sh
node --test workspace/week2/kimdahyeon977/acceptance/todo.test.mjs
```

전체 검증은 로컬 Harness 빌드가 있는 환경에서 다음과 같이 실행한다. scoped guard 테스트는 실제 Harness 도구 제한을, Creator VM 테스트는 동적으로 제출한 소스의 반복·Handoff·종료를 확인한다.

```sh
node --test --test-reporter=tap \
  workspace/week2/kimdahyeon977/acceptance/todo.test.mjs \
  workspace/week2/kimdahyeon977/tests/core.test.mjs \
  workspace/week2/kimdahyeon977/tests/host.test.mjs \
  workspace/week2/kimdahyeon977/plugin/scoped-guard.test.mjs \
  workspace/week2/kimdahyeon977/tests/creator-dynamic.test.mjs
```

## 공식 구현과 비교할 기준

| 항목 | Custom | 공식 `tool-ralph` |
|---|---|---|
| 반복 제어 | 구현 Child → 테스트 Child → 고정 테스트 실행 | Round마다 작업 Child 실행 |
| 새 대화 | 구현·테스트 각각 새 Child | Round마다 새 Child |
| 상태 전달 | 공유 파일과 이전 검증 보고 | 공유 파일과 구조화 Handoff |
| 완료 판단 | 테스트 Child 통과 + 실제 고정 테스트 통과 | 작업 Child의 완료 보고 |
| 최대 Round | 5 | 비교 실행에서 5로 설정 |

기본 실행은 의도적으로 단계별 작업을 사용한다. Round 1에서 추가·조회만 구현하고 실제 완료 처리 테스트 실패를 확인한 뒤, Round 2에서 이전 실패를 받아 완료 기능을 구현한다. 실패를 조작하거나 테스트를 약화하지 않는다. 최초 단일 단계 작업은 `RALPH_SCENARIO=single`로 재현한다.

실제 비교 수치와 한계는 [실행 결과](result.md), 자동 검증 기록은 `tests/`, 실행 로그와 최종 코드는 `evidence/creator-custom/`과 `evidence/creator-official/`에 있다. 초기 1 Round 비교는 `evidence/custom/`과 `evidence/official/`에 보관했다. 수정 전 우회 호출 기록은 `evidence/custom-before-fix/`에 별도로 보관했다.
