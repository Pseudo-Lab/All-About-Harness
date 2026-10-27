# Week 3 결정 기록

grill-me 인터뷰(2026-10-26)에서 정한 사항과 이유다. 경로는 `deepseek-harness/` 기준이다.

## 출발점

- 개인 하네스 `cb`(`~/cb-harness`, Claude Code 플러그인 v0.3.1)는 이미 오케스트레이션을 한다. `cb:go`가 recon → fix → verify → ship 정거장과 외부 스킬·에이전트(`codex-rescue`, `test-verifier`, `mr-write`, `create-jira-ticket`)를 요청 무게·병렬 웨이브·멈춤 게이트로 지휘한다.
- 격리는 디렉터리(`$WT`/`$BASE_WT` worktree)와 맥락(수정 과정을 모르는 검증 에이전트)까지만 한다. 권한은 나누지 않는다. Codex 경로의 검증 명령이 `--allowedTools "Bash Read Write Edit Grep Glob"`이라 검증자도 수정본을 고칠 수 있다. "검증자는 고치지 않는다"는 프롬프트 약속이다.
- week2 RALPH도 같은 성격이다. 고정 테스트를 해시로 사후 감지할 뿐(`workspace/week2/kimdahyeon977/plugin/host.mjs:6`) 쓰기를 미리 막지 않는다.

## 결정

### Q1. 소재: `cb` 축소판

- 선택: `cb`의 구현·검증 분리를 cordis Plugin 2개로 옮긴다.
- 후보: week2 RALPH 연장(구현·테스트 Child를 그룹으로 분리), 과제 예시(`word-count`/`keyword-check`).
- 이유: 실제 운영 중인 하네스의 빈틈(검증자 권한)이 Task 4 "무엇을, 왜 isolate하나"의 근거가 된다. Task 5 실험 결과가 그 빈틈을 막는 증명이 된다. 과제 예시는 isolate와 연결이 끊긴다.

### Q2. 공부 방식: 예측 → 실험 루프

- 선택: 실험마다 결과를 먼저 예측하고 실행한 뒤, 틀리면 소스에서 이유를 찾는다. 반복 코드는 Claude가 쓰고 핵심 메커니즘은 함께 소스를 따라간다.
- 후보: 직접 구현 + 코치(가장 깊지만 시간이 많이 든다), Claude 구현 + 해설(빠르지만 얕다).
- 이유: 하네스는 설정 한 줄이 런타임에 어떻게 동작하는지가 핵심이다. 예측이 틀리는 지점이 배울 지점이고, 그 기록이 README "알게 된 점"이 된다.

### Q3. Plugin 2개: 둘 다 `ctx.shell` Consumer

| Plugin | Tool | 동작 | 배치 그룹 |
|---|---|---|---|
| `check-runner` | `run_check(command)` | `ctx.shell`로 검증 명령을 실행하고 종료 코드와 출력 끝부분으로 PASS/FAIL 판정. `cb:verify` 축소판 | verify |
| `patch-note` | `write_note(path, text)` | `ctx.shell`로 작업 공간에 파일 쓰기(heredoc). `cb:fix` 축소판 | fix |

- 후보: Shell 없는 순수 Tool(쉽지만 isolate 실험과 끊긴다), 직접 Service 제작(예: `ctx.verdictStore`, 가장 깊지만 범위가 커진다).
- 이유: 두 Plugin이 같은 `ctx.shell`을 쓰므로 Task 2 "공유 Service" 질문에 실제 답이 생긴다. `write_note`가 Shell로 쓰므로 read-only/workspace-write 차이가 바로 드러난다. Sandbox는 `ctx.shell` 명령만 가두므로(`packages/shell/bash-sandbox/README.md` "Use this package") `dsh-tool-fs`로 쓰면 실험이 무의미해진다.

### Q4. 그룹 구성: 2단계

