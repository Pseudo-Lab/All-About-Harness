# Week 2 — Build Your Own RALPH (jinmang2)

- 모델: `deepseek-v4-flash` (모든 하네스 같은 모델, 같은 설정)
- 같은 작업 지시문, 같은 초기 workspace(태스크 fixture 복사본), 최대 Round 5
- 채점: workspace 밖에 있는 수락 테스트 13개(SPEC 규칙마다 1개)를 최종 workspace에 다시 돌린 결과
- 토큰: 게이트웨이가 녹화한 모든 모델 호출의 합(Round child 포함), 입력은 캐시 포함
- workspace 밖 접근: 도구 호출 인자에 workspace 밖 경로가 나온 횟수(0이 아니면 결과를 믿기 어려움)
- 제외한 실행: `20261018-221848-week2-lab-backlog/*ralph-judge*`, `20261018-221848-week2-lab-backlog/*ralph-reset*`

## 실행 요약

숫자는 workspace 밖을 건드리지 않은 실행만의 중앙값이에요. 밖을 건드린 실행은 `오염`에 세고 중앙값에서 뺐어요.

| 태스크 | 하네스 | 실행(오염) | 수락 테스트 | Round | 종료 | 거짓 완료 보고 (그대로 끝남) | 전체 토큰 | 도구 호출 | 시간 |
|---|---|---:|---|---:|---|---:|---:|---:|---:|
| durations-backlog | DSH 공식 `tool-ralph` | 3 (0) | 13/13, 13/13, 13/13 | 4, 4, 4 | worker complete, worker complete, worker complete | 0 (0) | 1,273,729 | 91 | 281초 |
| durations-backlog | DSH Custom `verified_ralph` | 4 (1) | 13/13, 13/13*, 13/13, 13/13 | 2, 3, 4 | verified, verified, verified | 1 (0) | 1,038,132 | 82 | 229초 |
| durations-backlog | lab fresh (공식 재현) | 2 (0) | 13/13, 9/13 | 4, 1 | worker complete, error: ValueError | 0 (0) | 709,417 | 62.5 | 123초 |
| durations-backlog | lab verified (Custom 재현) | 2 (0) | 13/13, 13/13 | 4, 3 | verified, verified | 0 (0) | 1,032,677 | 81.5 | 199초 |
| durations-backlog | lab judge (같은 대화 + judge) | 2 (0) | 13/13, 13/13 | 1, 1 | complete, complete | 0 (0) | 834,635 | 38.5 | 122초 |
| durations-backlog | lab reset (대화 초기화 + handoff) | 2 (0) | 12/13, 13/13 | 4, 4 | complete, complete | 1 (1) | 670,638 | 58.5 | 116초 |

`*` = workspace 밖 접근이 있었던 실행(오염). Round와 종료는 깨끗한 실행마다 하나씩 적었어요.
거짓 완료 보고 = worker나 judge가 완료라고 했지만 그 시점 수락 테스트가 13/13이 아니었던 횟수. 괄호는 그 보고로 루프가 그대로 끝나 버린 횟수예요.

## Round별 기록

### durations-backlog · DSH 공식 `tool-ralph` · #1

- 종료: worker complete · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  |  | Ralph round 1 of 5: implemented BACKLOG item 1 only. durations.parse now handles compact durations per SPEC rules 1, 2, 3, 5, 6, 9, 10: cas… |
| 2 | continue |  |  | Ralph round 2 of 5: implemented BACKLOG item 2 only (decimals and sign in parse, SPEC rules 4 and 7), then checked it off. durations.parse … |
| 3 | continue |  |  | Ralph round 3 of 5: implemented BACKLOG item 3 only (ISO 8601 parse, SPEC rule 8), then checked it off. durations.parse now routes any post… |
| 4 | complete |  |  | Ralph round 4 of 5: completed the final unchecked BACKLOG item (item 4) and verified the whole spec. durations.format now implements compac… |

