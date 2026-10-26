# Week 3 실험 기록

실험마다 사용자 예측을 먼저 받고 Claude 예측을 공개한 뒤 실행했다([DECISIONS.md](DECISIONS.md) Q2·Q8). 명령은 이 폴더에서 실행한다.

```sh
node --import ./config/harness-resolve.mjs probe.mjs <presetId> [tool '<json args>']...
```

`probe.mjs`는 dsh-base와 같은 Host Shell 구성(`subprocess-local` → `sandbox-local` → `sandbox-policy` workspace-write → `bash-sandbox`)을 띄우고 Preset을 Agent 하나에 붙인 뒤 Tool을 직접 호출한다. 작업 폴더는 `~/week3-lab`이다. Shell 인스턴스는 executor `timeoutMs`로 구분한다(Host 30000, verify 5000, fix 60000).

## 실험 0. Sandbox 백엔드 확인

- 질문: Host `ctx.shell`이 `bash-sandbox`(workspace-write)이고 `bwrap`은 없고 커널에 Landlock이 켜져 있다. Stage 1에서 `run_check {"command":"true"}`의 결과는?
- 사용자 예측: (a) 실행되고 `enforcement: full`(Landlock).
- Claude 예측: (c) `SANDBOX_UNAVAILABLE`로 거부. 근거는 다음과 같다.
  - Linux 실행기 순서는 `bwrap` → Landlock이고 둘 다 못 쓰면 거부한다(`packages/sandbox/sandbox-local/README.md:71`).
  - 하네스는 커널 Landlock을 `landlock-run` 실행 파일로 쓴다(`native/system/packages/entry/src/index.ts:22`). 그런데 checkout에는 `linux-x64/bin/glibc/system.node`만 있다.
- 결과: (c). 거부됐다.

  ```
  "code": "SANDBOX_UNAVAILABLE"
  sandbox mode "workspace-write" is requested but no sandbox backend is usable on this host;
  refusing to run the command unconfined. Install bubblewrap or run a Landlock-enforcing kernel (Linux) ...
  ```

- 원인 확인: launcher API를 직접 호출했다.
  - `launcherPath()` → `native/system/packages/linux-x64/bin/landlock-run`이다. 이 경로에 파일이 없다(`bin/`에는 `glibc/`만 있다).
  - `probe()` → `unusable`이다.
  - 따라서 Landlock 경로가 막힌 직접 원인은 launcher 미빌드다. 커널 Landlock 자체가 이 WSL에서 동작하는지는 launcher가 없어 확인하지 못했다.
- 알게 된 점
  - **커널 기능 ≠ 하네스가 쓸 수 있음.** 하네스는 커널 기능을 별도 실행 파일로 쓰므로 그 실행 파일이 있어야 한다.
  - **fail closed.** Sandbox를 못 쓰면 가두지 않은 채로 실행하지 않고 거부한다. week2에서 `tool-bash`가 문제없이 돈 것처럼 보였다면 그 실행이 어떤 Shell 구성이었는지 다시 볼 필요가 있다(week2 증거에 sandbox 기록 없음).
- 조치: `sudo apt install`은 `!` 실행에서 비밀번호를 받을 터미널이 없어 실패했다. sudo 없이 설치했다. bwrap은 unprivileged user namespace로 돈다(`max_user_namespaces=63367`).

  ```sh
  cd ~/.local/opt/bwrap-deb && apt-get download bubblewrap && dpkg -x bubblewrap_*.deb .
  ln -sf ~/.local/opt/bwrap-deb/usr/bin/bwrap ~/.local/bin/bwrap   # sandbox-local은 PATH의 'bwrap'을 찾는다(src/index.ts:69)
  ```

