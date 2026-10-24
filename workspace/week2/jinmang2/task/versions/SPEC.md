# versions: spec

`versions.py` parses, compares and matches version strings. Python 3.11+, standard library only.
Every function raises `TypeError` for a non-`str` version or range argument, and `ValueError`
for any version or range text this spec does not allow.

## `parse(text: str) -> tuple`

Returns `(major, minor, patch, prerelease, build)`: three `int`s, then a tuple of prerelease
identifiers (numeric ones as `int`, others as `str`), then a tuple of build identifiers (all `str`).
`parse("1.2.3-alpha.1+build.05")` is `(1, 2, 3, ("alpha", 1), ("build", "05"))`.

1. **Core**: `MAJOR.MINOR.PATCH`, three non-negative decimal integers in ASCII digits. No leading zeros: `"01.2.3"` and `"1.02.3"` raise `ValueError`, `"0.0.0"` is fine. Exactly three parts: `"1.2"` and `"1.2.3.4"` raise `ValueError`.
2. **Prerelease**: optional, after `-`: one or more dot-separated identifiers of `[0-9A-Za-z-]`, none empty. A numeric identifier may not have a leading zero (`"1.0.0-01"` raises `ValueError`; `"1.0.0-0a"` is fine because `0a` is not numeric).
3. **Build**: optional, after `+` (and after the prerelease if there is one): one or more dot-separated identifiers of `[0-9A-Za-z-]`, none empty. Leading zeros are allowed here.
4. **Prefix and whitespace**: surrounding whitespace is ignored, and one leading `v` or `=` is ignored (`" v1.2.3 "` is `1.2.3`). Nothing else may precede or follow.

## `compare(a: str, b: str) -> int`

Returns `-1`, `0` or `1` as `a` is lower than, equal to, or higher than `b`.

5. **Core order**: compare major, then minor, then patch, numerically (`1.10.0` is higher than `1.9.0`).
6. **Prerelease is lower**: with equal cores, a version with a prerelease is lower than one without (`1.0.0-rc.1 < 1.0.0`).
7. **Prerelease order**: compare identifiers left to right. Two numeric identifiers compare numerically; two alphanumeric ones compare as ASCII strings; a numeric identifier is lower than an alphanumeric one. If all shared identifiers are equal, the shorter list is lower. So `1.0.0-alpha < 1.0.0-alpha.1 < 1.0.0-alpha.beta < 1.0.0-beta < 1.0.0-beta.2 < 1.0.0-beta.11 < 1.0.0-rc.1 < 1.0.0`.
8. **Build is ignored**: `compare("1.0.0+a", "1.0.0+b")` is `0`.

## `satisfies(version: str, range_: str) -> bool`

A range is one or more comparator sets joined by `||` (a version satisfies the range if it
satisfies any set). A set is one or more comparators separated by whitespace (a version
satisfies the set if it satisfies every comparator in it). Versions inside ranges are written
without the `v`/`=` prefix of rule 4.

9. **Comparators**: `>`, `>=`, `<`, `<=`, `=` followed by a version, optionally with spaces between operator and version (`">= 1.2.3"`). A bare version means `=`. Whitespace around `||` and around the whole range is ignored.
10. **Partial versions and X-ranges**: a version in a range may leave out trailing parts or write them as `x`, `X` or `*` (`1.2`, `1.2.x`, `1`, `1.x.x`, `*`); partial versions have no prerelease or build. An empty range, an empty set and `*` match every version that has no prerelease (rule 14 applies to every range). With no operator (or `=`), a partial version means its whole span: `1.2.x` is `>=1.2.0 <1.3.0`, `1` is `>=1.0.0 <2.0.0`. With an operator: `>=1.2` is `>=1.2.0`; `>1.2` is `>=1.3.0`; `<1.2` is `<1.2.0`; `<=1.2` is `<1.3.0`.
11. **Tilde**: `~` allows patch-level changes: `~1.2.3` is `>=1.2.3 <1.3.0`, `~1.2` is `>=1.2.0 <1.3.0`, `~1` is `>=1.0.0 <2.0.0`, `~0.2.3` is `>=0.2.3 <0.3.0`. A prerelease on the version is kept in the lower bound: `~1.2.3-beta.2` is `>=1.2.3-beta.2 <1.3.0`.
12. **Caret**: `^` allows changes that do not modify the left-most non-zero part of `MAJOR.MINOR.PATCH`: `^1.2.3` is `>=1.2.3 <2.0.0`; `^0.2.3` is `>=0.2.3 <0.3.0`; `^0.0.3` is `>=0.0.3 <0.0.4`; with no non-zero part, the patch moves: `^0.0.0` is `>=0.0.0 <0.0.1`. For partial versions the missing parts count as zero for the lower bound, and the upper bound moves the left-most given non-zero part, or the last given part if all given parts are zero: `^1.2` is `>=1.2.0 <2.0.0`, `^0.2` is `>=0.2.0 <0.3.0`, `^0.0` is `>=0.0.0 <0.1.0`, `^0` is `>=0.0.0 <1.0.0`, `^1.x` is `>=1.0.0 <2.0.0`. A prerelease on the version is kept in the lower bound.
13. **Hyphen ranges**: `A - B` (spaces around the hyphen required) is `>=A <=B`, and makes up a whole comparator set (`"1.0.0 - 1.2.0 || 2.x"` is fine). A partial `A` fills missing parts with zero (`1.2 - 2.3.4` is `>=1.2.0 <=2.3.4`); a partial `B` includes its whole span (`1.2.3 - 2.3` is `>=1.2.3 <2.4.0`, `1.2.3 - 2` is `>=1.2.3 <3.0.0`).
14. **Prereleases need an invitation**: a version that has a prerelease satisfies a comparator set only if the set also contains a comparator whose own version has a prerelease **and the same `MAJOR.MINOR.PATCH`** (and, as always, every comparator holds). So `1.2.3-alpha.7` satisfies `>1.2.3-alpha.3`, but `3.4.5-alpha.9` does not, and `1.0.0-rc.1` does not satisfy `^0.9.0`, `<1.0.0` or `*`. Bounds produced by rules 10–13 count as comparators of the set: `1.2.3-beta.4` satisfies `^1.2.3-beta.2`, `1.2.4-beta.1` does not.

## `max_satisfying(versions: list[str], range_: str) -> str | None`

15. **Highest match**: returns the highest version in `versions` (by rule 5–8 order) that satisfies `range_`, exactly as it was written in the list, or `None` when none does. Every item must be a valid version: one invalid item raises `ValueError`.

16. **Invalid ranges**: anything else in a range raises `ValueError`, including an unknown operator (`"=>1.2.3"`, `"~>1.2"`), a dangling operator (`">="`), a prerelease on a partial version (`"1.2-beta"`), a number after a wildcard (`"1.x.3"`), or a hyphen range with an operator or other comparators in the same set (`">=1.2.3 - 2.0.0"`, `"1.0.0 - 2.0.0 <1.5.0"`).

Ordering is total: sorting any list of valid versions with `compare` gives the same result whatever the input order (equal-precedence versions that differ only in build may appear in either order).
