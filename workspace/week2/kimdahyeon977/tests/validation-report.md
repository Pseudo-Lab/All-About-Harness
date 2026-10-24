# Independent validation

- Acceptance, orchestration core, and real host suite: 51 passed, 0 failed, 0 cancelled, 0 skipped. See verification.log. The passing suite was not repeated after runner-only edits.
- Latest runner/run.mjs passes `node --check` (exit 0).
- Independently inspected /tmp/week2-harness-runs/custom-XhtwRQ/logs/{bootstrap.jsonl,controller-result.json,outcome.json}: custom-ralph preset, actual cordis_define and cordis_run successful, activation running, checked-no-model, process code 0, frozenUnchanged true.
- Independently inspected /tmp/week2-harness-runs/official-kN1YK5/logs/{bootstrap.jsonl,controller-result.json,outcome.json}: cordis preset, actual cordis_define and cordis_run successful, activation running, checked-no-model, process code 0, frozenUnchanged true.

Both smoke checks have acceptance:null and checkOnly:true. They establish Creator definition/activation and preset loading, not model execution or task completion. Ongoing model runs require separate final controller and frozen acceptance evidence.

## Final scoped-guard validation

Executed the complete suite after the scoped execution guard and minimal preset changes: **53 passed, 0 failed, 0 cancelled, 0 skipped**. Independent execution output is final-verification.log; verification.log retains the prior 51-pass baseline. The two guard tests exercise real Cordis scoped tool dispatch: implementation cannot execute preset-scoped delegation or bash; tester cannot write/edit; unassigned and deeper descendants cannot delegate; a later allow hook cannot bypass the guard; role permissions are removed after disposal.

Runner syntax check passed again. Independently inspected custom-igGcQB smoke outcome: checkOnly true, checked-no-model, process code 0, frozenUnchanged true. Independently inspected custom-Sdt8j4 final outcome: checkOnly false, controllerStatus complete, process code 0, frozenUnchanged true, external acceptance exitCode 0 and 6/6 passing. Exported evidence/custom native metadata contains exactly controller, implementation and test sessions at depths 0, 1, 1, with no grandchildren. Evidence/custom/logs/controller-result.json confirms complete. These actual-run observations are separate from the 53-test source verification.