- 재실행. 사용자 예측은 (a). Claude 예측도 (a)다. README가 partial을 Windows ACL과 구 Landlock ABI로만 든다(`sandbox-local/README.md:53`).
- 결과: (a).

  ```json
  "verdict": "PASS",
  "shell":   { "executorTimeoutMs": 30000, "defaultMode": "workspace-write", "workdir": "/home/dhkim/week3-lab" },
  "sandbox": { "mode": "workspace-write", "denied": false, "enforcement": "full" }
  ```

  - 바꾼 것은 bwrap 하나다. 설치 전에는 거부, 설치 후에는 full이다.
  - `executorTimeoutMs: 30000` = Host Shell이다. isolate 없는 Stage 1의 `check-runner`는 Host의 workspace-write Shell을 그대로 쓴다(Task 2 "공유 Service" 답).

## 실험 1. Group 켰을 때/껐을 때 Tool 목록

- 질문: Stage 1의 `cb-lite` 그룹 행에 `disabled: true`만 추가하면(`config/exp1-off/`) Agent가 받는 Tool은?
- 사용자 예측: (a) `[]`. 그룹 자체를 껐고 Plugin이 그 그룹에 속해 있기 때문이다.
- Claude 예측: (a). Loader는 entry 자신 또는 부모 entry 중 하나라도 disabled면 꺼진 것으로 판정한다(`vendor/loader/src/config/entry.ts:83-94`).
- 결과: (a).

  | Preset | Agent Tool |
  |---|---|
  | `stage1` | `['run_check', 'write_note']` |
  | `exp1-off` | `[]` |

- 알게 된 점: 그룹 행 하나가 하위 Plugin 전체의 on/off 스위치다. 판정은 부모 체인을 따라 올라가며 한다.

## 실험 2. Group으로 묶었을 때/개별 등록했을 때

- 질문: 두 Plugin을 그룹 없이 최상위 행으로 등록하면(`config/exp2-flat/`) Stage 1과 비교해 (1) Tool 목록, (2) `run_check`에 응답하는 Shell이 달라지나?
- 사용자 예측: (1) 같다. 개별 등록했어도 같은 Plugin이다. (2) 같다. 그룹 종속만 달라졌고 Service를 제공하는 쪽은 그대로다.
- Claude 예측: 둘 다 같다.
  - `cordis:group`은 Loader의 `Group`을 다시 내보내는 3줄이다(`vendor/group/src/index.ts`).
  - Service 조회 키는 entry에 `isolate` 옵션이 있을 때만 새 맵으로 갈린다(`vendor/loader/src/config/isolate.ts:79-93`). 없으면 부모 맵을 물려받는다.
- 결과: 둘 다 같다.

  | Preset | Agent Tool | `run_check` Shell |
  |---|---|---|
  | `stage1` | `run_check`, `write_note` | `executorTimeoutMs: 30000`, workspace-write (Host) |
  | `exp2-flat` | `run_check`, `write_note` | `executorTimeoutMs: 30000`, workspace-write (Host) |

- 알게 된 점
  - 묶기만 해서는 Service가 분리되지 않는다. 그룹이 주는 것은 (1) 하위 Plugin을 함께 켜고 끄는 단위(실험 1), (2) isolate를 걸어 Provider와 Consumer를 한 영역에 모으는 자리다. (2)는 실험 4에서 확인한다.
  - `isolate`는 그룹 전용이 아니라 Loader의 모든 entry가 받는 옵션이다(`isolate.ts:8`, `:79`).

## 실험 3. isolate 없이 Shell Provider를 Preset에 넣기

- 질문: Host가 이미 `ctx.shell`(30000)을 제공하는 상태에서 `cb-lite` 그룹에 `dsh-bash-sandbox`(5000)를 isolate 없이 넣으면(`config/exp3-noisolate/`)?
- 사용자 예측: (c) 붙고, Host Shell을 덮어써서 프로세스 전체가 5000 Shell을 쓴다. isolate가 없으면 분리가 안 되니 덮어씌워진다.
- Claude 예측: (d) 같은 이름 충돌로 mount 실패.
  - 같은 영역 키로 두 번째 등록하면 `provide()`가 throw한다(`presets/standard/agent.cordis.yml:16-17`).
  - mount는 "켜지지 않은 행" → "루트로 샌 Service" 순서로 검사한다(`agent-presets/src/mount.ts:403-413`). 충돌이면 앞 검사에 걸린다.
