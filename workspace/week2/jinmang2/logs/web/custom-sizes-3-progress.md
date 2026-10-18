# Custom `verified_ralph` — sizes-backlog #3 `.ralph/progress.md` (DSH Web, Verified RALPH preset)

Plugin이 Round마다 쓰는 기록이에요. `## Round 3`, `## Round 4`가 두 번씩 있는 건 worker도 같은 형식으로 이 파일에 적었기 때문이에요(Verifier 줄이 없는 쪽이 worker가 쓴 것).

````markdown
# Verified RALPH progress log

## Round 1
- Worker status: continue
- Worker summary: Round 1 completed BACKLOG item 1 (parse units and form: SPEC rules 1, 2, 3, 7, 8). Implemented parse() in sizes.py: case-sensitive B/KB/MB/GB/TB/KiB/MiB/GiB/TiB units, number + at most one space + unit form, whitespace trimming, bare-integer bytes, exact decimal-to-byte conversion via fractions.Fraction with a whole-byte check, ValueError for empty/unit-only/trailing-dot/malformed input, and TypeError for non-str. Added 6 new item-1 test methods to tests/test_sizes.py covering all units, case sensitivity, spacing/whitespace, bare numbers, empty/unit-only/trailing-dot errors, and non-str TypeError. All 7 ParseTest tests pass (python3 -m unittest discover -s tests -k ParseTest). Checked off item 1 in BACKLOG.md. The full starter suite still reports one expected NotImplementedError for format(), which belongs to item 3 and was intentionally left for that round. No .ralph/progress.md existed at the start of the round.
- Worker next steps: Round 2: implement and test BACKLOG item 2 — parse numbers (SPEC rules 4, 5, 6). Add support for a single underscore separating digits in the integer part while rejecting leading/trailing/doubled underscores, commas, exponents, and non-ASCII digits; verify decimals produce whole bytes and that signs are rejected; add tests for each rule, then check off item 2.; Round 3: implement and test BACKLOG item 3 — format unit choice and rounding (SPEC rules 9, 10, 12), including largest-unit selection, round-half-to-even at the requested precision, trailing-zero trimming, integer byte display, and argument validation; check off item 3.; Round 4: implement and test BACKLOG item 4 — format carry (rule 11) and the parse(format(n)) exact round trip from SPEC.md's last line; check off item 4.; Run the full tests/test_sizes.py suite plus spec-wide edge-case checks after the final item to confirm every SPEC rule holds.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 7, "total": 13, "failed": [{"test": "test_r05_digits", "rule": "rule 5: ASCII digits, underscores only between integer digits", "error": "ValueError: invalid size: '1_000 B'"}, {"test": "test_r09_unit_choice", "rule": "rule 9: largest unit with value >= 1, binary by default", "error": "NotImplementedError"}, {"test": "test_r10_rounding", "rule": "rule 10: round half to even on the exact value, drop trailing zeros", "error": "NotImplementedError"}, {"test": "test_r11_carry", "rule": "rule 11: rounding up to the next base shows the next unit", "error": "NotImplementedError"}, {"test": "test_r12_errors", "rule": "rule 12: negative size or precision is a ValueError, non-int size a TypeError", "error": "NotImplementedError"}, {"test": "test_r13_round_trip", "rule": "round trip: parse(format(n)) == n when format is exact", "error": "NotImplementedError"}]}
```

## Round 2
- Worker status: continue
- Worker summary: Round 2 completed BACKLOG item 2 (parse numbers: SPEC rules 4, 5, 6). Updated sizes.py's number grammar to allow a single underscore only between digits of the integer part ([0-9]+(?:_[0-9]+)*) while rejecting leading/trailing/doubled underscores and underscores in the fractional part; kept ASCII-only digits (no commas, exponents, or non-ASCII/fullwidth digits) and no optional sign, and normalized underscores before exact Fraction conversion so whole-byte checks still apply. Added 5 new ParseTest methods covering decimals (0.5 KiB, 1.25 MiB, non-whole byte errors), valid and invalid underscore placement (including bare integers), commas/exponents/non-ASCII digits, and sign rejection plus leading zeros. All 12 ParseTest tests pass; a manual spec-example check also passes. The full starter suite still has exactly one expected error from FormatTest (format is NotImplemented, item 3). Checked off item 2 in BACKLOG.md; items 3 and 4 remain.
- Worker next steps: Round 3: implement and test BACKLOG item 3 — format unit choice and rounding (SPEC rules 9, 10, 12): binary-by-default unit selection, largest unit with value >= 1 up to TiB/TB, round-half-to-even on the exact value, trailing-zero/dot trimming, integer byte display, and ValueError/TypeError argument validation; add tests, then check off item 3.; Round 4: implement and test BACKLOG item 4 — format carry to the next unit (rule 11) and the exact parse(format(n)) == n round trip (last line of SPEC.md); add tests, then check off item 4.; After the final item, run the full tests/test_sizes.py suite plus a spec-wide edge-case sweep to confirm every SPEC rule holds.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 8, "total": 13, "failed": [{"test": "test_r09_unit_choice", "rule": "rule 9: largest unit with value >= 1, binary by default", "error": "NotImplementedError"}, {"test": "test_r10_rounding", "rule": "rule 10: round half to even on the exact value, drop trailing zeros", "error": "NotImplementedError"}, {"test": "test_r11_carry", "rule": "rule 11: rounding up to the next base shows the next unit", "error": "NotImplementedError"}, {"test": "test_r12_errors", "rule": "rule 12: negative size or precision is a ValueError, non-int size a TypeError", "error": "NotImplementedError"}, {"test": "test_r13_round_trip", "rule": "round trip: parse(format(n)) == n when format is exact", "error": "NotImplementedError"}]}
```

