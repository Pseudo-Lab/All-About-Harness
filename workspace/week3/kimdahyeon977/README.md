# Week 3: Plugin Grouping과 Service Isolation

개인 하네스 `cb`(Claude Code 플러그인)는 "검증자는 코드를 고치지 않는다"를 프롬프트로만 약속한다. 검증 에이전트에게 `Write`/`Edit` 권한이 그대로 있다. 이번 주에는 그 구조를 cordis Plugin 2개로 줄여 옮기고, 검증 그룹이 권한으로 쓰기를 못 하게 막을 수 있는지 실험했다.

- 결론: `isolate`로 그룹마다 Shell과 정책을 따로 붙일 수 있다. 하지만 하네스의 권한은 세션 단위다. 실제 Agent 세션에서는 read-only 그룹도 쓸 수 있었다. 그룹 기본값을 상한으로 쓰도록 Plugin을 고친 뒤 막혔다.
- 진행 방식: 실험마다 결과를 먼저 예측하고 실행했다. [결정 기록](DECISIONS.md), [실험 기록](EXPERIMENTS.md)(예측·결과·근거 소스 줄 번호).

## 1. 만든 Plugin

| Plugin | Tool | 역할 | 대응하는 `cb` 정거장 |
|---|---|---|---|
| [`check-runner`](plugins/check-runner.mjs) | `run_check(command)` | 검증 명령을 실행하고 종료 코드로 PASS/FAIL 판정 | `cb:verify` |
| [`patch-note`](plugins/patch-note.mjs) | `write_note(path, text)` | 작업 폴더에 파일 쓰기 | `cb:fix` |

두 Plugin 모두 [`shell-call.mjs`](plugins/shell-call.mjs)를 거쳐 `ctx.shell`로 명령을 실행한다. 차이는 어느 그룹에 붙느냐뿐이다. Tool 결과에는 응답한 Shell(`executorTimeoutMs`), 그룹 기본 모드, 세션이 요청한 모드, 실제 실행 모드, 거부 여부가 찍힌다. Shell은 `timeoutMs`로 구분한다(실제 CLI Host 60000, probe Host 30000, verify 5000, fix 45000).

## 2. Group과 Preset 구성

**Stage 1: 묶기만 한다**([`config/stage1`](config/stage1/agent.cordis.yml))

```yaml
- id: cb-lite
  name: cordis:group
  group: true
  config:
    - id: check-runner
      name: ../../plugins/check-runner.mjs
    - id: patch-note
      name: ../../plugins/patch-note.mjs
```

**Stage 2: 역할별 격리**([`config/stage2`](config/stage2/agent.cordis.yml))

```yaml
- id: verify
  name: cordis:group
  group: true
  isolate: { shell: true, sandboxPolicy: true }
  config:
    - { id: verify-policy, name: '@deepseek-ai/dsh-sandbox-policy', config: { mode: read-only } }
    - { id: verify-shell,  name: '@deepseek-ai/dsh-bash-sandbox',   config: { timeoutMs: 5000 } }
    - { id: check-runner,  name: ../../plugins/check-runner.mjs }
- id: fix
  name: cordis:group
  group: true
  isolate: { shell: true, sandboxPolicy: true }
  config:
    - { id: fix-policy,  name: '@deepseek-ai/dsh-sandbox-policy', config: { mode: workspace-write } }
    - { id: fix-shell,   name: '@deepseek-ai/dsh-bash-sandbox',   config: { timeoutMs: 45000 } }
    - { id: patch-note,  name: ../../plugins/patch-note.mjs }
```

`ctx.sandbox`(bwrap 실행기)는 Host 것을 그대로 쓴다. 중복 Provider를 만들지 않는다.

**Group 켰을 때/껐을 때, 묶었을 때/개별 등록했을 때**(실험 1·2)

| 구성 | Agent Tool | `run_check` Shell |
|---|---|---|
| Stage 1 그룹 | `run_check`, `write_note` | Host |
| 그룹 행에 `disabled: true` | 없음 | — |
| 그룹 없이 최상위 행 2개 | `run_check`, `write_note` | Host |

묶기만 해서는 Tool도 Shell도 달라지지 않는다. 그룹이 주는 것은 두 가지다. 하나는 하위 Plugin을 함께 켜고 끄는 단위다(Loader가 부모 체인의 `disabled`를 따라 올라간다, `vendor/loader/src/config/entry.ts:83-94`). 다른 하나는 isolate한 Service의 Provider와 Consumer를 한 영역에 모으는 자리다(실험 4·4b).

## 3. 하나의 Agent에서 두 Plugin 호출(Task 3)

`node agent-run.mjs stage1 '<작업>'`으로 실행했다. headless CLI, Bedrock Haiku 4.5, 작업 폴더 `~/week3-lab`이다. 기록은 [`config/logs/stage1-*.json`](config/logs/)이다.