- 결과: (d). 실패 위치는 예측보다 앞인 entry 적용 단계다.

  ```
  failed to apply loader entry lite-shell (@deepseek-ai/dsh-bash-sandbox):
  service "shell" has been registered at <SandboxBashExecutor>
  ```

- 반증 확인(`config/exp3b-leak/`): Host에 없는 이름(`labNote`, fixture Service)을 isolate 없이 제공했다. 충돌이 없으면 두 번째 안전장치에 걸리는지 확인하려는 것이다.

  ```
  row(s) published process-global service(s) [labNote];
  a preset service must sit behind an `isolate` realm or move to the host composition
  ```

  | 변형 | 막힌 곳 |
  |---|---|
  | 이름 충돌 있음(`shell`) | cordis Service 등록 단계 |
  | 이름 충돌 없음(`labNote`) | agent-presets mount 후 누출 검사(`leakedServices`, `mount.ts:211-225`) |

- 알게 된 점
  - isolate 없는 Provider는 루트 영역(프로세스 전체)에 등록하려 한다. 여기까지는 사용자 직관이 맞다.
  - 같은 영역의 같은 이름은 덮어쓰지 않고 거부한다. 이름이 안 겹쳐도 Preset 층이 누출로 거부한다.
  - 따라서 Preset 안에서 Service를 제공하려면 isolate가 필수다. 같은 Preset을 쓰는 여러 세션이 인스턴스를 공유하거나 서로 덮어쓰는 것을 두 겹으로 막는다.

## 실험 4. isolate 후 그룹 밖 Tool이 그룹 전용 Shell을 보는가

- 질문: `verify` 그룹만 isolate(read-only Shell, 5000)하고 `patch-note`를 그룹 밖 최상위 행에 두면(`config/exp4-outside/`) 각 Tool에 어느 Shell이 응답하나?
- 사용자 예측: (a) `run_check`는 그룹 Shell(5000, read-only), `write_note`는 Host Shell(30000, workspace-write). 그렇게 명시했기 때문이다.
- Claude 예측: (a). isolate가 걸린 entry만 새 isolate 맵을 받고(`vendor/loader/src/config/isolate.ts:93`) 하위 행이 그 맵을 물려받는다. 그룹 밖은 원래 맵을 쓴다.
- 결과: (a).

  | Tool | 위치 | `executorTimeoutMs` | mode | 결과 |
  |---|---|---|---|---|
  | `run_check` | verify 그룹 안 | 5000 | read-only | PASS |
  | `write_note` | 그룹 밖 | 30000 | workspace-write | `~/week3-lab/exp4/out.md` 작성됨 |

- 알게 된 점
  - isolate는 그 그룹 안에서만 유효한 Service 주소록을 만든다. 그룹 밖 Tool은 그룹 Shell을 자동으로 쓰지 않는다(과제 문서의 "그룹 밖에 등록한 다른 Tool이 이 Shell을 자동으로 사용하게 되는 것은 아닙니다"를 확인).
  - 이 실험이 보인 것은 "그룹 밖에서는 그룹 Shell이 안 보인다"까지다. 처음에 "Provider와 Consumer가 같은 그룹에 있어야 연결된다"까지 확인됐다고 적었는데 과장이었다. 반대 방향은 실험 4b에서 확인했다.
  - `write_note`가 Shell을 쓸 수 있었던 것은 Host가 모두에게 Shell을 주기 때문이다. isolate 맵은 `Object.create(부모 맵)`이라(`isolate.ts:93`) isolate하지 않은 이름은 바깥을 따라간다. 그룹 안 `check-runner`가 Host의 `tools`에 Tool을 등록할 수 있는 것도 같은 이유다.

## 실험 4b. isolate했는데 그룹 안에 Provider가 없으면

