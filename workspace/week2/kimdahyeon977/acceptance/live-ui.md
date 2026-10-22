# Live Coding RALPH dashboard contract

Build a runnable, dependency-free Node.js ESM web application in this workspace. The application must visualize **actual append-only Coding RALPH telemetry**, not hardcoded sample cards or a prerecorded animation. Create `server.mjs`, cohesive server modules under `lib/`, and `public/index.html`, `public/app.js`, `public/style.css`. Do not require npm install or a build step. The server must read only the file named by `RALPH_EVENTS_FILE`; `PORT=0` requests an ephemeral port. On startup print one line `READY <port>` to stdout after the listener is ready. A nonempty `RALPH_EVENTS_FILE` is required.

The producer writes newline-delimited JSON objects with monotonically increasing integer `seq`, ISO `at`, and `event`. It appends only complete lines. The possible event names and fields are:

| Event | Fields | UI meaning |
|---|---|---|
| `run/start` | | Running begins |
| `round/start` | `round`, `handoff` | A new round begins; handoff is the previous failure context |
| `child/start` | `round`, `role`, `childId` | `implementation` or `test` child begins |
| `child/end` | `round`, `role`, `childId`, `status`, `summary` | Child finishes; summary states completed work or missing work |
| `acceptance/start` | `round` | Host starts its fixed tests |
| `acceptance/end` | `round`, `kind`, `exitCode`, `testsRun`, `passed`, `failed`, `summary` | Host test result and TAP details |
| `round/end` | `round`, `result` | `pass` or `continue` |
| `run/end` | `status` | `complete`, `incomplete`, `blocked`, or `cancelled` |
| `run/error` | `status` | A run-level failure |

The application treats every supplied string as untrusted plain text, including `summary` and `handoff`. It must never execute or insert them as HTML. A producer may append while clients are connected. A trailing partial line must remain invisible until its newline arrives. Malformed complete lines should be skipped without stopping the stream. Duplicate or out-of-order sequence numbers must not be shown twice. For a log that is replaced or truncated, clients must receive a reset signal and reload the snapshot; the server must continue following the new file. The process should handle several clients at once and stop cleanly on SIGTERM.

HTTP contract:

- `GET /health` returns JSON `{ok:true}`.
- `GET /api/snapshot` returns JSON `{events:[...],lastSeq:N}` using valid events in sequence order. Missing or empty files return `{events:[],lastSeq:0}`. The response must set `Cache-Control: no-store`.
- `GET /api/events` is a real Server-Sent Events stream (`text/event-stream`). Each event has `id: <seq>`, `event: ralph`, and `data: <the JSON event>`. On connection it replays existing events unless the client supplies a `Last-Event-ID` header; with that header, send only greater sequence numbers. Then stream newly appended complete events promptly (within one second). Send comment heartbeats during idle periods. On log replacement/truncation send `event: reset` before replaying the new log. Never send a duplicate ID on one connection.
- `GET /`, `/app.js`, and `/style.css` serve local static assets with correct content types. Other paths return 404; do not expose the event file or arbitrary files.

Browser contract: The initial view fetches `/api/snapshot`, then subscribes to `/api/events`; a reload reconstructs the same state from the log. Show run status and live/disconnected connection state, current round, all rounds in order, implementation and test child cards with their IDs/status/summaries, host test counts and failure details, the handoff into each round, and a chronological event timeline. New events update the open page without a refresh. Show a useful empty state before the first event, a visible failure state for failed tests, and a clear completed state. Users can select a round and filter the timeline to failures. Use semantic headings/landmarks, visible keyboard focus, sufficient contrast, responsive layout, and readable copy. A graph or connected stage strip should make implementation → test child → host acceptance → next round visually legible. The real event data must drive every status and count.

The visible suite tests the runnable HTTP server and stream. A separate held-out suite and a real browser smoke test run after the Custom controller finishes. The complete contract applies from the first round; implementation milestones are server lifecycle, log reader/SSE, stateful browser rendering, and visual/interaction polish. Concurrent writers to the same telemetry file and secret fields outside the listed schema are outside this contract.