## Round 3
- Worker status: continue
- Worker summary: Round 3 completed BACKLOG item 3 (format unit choice and rounding: SPEC rules 9, 10, 12). Implemented format() in sizes.py: binary units by default and decimal with binary=False, choosing the largest unit whose value is at least 1 up to TiB/TB (B below 1 KiB/KB, 0 -> "0 B"); exact round-half-to-even on the rational size/factor scaled by 10**precision via a local integer helper (no float arithmetic); trailing zeros and a trailing dot dropped; bytes always shown as an integer; ValueError for negative size or precision and TypeError for non-int size (including bool) and non-int precision. Added 5 new FormatTest methods covering unit choice in both bases, half-to-even ties, trailing-zero trimming, integer bytes, and validation, plus manual checks of every rule 9/10/12 spec example. All 18 tests in tests/test_sizes.py pass. Rule 11 carry is intentionally the next item: format(1048525) currently gives "1024 KiB". Checked off item 3 in BACKLOG.md; item 4 remains.
- Worker next steps: Round 4: implement and test BACKLOG item 4 — format carry to the next unit (rule 11) and the exact parse(format(n)) == n round trip; add tests, then check off item 4.; After the final item, run the full tests/test_sizes.py suite plus a spec-wide edge-case sweep to confirm every SPEC rule holds.
- Worker blocker: (none)