- 질문: `verify`에 `isolate: { shell: true }`만 걸고 Shell Provider 없이 `check-runner`만 두면(`config/exp4b-noprovider/`)? (a) 바깥 Host Shell을 찾아 쓴다, (b) Shell을 못 찾아 Tool이 안 생기거나 mount 실패.
- 사용자 예측: (b). 이유는 "횟수 제한은 안 해서..?"(원문 그대로)이다.
- Claude 예측: (b) `row(s) did not activate`. isolate는 그룹 맵의 `shell` 칸을 비우는 게 아니라 새 키로 덮어쓴다(`isolate.ts:93-97`). 그 키로 등록된 Provider가 없으니 `inject: ['shell']`인 `check-runner`가 시작하지 못한다.
- 결과: (b).

  ```
  1 row(s) did not activate:
  check-runner (../../plugins/check-runner.mjs): waiting for shell
  ```

- 알게 된 점: isolate한 이름은 바깥으로 넘어가 찾지 않는다. 실험 4와 합치면 **isolate한 Service의 Provider와 Consumer는 같은 그룹에 있어야 한다**. 그룹이 isolate의 단위로 필요한 이유다(실험 2 가설 확인).

## 실험 5. read-only 읽기 vs 쓰기

- 질문: Stage 2 `verify` 그룹(read-only Shell)의 `run_check`로 (1) `cat exp4/out.md`, (2) `echo test > exp5.txt`를 실행하면?
- 사용자 예측: (b) 둘 다 성공(이유 미기재).
- Claude 예측: (a) 읽기 성공, 쓰기 차단.
  - 정책 우선순위는 승인된 상향 > 세션 모드 기록 > 기본값이다(`packages/sandbox/sandbox-policy/src/index.ts:156`). probe 세션에는 기록도 승인도 없어 그룹 기본값 read-only가 적용된다.
  - read-only에서 쓸 수 있는 곳은 `/dev/null`뿐이다(`packages/shell/bash-sandbox/README.md` 모드 표).
- 결과: (a).

  | 명령 | verdict | 출력 | sandbox |
  |---|---|---|---|
  | `cat exp4/out.md` | PASS | `hi` | 5000 / read-only / `denied: false` / full |
  | `echo test > exp5.txt` | FAIL | `bash: line 1: exp5.txt: Read-only file system` | 5000 / read-only / `denied: true` / full |

  `ls ~/week3-lab/exp5.txt` → `No such file or directory`.

- 알게 된 점
  - `run_check`는 임의 명령을 받지만 그룹 Shell이 read-only라 쓰기가 권한으로 막힌다. `cb`의 "검증자는 고치지 않는다"(프롬프트 약속)를 이 구성은 권한으로 강제한다. Task 4의 핵심 근거다.
  - 실제 Agent 세션에서는 세션 모드 기록이 기본값보다 우선한다. 같은 결과가 나오는지는 Task 5 시연에서 확인한다.

## 실험 6. workspace-write 안/밖/`/tmp` 쓰기

- 질문: Stage 2 `fix` 그룹(workspace-write Shell)의 `write_note`로 (1) `exp6/in.md`, (2) `/home/dhkim/exp6-outside.md`, (3) `/tmp/exp6-tmp.md`를 쓰면?
- 사용자 예측: isolate가 되면 각각 써지고, 아니면 막힌다. `fix`는 isolate돼 있으므로 셋 다 써진다고 기록한다.
- Claude 예측: 1 성공, 2 차단, 3은 성공으로 보고되지만 실제 `/tmp`에는 남지 않는다. workspace-write는 workspace root와 `/tmp`만 쓸 수 있고, bwrap의 `/tmp`는 일회용이다(`bash-sandbox/README.md` 모드 표).
- 결과: Claude 예측대로다.

  | # | 경로 | Tool 응답 | 실제 디스크 |
  |---|---|---|---|
  | 1 | `exp6/in.md` | `written: true` | 있음 |
  | 2 | `/home/dhkim/exp6-outside.md` | `written: false`, `Read-only file system`, `denied: true` | 없음 |
  | 3 | `/tmp/exp6-tmp.md` | `written: true`, `exitCode: 0` | **없음** |

  셋 다 `executorTimeoutMs: 60000`(fix 그룹 Shell), mode `workspace-write`이다.

