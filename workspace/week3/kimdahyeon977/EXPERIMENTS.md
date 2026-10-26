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
- 다음: `bubblewrap` 설치 후 재실행한다([DECISIONS.md](DECISIONS.md) Q6 대체 경로).
