# Reproducible Harness runs

From the All-About-Harness repository root:

```bash
# No model requests: prepare and exercise real preset + Creator define/run.
node workspace/week2/kimdahyeon977/runner/run.mjs custom --check
node workspace/week2/kimdahyeon977/runner/run.mjs official --check

# Actual paid model execution; the parent runs these when ready.
node workspace/week2/kimdahyeon977/runner/run.mjs custom
node workspace/week2/kimdahyeon977/runner/run.mjs official

# Materialize files without even starting Harness.
node workspace/week2/kimdahyeon977/runner/run.mjs custom --prepare

# Dependency-aware project planner, same generated preset in both modes.
RALPH_SCENARIO=planner node workspace/week2/kimdahyeon977/runner/run.mjs custom
RALPH_SCENARIO=planner node workspace/week2/kimdahyeon977/runner/run.mjs official
```

Each command prints its newly created private directory under `/tmp/week2-harness-runs/`. `RUN_ROOT` may select another directory within `/tmp` or this repository. `HARNESS_ROOT`, `BEDROCK_ENV`, and `BEDROCK_PATCH` override the source checkout, credential input, and model patch paths. No installs, builds, home writes, credential copies, or model requests occur during preparation. Checks remove secret environment variables and point AWS credential/config lookup at absent paths in the private run directory. Real runs inherit the parent's authenticated environment and, when present, read only Bedrock/AWS key and region entries from `/home/user/.dsh/bedrock.env` or `BEDROCK_ENV`. A larger application `.env` may be supplied: unrelated entries are neither loaded nor passed to Harness. Credential values are not copied or printed.

The checked-in `bedrock.patch.yml` is the default first `--patch` overlay; `BEDROCK_PATCH` may override it. It declares `amazon-bedrock` / `us.anthropic.claude-sonnet-4-5-20250929-v1:0` without credentials. Bootstrap refuses another route. The process uses the built local CLI, `deepseek-harness/apps/cli/lib/bin.js`; it does not silently rebuild stale artifacts. For the local follow-up experiment, `BEDROCK_ENV=/home/dhkim/chatbot-v2/.env` supplied only the three required Bedrock values, mapped to AWS standard variable names in memory. `DSH_PERMISSION_MODE=danger-full-access` allowed the delegated test child to run Node's test runner.

Every run gets its own `dsh-home/`, `workspace/`, `logs/`, and external `frozen/`. Both workspaces initially contain only identical acceptance files: no CLI and no reference example. By default the same bytes from `task-staged.txt` become the immutable objective and the six TODO tests are frozen. `RALPH_SCENARIO=single` selects the original `task.txt` objective. `RALPH_SCENARIO=planner` selects the larger three-stage project planner in `task-planner.txt`, `acceptance/planner.md`, and its eleven frozen tests. The manifest records task, acceptance, and preset SHA-256 digests. Descendants inherit the parent's exact provider/model selection. Both controllers receive a five-round bound; the custom controller can start an implementation child and a verification child per round, whereas official Ralph starts one child per round. This compares five rounds, not equal model-call counts.

Both modes now use the same generated preset ID **experiment-ralph** and identical preset bytes. Preparation takes the authored `persona`, `tool-bash`, and `tool-fs` rows from `../preset/agent.cordis.yml`, omits the static controller, then adds an isolated workflow engine with official `tool-ralph` and `tool-cordis` for Creator define/run. This is the smallest shared toolset that can execute either controller. It does not inherit the shipped delegation group or skills. The custom controller's child guard remains a separate enforcement layer. Display metadata is copied from `../preset/preset.yml`. The roster uses the supported `roots` setting with `trust: user` and disables the home-derived user root. Static model-facing host rows are disabled using the same split as the Web composition. Host registries, spawn backend, system prompt, and the dynamic Cordis runner remain available to both modes.

Both drivers create a persisted agent and join the preset in `agents.create(... setup ...)`, submit the exact run-local `creator.host.js` to `cordis_define`, activate it with `cordis_run`, and execute `creator_run_loop`. No parent model call is required. For Custom, `creator-source.mjs` inserts the full reviewed `plugin/core.mjs` function into the dynamic source: its `for` loop starts every round, composes the handoff, and decides completion inside the Creator VM. `ralphHost.withRun` supplies single-child startup, shared-workspace IO, guards, cancellation, and cleanup to that callback; it never iterates rounds. No static `custom_ralph` tool is mounted, and bootstrap refuses one if present. The standalone file-based entry remains only for compatibility and its scoped policy regressions. Official comparison uses `creator-official.host.js` to call the official tool. `--check` exercises actual mounting and definition/activation without model execution.

Logs:

- `manifest.json`: scenario, prepared input identity, paths, and exact generated Creator-source hash; its state describes preparation only.
- `presets/experiment-ralph/`: byte-identical generated preset composition and metadata in both modes. Compare `presetSha256` in the manifests.
- `creator.host.js`: complete literal source submitted to `cordis_define`, including the Custom loop.
- `logs/bootstrap.jsonl`: explicit bootstrap audit of actual tool arguments and canonical results, preset ID, selection, lifecycle, and Custom `round/start`/`round/end` events including the previous failure handoff. This is an audit stream, not fabricated model conversation events.
- `logs/controller-result.json`: actual returned controller result (or `checked-no-model`).
- `logs/stdout.log`, `logs/stderr.log`: subprocess output; these stay in the private run directory.
- `dsh-home/sessions/`: native persisted root and descendant session artifacts, including actual child model/tool activity.
- `logs/final-acceptance.tap`: independent host evaluation using the external frozen test copy and explicit `TODO_CLI`.
- `logs/outcome.json`: process status, frozen-file integrity, and independent acceptance exit status. A check has `acceptance: null` and is never reported as task success.

Do not publish raw logs without reviewing them. None of the commands above prints patch contents or credentials. Final acceptance runs even if the controller exits unsuccessfully; overall exit status requires successful Harness exit, unchanged frozen copies, a completed controller result, and passing external acceptance. The runner does not independently prevent a malicious agent from modifying and restoring test files between integrity checks; the custom controller also hashes its frozen root between stages.

Supported CLI facts were checked against local primary sources: `apps/cli/src/args.ts`, `apps/cli/reference/README.md`, `packages/bundle/headless/src/index.ts`, `packages/preset/agent-presets/src/index.ts`, `packages/preset/agent-presets/src/metadata.ts`, and `packages/workflow/tool-ralph/src/index.ts`. Stock headless and SDK drivers do not join preset rosters; there is no headless `--preset`, `--model`, `--cwd`, or full-log flag. The invoking cwd is the workspace; launcher flags precede app arguments. Even config dumps can initialize profile files, so use an isolated `DSH_HOME` for them.

For a separately packaged plugin with a `package.json`, the supported local-install form is `DSH_HOME=/tmp/isolated-home node /absolute/path/to/deepseek-harness/apps/cli/lib/bin.js plugin --profile headless add /absolute/workspace/plugin`. The CLI forwards to pnpm and anchors local paths to the invoking directory; it requires pnpm on PATH. This runner instead uses the supported absolute-file Loader row and private dependency link, so installation needs no registry access. Creator's dynamic define/run is exercised separately and explicitly above.