- 알게 된 점
  - **isolate ≠ Sandbox.** isolate는 어느 Shell을 쓰는지를, Sandbox 모드는 그 Shell이 어디에 쓸 수 있는지를 정한다. isolate된 그룹이라고 아무 데나 쓸 수 있는 것이 아니다. 사용자 예측이 어긋난 지점이다.
  - **종료 코드는 결과의 증거가 아니다.** `/tmp` 쓰기는 exit 0으로 성공했지만 bwrap 일회용 `/tmp`라 명령이 끝나면 사라졌다. 종료 코드만으로 판정하는 `write_note`/`run_check`는 거짓 성공을 보고할 수 있다.
  - 경로에 `~`를 쓰면 따옴표 안이라 확장되지 않는다. 처음 질문의 `~/exp6-outside.md`를 절대경로로 바꿔 실행했다.

## 실험 8. `shell`만 isolate하고 `sandboxPolicy`는 빼면

- 질문: Stage 2에서 두 그룹의 isolate를 `shell`만 남기고, 각 그룹의 정책 Plugin(read-only / workspace-write)은 그대로 두면(`config/exp8-shellonly/`)? (a) Stage 2와 같다, (b) 둘 다 Host 정책을 따라 verify도 쓸 수 있다, (c) mount 실패.
- 사용자 예측: (a). Sandbox 모드를 끄니까. (실제로는 정책 Plugin은 남아 있고 정책을 그룹에 가두는 설정만 뺀 것이다.)
- Claude 예측: (c). 실험 3과 같은 이유다. isolate하지 않은 `sandboxPolicy` Provider는 루트 영역에 등록하려 하고, 그 자리에 Host 정책이 이미 있다.
- 결과: (c).

  ```
  failed to apply loader entry verify-policy (@deepseek-ai/dsh-sandbox-policy):
    service "sandboxPolicy" has been registered at <SandboxPolicyService>
  failed to apply loader entry fix-policy (...): 같은 오류
  ```

- 설계 추론 확인(`config/exp8b-nopolicy/`): DECISIONS Q4의 추론("`shell`만 isolate하면 두 Shell이 Host 정책 하나를 읽어 모드가 같아진다")은 그룹에서 정책 Plugin을 빼야 성립한다. verify의 `run_check`로 `echo x > exp8b.txt`를 실행했다.

  ```
  "verdict": "PASS", "executorTimeoutMs": 5000, "mode": "workspace-write", "denied": false
  ```

  `~/week3-lab/exp8b.txt`가 생겼다. Shell은 verify 전용(5000)인데 정책은 Host의 workspace-write라 검증 그룹이 파일을 썼다.

- 알게 된 점
  - 그룹별로 다른 모드를 주려면 **`sandboxPolicy`도 isolate하고 그룹 안에 정책 Provider를 둬야 한다**. 최종 YAML(Stage 2)의 `isolate: { shell: true, sandboxPolicy: true }`의 근거다.
  - `shell`만 isolate하면 다음 둘 중 하나다. 정책 Provider를 두면 이름 충돌로 실패하고(8), 빼면 조용히 Host 정책을 따라 검증 그룹도 쓸 수 있게 된다(8b). 8b가 더 위험하다. 오류 없이 붙고 Shell도 그룹 전용처럼 보여서 격리된 것으로 착각하기 쉽다.

## Task 3. 하나의 Agent Preset으로 실제 Agent 실행

- 명령: `node agent-run.mjs stage1 '<작업>'`. headless CLI, Bedrock Haiku 4.5(`config/bedrock-haiku.patch.yml`), 작업 폴더 `~/week3-lab`이다. 기록은 `config/logs/stage1-*.json`이다.
- 작업: "`write_note`로 `notes/plan.md`에 `status: verified` 한 줄을 쓰고, `run_check`로 `grep -qx "status: verified" notes/plan.md`를 실행해 verdict와 각 Tool의 Shell을 보고하라."
- 처음 실행은 실패했다. Agent가 `write_note`/`run_check`가 아니라 Host의 `write`/`bash`를 썼다.
  - 세션 로그에 Preset mount 기록이 없었다.
  - headless 실행기는 Preset roster를 쓰지 않는다. `packages/bundle/headless/src/index.ts:180-191`: "This bundle composes no preset roster… A deployment that DOES configure one has to join it here first."
  - roster의 `default: stage1` 설정은 아무도 읽지 않았다. week2가 자체 bootstrap을 넣은 이유와 같다.
