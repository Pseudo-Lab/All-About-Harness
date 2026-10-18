# Verified RALPH

A persistent Harness bundle that contributes one agent preset, **Verified RALPH**
(`verified-ralph`), whose only extra plugin is `@local/verified-ralph`. That plugin
registers the `verified_ralph` tool inside the preset's scope. The bundle patch
contains the preset declaration and nothing else, so the tool is **not** in the
global Host tool catalog: a session sees it only after selecting the preset.

Plain JavaScript ESM, no build step, no runtime dependencies outside `node:*`.

## The loop

`verified_ralph({ objective, maxRounds? })` runs a foreground Ralph-style loop
toward one immutable objective and blocks until it settles. Loop control lives in
`index.js`; it does not use the official `ralph` tool, `tool-ralph`, or the
workflow engine.

Each round:

1. The plugin starts exactly one fresh child through `ctx.subagents` with the
   configured provider, labelled with the round and attempt. A provider that
   inherits the parent context or lacks structured output is refused before any
   child starts.
2. The child prompt contains only the objective, `round i of N`, the
   durable-memory instruction (inspect the workspace and progress file first,
   keep existing work), the previous verifier result (exit code plus the last
   `maxFeedbackChars` characters of output), and the previous worker report.
   Neither the parent conversation nor an earlier child session is seeded.
3. The child must return a structured report
   `{ status: "continue" | "complete" | "blocked", summary, nextSteps, blocker }`.
4. After the child settles, the plugin — not the child — appends the round to the
   progress file: round number, worker status and summary, and the verifier
   result.
5. When `verifyCommand` is set, the plugin runs it in the caller's working
   directory under `verifyTimeoutMs`. Exit 0 ends the loop as `verified`.
6. Termination: a worker `blocked` ends as `blocked`; with no `verifyCommand`, a
   worker `complete` ends as `self-reported`; a failing verifier or a continuing
   worker starts the next round; reaching the round cap ends as `budget-limited`.

A child that fails, stops abnormally, or returns no valid report is retried once
in the same round; a second failure ends the loop as `round-failed`. Caller
cancellation (the tool's abort signal) disposes the running child and stops the
loop. The tool result states the final status, rounds started, verifier pass/fail
per round, the last verifier output tail, and the last worker report.

## Configuration

Deployment-owned; part of the preset row, not of the tool schema.

| Field | Default | Meaning |
|---|---|---|
| `subagentProvider` | `spawn` | Fresh provider used for every round; must support structured output and must not inherit parent context. |
| `maxRounds` | `5` | Default round cap and the ceiling for a call's `maxRounds`. |
| `verifyCommand` | `""` | Shell command run in the caller's working directory after every worker round. Empty disables machine verification. |
| `verifyTimeoutMs` | `120000` | Verifier timeout; the whole process tree is killed when it expires. |
| `progressFile` | `.ralph/progress.md` | Progress log appended by the plugin, resolved against the caller's working directory. |
| `maxFeedbackChars` | `4000` | Length of the verifier output tail carried into the next round and shown in the result. |

## Preset

The preset is built from the shipped `standard` rows. The official `tool-ralph`
row stays disabled, and one extra row mounts this plugin:

```yaml
- id: verified-ralph
  name: '@local/verified-ralph'
  config:
    maxRounds: 5
    verifyCommand: 'python3 <harness-lab>/tasks/checks/week2_verify.py .'
```
