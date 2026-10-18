# 공식 `tool-ralph` — sizes-backlog #1 Round별 보고서 (DSH Web, ralph preset)

공식 구조에서 다음 Round로 넘어가는 건 workspace와 아래 보고서 하나뿐이에요. 각 child가 `structured_output`으로 낸 보고서 원문이에요.

## ?

```json
{
  "status": "continue",
  "summary": "Round 1 complete: BACKLOG item 1 (parse units and form, SPEC rules 1, 2, 3, 7, 8) is implemented, tested, and checked off. sizes.parse now handles all nine case-sensitive units, the optional single space before a unit, surrounding whitespace, bare-integer byte counts, and raises ValueError for empty/whitespace-only text, unit-only text, trailing dots, unknown/incorrect-case units, and extra internal spacing; non-str input raises TypeError. Rule 2's \"1.5KiB\"/\"1.5 KiB\" examples required decimal arithmetic, so exact integer-based decimal-to-bytes conversion was included early. A minimal exact half-to-even formatter core was also added solely to keep the two starter format assertions green; format carry (rule 11) and full format validation testing remain for later items. Full suite: 14 tests pass (3 starter + 11 new item-1 tests).",
  "evidence": [
    "BACKLOG.md: item 1 now reads '- [x] 1. `parse` units and form: SPEC rules 1, 2, 3, 7, 8'; items 2-4 remain unchecked",
    "sizes.py:29 defines parse(text: str) -> int with str type check, strip/empty handling, bare-integer branch, and full-match unit/form regex",
    "sizes.py:49 defines _to_bytes for exact decimal-to-whole-byte conversion, raising ValueError when the total is not a whole number of bytes",
    "sizes.py:63 defines format(size, *, binary=True, precision=1) with a minimal exact half-to-even core at sizes.py:88 to satisfy the starter tests",
    "tests/test_parse_units_and_form.py: 11 new tests cover all units, unit case sensitivity, unknown units, spacing, surrounding whitespace, bare numbers, bare decimals, empty input, unit-only input, trailing dots, and non-str types",
    "python3 -m unittest discover -s tests -v -> Ran 14 tests in 0.000s, OK",
    "Manual spot checks confirmed parse('1.5KiB')=1536, parse('1.5 KiB')=1536, parse(' 1 KiB ')=1024, parse('007 B')=7, and ValueError for '1.5  KiB', '1\\tKiB', '', 'KiB', '1. KiB', '1 kb', '-1 B', '+1 B'",
    "Manual spot checks confirmed TypeError for parse(512), parse(1.5), parse(None), parse(True), parse(b'1 KiB')"
  ],
  "nextSteps": [
    "Round 2: take BACKLOG item 2 (parse numbers: decimals, digits, sign; SPEC rules 4, 5, 6). Verify existing decimal/whole-byte behavior, add underscore digit-separator support so '1_000 B' -> 1000 while '_1 B', '1_ B', '1__0 B' raise ValueError, reject commas/exponents/non-ASCII digits, and reject leading '+'/'-'. Add focused tests, keep the suite green, then check item 2 off in BACKLOG.md.",
    "Do not check off items 3 or 4 yet: format currently has unit choice and half-to-even rounding, but carry at the next base (rule 11) and the exact-format round-trip requirement are still unimplemented.",
    "When format work begins, add tests for rules 9, 10, 12 and then rule 11/round-trip in their own round."
  ],
  "blocker": ""
}
```

## ?