```yaml
# 1단계 (Task 2·3): 묶기만 한다. Host shell 공유
- id: cb-lite
  name: cordis:group
  group: true
  config:
    - name: './check-runner.mjs'
    - name: './patch-note.mjs'

# 2단계 (Task 4·5): 역할별 격리
- id: verify
  name: cordis:group
  group: true
  isolate: { shell: true, sandboxPolicy: true }
  config:
    - name: '@deepseek-ai/dsh-sandbox-policy'
      config: { mode: read-only }
    - name: '@deepseek-ai/dsh-bash-sandbox'   # 그룹 전용 Shell Provider
    - name: './check-runner.mjs'              # Consumer
- id: fix
  name: cordis:group
  group: true
  isolate: { shell: true, sandboxPolicy: true }
  config:
    - name: '@deepseek-ai/dsh-sandbox-policy'
      config: { mode: workspace-write }
    - name: '@deepseek-ai/dsh-bash-sandbox'
    - name: './patch-note.mjs'
```

- 이유
  - Host가 `ctx.sandbox`(`sandbox-local`), `ctx.sandboxPolicy`(기본 `workspace-write`), `ctx.shell`(`bash-sandbox`)을 프로세스 전체에 한 벌 제공한다(`packages/bundle/base/cordis.patch.yml:204-218`). 1단계는 두 Plugin이 이 한 벌을 같은 정책으로 공유하므로 `check-runner`도 쓸 수 있다. `cb`의 빈틈이 그대로 재현된다.
  - 1단계와 2단계의 차이가 "묶기 ≠ 격리"의 증거다.
  - `sandboxPolicy`도 isolate한다. `shell`만 isolate하면 두 그룹의 `bash-sandbox`가 Host 정책 하나를 읽어 모드가 같아질 것이다(추론, 실험 8로 확인).
  - `ctx.sandbox`(실행 백엔드)는 Host 것을 재사용한다. 과제의 "중복 Provider를 만들지 않는다"를 지킨다.
- 소스 근거
  - isolate는 Plugin이 아니라 Service 조회 키를 가른다. `ctx.isolate(name)`이 그룹 전용 Symbol을 발급한다(`vendor/cordis/src/context.ts:121`).
  - Preset 안의 Service Provider는 isolate 그룹 안에 있어야 하고, 아니면 mount에서 거부된다(`packages/preset/agent-presets/src/invariant.ts:41`, `presets/standard/agent.cordis.yml:11-18`).

### Q5. 실행 수단: probe + Haiku Agent

| 수단 | 쓰는 곳 | 이유 |
|---|---|---|
| 모델 없는 probe 스크립트: Preset mount, Tool 목록 덤프, Tool 직접 호출, 그룹별 `ctx.shell` 정체(Symbol 키·정책 모드) 출력 | 구조 실험 전부, 5·6 1차 | 결과가 매번 같다. 비용 0, 몇 초. 모델 쪽 변수("왜 Tool을 안 불렀지")가 섞이지 않는다 |
| 실제 Agent: week2 `runner/run.mjs`를 줄여 복사, headless, Bedrock Haiku | Task 3 실행 기록, Task 5 시연, 실험 9 | 과제가 "Agent가 Plugin 2개를 실제로 호출", "Consumer가 격리된 Shell을 호출했는지 확인"을 요구한다. Tool 호출이 단순해 Haiku로 충분하다 |

- headless는 `dsh-base` 위에 얹혀 있어(`packages/bundle/headless/cordis.patch.yml:1`) Host sandbox·approval 구성을 그대로 쓴다. week2 실행 증거에는 sandbox enforcement 기록이 없다. 이 WSL에서 Sandbox가 실제로 막았는지는 아직 확인되지 않았다.

### Q6. 실험 우선순위

| 등급 | # | 실험 | 연결 |
|---|---|---|---|
| 필수 | 0 | Sandbox 백엔드 확인(Landlock 동작, enforcement full/partial) | Task 5 전제 |
| 필수 | 1 | Group 켰을 때/껐을 때 Tool 목록 | Task 3 |
| 필수 | 2 | Group으로 묶었을 때/개별 등록했을 때 차이 | Task 3(과제 원문 요구) |
| 필수 | 3 | isolate 없이 Shell Provider를 Preset에 넣기 → invariant 오류 여부 | Task 4 |
| 필수 | 4 | isolate 후 그룹 밖 Tool이 그룹 전용 Shell을 보는가 | Task 4 |
| 필수 | 5 | read-only 읽기 vs 쓰기 | Task 5 |
| 필수 | 6 | workspace-write 읽기 vs 쓰기, 작업 공간 밖 쓰기 | Task 5 |
| 필수 | — | Task 3 실행 기록(Agent가 `run_check`와 `write_note`를 둘 다 호출) | Task 3 |
| 조건부 | 8 | `shell`만 isolate하고 `sandboxPolicy`는 공유하면 모드가 섞이나 | Task 4 |
| 심화 | 7 | read-only 그룹에서도 `tool-fs`로 쓸 수 있나(Sandbox 우회) | Task 4·5 |
| 심화 | 9 | headless에서 쓰기 거부 후 권한 상향 요청 처리 | Task 5 |