```
Ralph worker reported completion after 4 rounds.
Final report:
{
  "status": "complete",
  "summary": "Ralph round 4 of 5: completed the final unchecked BACKLOG item (item 4) and verified the whole spec. durations.format now implements compact form (largest unit first, zero units omitted, 0 -> \"0s\", one leading \"-\" for negatives, e.g. 5400 -> \"1h30m\", 90061 -> \"1d1h1m1s\", -93600 -> \"-1d2h\") and ISO form via iso=True (5400 -> \"PT1H30M\", 86400 -> \"P1D\", 93600 -> \"P1DT2H\", 0 -> \"PT
```

### durations-backlog · DSH 공식 `tool-ralph` · #2

- 종료: worker complete · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  |  | PROGRESS — backlog item 1 done (items 2, 3, 4 remain unchecked). Implemented compact `parse` per SPEC rules 1, 2, 3, 5, 6, 9, 10 in duratio… |
| 2 | continue |  |  | PROGRESS — backlog item 2 done (items 3 and 4 remain unchecked). Implemented SPEC rules 4 and 7 in durations.py: parse now accepts decimal … |
| 3 | continue |  |  | PROGRESS — backlog item 3 done (item 4 remains unchecked). Implemented SPEC rule 8 in durations.py: parse now recognizes an uppercase-only … |
| 4 | complete |  |  | COMPLETE — backlog item 4 finished; all four BACKLOG.md items are checked and the full suite passes. Implemented SPEC rules 11 and 12 in du… |

