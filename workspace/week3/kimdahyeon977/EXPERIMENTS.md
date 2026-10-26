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
