# durations: spec

`durations.py` parses and formats human-written time spans. Python 3.11+, standard library only.

## `parse(text: str) -> int`

Returns whole seconds. Raises `ValueError` for anything this spec does not allow.

1. **Units**: `d` (86400 s), `h` (3600), `m` (60), `s` (1), case-insensitive. `1h30m` is 5400.
2. **Spaces**: whitespace between parts and around the whole text is ignored. `" 1h  30m "` is 5400.
3. **Bare number**: a text that is only a non-negative integer means seconds. `"90"` is 90.
4. **Decimals**: a part may have a decimal value, `1.5h` is 5400. If the total is not a whole number of seconds (`0.5s`, `1.01m`), raise `ValueError`.
5. **Order**: units must appear from largest to smallest, each at most once. `30m1h` and `1h1h` raise `ValueError`.
6. **Dangling number**: once a unit is used, every number needs a unit. `1h30` raises `ValueError`.
7. **Sign**: one leading `-` negates the whole span. `-1h30m` is -5400. A sign anywhere else (`1h-30m`, `--1h`, `+1h`) raises `ValueError`.
8. **ISO 8601**: `P[nD][T[nH][nM][nS]]`, uppercase only, integers only. `PT1H30M` is 5400, `P1DT2H` is 93600, `PT0S` is 0. `P`, `PT`, `pt1h` and `PT1.5H` raise `ValueError`.
9. **Empty**: an empty or whitespace-only text, or a unit without a number (`h`), raises `ValueError`.
10. **Type**: a non-`str` argument raises `TypeError`.

## `format(seconds: int, *, iso: bool = False) -> str`

11. **Compact form**: largest unit first, zero units left out, `0` is `"0s"`, negative spans get one leading `-`. `5400` is `"1h30m"`, `90061` is `"1d1h1m1s"`, `-93600` is `"-1d2h"`.
12. **ISO form** (`iso=True`): `5400` is `"PT1H30M"`, `86400` is `"P1D"`, `93600` is `"P1DT2H"`, `0` is `"PT0S"`. Negative spans raise `ValueError` in ISO form.

`parse(format(n)) == n` must hold for every integer `n` in both forms (ISO: `n >= 0`).
