# Custom(검증 = workspace 테스트) durations #4: 덜 된 채 verified로 끝난 실행

Preset `lab-verified-ralph-tests`: Creator Plugin 그대로, 검증 명령만 `python3 -m unittest discover -s tests`(worker가 쓴 테스트).

## 숨은 수락 테스트로 채점한 결과

```json
{"passed": 12, "total": 13, "failed": [{"test": "test_r04_decimals", "rule": "rule 4: decimal parts, total must be whole seconds", "error": "AssertionError: ValueError not raised"}]}
```

rule 4(소수)가 틀렸지만, worker가 쓴 테스트는 같은 이해로 쓰여서 모두 통과했어요. 그래서 검증 exit 0으로 `verified`가 됐어요.

## Plugin의 progress 파일 (Round별 검증 결과)

````markdown
# Verified RALPH progress log

## Round 1
- Worker status: continue
- Worker summary: Implemented BACKLOG item 1 (compact parse: SPEC rules 1, 2, 3, 5, 6, 9, 10) in durations.py and checked it off. parse now validates str type (TypeError otherwise), strips surrounding whitespace, accepts a bare non-negative integer as seconds, parses concatenated and whitespace-separated d/h/m/s parts case-insensitively, and rejects empty input, unit-without-number, dangling numbers, out-of-order units, duplicate units, and unknown characters with ValueError. Added 14 parse tests to tests/test_durations.py covering all item-1 rules, including case-insensitivity, tabs/newlines, bare-number edges, order/duplicate/dangling cases, empty input, unitless numbers, and non-str TypeError. All 14 ParseTest tests pass. Full discovery still fails only on the starter FormatTest because item 4 (format) remains unimplemented, as expected for this round. durations.py imports only the standard library (re). BACKLOG item 1 is now [x]; items 2-4 remain unchecked.
- Worker next steps: Implement BACKLOG item 2: decimals and sign in parse (SPEC rules 4 and 7), rejecting non-whole-second totals and misplaced/duplicate signs, then add tests and check it off.; Implement BACKLOG item 3: ISO 8601 parse (SPEC rule 8: uppercase P[nD][T[nH][nM][nS]], integers only; reject P, PT, lowercase, decimals), then add tests and check it off.; Implement BACKLOG item 4: format compact and iso forms (SPEC rules 11, 12) plus parse(format(n)) == n round-trip tests for both forms, then check it off.; Run python3 -m unittest discover -s tests until fully green and confirm durations.py imports only the standard library.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
E..............
======================================================================
ERROR: test_compact (test_durations.FormatTest.test_compact)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "<workspace>/tests/test_durations.py", line 87, in test_compact
    self.assertEqual(durations.format(5400), "1h30m")
                     ~~~~~~~~~~~~~~~~^^^^^^
  File "<workspace>/durations.py", line 59, in format
    raise NotImplementedError
NotImplementedError

----------------------------------------------------------------------
Ran 15 tests in 0.001s

FAILED (errors=1)
```

## Round 2
- Worker status: continue
- Worker summary: Implemented BACKLOG item 2 (decimals and sign, SPEC rules 4 and 7) and checked it off. parse now accepts decimal part values (e.g. 1.5h, .5h, 0.01h) using exact Fraction arithmetic, rejects totals that are not whole seconds (0.5s, 1.01m, 0.001h, 1.0001h), rejects malformed decimals (1.h, 1..5h, 1.5 h, 1,5h), and only treats a bare value as seconds when it is an integer (so 1.5 and 90.0 raise ValueError). A single leading '-' now negates the whole span for both unit forms and bare numbers (-1h30m, -90, -0.5h), while misplaced or duplicate signs (1h-30m, --1h, +1h, - 1h, -) raise ValueError. Added 7 new ParseTest methods covering these rules; all 20 ParseTest tests pass. durations.py imports only re and fractions (standard library). Full discovery runs 21 tests and still fails solely on FormatTest.test_compact because format (item 4) remains NotImplementedError, as expected since only the first unchecked item was in scope.
- Worker next steps: Implement BACKLOG item 3: ISO 8601 parse (SPEC rule 8: uppercase P[nD][T[nH][nM][nS]], integers only; reject P, PT, lowercase, decimals), add tests, and check it off.; Implement BACKLOG item 4: format compact and iso forms (SPEC rules 11, 12) plus parse(format(n)) == n round-trip tests for both forms, then check it off.; Run python3 -m unittest discover -s tests until fully green and confirm durations.py imports only the standard library.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
E....................
======================================================================
ERROR: test_compact (test_durations.FormatTest.test_compact)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "<workspace>/tests/test_durations.py", line 153, in test_compact
    self.assertEqual(durations.format(5400), "1h30m")
                     ~~~~~~~~~~~~~~~~^^^^^^
  File "<workspace>/durations.py", line 94, in format
    raise NotImplementedError
NotImplementedError

----------------------------------------------------------------------
Ran 21 tests in 0.001s

FAILED (errors=1)
```

