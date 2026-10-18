# Ralph progress

## Round 1

- Backlog item 1 (compact `parse`: SPEC rules 1, 2, 3, 5, 6, 9, 10) implemented
  in `durations.py` and covered thoroughly in `tests/test_durations.py`.
- `python3 -m unittest discover -s tests` passes (13 tests; the starter
  `format` test is skipped until backlog item 4).
- Remaining items: 2 (decimals and sign), 3 (ISO 8601 parse), 4 (format and
  round trip).
## Round 1
- Worker status: continue
- Worker summary: Round 1 completed backlog item 1. Implemented compact parse in durations.py for SPEC rules 1, 2, 3, 5, 6, 9, 10: case-insensitive d/h/m/s units, ignored inter-part/outer whitespace, bare non-negative integer as seconds, strictly descending units each at most once, rejection of dangling numbers/units without numbers/empty or malformed text, and TypeError for non-str input. Replaced tests/test_durations.py with thorough item-1 coverage and temporarily skipped the starter format test (format is backlog item 4). Marked only item 1 as [x] in BACKLOG.md and recorded the round in .ralph/progress.md. `python3 -m unittest discover -s tests` passes: 13 tests, 1 skipped; manual item-1 spot checks also pass. Next unchecked item is 2 (decimals and sign: SPEC rules 4, 7).
- Worker next steps: Implement backlog item 2 in durations.py: SPEC rule 4 (decimal part values, whole-second total required, e.g. 1.5h=5400, 0.5s and 1.01m raise ValueError) and rule 7 (one leading '-' negates; signs anywhere else including 1h-30m, --1h, +1h raise ValueError).; Add thorough tests for rules 4 and 7, including all invalid decimal/sign ValueError cases, then run `python3 -m unittest discover -s tests` until green.; Mark only backlog item 2 as [x] in BACKLOG.md and update .ralph/progress.md before reporting.; Later rounds: item 3 (ISO 8601 parse, SPEC rule 8), then item 4 (format in both forms, SPEC rules 11-12, unskip/expand format tests, and verify the parse(format(n)) == n round trip for all integers in compact and ISO forms).
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 7, "total": 13, "failed": [{"test": "test_r04_decimals", "rule": "rule 4: decimal parts, total must be whole seconds", "error": "ValueError: invalid duration: '1.5h'"}, {"test": "test_r07_sign", "rule": "rule 7: one leading minus for the whole span", "error": "ValueError: invalid duration: '-1h30m'"}, {"test": "test_r08_iso", "rule": "rule 8: ISO 8601 durations, uppercase, integers", "error": "ValueError: invalid duration: 'PT1H30M'"}, {"test": "test_r11_format_compact", "rule": "rule 11: compact format", "error": "NotImplementedError"}, {"test": "test_r12_format_iso", "rule": "rule 12: ISO format, negative is a ValueError", "error": "NotImplementedError"}, {"test": "test_r13_round_trip", "rule": "round trip: parse(format(n)) == n", "error": "NotImplementedError"}]}
```

## Round 2

- Backlog item 2 (decimals and sign: SPEC rules 4, 7) implemented in
  `durations.py` and covered thoroughly in `tests/test_durations.py`.
- Rule 4: `_PART_RE` now accepts `digits[.digits]`; values are summed with
  `fractions.Fraction` so decimal text is exact, and any total whose
  denominator is not 1 raises `ValueError` (e.g. `1.5h` = 5400, `0.01m` and
  `0.5s` invalid; `.5h`, `1.h`, `1.5` invalid).
- Rule 7: exactly one leading `-` negates the whole span, including bare
  numbers (`-90` is -90); a sign anywhere else, or a minus alone / followed
  by whitespace, raises `ValueError`.
- `python3 -m unittest discover -s tests` passes: 20 tests, 1 skipped (the
  starter `format` test, deferred to backlog item 4).
- Remaining items: 3 (ISO 8601 parse), 4 (format and round trip).
## Round 2
- Worker status: continue
- Worker summary: Round 2 completed backlog item 2 (SPEC rules 4 and 7) in durations.py. Rule 4: parts now accept decimal values via `[0-9]+(?:\.[0-9]+)?`, values are summed with `fractions.Fraction` for exact arithmetic, and any total that is not a whole number of seconds raises ValueError (e.g. 1.5h=5400, 0.01m and 0.5s invalid; .5h, 1.h, 1.5 invalid). Rule 7: exactly one leading '-' negates the whole span including bare numbers (-90 is -90); signs elsewhere (1h-30m, --1h, +1h), a lone minus, or a minus followed by whitespace raise ValueError. Added ~90 subTest cases in new ParseDecimalsTest and ParseSignTest classes covering valid decimals across units/multi-part totals, fractional totals, malformed decimals, negative spans, and all misplaced-sign cases. `python3 -m unittest discover -s tests` passes: 20 tests, 1 skipped (starter format test deferred to item 4). Marked only item 2 as [x] in BACKLOG.md and appended a Round 2 entry to .ralph/progress.md; SPEC.md and README.md untouched. Next unchecked item is 3 (ISO 8601 parse, SPEC rule 8), then item 4 (format both forms and round trip).
- Worker next steps: Implement backlog item 3 in durations.py: SPEC rule 8 ISO 8601 parse — uppercase-only P[nD][T[nH][nM][nS]], integers only, PT1H30M=5400, P1DT2H=93600, PT0S=0, rejecting P, PT, pt1h, PT1.5H and other malformed forms; keep the existing leading-minus behavior working for ISO text if applicable.; Add thorough tests for ISO 8601 valid/invalid cases and rerun `python3 -m unittest discover -s tests` until green, then mark only item 3 as [x] in BACKLOG.md and update .ralph/progress.md.; Implement backlog item 4: format(seconds, *, iso=False) for compact (largest unit first, zeros omitted, 0 -> '0s', negatives get one leading '-') and ISO (PTnHnMnS / PnD forms, 0 -> 'PT0S', negative raises ValueError) per SPEC rules 11-12.; Replace the skipped FormatTest with thorough format tests, verify parse(format(n)) == n for every integer n in compact form and every n >= 0 in ISO form, mark only item 4 as [x], update progress, and confirm the full suite passes.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 9, "total": 13, "failed": [{"test": "test_r08_iso", "rule": "rule 8: ISO 8601 durations, uppercase, integers", "error": "ValueError: invalid duration: 'PT1H30M'"}, {"test": "test_r11_format_compact", "rule": "rule 11: compact format", "error": "NotImplementedError"}, {"test": "test_r12_format_iso", "rule": "rule 12: ISO format, negative is a ValueError", "error": "NotImplementedError"}, {"test": "test_r13_round_trip", "rule": "round trip: parse(format(n)) == n", "error": "NotImplementedError"}]}
```