- 실험 2를 필수로 올린 이유: 과제 원문 Task 3이 "Group으로 묶기만 했을 때와 개별 등록했을 때의 차이도 정리"를 요구한다. probe로 YAML 한 곳만 바꾸면 된다.
- 실험 8은 5·6 결과에 따라 무조건 실행한다. 5·6이 통과해도 "둘 다 isolate하면 된다"까지만 증명하고 "`sandboxPolicy`까지 isolate해야만 한다"는 증명하지 못한다. 통과면 최종 YAML 근거용, 실패면 원인 분석용이다.
- 7·9는 필수가 끝나고 시간이 남으면 한다. 안 하면 README "다음에 확인할 것"에 가설로 남긴다.
- Sandbox 백엔드: 이 WSL에는 `bwrap`이 없다. 커널에 `CONFIG_SECURITY_LANDLOCK=y`가 있고 활성 LSM 목록 맨 앞이 `landlock`이라 Landlock 경로가 유력하다. 실패하면 `sudo apt install bubblewrap`(사용자가 실행)으로 넘어간다.

### Q7. 제출

- `origin/main`(b055539)에서 `week3/kimdahyeon977` 브랜치 → `fork`에 push → `origin`(Pseudo-Lab)으로 PR.
- 이유: week2 실험 브랜치(`experiment/ralph-live-ui`)와 섞이지 않게 한다. 커밋은 단계별로, push와 PR은 확인받고 한다.

### Q8. 예측 작성

- 선택: 실험마다 사용자가 소스를 보기 전에 예측과 이유를 먼저 쓴다. Claude 예측(근거 `파일:줄` 포함)은 그다음 공개한다. 둘 다 `EXPERIMENTS.md`에 기록한다.
- 후보: Claude 예측 + 검토만, 생략.
- 이유: 예측 → 실험 루프는 직접 예측해야 효과가 있다. Claude 예측을 먼저 보면 예측이 그쪽으로 끌려간다.

## 진행 순서

1. 브랜치 생성, `DECISIONS.md` 작성
2. Plugin 2개, 1단계·2단계 Preset YAML, probe 스크립트 작성
3. 필수 실험: 질문 → 예측 받기 → Claude 예측 공개 → 실행 → `EXPERIMENTS.md`에 기록
4. 실험 8, 시간이 남으면 7·9
5. Task 3 Agent 실행, Task 5 시연(로그는 `config/`)
6. README 작성
7. 단계별 커밋, push·PR은 확인받고

## 실험 후 바뀐 것

- Q4 fix Shell 표식: 60000 → 45000. 실제 CLI Host Shell이 60000(`packages/bundle/base/cordis.patch.yml:218`)이라 겹쳤다.
- Q4 추론 "`shell`만 isolate하면 모드가 섞인다": 그룹에서 정책 Provider를 뺄 때만 맞다(실험 8b). 정책 Provider를 두면 이름 충돌로 mount 실패다(실험 8). 결론(`sandboxPolicy`도 isolate)은 유지한다.
- Q3 Plugin 동작 추가: 세션 모드와 그룹 기본값 중 좁은 쪽으로 실행한다(`plugins/shell-call.mjs`). 실제 Agent 세션의 `sandbox/mode: workspace-write`가 read-only 그룹을 넓히는 구멍을 막기 위해서다(Task 5).
- Q6 심화 7·9도 실행했다. 실험 7은 가설("`tool-fs`가 Sandbox를 우회")을 질문부터 고쳤다. Host `ctx.fs`가 `fs-sandbox`였기 때문이다.