- 조치: `config/preset-runner.mjs`가 `headless-runner`를 대신해 Agent 생성 시 `ctx.agentPresets.mount(agentCtx, presetId)`를 호출한다. 모델이 우회하지 못하게 Host `tool-bash`/`tool-fs`/`tool-fs-search`를 끈다.
- 결과: Agent Tool 목록에 `run_check`와 `write_note`가 있고 `bash`/`write`/`read`는 없다.

  | 호출 | 인자 | 결과 | Shell |
  |---|---|---|---|
  | `write_note` | `notes/plan.md`, `status: verified` | `written: true` | 60000 / workspace-write |
  | `run_check` | `grep -qx "status: verified" notes/plan.md` | `PASS` | 60000 / workspace-write |

  - 디스크의 `~/week3-lab/notes/plan.md` = `status: verified`.
  - Agent 최종 답변: "run_check verdict: PASS … Both tools reported the same shell configuration with a 60-second executor timeout and workspace-write sandbox mode."
- 알게 된 점
  - 실제 CLI의 Host Shell은 `timeoutMs: 60000`이다(`packages/bundle/base/cordis.patch.yml:218`). probe의 Host(30000)와 다르고, Stage 2 `fix` 표식(60000)과 겹친다. 그래서 `fix` 표식을 45000으로 바꿨다. 실험 5·6의 60000은 probe 기준(Host 30000) 기록이라 그대로 둔다.
  - **실제 Agent 세션은 시작하자마자 `sandbox/mode: workspace-write`를 세션에 기록한다**(session seq 1, `permission/preset` 직후). 정책 우선순위상 세션 모드가 그룹 기본값보다 위다. Stage 2 verify(read-only)가 실제 세션에서도 유지되는지는 Task 5에서 확인한다.

## Task 5. 실제 Agent 세션에서 verify(read-only)가 유지되나

- 질문: Stage 2로 실제 Agent를 실행하고 verify 그룹의 `run_check`에 `echo test > task5.txt`를 시키면? 세션은 시작 시 `sandbox/mode: workspace-write`를 기록한다(Task 3).
- 사용자 예측: (b) 써진다. 세션 모드가 더 상위다.
- Claude 예측: (b). 그룹 정책의 `resolve()`는 `request.mode ?? overrideOf(session) ?? this.defaultMode` 순서다(`packages/sandbox/sandbox-policy/src/index.ts:163-169`). `overrideOf`가 읽는 세션 기록(`sessionProjections`)은 isolate하지 않아 Host와 공유된다.
- 결과: (b). 써졌다.

  ```
  run_check "echo test > task5.txt" → PASS
  shell.executorTimeoutMs=5000 (verify 그룹 Shell), shell.defaultMode=read-only
  sandbox.mode=workspace-write, denied=false
  ~/week3-lab/task5.txt 생성됨
  ```

- 알게 된 점
  - isolate는 동작했다(verify 전용 Shell 5000, 전용 정책 기본값 read-only). 하지만 그 정책은 공유 세션 기록을 먼저 읽는다. 그래서 probe(실험 5, 세션 기록 없음)에서 막힌 쓰기가 실제 Agent에서는 뚫린다.
  - `cb`의 빈틈("검증자도 고칠 수 있다")이 isolate 후에도 남아 있었다. 오류 없이 격리된 것처럼 보인다는 점에서 실험 8b와 같은 종류의 위험이다.
  - 모델 없는 probe만으로 결론 내리면 안 된다. probe 세션에는 `permission/preset`·`sandbox/mode` 이벤트가 없다.

### Task 5 수정 후 재실행