## Round 3

- Backlog item 3 (ISO 8601 `parse`: SPEC rule 8) implemented in
  `durations.py` and covered thoroughly in `tests/test_durations.py`.
- Rule 8: a new `_ISO_RE` parses the uppercase-only, integers-only form
  `P[nD][T[nH][nM][nS]]`, each component at most once and in order. `P` and
  `PT` (no components), `P1DT` (a `T` with no time component), `P1D2H` (time
  components without `T`), lowercase/mixed-case text, decimals, unknown
  units, signs inside the span, and trailing/duplicate/out-of-order content
  all raise `ValueError`. Valid examples: `PT1H30M` = 5400, `P1DT2H` = 93600,
  `PT0S` = 0, `P1D` = 86400.
- Outer whitespace is ignored (consistent with SPEC rule 2) and one leading
  `-` negates the whole ISO span (consistent with SPEC rule 7); signs
  anywhere else remain invalid.
- Added a `ParseISOTest` class with ~110 subTest cases (valid components,
  days+time combinations, whitespace, leading minus, missing components,
  lowercase, decimals, ordering/uniqueness, unknown/trailing content, and
  misplaced signs).
- `python3 -m unittest discover -s tests` passes: 32 tests, 1 skipped (the
  starter `format` test, deferred to backlog item 4).