```json
{
  "status": "continue",
  "summary": "Round 2 complete: BACKLOG item 2 (`parse` numbers: decimals, digits and sign; SPEC rules 4, 5, 6) is implemented, tested, and checked off. The only missing behavior was underscore digit separators, so sizes.py now uses `_INTEGER_DIGITS = r\"[0-9]+(?:_[0-9]+)*\"` for both the unit form and the bare-integer form. Underscores are accepted only singly between integer-part digits (\"1_000 B\" -> 1000, \"1_000.5 KiB\" -> 1024512, bare \"1_000\" -> 1000) and rejected when leading, trailing, doubled, or in the fractional part (\"_1 B\", \"1_ B\", \"1__0 B\", \"1_.5 KiB\", \"1.0_5 KiB\" all raise ValueError). Decimals, sign, comma/exponent, non-ASCII digit, and leading-zero behavior already matched the spec and are now locked in by tests. New tests/test_parse_numbers.py has 8 tests covering rules 4, 5, 6. Full suite: 22 tests pass (3 starter + 11 item-1 + 8 item-2).",
  "evidence": [
    "BACKLOG.md:7 now reads '- [x] 2. `parse` numbers: decimals, digits and sign: SPEC rules 4, 5, 6'; items 3 and 4 remain unchecked",
    "sizes.py:19 defines `_INTEGER_DIGITS = r\"[0-9]+(?:_[0-9]+)*\"`; sizes.py:20 defines `_NUMBER_PATTERN = rf\"{_INTEGER_DIGITS}(?:\\.[0-9]+)?\"`",
    "sizes.py:21-23 compile `_SIZE_RE` from `_NUMBER_PATTERN`; sizes.py:24 compiles `_INTEGER_RE = re.compile(_INTEGER_DIGITS)` so bare integers also accept separators",
    "tests/test_parse_numbers.py: 8 new tests in ParseDecimalsTest, ParseDigitSeparatorsTest, ParseSignAndDigitsTest cover exact decimal conversion, fractional-byte rejection, bad decimal forms, valid/invalid underscores, signs, leading zeros, commas, exponents, and non-ASCII digits",
    "python3 -m unittest discover -s tests -v -> Ran 22 tests in 0.001s, OK",
    "Manual checks: parse('1_000 B')=1000, parse('1_000_000 B')=1000000, parse('1_000 KiB')=1024000, parse('1_000.5 KiB')=1024512, parse('1_000')=1000, parse('00_7 B')=7",
    "Manual checks: ValueError for '_1 B', '1_ B', '1__0 B', '_1', '1_', '1__0', '1_.5 KiB', '1._5 KiB', '1.0_5 KiB', '-1 B', '+1 B', '1,000 B', '1e3 B', '\\u0661 B', '\\uff11 B', '0.1 B', '2.5 B', '1.0001 KB'",
    "Unchanged and still correct: parse('0.5 KiB')=512, parse('1.5 KiB')=1536, parse('0.0005 MB')=500, parse('0.0009765625 KiB')=1, parse('007 B')=7"
  ],
  "nextSteps": [
    "Round 3: take BACKLOG item 3 (`format` unit choice and rounding: SPEC rules 9, 10, 12). The current format already selects B/KiB/MiB/GiB/TiB or B/KB/MB/GB/TB by largest unit, rounds half-to-even on the exact rational value, trims trailing zeros/dot, and validates size/precision types. Add tests covering: 0 -> '0 B', 512 -> '512 B', 1023 -> '1023 B', 1024 -> '1 KiB', 1536 -> '1.5 KiB', 1500 with binary=False -> '1.5 KB', 999 with binary=False -> '999 B', 2304 -> '2.2 KiB', 2816 -> '2.8 KiB', precision=0/2/3 cases, trailing-zero trimming (1024 -> '1 KiB'), bytes always integer, largest-unit clipping beyond TiB/TB, negative size ValueError, bool/float size TypeError, negative precision ValueError, and non-int precision TypeError if kept; run the full suite and then check item 3 off in BACKLOG.md.",
    "Do not check off item 4 yet: rule 11 carry is still missing (e.g. format(1048525) currently yields '1024 KiB' instead of '1 MiB') and the parse(format(n)) round-trip requirement is untested.",
    "Round 4: implement rule 11 carry at the next base (1024/1000) after rounding and add round-trip tests for exact formats, then check item 4 off and run the full suite."
  ],
  "blocker": ""
}
```

## ?

```json
{
  "status": "continue",
  "summary": "Round 3 complete: BACKLOG item 3 (`format` unit choice, rounding, and errors; SPEC rules 9, 10, 12) is now fully tested and checked off. The implementation already present in sizes.py matched the spec: largest fitting unit from B/KiB/MiB/GiB/TiB or B/KB/MB/GB/TB, exact rational round-half-to-even at `precision`, trailing-zero/dot trimming, integer bytes, and the rule-12 type/value errors. I confirmed this with 20 new focused tests plus a corrected exact-rational property check over 30,194 non-byte/non-carry cases (0 mismatches), then changed BACKLOG.md:7 to `- [x]`. Item 4 remains unchecked because rule 11 carry is still missing and the round-trip requirement is untested.",
  "evidence": [
    "BACKLOG.md:7 now reads '- [x] 3. `format` unit choice and rounding: SPEC rules 9, 10, 12'; BACKLOG.md:8 still reads '- [ ] 4. `format` carry and the round trip: SPEC rule 11 and the last line of SPEC.md'",
    "tests/test_format_units_and_rounding.py is new: 20 tests in FormatUnitChoiceTest (6), FormatRoundingTest (8), FormatErrorsTest (6) covering rules 9, 10, 12",
    "python3 -m unittest discover -s tests -v -> Ran 42 tests in 0.001s, OK (22 prior + 20 new)",
    "Corrected exact-rational property check (carry cases excluded correctly via floor >= base*10**precision): 30,194 non-byte/non-carry cases over sizes 0..10**15, both bases, precision 0..4 -> 0 mismatches",
    "Unit-choice checks: format(0)='0 B', format(512)='512 B', format(1023)='1023 B', format(1024)='1 KiB', format(1024**2)='1 MiB', format(1024**4)='1 TiB', format(1000, binary=False)='1 KB', format(1000**4, binary=False)='1 TB', format(1024**5)='1024 TiB', format(10**15, binary=False)='1000 TB'",
    "Rounding checks: format(2304)='2.2 KiB', format(2816)='2.8 KiB', format(1536, precision=0)='2 KiB', format(2560, precision=0)='2 KiB', format(3584, precision=0)='4 KiB', format(1152, precision=2)='1.12 KiB', format(1408, precision=2)='1.38 KiB', format(1088, precision=3)='1.062 KiB', format(1125, binary=False, precision=2)='1.12 KB'",
    "Trimming/bytes checks: format(1024, precision=3)='1 KiB', format(1536, precision=3)='1.5 KiB', format(512, precision=3)='512 B', format(0, precision=3)='0 B'",
    "Error checks: ValueError for size -1/-1024/-10**9 and precision -1/-2; TypeError for bool True/False, floats 0.0/1.0/1024.0/1024.5, and str/None/bytes/list/object",
    "sizes.py unchanged this round (no item-3 defect found); remaining object-level gap confirmed: format(1048525)='1024 KiB' (rule 11 expects '1 MiB') and format(999950, binary=False)='1000 KB' (expects '1 MB')"
  ],
  "nextSteps": [
    "Round 4: implement SPEC rule 11 carry in sizes.py. After rounding, if the rounded integer equals base*10**precision and exponent < len(units)-1, emit the next unit (carry always yields exactly '1 <next unit>' because the pre-round value is below the next base); do not carry above TiB/TB, so format(1024**5) must stay '1024 TiB'.",
    "Add tests for carry: format(1048525)='1 MiB', format(1024**2-1)='1 MiB', format(999950, binary=False)='1 MB', precision=0 carry such as format(1023*1024+512)='1 MiB', and no-carry-at-max cases.",
    "Add round-trip tests parse(format(n)) == n for exact formats across all units and precisions (e.g. 0, 512, 1024, 1536, 1024**2, 1024**2+512*1024, 10**6, 1500 with binary=False, 10**12 with binary=False, 1024**4), noting inexact carry examples like 1048525 need not round-trip.",
    "Run the full suite, verify all 12 rules plus the round-trip line, then check off item 4 in BACKLOG.md and report complete with concrete evidence."
  ],
  "blocker": ""
}
```

## ?

```json
{
  "status": "complete",
  "summary": "Round 4 (final) complete: BACKLOG item 4 is implemented, tested, and checked off. `format` now carries into the next unit when half-to-even rounding reaches the next base, never carries above TiB/TB, and the exact-format round-trip requirement (`parse(format(n)) == n`) is verified. All four backlog items are checked; sizes.py implements all 12 SPEC rules plus the round-trip requirement; the full suite passes.",
  "evidence": [
    "BACKLOG.md:5-8 now has all four items checked, including '- [x] 4. `format` carry and the round trip: SPEC rule 11 and the last line of SPEC.md'",
    "sizes.py:89-97 implements rule 11: after exact half-to-even rounding, `scaled == base * 10**precision` carries to the next unit (scaled set to 10**precision) unless already at TiB/TB, where no carry is possible and e.g. 1024 TiB stays put",
    "sizes.py:100-117 factor the exact integer round-half-to-even into `_round_scaled` and trailing-zero/dot trimming into `_render_scaled`, keeping the public API `parse(text: str) -> int` and `format(size: int, *, binary: bool = True, precision: int = 1) -> str` unchanged",
    "tests/test_format_carry_and_round_trip.py is new (194 lines, 18 tests): 13 carry tests covering the SPEC example 1048525 -> '1 MiB', every binary/decimal boundary, precision 0/1/2 carry, tie-no-carry (999850 -> '999.8 KB'), below-threshold no-carry, and no-unit-above-TiB/TB; 5 round-trip tests covering exact values across all units and precisions plus exhaustive small ranges",
    "python3 -m unittest discover -s tests -> 'Ran 60 tests in 0.018s, OK' (42 prior tests + 18 new)",
    "Independent brute-force reference check: 840,600 format cases over 70,050 sizes (0..4000, every unit boundary +/-3000, and 30,000 random sizes up to 10**16), both bases, precision {0,1,2,3,4,7} -> 0 mismatches; every exact case also satisfied parse(format(n)) == n",
    "Independent 180-check audit of SPEC rules 1-12 plus the round-trip line -> 180 total, 0 failed",
    "Confirmed key outputs: format(1048525)='1 MiB', format(1024**2-1)='1 MiB', format(999950, binary=False)='1 MB', format(1024**3-1)='1 GiB', format(1024**4-1)='1 TiB', format(1024**5)='1024 TiB', format(10**15, binary=False)='1000 TB', format(1024**2-1, precision=3)='1023.999 KiB'"
  ],
  "nextSteps": [],
  "blocker": ""
}
```
