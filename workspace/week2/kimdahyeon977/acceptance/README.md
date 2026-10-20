# Todo CLI acceptance specification

Run with Node's built-in test runner (no dependencies):

```sh
node --test workspace/week2/kimdahyeon977/acceptance/todo.test.mjs
TODO_CLI=/absolute/path/to/cli.mjs node --test workspace/week2/kimdahyeon977/acceptance/todo.test.mjs
```

`TODO_CLI`, when supplied, must be an absolute path. Otherwise the target is
`../example/cli.mjs`, resolved relative to the test file. Each test uses a private
temporary directory, a `TODO_FILE` JSON storage path, and fresh Node processes.
Temporary files are removed after each test. No shell, packages, or network are needed.

The fixed public contract is:

- `node cli.mjs add TITLE`: one title argument; emit a JSON object with positive
  integer `id`, the supplied `title`, and `completed: false`.
- `node cli.mjs list`: emit a JSON array, initially empty, in creation order.
- `node cli.mjs complete ID`: emit the matching object with `completed: true`.
  Repeating completion succeeds and keeps the same state.
- Successful commands exit zero and stdout contains one JSON value, without logs.
  Objects may carry additional fields; the tests compare the three contract fields.
- IDs remain stable across processes and completion, and increase for later adds.
  The first ID need not be 1 and IDs need not be consecutive.
- Missing, empty, or whitespace-only titles fail. Missing IDs, zero, negatives,
  fractions, malformed numeric strings, unsafe integers, and nonexistent IDs fail
  with a nonzero exit status.
- Invalid commands must not change existing storage bytes or visible todos, consume
  an ID, or create a storage file when none existed. Unknown commands and wrong
  argument counts also fail without mutation.
- `TODO_FILE` selects independent JSON persistence. Tests verify valid JSON on disk
  without prescribing the storage schema, and verify persistence through the CLI.

Out of scope: concurrent writers, deletion, title normalization beyond rejecting
blank input, default storage location, exact error wording, and recovery from
externally corrupted storage.

The suite was written before the example implementation. Execution is reserved
for the separate tester; it has not been run by the authoring agent.