## Round 3
- Worker status: continue
- Worker summary: Implemented BACKLOG item 3 (ISO 8601 parse, SPEC rule 8) and checked it off. parse now recognizes a text beginning with uppercase "P" as ISO 8601: P[nD][T[nH][nM][nS]], integer components only, via a case-sensitive fullmatch regex (so lowercase forms like pt1h and decimals like PT1.5H fall through to ValueError). It rejects P, PT, P1DT (T without a time component), missing T (P1D2H), day parts after T (PT1D), duplicate/out-of-order components (PT1H2H, P1D1D), trailing junk (PT1H3, PT1HZ), internal whitespace, W weeks, and internal +/- signs. Valid examples parse correctly (PT1H30M=5400, P1DT2H=93600, PT0S=0, P2DT3H4M5S=183845, leading zeros accepted), whitespace around the whole text is ignored, and the rule-7 single leading "-" negates ISO spans too (-PT1H30M=-5400). Added a new IsoParseTest class with 7 test methods covering examples, zero/leading-zero components, whitespace, sign, invalid forms, and case sensitivity. The suite now runs 28 tests: 27 pass and the single failure is the still-unimplemented FormatTest.test_compact (item 4), as expected. durations.py imports only re and fractions (standard library).
- Worker next steps: Implement BACKLOG item 4: format for both compact and ISO forms (SPEC rules 11, 12), including 0 -> "0s"/"PT0S", negative compact "-1d2h", and ValueError for negative ISO.; Add parse(format(n)) == n round-trip tests for both forms across representative and edge values (0, 1, 59, 60, 3599, 3600, 90061, 86400, 93600, negative compact values, ISO for n >= 0).; Run python3 -m unittest discover -s tests until fully green and re-confirm durations.py imports only the standard library.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
E...........................
======================================================================
ERROR: test_compact (test_durations.FormatTest.test_compact)
----------------------------------------------------------------------
Traceback (most recent call last):
  File "<workspace>/tests/test_durations.py", line 236, in test_compact
    self.assertEqual(durations.format(5400), "1h30m")
                     ~~~~~~~~~~~~~~~~^^^^^^
  File "<workspace>/durations.py", line 131, in format
    raise NotImplementedError
NotImplementedError

----------------------------------------------------------------------
Ran 28 tests in 0.001s

FAILED (errors=1)
```

## Round 4
- Worker status: complete
- Worker summary: Implemented BACKLOG item 4 (format in both forms and the round trip, SPEC rules 11–12 and the last line) and checked it off, so all four BACKLOG items are now [x]. format(seconds, *, iso=False) now: rejects non-int with TypeError; emits compact largest-unit-first strings with zero units omitted, "0s" for zero, and one leading "-" for negatives (5400 -> "1h30m", 90061 -> "1d1h1m1s", -93600 -> "-1d2h"); emits ISO 8601 ("PT1H30M", "P1D", "P1DT2H", "PT0S") and raises ValueError for negative ISO values. Expanded FormatTest with compact positive/negative examples, ISO examples, negative-ISO rejection, keyword-only iso, format type errors, and parse(format(n)) == n round-trip tests for both forms. Verification: `python3 -m unittest discover -s tests` exits 0 with 36 tests passing; an exhaustive round-trip check for both signs over -200000..200000 (compact) and 0..200000 (ISO) found zero failures; every SPEC.md example was spot-checked including error cases; and durations.py imports only re and fractions (both standard library).
- Worker next steps: (none)
- Worker blocker: (none)
- Verifier: passed (exit code 0)

Verifier output tail (last up to 4000 characters):
```
....................................
----------------------------------------------------------------------
Ran 36 tests in 0.001s

OK
```


````

## 부모가 받은 마지막 결과

```
The Ralph loop completed successfully: it ran **4 rounds** (under the 5-round cap) and the verifier passed on round 4.

## Result

- **[durations.py](durations.py#L29)** — full implementation:
  - `parse`: compact units (case-insensitive), whitespace, bare integers, decimals via exact `Fraction` arithmetic, strict unit ordering/uniqueness, dangling-number rejection, leading `-`, ISO 8601, `TypeError` for non-`str`, and `ValueError` for everything disallowed.
  - **[format](durations.py#L131)**: compact form (`0s`, omitted zero units, leading `-`) and ISO form (`PT0S`, `P1D`, `P1DT2H`), with `ValueError` for negative ISO.
- **[BACKLOG.md](BACKLOG.md)** — all 4 items checked off, one per round.
- **[tests/test_durations.py](tests/test_durations.py)** — expanded from 5 tests to **37 tests** covering every SPEC rule, including error cases and both round trips.
- **[.ralph/progress.md](.ralph/progress.md)** — per-round record and verifier results.

## Independent verification

- `python3 -m unittest discover -s tests`: **37 tests, OK**
- Exhaustive `parse(format(n)) == n` check: compact for `-200000..200000`, ISO for `0..200000`, plus 2,000 random values up to ±10¹² — zero failures.
- Imports are standard-library only: `re`, `fractions`.

I also hardened one edge case the loop missed: Python's `re.IGNORECASE` let the Unicode long-s `ſ` match `s`, which leaked a `KeyError` instead of the spec-required `ValueError`. The patterns now spell out `dDhHmMsS` explicitly, with a regression
```
