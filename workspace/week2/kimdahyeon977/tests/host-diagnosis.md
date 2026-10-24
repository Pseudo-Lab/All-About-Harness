Host author handoff: full suite 46 pass / 5 fail before environment fix.

`runAcceptance` copies process.env into its spawned `node --test`. When invoked from node:test, this inherits NODE_TEST_CONTEXT; Node detects recursive testing and skips all files. Exact warning: `node:test run() is being called recursively within a test file. skipping running files.` Remove NODE_TEST_CONTEXT from the copied child environment in host.mjs; retain TODO_CLI pointing at workspace/cli.mjs. Do not weaken tests.

Affected tests: real runner classifies passing; real runner classifies assertion; runner executes TODO_CLI from run workspace, not bundled example; runner cancellation propagates instead of producing pass (Missing expected rejection); runner timeout blocks as infrastructure error (actual exitCode 0).

Full original output: verification-before-host-fix.log.
