# sizes: spec

`sizes.py` parses and formats byte sizes. Python 3.11+, standard library only.

## `parse(text: str) -> int`

Returns whole bytes. Raises `ValueError` for anything this spec does not allow.

1. **Units**: `B` (1); decimal `KB` (1000), `MB` (1000²), `GB` (1000³), `TB` (1000⁴); binary `KiB` (1024), `MiB` (1024²), `GiB` (1024³), `TiB` (1024⁴). Units are case-sensitive: `kb`, `KIB` and `mb` raise `ValueError`.
2. **Form**: a number, then at most one space, then a unit. `"1.5KiB"` and `"1.5 KiB"` are 1536; `"1.5  KiB"` raises `ValueError`. Whitespace around the whole text is ignored.
3. **Bare number**: a text that is only an integer means bytes. `"512"` is 512.
4. **Decimals**: the number may have a decimal part. `"0.5 KiB"` is 512. If the total is not a whole number of bytes (`"0.1 B"`, `"1.0001 KB"`), raise `ValueError`.
5. **Digits**: ASCII digits only. An underscore may separate digits in the integer part (`"1_000 B"` is 1000); it may not lead, trail, or double (`"_1 B"`, `"1_ B"`, `"1__0 B"`). Commas, exponents (`"1e3 B"`) and non-ASCII digits raise `ValueError`.
6. **Sign**: sizes are never negative. `"-1 B"` and `"+1 B"` raise `ValueError`. Leading zeros are fine (`"007 B"` is 7).
7. **Empty**: an empty or whitespace-only text, a unit without a number (`"KiB"`), or a number with a trailing dot (`"1. KiB"`) raises `ValueError`.
8. **Type**: a non-`str` argument raises `TypeError`.

## `format(size: int, *, binary: bool = True, precision: int = 1) -> str`

9. **Unit choice**: binary units (`B`, `KiB`, `MiB`, `GiB`, `TiB`) by default, decimal (`B`, `KB`, `MB`, `GB`, `TB`) with `binary=False`. Use the largest unit whose value is at least 1, up to `TiB`/`TB`. `1536` is `"1.5 KiB"`, `1500` with `binary=False` is `"1.5 KB"`, `512` is `"512 B"`, `0` is `"0 B"`.
10. **Rounding**: round the value to `precision` decimal places with round-half-to-even on the exact value (`2304` is 2.25 KiB, so `"2.2 KiB"`; `2816` is 2.75 KiB, so `"2.8 KiB"`). Then drop trailing zeros and a trailing dot (`1024` is `"1 KiB"`, not `"1.0 KiB"`). Bytes are always shown as an integer.
11. **Carry**: if rounding reaches the next unit's base (1024 or 1000), show the next unit instead: `1048525` is 1023.950… KiB, which rounds to 1024.0, so it is `"1 MiB"`.
12. **Errors**: a negative `size` or a negative `precision` raises `ValueError`; a non-`int` `size` (including `bool` and `float`) raises `TypeError`.

`parse(format(n))` must equal `n` whenever `format(n)` is exact (no rounding happened).