| 호출 | 결과 | Shell |
|---|---|---|
| `write_note("notes/plan.md", "status: verified")` | `written: true` | 60000 / workspace-write |
| `run_check('grep -qx "status: verified" notes/plan.md')` | `PASS` | 60000 / workspace-write |

Agent 최종 답변: "run_check verdict: PASS … Both tools reported the same shell configuration with a 60-second executor timeout and workspace-write sandbox mode." Stage 1은 두 Plugin이 Host Shell 하나를 공유한다.

## 4. isolate 설계(Task 4)

1. **공유하는 Service**: isolate 없는 Stage 1에서 두 Plugin은 Host의 `ctx.shell`(`bash-sandbox`)과 `ctx.sandboxPolicy`(workspace-write)를 함께 쓴다. `tools`(Tool 등록소)도 공유한다. 그래서 검증용 `check-runner`도 파일을 쓸 수 있다.
2. **분리 대상**: `shell`과 `sandboxPolicy`다. 둘은 한 쌍으로 분리해야 한다.
3. **이유**
   - 공유하면 검증 그룹이 수정 그룹과 같은 쓰기 권한을 가진다. 검증자가 테스트나 코드를 고쳐 PASS를 만들 수 있다(`cb`의 빈틈).
   - 분리하면 검증 그룹은 read-only Shell만 받으므로 쓰기가 권한으로 막힌다(실험 5: `Read-only file system`, `denied: true`). 수정 그룹은 작업 폴더 안에만 쓴다(실험 6).
   - `shell`만 isolate하면 안 된다. 그룹에 정책 Provider를 두면 이름 충돌로 mount가 실패한다(실험 8). 빼면 그룹 전용 Shell이 Host 정책(workspace-write)을 따라 검증 그룹이 조용히 파일을 쓴다(실험 8b).
4. **배치**: 위 Stage 2 YAML이다. Provider(`sandbox-policy`, `bash-sandbox`)와 Consumer(`check-runner` / `patch-note`)를 같은 그룹에 둔다.

```
[ Host ]  ctx.sandbox(bwrap) · ctx.shell(60000, workspace-write) · tools · 세션 기록
   ├─ [ verify ]  isolate: shell, sandboxPolicy
   │     sandbox-policy(read-only) · bash-sandbox(5000) · check-runner
   └─ [ fix ]     isolate: shell, sandboxPolicy
         sandbox-policy(workspace-write) · bash-sandbox(45000) · patch-note
```

## 5. isolate 적용과 Sandbox 실험(선택, Task 5)

**Sandbox 백엔드(실험 0)**: 처음에는 `SANDBOX_UNAVAILABLE`로 거부됐다. 커널에 Landlock이 있어도 하네스가 쓰는 `landlock-run` 실행 파일이 checkout에 없었다. bubblewrap을 sudo 없이 `~/.local/bin`에 풀어 놓은 뒤 `enforcement: full`로 동작했다.

**probe(모델 없음)**

| 실험 | 결과 |
|---|---|
| 3. isolate 없이 Shell Provider를 Preset에 넣기 | mount 실패. `service "shell" has been registered`. 이름이 안 겹쳐도 `a preset service must sit behind an isolate realm`(3b) |
| 4. 그룹 밖 Tool | 그룹 Shell을 못 보고 Host Shell을 쓴다 |
| 4b. isolate했는데 그룹에 Provider 없음 | `check-runner: waiting for shell`. 바깥으로 넘어가 찾지 않는다 |
| 5. verify(read-only) 읽기/쓰기 | 읽기 PASS, 쓰기 `Read-only file system` |
| 6. fix(workspace-write) | 작업 폴더 안 O, 홈 X, `/tmp`는 exit 0인데 파일이 남지 않는다(bwrap 일회용 `/tmp`) |

**실제 Agent에서 발견한 구멍**

| 실행 | verify `run_check` 쓰기 | fix `write_note` 쓰기 |
|---|---|---|
| Stage 2, 수정 전 | **써짐**(그룹 기본값 read-only, 실행 모드 workspace-write) | — |
| Stage 2, 수정 후 | 막힘(`Read-only file system`) | 써짐 |

- 실제 Agent 세션은 시작하자마자 `sandbox/mode: workspace-write`를 세션 기록에 남긴다.
- 정책은 `요청 모드 ?? 세션 기록 ?? 그룹 기본값` 순서로 모드를 정한다(`packages/sandbox/sandbox-policy/src/index.ts:163-169`). 세션 기록은 isolate하지 않아 그룹끼리 공유된다. probe 세션에는 이 기록이 없어서 실험 5에서는 보이지 않았다.
- 정책의 `mode`는 상한이 아니라 "a session starts from"(같은 파일 `:71`)이다. 하네스의 권한 모델은 세션 단위다.
- 기본 `tool-fs`도 같다. read-only 그룹 안에서 probe로는 `FS_SANDBOX_DENIED`였지만 실제 세션에서는 파일을 만들었다(실험 7).
- 수정: [`shell-call.mjs`](plugins/shell-call.mjs)가 세션 모드와 그룹 기본값 중 더 좁은 쪽으로 실행한다(`capMode`). 그룹 기본값이 상한이 되고 세션은 더 좁힐 수만 있다. 모르는 모드는 기본값으로 내린다. 확인은 `node plugins/shell-call.check.mjs`.