- 수정(`plugins/shell-call.mjs`): 세션 모드와 그룹 기본값 중 더 좁은 쪽으로 실행한다(read-only < workspace-write < danger-full-access). 그룹 기본값이 상한이 되고 세션은 그보다 좁힐 수만 있다. 결과에 세션이 요청한 모드(`resolvedMode`)를 함께 남긴다.
- 질문: 같은 세션(workspace-write)에서 (1) verify `run_check`로 `echo test > task5b.txt`, (2) fix `write_note`로 `notes/task5b.md`를 쓰면?
- 사용자 예측: (1) 막힌다. 더 좁은 그룹 기본값으로 고쳤기 때문이다. (2) 미기재.
- Claude 예측: (1) 막힌다(min(workspace-write, read-only) = read-only). (2) 써진다(min(workspace-write, workspace-write)). 둘 다 막히면 과하게 고친 것이다.
- 결과: 예측대로다.

  | Tool | Shell | 그룹 기본값 | 세션 요청 | 실제 실행 | 결과 |
  |---|---|---|---|---|---|
  | `run_check` | 5000 | read-only | workspace-write | read-only | FAIL, `Read-only file system`, `denied: true`, 파일 없음 |
  | `write_note` | 45000 | workspace-write | workspace-write | workspace-write | `written: true`, `notes/task5b.md` 있음 |

- 알게 된 점: isolate(어느 Shell·정책을 쓰나)와 Sandbox(어디에 쓸 수 있나)에 더해, **정책이 무엇을 입력으로 읽는가**까지 확인해야 격리가 성립한다. 이번 구멍은 isolate하지 않은 공유 상태(세션 기록)를 통해 들어왔다.

## 실험 7. read-only 그룹 안의 `tool-fs`(Shell을 거치지 않는 쓰기)

- 준비: 처음 가설은 "`tool-fs`는 Sandbox를 우회한다"였다. 구성을 확인해 보니 Host `ctx.fs`가 `fs-sandbox`(정책을 읽고 쓰기를 거부함)라(`packages/bundle/base/cordis.patch.yml:479`) 질문을 바꿨다. probe Host에도 `fs-sandbox`를 붙였다.
- 질문: Stage 2 verify 그룹(shell·sandboxPolicy isolate, read-only)에 `dsh-tool-fs`를 넣고(`config/exp7-toolfs/`) `write`로 `exp7.txt`를 쓰면? `ctx.fs`는 isolate하지 않았다.
- 사용자 예측: (b) 써진다. `write`는 Shell이 아니라 `ctx.fs`를 쓰고, `ctx.fs`는 isolate하지 않았으니 Host 권한대로 써진다.
- Claude 예측: (a) probe에서는 막힌다.
  - `fs-sandbox`는 호출자가 넘긴 정책으로 판단한다(`packages/fs/fs-sandbox/src/index.ts:76-87`).
  - 정책은 `tool-fs`가 자기 ctx에서 가져온다(`packages/fs/tool-fs/src/sandbox.ts:46`, `write.ts:110-117`). verify 그룹의 read-only 정책이다.
  - 실제 Agent 세션에서는 Task 5와 같은 이유로 써질 것이다.
- 결과
  - probe: (a). `FS_SANDBOX_DENIED`, `[sandbox: file access denied under read-only mode]`, 파일 없음.
  - 실제 Agent(`config/logs/exp7-toolfs-*.json`): 세션 모드 workspace-write, `write` → `Created file`, `~/week3-lab/exp7-agent.txt` 생성.
- 알게 된 점
  - Provider(`ctx.fs`)가 Host 것이어도 정책은 Consumer(`tool-fs`)가 있는 그룹에서 결정된다. 사용자 예측이 어긋난 지점이다.
  - Task 5의 구멍은 우리 Plugin만의 문제가 아니다. 기본 `tool-fs`도 실제 세션에서 read-only 그룹을 넘어 쓴다.
  - 원인은 설계다. `sandbox-policy`의 `mode`는 "File-sandbox mode a session starts from"(`sandbox-policy/src/index.ts:71`), 즉 상한이 아니라 세션의 출발값이다. 하네스의 권한 모델은 세션 단위(사용자 선택·승인)다. 그룹별 상한을 원하면 Consumer가 직접 걸거나(우리 `shell-call.mjs`), 정책에 상한 설정이 있어야 한다.