## Round 3
- Worker status: continue
- Worker summary: Round 3 completed BACKLOG item 3 (format unit choice and rounding: SPEC rules 9, 10, 12). Implemented format() in sizes.py: binary units by default and decimal with binary=False, choosing the largest unit whose value is at least 1 up to TiB/TB (B below 1 KiB/KB, 0 -> "0 B"); exact round-half-to-even on the rational size/factor scaled by 10**precision using a local integer helper (no floats); trailing zeros and trailing dot dropped; bytes always shown as an integer; ValueError for negative size or precision and TypeError for non-int size (including bool) and non-int precision. Added 5 FormatTest methods (unit choice in both bases, half-to-even ties, trailing-zero trimming, integer bytes, validation); all 18 tests in tests/test_sizes.py pass, plus manual checks of every rule 9/10/12 spec example. Rule 11 carry is intentionally deferred: format(1048525) currently gives "1024 KiB". Checked off item 3 in BACKLOG.md; item 4 remains.
- Worker next steps: Round 4: implement and test BACKLOG item 4 — format carry to the next unit (rule 11) and the exact parse(format(n)) == n round trip; add tests, then check off item 4.; After the final item, run the full tests/test_sizes.py suite plus a spec-wide edge-case sweep (all units and bases, tie rounding, carry, max-unit behavior, round trip) to confirm every SPEC rule holds.; Update .ralph/progress.md with the round 4 result; the goal is complete once all SPEC rules pass and BACKLOG.md has no unchecked items.
- Worker blocker: (none)
- Verifier: failed (exit code 1)

Verifier output tail (last up to 4000 characters):
```
{"passed": 12, "total": 13, "failed": [{"test": "test_r11_carry", "rule": "rule 11: rounding up to the next base shows the next unit", "error": "+ 1 MiB"}]}
```

## Round 4
- Worker status: complete
- Worker summary: Round 4 completed BACKLOG item 4 (format carry: SPEC rule 11, and the parse(format(n)) == n round trip from SPEC.md's last line). sizes.py's format() now carries after rounding: while the value rounded in the selected unit reaches the next unit's base (1024 binary / 1000 decimal) and a next unit exists, it advances to that unit and re-rounds there. So format(1048525) is "1 MiB", format(1024**2 - 1) is "1 MiB", format(999999, binary=False) is "1 MB", while format(1048525, precision=5) stays "1023.9502 KiB" and format(1047552, precision=0) stays "1023 KiB" (half-to-even does not carry). Bytes never carry (format(1023) is "1023 B"); the top unit is capped, so 2**50 is "1024 TiB". Added 2 tests (test_carry_to_next_unit, test_round_trip covering both bases, precision 0/1/3/5, carry/no-carry, exact round trips including high precision). All 20 tests in tests/test_sizes.py pass. Also ran an independent Decimal ROUND_HALF_EVEN reference sweep over 3048 values x 2 bases x 5 precisions (all matched), 480,039 exact round-trip cases (all matched), every SPEC example, and all rule 12 error checks. BACKLOG.md now has no unchecked items.
- Worker next steps: (none; all SPEC rules are implemented and verified)
- Worker blocker: (none)

## Round 4
- Worker status: complete
- Worker summary: Round 4 completed BACKLOG item 4 (SPEC rule 11 carry and the parse(format(n)) == n round trip) and closed out the objective. sizes.py's format() now carries after rounding: while the value rounded in the selected unit reaches the next unit's base (1024 binary / 1000 decimal) and a next unit exists, it advances and re-rounds there. So format(1048525) is "1 MiB", format(1024**2 - 1) is "1 MiB", format(999999, binary=False) is "1 MB"; no carry when rounding stays below the base (format(1048525, precision=5) = "1023.9502 KiB", format(1047552, precision=0) = "1023 KiB"), bytes never carry (format(1023) = "1023 B"), and the top unit is capped (2**50 = "1024 TiB"). Added 2 tests (test_carry_to_next_unit, test_round_trip) covering both bases, precision 0/1/3/5, carry/no-carry cases, and exact round trips including high precision. All 20 tests in tests/test_sizes.py pass (exit 0). An independent Decimal ROUND_HALF_EVEN reference sweep matched on 3048 values x 2 bases x 5 precisions, 480,039 exact round-trip cases matched, and every SPEC example plus all rule 12 error checks passed. BACKLOG.md now has all 4 items checked and .ralph/progress.md records Round 4. Public API (parse, format signatures) is unchanged and only the standard library is used.
- Worker next steps: (none)
- Worker blocker: (none)
- Verifier: passed (exit code 0)

Verifier output tail (last up to 4000 characters):
```
{"passed": 13, "total": 13, "failed": []}
```

````