```
Ralph worker reported completion after 4 rounds.
Final report:
{
  "status": "complete",
  "summary": "COMPLETE — backlog item 4 finished; all four BACKLOG.md items are checked and the full suite passes. Implemented SPEC rules 11 and 12 in durations.py via _format_compact and _format_iso: compact output is largest-unit-first with zero units omitted, `0s` for zero, and one leading `-` for negatives (`5400`->`1h30m`, `90061`->`1d1h1m1s`, `-93600`->`-1d2h`); ISO output is uppercase `P[nD][T[nH][nM]
```

### durations-backlog · DSH 공식 `tool-ralph` · #3

- 종료: worker complete · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  |  | Completed BACKLOG item 1 only: implemented compact `parse` for SPEC rules 1, 2, 3, 5, 6, 9, 10 and checked it off. Units d/h/m/s are case-i… |
| 2 | continue |  |  | Completed BACKLOG item 2 only: implemented decimals and sign in `parse` for SPEC rules 4 and 7, then checked it off. Decimal parts are pars… |
| 3 | continue |  |  | Completed BACKLOG item 3 only: implemented ISO 8601 `parse` for SPEC rule 8 and checked it off. `parse` now routes texts beginning with upp… |
| 4 | complete |  |  | Completed BACKLOG item 4 and then the final comprehensive SPEC.md verification in the same round. `format(seconds, *, iso=False)` now emits… |

```
Ralph worker reported completion after 4 rounds.
Final report:
{
  "status": "complete",
  "summary": "Completed BACKLOG item 4 and then the final comprehensive SPEC.md verification in the same round. `format(seconds, *, iso=False)` now emits compact form (largest unit first, zero units omitted, `0` -> `0s`, one leading `-` for negatives) and ISO form (uppercase, `0` -> `PT0S`, `P1D`/`P1DT2H` as specified, negative values -> ValueError). I also hardened `parse` during final verification: regexes
```

### durations-backlog · DSH Custom `verified_ralph` · #1

- 종료: verified · Round 2 · 거짓 완료 보고 1
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | complete |  | 1 | Implemented durations.py fully against SPEC.md. Worked through all four BACKLOG.md items in order, testing each before checking it off: (1)… |
| 2 | complete |  | 0 | Fixed the sole verifier failure in rule 7: the leading minus now negates the whole span, including a bare number, so parse("-90") == -90, p… |

```
verified_ralph ended as verified after 2 rounds.
Verifier: round 1 fail (exit 1), round 2 pass (exit 0).
Progress file: <tmp>
Last worker report:
{
  "status": "complete",
  "summary": "Fixed the sole verifier failure in rule 7: the leading minus now negates the whole span, including a bare number, so parse(\"-90\") == -90, parse(\"-0\") == 0, and parse(\" -90 \") == -90 while invalid sign placements sti
```

### durations-backlog · DSH Custom `verified_ralph` · #2 (오염: 결과에서 제외)

- 종료: verified · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13
- workspace 밖 접근 10회: <tmp> <tmp> <tmp> <tmp>

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  | 1 | Round 1 completed backlog item 1 (compact parse: SPEC rules 1, 2, 3, 5, 6, 9, 10). Implemented durations.parse with isinstance str TypeErro… |
| 2 | continue |  | 1 | Round 2 completed backlog item 2 (SPEC rules 4 and 7). durations.py now parses decimal part values exactly via fractions.Fraction and raise… |
| 3 | continue |  | 1 | Round 3 completed BACKLOG item 3 (SPEC rule 8: ISO 8601 parse). durations.py now dispatches text beginning with uppercase 'P' to a new _par… |
| 4 | complete |  | 0 | Round 4 completed BACKLOG item 4 and thereby the whole objective. Implemented durations.format(seconds, *, iso=False) for both forms: compa… |

```
verified_ralph ended as verified after 4 rounds.
Verifier: round 1 fail (exit 1), round 2 fail (exit 1), round 3 fail (exit 1), round 4 pass (exit 0).
Progress file: <tmp>
Last worker report:
{
  "status": "complete",
  "summary": "Round 4 completed BACKLOG item 4 and thereby the whole objective. Implemented durations.format(seconds, *, iso=False) for both forms: compact decomposition into d/h/m/s with l
```

### durations-backlog · DSH Custom `verified_ralph` · #3

- 종료: verified · Round 3 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  | 1 | Round 1 completed BACKLOG item 1 (compact parse, SPEC rules 1, 2, 3, 5, 6, 9, 10). Implemented durations.parse for case-insensitive d/h/m/s… |
| 2 | continue |  | 1 | Round 2 completed BACKLOG item 2 (SPEC rules 4 and 7). durations.parse now accepts decimal parts using exact Fraction arithmetic and reject… |
| 3 | complete |  | 0 | Round 3 completed the remaining BACKLOG items (3 and 4), so the full SPEC is now implemented and tested. ISO 8601 parse (rule 8) accepts on… |

```
verified_ralph ended as verified after 3 rounds.
Verifier: round 1 fail (exit 1), round 2 fail (exit 1), round 3 pass (exit 0).
Progress file: <tmp>
Last worker report:
{
  "status": "complete",
  "summary": "Round 3 completed the remaining BACKLOG items (3 and 4), so the full SPEC is now implemented and tested. ISO 8601 parse (rule 8) accepts only uppercase P[nD][T[nH][nM][nS]] with integer components (
```

### durations-backlog · DSH Custom `verified_ralph` · #1

- 종료: verified · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue |  | 1 | Round 1 completed backlog item 1 only. Implemented compact `parse` in durations.py for SPEC rules 1, 2, 3, 5, 6, 9, 10: case-insensitive d/… |
| 2 | continue |  | 1 | Round 2 completed BACKLOG item 2 only. Implemented decimal parts and the single leading `-` sign in compact `parse` (SPEC rules 4, 7): exac… |
| 3 | continue |  | 1 | Round 3 completed BACKLOG item 3 only. Added ISO 8601 `parse` in durations.py (SPEC rule 8): uppercase-only grammar `P[nD][T[nH][nM][nS]]`,… |
| 4 | complete |  | 0 | Round 4 completed BACKLOG item 4 only and finished the objective. Implemented `format` in compact and ISO forms in durations.py (SPEC rules… |

```
verified_ralph ended as verified after 4 rounds.
Verifier: round 1 fail (exit 1), round 2 fail (exit 1), round 3 fail (exit 1), round 4 pass (exit 0).
Progress file: <tmp>/workspace/.ralph/progress.md
Last worker report:
{
  "status": "complete",
  "summary": "Round 4 completed BACKLOG item 4 only and finished the objective. Implemented `format` in compact and ISO forms in durations.py (SPEC rules 11 and 12): compact output is
```

### durations-backlog · lab fresh (공식 재현) · #1

- 종료: worker complete · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue |  | BACKLOG item 1 (compact parse: SPEC rules 1, 2, 3, 5, 6, 9, 10) is implemented in durations.py and checked off in BACKLOG.md. parse now han… |
| 2 | continue | continue |  | BACKLOG item 2 (decimals and leading sign in parse: SPEC rules 4 and 7) is implemented in durations.py and checked off in BACKLOG.md. Decim… |
| 3 | continue | continue |  | BACKLOG item 3 (ISO 8601 parse: SPEC rule 8) is implemented in durations.py and checked off in BACKLOG.md. A dedicated `_parse_iso8601` hel… |
| 4 | complete | complete |  | BACKLOG item 4 (format in compact and ISO forms plus the round trip, SPEC rules 11-12 and the final line) is implemented in durations.py an… |

```
Ralph worker reported completion after 4 rounds.
Final report:
{
  "status": "complete",
  "summary": "BACKLOG item 4 (format in compact and ISO forms plus the round trip, SPEC rules 11-12 and the final line) is implemented in durations.py and checked off in BACKLOG.md. Added `_split_seconds`, which decomposes a non-negative integer into non-zero d/h/m/s parts, and implemented `format`: compact output omits zero units, emits \"0s\" for zero, and prefixes one \"-\" for negative spans; ISO output 
```

### durations-backlog · lab fresh (공식 재현) · #2

- 종료: error: ValueError · Round 1 · 거짓 완료 보고 0
- BACKLOG 체크: 2/4
- 수락 테스트: 9/13 (실패: test_r08_iso, test_r11_format_compact, test_r12_format_iso, test_r13_round_trip)

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue |  | Completed BACKLOG item 1 (compact `parse`: SPEC rules 1, 2, 3, 5, 6, 9, 10). Implemented `parse` in durations.py with: case-insensitive uni… |

```
ValueError('Ralph child returned no structured round report')
```

### durations-backlog · lab verified (Custom 재현) · #1

- 종료: verified · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue | 1 | Round 1 complete: implemented compact `parse` (SPEC rules 1, 2, 3, 5, 6, 9, 10) in durations.py and added tests/test_backlog.py covering un… |
| 2 | continue | continue | 1 | Round 2 complete: implemented BACKLOG item 2 (SPEC rules 4 and 7) in durations.py. Compact parts now accept decimal values (`1.5h`, `0.5d12… |
| 3 | continue | continue | 1 | Round 3 complete: implemented BACKLOG item 3 (ISO 8601 parse, SPEC rule 8) in durations.py. ISO detection now runs before the compact parse… |
| 4 | complete | verified | 0 | Round 4 complete: implemented BACKLOG item 4 (`format`) in durations.py, so all four backlog items are checked. Compact form emits largest-… |

```
verified_ralph finished: verified after 4 round(s).
round 1: worker continue, verifier fail (exit 1)
round 2: worker continue, verifier fail (exit 1)
round 3: worker continue, verifier fail (exit 1)
round 4: worker complete, verifier pass
Last verifier output:
{"passed": 13, "total": 13, "failed": []}
Last worker report:
{"status": "complete", "summary": "Round 4 complete: implemented BACKLOG item 4 (`format`) in durations.py, so all four backlog items are checked. Compact form emits largest-uni
```

### durations-backlog · lab verified (Custom 재현) · #2

- 종료: verified · Round 3 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue | 1 | Implemented BACKLOG item 1 in durations.py: compact `parse` covering SPEC rules 1 (units d/h/m/s case-insensitive), 2 (whitespace between p… |
| 2 | continue | continue | 1 | Round 2 completed BACKLOG item 2 (SPEC rules 4 and 7) in durations.py. `_parse_compact` now accepts per-part decimal values using Decimal (… |
| 3 | complete | verified | 0 | All four BACKLOG items are implemented, checked off, and tested. durations.py now supports compact parse (units, whitespace, bare integers,… |

```
verified_ralph finished: verified after 3 round(s).
round 1: worker continue, verifier fail (exit 1)
round 2: worker continue, verifier fail (exit 1)
round 3: worker complete, verifier pass
Last verifier output:
{"passed": 13, "total": 13, "failed": []}
Last worker report:
{"status": "complete", "summary": "All four BACKLOG items are implemented, checked off, and tested. durations.py now supports compact parse (units, whitespace, bare integers, decimals with whole-second totals, order/repeat che
```

### durations-backlog · lab judge (같은 대화 + judge) · #1

- 종료: complete · Round 1 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 |  | complete |  | The implementation, added spec tests, and broad round-trip checks all pass, and all BACKLOG items are checked off within the 5-round limit. |

### durations-backlog · lab judge (같은 대화 + judge) · #2

- 종료: complete · Round 1 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 |  | complete |  | The assistant implemented durations.py across the required Ralph rounds, checked off all BACKLOG items, passed the starter tests, and repor… |

### durations-backlog · lab reset (대화 초기화 + handoff) · #1

- 종료: complete · Round 4 · 거짓 완료 보고 1
- BACKLOG 체크: 4/4
- 수락 테스트: 12/13 (실패: test_r07_sign)

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue |  | Round 1 complete. Implemented compact `parse` in durations.py covering SPEC rules 1, 2, 3, 5, 6, 9, 10: unit parsing case-insensitive with … |
| 2 | continue | continue |  | Round 2 complete. Implemented SPEC rules 4 and 7 in `parse`: decimal part values handled with exact `fractions.Fraction` arithmetic (non-wh… |
| 3 | continue | continue |  | Round 3 complete. Implemented ISO 8601 parsing (SPEC rule 8) in `parse` via a strict `_ISO_RE`: accepts `P[nD][T[nH][nM][nS]]`, uppercase/i… |
| 4 | complete | complete |  | Round 4 complete and objective achieved. Implemented `format` in durations.py for both forms (SPEC rules 11-12): compact output largest-uni… |

### durations-backlog · lab reset (대화 초기화 + handoff) · #2

- 종료: complete · Round 4 · 거짓 완료 보고 0
- BACKLOG 체크: 4/4
- 수락 테스트: 13/13

| Round | worker 보고 | 루프 판단 | 검증 exit | 요약 |
|---:|---|---|---:|---|
| 1 | continue | continue |  | Round 1: Implemented compact parse in durations.py for SPEC rules 1,2,3,5,6,9,10 (integer parts, units d/h/m/s case-insensitive, whitespace… |
| 2 | continue | continue |  | Round 2: Implemented BACKLOG item 2 (SPEC rules 4, 7) in parse. Decimal parts are parsed exactly via fractions.Fraction (e.g. 1.5h==5400, 2… |
| 3 | continue | continue |  | Round 3: Implemented BACKLOG item 3 (SPEC rule 8) ISO 8601 parsing. Added uppercase-only, integer-only `P[nD][T[nH][nM][nS]]` regex branch … |
| 4 | complete | complete |  | Round 4: Completed BACKLOG item 4 (SPEC rules 11, 12, round-trip). Implemented format(seconds, *, iso=False): compact form emits largest-un… |

---
측정: harness-lab `lab run` + `lab week2`. API key, credential, 세션 로그 원문은 포함하지 않았어요.
