Build a persistent Harness plugin bundle in this workspace at ./verified-ralph, install it with plugin_manager install_bundle, and create a new agent preset that mounts it.

## The tool
`verified_ralph({ objective: string, maxRounds?: number })` runs a Ralph-style loop toward one immutable objective and blocks until it settles. Implement the loop control in this plugin yourself: do NOT call, wrap or reuse the official `ralph` tool, `tool-ralph`, or the workflow engine.

Config (deployment-owned, not part of the tool schema): `subagentProvider` (default "spawn"), `maxRounds` (default 5, also the ceiling for a call), `verifyCommand` (default ""), `verifyTimeoutMs` (default 120000), `progressFile` (default ".ralph/progress.md"), `maxFeedbackChars` (default 4000).

Each round:
1. Start exactly one fresh child through `ctx.subagents` with the configured provider. Refuse a provider that inherits the parent context or lacks structured output. The child returns a structured report `{ status: "continue" | "complete" | "blocked", summary: string, nextSteps: string[], blocker: string }`.
2. The child prompt holds only: the objective, "round i of N", an instruction that the workspace and the progress file are the durable memory (inspect them first, keep existing work), the previous round's verifier result (exit code and the last maxFeedbackChars of its output), and the previous worker report. Never the parent conversation.
3. After the child settles, the plugin itself (not the child) appends the round to the progress file: round number, worker status and summary, verifier result.
4. If `verifyCommand` is set, the plugin runs it in the caller's working directory with the timeout. Exit 0 ends the loop as `verified`. A worker `blocked` ends it as `blocked`. Anything else, including a worker `complete` while the verifier fails, starts the next round with the verifier output. Without a `verifyCommand`, a worker `complete` ends the loop as `self-reported`.
5. A child that fails or returns no valid report is retried once in the same round; a second failure ends the loop as `round-failed`.
6. Reaching maxRounds ends it as `budget-limited`. Caller cancellation (the tool's abort signal) disposes the running child and stops.
The tool result states the final status, rounds started, verifier pass/fail per round, the last verifier output tail, and the last worker report.

## The preset
Add an agent preset with id `verified-ralph`, name "Verified RALPH", built from the shipped `standard` preset rows, keeping the official `tool-ralph` disabled and adding the `verified_ralph` row with config `maxRounds: 5` and `verifyCommand: "python3 <harness-lab>/tasks/checks/week2_acceptance.py ."`. The bundle itself must not register the tool globally; only the preset mounts it.

## Deliver
Plain JavaScript ESM, no build step. Include locale metadata, an icon, and a short README.md in the bundle explaining the loop design. After installing, confirm the bundle state and that the preset exists. Do not run the loop yourself; I will test it in a new session with the new preset. Finish with the bundle path, what you installed, and anything unverified.
