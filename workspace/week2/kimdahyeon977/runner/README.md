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
```

Each command prints its newly created private directory under `/tmp/week2-harness-runs/`. `RUN_ROOT` may select another directory within `/tmp` or this repository. `HARNESS_ROOT`, `BEDROCK_ENV`, and `BEDROCK_PATCH` override the source checkout and existing model patch paths. No installs, builds, home writes, credential copies, or model requests occur during preparation. Checks remove secret environment variables and point AWS credential/config lookup at absent paths in the private run directory. Real runs inherit the parent's authenticated environment and load the existing local `/home/user/.dsh/bedrock.env` (overridable with `BEDROCK_ENV`) into memory. They do not copy or print credential files.

The existing `/home/user/.dsh/bedrock.patch.yml` is applied directly as the first `--patch` overlay. Its configured default route was inspected without printing raw config: `amazon-bedrock` / `us.anthropic.claude-sonnet-4-5-20250929-v1:0`. Bootstrap refuses another route. This establishes configuration and prior week1 success, not current remote availability. The process uses the built local CLI, `deepseek-harness/apps/cli/lib/bin.js`; it does not silently rebuild stale artifacts.

Every run gets its own `dsh-home/`, `workspace/`, `logs/`, and external `frozen/`. Both workspaces initially contain only identical acceptance tests: no CLI and no reference example. By default the same bytes from `task-staged.txt` become the immutable objective. This is an explicitly planned staged demonstration: round 1 implements add/list and the unchanged completion test actually fails; round 2 receives that failure and implements complete. It does not measure spontaneous bug discovery. `RALPH_SCENARIO=single` selects the original `task.txt` objective. Both files keep the same six frozen acceptance tests. The manifest records task and test SHA-256 digests. Descendants inherit the parent's exact provider/model selection. Both controllers receive a five-round bound; the custom controller can start an implementation child and a verification child per round, whereas official Ralph starts one child per round. This compares five rounds, not equal model-call counts.

Custom uses preset ID **custom-ralph**. Preparation takes exactly the authored `persona`, `tool-bash`, and `tool-fs` rows from `../preset/agent.cordis.yml`, omits the static controller, and adds `tool-cordis` for actual Creator define/run. It does not copy the shipped Creator composition, delegation group, workflow tools, or skills. This avoids inherited scoped delegation registrations that can escape a global child tool filter; the custom controller's child guard remains a separate enforcement layer. Display metadata is copied from `../preset/preset.yml`. Official still uses shipped preset ID **cordis**, with the same task bytes and initial workspace. The roster uses the supported `roots` setting with `trust: user` and disables the home-derived user root. Static model-facing host rows are disabled using the same split as the Web composition. Host registries, spawn backend, system prompt, and the dynamic Cordis runner remain available to support the minimal custom preset.

Both drivers create a persisted agent and join the preset in `agents.create(... setup ...)`, submit the exact run-local `creator.host.js` to `cordis_define`, activate it with `cordis_run`, and execute `creator_run_loop`. No parent model call is required. For Custom, `creator-source.mjs` inserts the full reviewed `plugin/core.mjs` function into the dynamic source: its `for` loop starts every round, composes the handoff, and decides completion inside the Creator VM. `ralphHost.withRun` supplies single-child startup, shared-workspace IO, guards, cancellation, and cleanup to that callback; it never iterates rounds. No static `custom_ralph` tool is mounted, and bootstrap refuses one if present. The standalone file-based entry remains only for compatibility and its scoped policy regressions. Official comparison uses `creator-official.host.js` to call the official tool. `--check` exercises actual mounting and definition/activation without model execution.

Logs:

- `manifest.json`: scenario, prepared input identity, paths, and exact generated Creator-source hash; its state describes preparation only.
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
