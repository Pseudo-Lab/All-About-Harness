# Week 2 — 검증 기반 Coding RALPH

확정한 요구사항과 고정 테스트를 받아 구현 → 독립 테스트 → 수정의 반복을 제어하는 Custom Plugin이다. 구현 에이전트의 완료 선언 대신 별도 테스트 에이전트의 결과와 실제 테스트 실행 결과를 종료 기준으로 사용한다.

[최종 실행·비교 보고서](result.md): 실제 Custom과 공식 실행 모두 고정 테스트 6개를 통과했다. 코드·Preset·재현 명령·실행 증거를 이 폴더에 함께 보관한다.

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

`--check`는 모델 호출 없이 실제 Preset 로딩과 `cordis_define` → `cordis_run`을 확인한다. 실제 실행은 동적 Plugin의 `creator_run_loop`를 통해 자체 `custom_ralph` 또는 공식 `ralph`를 호출한다. 반복 제어 구현은 `plugin/core.mjs`, Harness 연결은 `plugin/index.mjs`에 있다. Creator Mode에 등록하는 동적 코드는 이 컨트롤러를 호출하는 연결 Plugin이다.

다른 Workspace용 Preset 파일만 생성하려면 다음 명령을 사용한다. 이 명령은 원본 템플릿과 사용자 홈을 변경하지 않고 `preset/generated/`에 설정을 만든다. 실제 마운트 시 호스트는 `subagents`와 `spawn`, 파일·셸 실행 서비스와 모델 경로를 제공해야 한다.

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

전체 검증은 로컬 Harness 빌드가 있는 환경에서 다음과 같이 실행한다. 마지막 테스트는 실제 Harness의 scoped 도구 등록과 실행 guard를 확인한다.

```sh
node --test --test-reporter=tap \
  workspace/week2/kimdahyeon977/acceptance/todo.test.mjs \
  workspace/week2/kimdahyeon977/tests/core.test.mjs \
  workspace/week2/kimdahyeon977/tests/host.test.mjs \
  workspace/week2/kimdahyeon977/plugin/scoped-guard.test.mjs
```

## 공식 구현과 비교할 기준

| 항목 | Custom | 공식 `tool-ralph` |
|---|---|---|
| 반복 제어 | 구현 Child → 테스트 Child → 고정 테스트 실행 | Round마다 작업 Child 실행 |
| 새 대화 | 구현·테스트 각각 새 Child | Round마다 새 Child |
| 상태 전달 | 공유 파일과 이전 검증 보고 | 공유 파일과 구조화 Handoff |
| 완료 판단 | 테스트 Child 통과 + 실제 고정 테스트 통과 | 작업 Child의 완료 보고 |
| 최대 Round | 5 | 비교 실행에서 5로 설정 |

실제 비교 수치와 한계는 [실행 결과](result.md), 자동 검증 기록은 `tests/`, 실행 로그와 최종 코드는 `evidence/custom/`과 `evidence/official/`에 있다. 수정 전 우회 호출 기록은 `evidence/custom-before-fix/`에 별도로 보관했다.