- Remaining item: 4 (`format` in both forms and the round trip).
## Round 3
- Worker status: continue
- Worker summary: Round 3 completed backlog item 3 (SPEC rule 8, ISO 8601 parse) in durations.py. Added a strict `_ISO_RE` for the uppercase-only, integer-only form `P[nD][T[nH][nM][nS]]`, plus a `_parse_iso` helper: `PT1H30M`=5400, `P1DT2H`=93600, `PT0S`=0, `P1D`=86400, `P1DT2H3M4S`=93784. Rejects `P`, `PT`, `P1DT`, `P1D2H`, lowercase/mixed case, decimals, unknown units, duplicate/out-of-order/trailing content, internal whitespace, and misplaced signs; outer whitespace (rule 2) and one leading `-` (rule 7) are honored. Added a `ParseISOTest` class (~110 subTests across 11 methods) to tests/test_durations.py covering valid components, days+time combos, whitespace, leading minus, missing components, case sensitivity, decimals, ordering/uniqueness, trailing/unknown content, and sign placement. `python3 -m unittest discover -s tests` passes: 32 tests, 1 skipped (starter format test deferred to item 4). Marked only item 3 as [x] in BACKLOG.md and appended a Round 3 entry to .ralph/progress.md; SPEC.md and README.md untouched. Remaining unchecked item is 4 (format both forms and round trip).
- Worker next steps: Implement backlog item 4 in durations.py: SPEC rule 11 compact `format` (largest unit first, zero units omitted, 0 -> '0s', one leading '-' for negatives, e.g. 5400 -> '1h30m', 90061 -> '1d1h1m1s', -93600 -> '-1d2h') and SPEC rule 12 ISO `format(..., iso=True)` (5400 -> 'PT1H30M', 86400 -> 'P1D', 93600 -> 'P1DT2H', 0 -> 'PT0S', negative -> ValueError).; Replace the skipped starter FormatTest in tests/test_durations.py with thorough format tests for both forms and all examples/edge cases from SPEC rules 11-12, including ISO negative ValueError.; Add round-trip tests asserting `parse(format(n)) == n` over a broad range of integers (negative and zero included) in compact form and every n >= 0 in ISO form; rerun `python3 -m unittest discover -s tests` until green.; Mark only backlog item 4 as [x], append a Round 4 entry to .ralph/progress.md, and confirm all four items are checked with the full suite passing.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 10, "total": 13, "failed": [{"test": "test_r11_format_compact", "rule": "rule 11: compact format", "error": "NotImplementedError"}, {"test": "test_r12_format_iso", "rule": "rule 12: ISO format, negative is a ValueError", "error": "NotImplementedError"}, {"test": "test_r13_round_trip", "rule": "round trip: parse(format(n)) == n", "error": "NotImplementedError"}]}
```

## Round 4

- Backlog item 4 (SPEC rules 11, 12 and the round-trip line) implemented in
  `durations.py`; all four backlog items are now checked.
- Rule 11 (`_format_compact`): units d/h/m/s largest first, zero units
  omitted, `0` -> `"0s"`, negative spans get exactly one leading `-`
  (`5400` -> `"1h30m"`, `90061` -> `"1d1h1m1s"`, `-93600` -> `"-1d2h"`).
- Rule 12 (`_format_iso`): `P[nD][T[nH][nM][nS]]` with zero components
  omitted (`5400` -> `"PT1H30M"`, `86400` -> `"P1D"`, `93600` ->
  `"P1DT2H"`, `93784` -> `"P1DT2H3M4S"`, `0` -> `"PT0S"`, `86399` ->
  `"PT23H59M59S"`); negative spans raise `ValueError`. Non-`int` input to
  `format` raises `TypeError` (public API is unchanged).
- Replaced the skipped starter `FormatTest` with `FormatCompactTest`,
  `FormatISOTest` and `RoundTripTest` in `tests/test_durations.py`. The
  round-trip tests cover every integer in `range(-50000, 50001)` compact
  and `range(0, 50001)` ISO, plus boundary values, very large values
  (through 10**15) and seeded random values.
- `python3 -m unittest discover -s tests` passes: 45 tests, 0 skipped.
  An independent property script also passed `parse(format(n)) == n` for
  all n in `range(-2000000, 2000001)` compact, all n in
  `range(0, 2000001)` ISO, and 20000 random values up to 10**18 in each
  form.
- SPEC.md and README.md untouched; only item 4 was checked in BACKLOG.md.

## Round 4
- Worker status: complete
- Worker summary: Round 4 completed backlog item 4 (SPEC rules 11, 12 and the round-trip requirement), so all four BACKLOG.md items are now checked. durations.py now implements `format(seconds, *, iso=False)` with helpers `_format_compact` (largest unit first, zero units omitted, 0 -> "0s", exactly one leading "-" for negatives; 5400 -> "1h30m", 90061 -> "1d1h1m1s", -93600 -> "-1d2h") and `_format_iso` (P[nD][T[nH][nM][nS]] with zero components omitted; 5400 -> "PT1H30M", 86400 -> "P1D", 93600 -> "P1DT2H", 93784 -> "P1DT2H3M4S", 0 -> "PT0S"; negatives raise ValueError). Non-int input to format raises TypeError. Replaced the skipped starter FormatTest with FormatCompactTest, FormatISOTest and RoundTripTest covering all spec examples, zero-unit omission, negative compact spans, ISO negative ValueError, and round trips over all n in range(-50000, 50001) compact and range(0, 50001) ISO plus boundaries, values through 10**15, and seeded random values. `python3 -m unittest discover -s tests` passes: 45 tests, 0 skipped. An independent property script verified parse(format(n)) == n for all n in range(-2000000, 2000001) compact, all n in range(0, 2000001) ISO, and 20000 random values up to 10**18 in each form. Only item 4 was checked in BACKLOG.md; SPEC.md and README.md were untouched; a Round 4 entry was appended to .ralph/progress.md.
- Worker next steps: (none)
- Worker blocker: (none)
- Verifier: passed (exit code 0)

Verifier output tail (last up to 4000 characters):
```
{"passed": 13, "total": 13, "failed": []}
```