**권한 상향(실험 9)**: read-only 세션에서 모델이 `sandbox_permissions`로 상향을 요청하자 `requires approval, but no approval channel is available`로 즉시 거부됐다(실행 12초). 승인할 사람이 없으면 기다리지 않고 거부한다.

## 6. 알게 된 점

- **묶기 ≠ 격리 ≠ 권한 제한.** 그룹은 켜고 끄는 단위다. isolate는 어느 Service 인스턴스를 쓸지 정한다. Sandbox 모드는 그 Shell이 어디에 쓸 수 있는지 정한다. 여기에 하나가 더 있다. 정책이 무엇을 입력으로 읽는지(세션 기록)까지 봐야 격리가 성립한다.
- **isolate한 이름은 그룹 안에서 새로 채워야 한다.** isolate 맵은 `Object.create(부모 맵)`이다(`vendor/loader/src/config/isolate.ts:93`). isolate하지 않은 이름(`tools` 등)은 바깥을 따라가고, isolate한 이름은 새 키로 덮어써서 바깥을 보지 않는다.
- **정책은 Consumer 쪽 그룹에서 정해진다.** Host의 `ctx.fs`를 써도 `tool-fs`가 자기 그룹 정책을 넘긴다(실험 7).
- **fail closed.** Sandbox 실행기가 없을 때(실험 0)와 승인할 사람이 없을 때(실험 9) 둘 다 실행하지 않고 거부한다.
- **종료 코드는 결과의 증거가 아니다.** `/tmp` 쓰기는 exit 0이었지만 파일이 사라졌다.
- **probe만으로 결론 내리면 안 된다.** 실험 5는 probe에서 통과했지만 실제 세션에서 뚫렸다.

## 7. 어려웠던 점

- **Preset 안 패키지 이름의 해석 기준**: Preset 폴더가 아니라 Host 구성(dsh-base) 위치다(`packages/preset/agent-presets/src/mount.ts:80-104`). probe의 base URL을 dsh-base로 맞춰야 했다. 저장소 밖 Plugin이 `@deepseek-ai/*`를 이름으로 import하도록 [`config/harness-resolve.mjs`](config/harness-resolve.mjs) resolve hook을 썼다.
- **headless는 Preset을 붙이지 않는다**(`packages/bundle/headless/src/index.ts:180-191`). 첫 Agent 실행이 우리 Tool 대신 Host `bash`/`write`를 썼다. [`config/preset-runner.mjs`](config/preset-runner.mjs)가 Agent 생성 시 Preset을 mount하고, Host `tool-bash`/`tool-fs`는 꺼서 우회를 막았다.
- **Shell 표식 충돌**: 실제 CLI Host Shell이 60000이라 처음 정한 fix 표식(60000)과 겹쳤다. fix를 45000으로 바꿨다.
- **실수**: 실험 4 직후 "Provider와 Consumer가 같은 그룹에 있어야 한다"까지 확인됐다고 적었다. 실험 4는 한 방향만 보였다. 실험 4b로 반대 방향을 확인하고 기록을 고쳤다.

## 8. 실행 방법

```sh
cd workspace/week3/kimdahyeon977
# 모델 없이: Preset mount, Tool 목록, Tool 직접 호출
node --import ./config/harness-resolve.mjs probe.mjs stage2 run_check '{"command":"echo x > a.txt"}'
# 실제 Agent(Bedrock Haiku). 키는 BEDROCK_ENV 파일(기본 ~/.dsh/bedrock.env)에서 읽는다
node agent-run.mjs stage2 'Call run_check with `echo x > a.txt` and report the result.'
```

필요한 것: 로컬 `deepseek-harness` 빌드, PATH의 `bwrap`, 세션 로그 해제용 `zstd`. 작업 폴더는 `~/week3-lab`(`WEEK3_LAB`로 변경)이다.

## 파일

- `plugins/`: Plugin 2개, 공통 헬퍼, 상한 로직 체크(`shell-call.check.mjs`)
- `config/stage1`, `config/stage2`: 최종 Preset. `config/exp*`: 실험별 변형 Preset
- `config/logs/`: Agent 실행 요약(Tool 호출·결과·최종 답변, 자격 증명 없음)
- `probe.mjs`, `agent-run.mjs`, `config/preset-runner.mjs`, `config/harness-resolve.mjs`: 실행 도구
- [`DECISIONS.md`](DECISIONS.md), [`EXPERIMENTS.md`](EXPERIMENTS.md)
