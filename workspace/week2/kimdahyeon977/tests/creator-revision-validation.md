# Independent Creator revision verification

Scope: existing tests and read-only architecture inspection. No source or test changes; no model calls. Completed independent verification of exported live runs `custom-Sqv4Os` and `official-0UApuN`; no new model executions were initiated.

## Test result

Command executed from repository root:

```sh
node --test --test-reporter=tap workspace/week2/kimdahyeon977/acceptance/todo.test.mjs workspace/week2/kimdahyeon977/tests/core.test.mjs workspace/week2/kimdahyeon977/tests/host.test.mjs workspace/week2/kimdahyeon977/plugin/scoped-guard.test.mjs workspace/week2/kimdahyeon977/tests/creator-dynamic.test.mjs > workspace/week2/kimdahyeon977/tests/creator-revision-verification.log 2>&1
```

Initial sandbox execution failed at child-dependent test files. The identical command was rerun with approved escalation and exited 0: **61 tests passed, 0 failed, 0 skipped**. The retained TAP log is the successful escalated execution.

## Architecture inspection

- `runner/creator-source.mjs` reads the complete `plugin/core.mjs`, removes its named export declaration, and inserts it into `runner/creator.host.js`. The generated source therefore contains the actual round loop, handoff, acceptance checks, and termination logic.
- `runner/run.mjs` writes that generated source; `runner/bootstrap.mjs` submits its contents as `cordis_define`'s `code.host`, activates it through `cordis_run`, and invokes `creator_run_loop`.
- The dynamic tool calls `ralphHost.withRun(..., runtime => runRalph(runtime))`. The host runtime supplies IO, child startup/disposal, cancellation, and workspace serialization; the VM callback executes the loop.
- The custom run preset keeps only authored `persona`, `tool-bash`, and `tool-fs`, then adds `tool-cordis`. It excludes the authored `custom-ralph` registration. Bootstrap also rejects a mounted `custom_ralph` tool. Importing the adapter for `createRuntime` does not call its compatibility `apply` function.
- Existing VM tests execute the generated artifact with static dispatch forbidden, exercising two-round failure/handoff/success, five-round exhaustion, invalid limits, acceptance errors, child failure/disposal, frozen-suite mutation, and cancellation.

## Original finding: resolved in source template

The original low-severity finding was stale persona guidance to use `custom_ralph`. The current `preset/agent.cordis.yml` now instructs children to follow their assigned role and avoid delegation or nested loops. This resolves the finding for future runs. The actual exported custom preset retains the legacy guidance because it was generated before the correction; it contains only persona, bash, filesystem, and Cordis rows, without a static custom controller registration. Actual bootstrap and native tool-call records contain no `custom_ralph` calls. The archived artifact was preserved unchanged.

## Completed live evidence verification

Both exports match their corresponding `/tmp/week2-harness-runs/` actual run directories. Exported `creator.host.js`, actual generated source, and submitted `cordis_define` `code.host` match byte for byte. SHA-256 also matches each manifest:

| Mode | Creator source SHA-256 | Observed children | Rounds |
| --- | --- | --- | --- |
| Custom | `61e0d1864f95b5b1349bc9e3400818647530a11448a120f745da4f2bc507d2bf` | 4 distinct implementation/test children | 2 |
| Official | `dfded4e0a8411e7692896d8d9f5d8de6330a1866e7a02d9df2d676f3a71ca13d` | 2 distinct official workers | 2 |

Custom bootstrap tool calls are exactly `cordis_define`, `cordis_run`, `creator_run_loop`; official additionally calls `ralph`. Native session tool names likewise show no static `custom_ralph` invocation. The full custom loop executes in the submitted dynamic source, through the low-level host runtime.

Custom round one independently reports `fail`; host acceptance records exit 1, 6 tests run, 5 passed, and the unsupported-completion assertion failure. Round two independently reports `pass`; host acceptance records exit 0 and all 6 passed. Its 3,461-character handoff parses successfully and preserves the preceding implementation/test records exactly, along with host exit-1 acceptance evidence. Native reports agree with controller records and identify four fresh children across the two rounds.

Official native worker one reports `continue`, 5/6 passing, and suite exit 1; worker two reports `complete`, 6/6 passing, and exit 0. The controller records `agentsStarted: 2`, `roundsStarted: 2`, and completion. This official round-one evidence is a worker report, whereas the custom controller additionally retains independent host acceptance for each round.

Both final outcomes record process exit 0, controller completion, `frozenUnchanged: true`, and external acceptance exit 0. Manifest `state: prepared-not-executed` is the original preparation metadata; completion is established by controller, native, and outcome artifacts.

## Matched conditions and retained acceptance checks

Both modes have identical task bytes/hash (`6a83becd24d728a3953ddf98d0a939cea12e88d4b88b400ee7a38e492960cd92`), initial acceptance bytes/hash (`4b935693162b7093a9aabeb39b1cbc7fff608b949cfe7547d9edfa47c4ea0f87`), initial-file manifests, absent initial CLI, Amazon Bedrock provider, `us.anthropic.claude-sonnet-4-5-20250929-v1:0` model, and maximum five rounds. Exported task hashes match manifest values. Both original frozen suites, final workspace acceptance files, and repository acceptance source match the acceptance hash. Exported final CLIs match the actual final run files byte for byte.

Independent acceptance reruns used each archived CLI via `TODO_CLI` and its corresponding original `/tmp/week2-harness-runs/<run>/frozen/todo.test.mjs` with `node --test --test-reporter=tap`. **Custom: 6/6 passed, exit 0. Official: 6/6 passed, exit 0.** Labeled TAP output is appended to `creator-revision-verification.log`, following the original 61-test result and hash checks. No evidence files, tests, or implementation files were edited by this verifier.
