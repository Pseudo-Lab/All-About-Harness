# Week 02 — Custom Strategy Ralph Plugin 결과

## 1. 주제: Bitcoin 전략 비교를 위한 Research RALPH

이번 발표에서는 저장된 BTCUSDT 5분봉 데이터에 여러 투자 전략을 순차적으로 적용하고, 각 전략의 결과를 검증한 뒤 가장 좋은 역사적 결과를 비교하는 작업을 주제로 삼았다.

핵심 질문은 다음과 같다.

> 같은 데이터와 비용 가정에서 여러 전략을 반복적으로 실험하고 검증하려면, 단순 Prompt 지시와 실제 반복 실행 Plugin은 어떤 차이를 만드는가?

사용한 데이터는 Binance BTCUSDT 5분봉 최근 24시간, 총 288개 candle이다. 연구 목적의 백테스트이며 실제 주문이나 거래는 실행하지 않았다.

이번 작업에서 비교한 전략은 Buy-and-Hold, SMA/EMA crossover, RSI와 Bollinger Bands mean reversion, Donchian breakout, momentum/volatility filter, MACD, grid trading, signal ensemble이다.

> 주의: 단일 24시간 in-sample 백테스트는 미래 수익률이나 투자 적합성을 증명하지 않는다.

## 이번 과제의 Assignment 정의

이번 주 과제는 다음 네 단계로 정의했다.

1. **Creator Mode로 Custom RALPH Plugin 만들기**
   - 반복 실행, 상태 전달, 종료 조건을 직접 구현한다.
2. **Custom Agent Preset에 연결하기**
   - 만든 Plugin과 Skill을 Custom Agent Preset에 등록한다.
3. **직접 만든 RALPH 실행하기**
   - 실제 작업을 여러 Round로 실행하고, 각 Round의 결과와 종료 과정을 기록한다.
4. **공식 `tool-ralph`와 비교하기**
   - 같은 목적과 데이터로 공식 Plugin을 실행하고 구조 및 결과를 비교한다.

이 문서는 위 네 가지 과제 순서에 맞춰 Plugin 구현부터 Preset 연결, 실제 실행, 공식 Plugin 비교 순서로 정리한다.

---

## Task 01. Creator Mode로 Custom RALPH Plugin 만들기

### 1.1 전반적인 구조

이 Plugin은 하나의 큰 Agent가 대화를 계속 이어가는 방식이 아니라, Workflow Engine 안에서 각 전략별로 새로운 analyst와 evaluator를 순차적으로 생성하는 구조다.

```text
Agent가 strategy_ralph 호출
  ↓
Workflow Engine 시작
  ↓
전략 1: fresh analyst → fresh evaluator
  ↓
전략 2: fresh analyst → fresh evaluator
  ↓
...
  ↓
전략 10: fresh analyst → fresh evaluator
  ↓
fresh final reviewer가 전체 Summary 작성
```

최대 실행 수는 10명의 analyst, 10명의 evaluator, 1명의 final reviewer로 총 21 agents다.

각 Round 사이에는 전체 Conversation History를 넘기지 않는다. 대신 다음의 제한된 상태만 사용한다.

- 실제 workspace 파일
- `.ralph/progress.md`
- 이전 Round의 제한된 structured handoff
- 이전 전략 리포트 파일

### 1.2 폴더 구조

```text
packages/workflow/tool-strategy-ralph/
├── package.json
├── README.md
└── src/
    └── index.ts

~/.dsh/.agent-presets/simple-ralph/
├── agent.cordis.yml
└── skills/
    └── strategy-ralph/
        └── SKILL.md
```

Plugin 구현 파일:

```text
packages/workflow/tool-strategy-ralph/src/index.ts
```

패키지 이름:

```text
@deepseek-ai/dsh-tool-strategy-ralph
```

모델에 노출되는 Tool 이름:

```text
strategy_ralph
```

Plugin은 다음 서비스를 직접 사용한다.

```ts
inject: ['tools', 'workflowEngine', 'subagents', 'systemPrompt']
```

### 1.3 종료 조건과 검증

- 모든 전략과 Summary가 검증되면 `complete`
- 데이터 파일 또는 검증 과정에 구체적인 문제가 있으면 `blocked`
- `maxIterations`에 도달하면 실행 종료
- worker가 완료라고 말해도 evaluator가 실제 파일과 결과를 재검증
- final reviewer가 전체 리포트와 Summary를 다시 확인

Custom Plugin 내부에는 공식 Ralph Plugin import나 dependency가 없다. 반복 제어, worker/evaluator 호출, handoff, 종료 처리를 직접 작성했다.

### 1.4 핵심 코드

서비스 주입과 Tool 등록:

```ts
export const inject = [
  'tools',
  'workflowEngine',
  'subagents',
  'systemPrompt',
]

ctx.tools.register(defineTool({
  name: 'strategy_ralph',
  async execute(args, exec) {
    const run = ctx.workflowEngine.start({
      script: STRATEGY_SCRIPT,
      parent: exec.agent,
      signal: exec.signal,
      maxTotalAgents: maxIterations * 2 + 1,
    })
    return await run.result
  },
}))
```

Workflow 내부의 핵심 반복 구조:

```js
for (let i = 0; i < args.maxIterations; i += 1) {
  const worker = await agent(workerPrompt, { schema: reportSchema })
  const evaluator = await agent(evaluatorPrompt, { schema: reportSchema })
  reports.push(evaluator)
}

const summary = await agent(summaryPrompt, { schema: summarySchema })
```

실제 구현에서는 abort 처리, provider 검증, structured report 검증, workflow dispose까지 포함한다.

---

## Task 02. Custom Agent Preset에 연결하기

Custom Plugin을 실제 Agent가 사용할 수 있도록 `Simple Ralph` Agent Preset에 연결했다.

Preset의 역할은 Plugin 자체의 반복 로직을 구현하는 것이 아니라, Agent에게 다음 실행 환경을 제공하는 것이다.

- Shell과 파일 작업
- Subagent 생성
- Workflow Engine 접근
- Strategy Ralph Tool
- Strategy Ralph Skill

Preset 파일:

```text
~/.dsh/.agent-presets/simple-ralph/agent.cordis.yml
```

추가한 row:

```yaml
- id: tool-strategy-ralph
  name: '@deepseek-ai/dsh-tool-strategy-ralph'
  config:
    subagentProvider: spawn
    maxIterations: 10
```

관련 Skill:

```text
~/.dsh/.agent-presets/simple-ralph/skills/strategy-ralph/SKILL.md
```

Skill은 다음 사용 규칙을 제공한다.

- local dataset만 사용
- look-ahead bias 금지
- fee/slippage 명시
- `.ralph/progress.md` 유지
- 전략별 리포트와 전체 Summary 작성
- 실거래 금지
- historical winner를 미래 예측으로 표현하지 않기

설치 및 검증 절차:

```text
1. Creator Mode에서 Simple Ralph Preset 선택
2. Plugin package를 Profile에 추가
3. Profile rebuild/restart
4. Simple Ralph Session 시작
5. strategy_ralph Tool call 확인
6. report와 summary 파일 확인
```

Plugin 설치 성공과 실제 Tool 사용 가능 여부는 다르므로, 최종 제출에는 실제 Tool call 화면 또는 실행 로그를 별도로 포함한다.

---

## Task 03. 직접 만든 RALPH 실행하기

입력 데이터:

```text
BTCUSDT Binance 5-minute candles
최근 24시간, 288개 candle
```

데이터 파일:

```text
bitcoin-5m-24h.json
bitcoin-5m-24h.metadata.json
```

사용한 전략:

1. Buy-and-Hold baseline
2. SMA crossover
3. EMA crossover
4. RSI mean reversion
5. Bollinger Bands mean reversion
6. Donchian breakout
7. Momentum + volatility filter
8. MACD crossover
9. Grid trading simulation
10. SMA/MACD/Momentum ensemble

공통 가정:

- Fee: 편도 `0.10%`
- Adverse slippage: 편도 `0.05%`
- Long-only
- No leverage
- Indicator signal은 completed candle 기준
- 실행은 다음 candle open 기준
- 남은 position은 마지막 candle에서 정리

---

### Task 03 실행 결과

### 생성된 파일

```text
.ralph/progress.md
.ralph/investment-reports/iteration-1.md
.ralph/investment-reports/iteration-2.md
...
.ralph/investment-reports/iteration-10.md
.ralph/investment-summary.md
```

### Summary 결과

| 순위 | 전략 | 비용 반영 순수익 |
|---:|---|---:|
| 1 | Buy-and-Hold | **+2.153853%** |
| 2 | Fixed Grid | -0.049775% |
| 3 | Bollinger Bands | -0.338788% |
| 4 | MACD | -1.405617% |
| 5 | Momentum + Volatility Filter | -1.628054% |
| 6 | SMA Crossover | -1.713200% |
| 7 | Donchian Breakout | -1.812880% |
| 8 | Signal Ensemble | -2.131481% |
| 9 | EMA Crossover | -2.679412% |
| 10 | RSI Mean Reversion | 0.000000% |

전체 Summary:

```text
.ralph/investment-summary.md
```

### 실행 증거

각 iteration은 다음을 남긴다.

- worker report
- evaluator report
- backtest script 또는 실행 결과
- `.ralph/progress.md` 갱신 기록
- final summary reviewer의 비교 결과

따라서 단순히 Agent가 “완료했다”고 말한 것이 아니라, workspace 파일과 백테스트 결과를 근거로 확인할 수 있다.

### 3.1 Custom Plugin 호출 검증 상태

현재 확인된 항목:

- Plugin source TypeScript typecheck 통과
- Simple Ralph Preset에 `tool-strategy-ralph` row 등록
- `strategy-ralph` Skill 등록
- 공식 Ralph Plugin import/dependency 없음
- 동일한 Workflow orchestration을 직접 실행해 10개 전략 report와 Summary 생성

아직 별도로 남은 검증:

- 현재 실행 중인 Harness Profile은 새 package를 시작 시점에만 resolve하므로, Profile rebuild/restart 전에는 `strategy_ralph` row를 mount할 수 없다.
- 따라서 제출 시에는 rebuild/restart 후 실제 Agent Session에서 `strategy_ralph` Tool call 카드를 캡처해야 한다.

실제 Plugin 호출 후 기록할 항목:

```text
Tool: strategy_ralph
Input: datasetPath, symbol, maxIterations=10
agentsStarted: 21
result.status: complete
summaryPath: .ralph/strategy-research/summary.md
```

현재의 10회 실행 결과는 동일한 Workflow Engine 로직을 직접 검증한 실행 증거이며, Profile 재시작 후에는 위 Tool call 실행 증거로 교체하거나 보완한다.

---

## Task 04. 공식 `tool-ralph`와 비교하기

| 비교 항목 | Custom Strategy Ralph | 공식 `tool-ralph` |
|---|---|---|
| 반복 제어 | 전략 목록을 고정하고 최대 10 iteration 실행 | 하나의 objective를 최대 Round까지 반복 실행 |
| Fresh Context | 전략마다 fresh analyst + fresh evaluator | 매 Round마다 fresh child |
| 상태 전달 | workspace + progress.md + 제한된 handoff | workspace + 제한된 structured handoff |
| 완료 검증 | evaluator와 final reviewer가 재검증 | worker structured report 기반 |
| 결과물 | 전략별 Markdown 10개 + 전체 Summary | Round report + final structured result |
| 이번 실행 | 최대 21 agents | 10 fresh child Round |
| 장점 | 연구 결과의 검증과 비교가 명시적 | 범용적이고 단순함 |
| 단점 | Agent 수와 실행 시간이 더 큼 | 독립 evaluator가 없음 |

세부 실행 결과와 두 방식의 수치 비교는 다음 `7. 포인트`에서 정리한다.

---

## 7. 포인트

### 1. Suffix보다 Plugin을 통해서 실제로 더 강한 통제 요건 생성

Suffix에 “완료될 때까지 반복하라”고 적는 것만으로는 실제 iteration을 강제할 수 없다. 모델이 지침을 따르지 않거나 완료를 너무 빨리 선언할 수도 있다.

Custom Plugin은 코드에서 직접 다음을 제어한다.

- `workflowEngine.start(...)`
- iteration별 fresh worker/evaluator 생성
- structured report schema 검증
- `maxTotalAgents`와 최대 iteration 제한
- `complete`, `blocked`, `limit` 상태
- abort와 workflow dispose

Prompt는 사용 방법을 설명하고, 실제 반복과 종료는 Plugin 코드가 담당한다.

### 2. Iteration 간 대화 Context는 연결되지 않도록 진행

각 iteration은 이전 Agent의 대화 전체를 상속하지 않는 fresh Context에서 시작한다.

대신 작업의 연속성은 다음 외부 상태로 유지한다.

- shared workspace
- `.ralph/progress.md`
- 전략별 Markdown report
- 짧게 제한된 structured handoff

따라서 대화 Context는 분리하면서도 작업 결과는 연결된다. 이전 대화가 지나치게 커지는 것을 막고, 실제 파일을 source of truth로 만든다.

### 3. 전반적인 evaluator로 다시 검증

Worker의 완료 선언을 그대로 믿지 않는다.

각 iteration 뒤에 독립 evaluator가 다음을 확인한다.

- 실제 데이터와 변경 파일
- backtest 실행 결과
- look-ahead bias 여부
- fee/slippage 적용 여부
- report 파일 존재 여부
- metrics의 재현 가능성

마지막에는 final reviewer가 10개 report 전체를 비교해 Summary를 작성한다. worker → evaluator → final reviewer의 검증 단계가 있기 때문에 단순 self-report보다 강한 확인이 가능하다.

### 같은 요청을 공식 `tool-ralph`로 실행한 결과

같은 BTCUSDT 5분봉 데이터, 같은 10개 전략, 같은 fee/slippage 조건으로 공식 `tool-ralph`를 최대 10 Round 실행했다.

- 10 Round 완료
- 10개 전략 report 생성
- `summary.md`와 `progress.md` 생성
- 최종 ensemble 결과: `+0.27%`
- 공식 실행에서도 Buy-and-Hold가 1위: `+2.15%`

공식 결과 저장 위치:

```text
.ralph/tool-ralph-comparison/strategy-01-*.md
.ralph/tool-ralph-comparison/strategy-10-*.md
.ralph/tool-ralph-comparison/summary.md
.ralph/tool-ralph-comparison/progress.md
```

| 순위 | 전략 | 공식 `tool-ralph` 순수익 |
|---:|---|---:|
| 1 | Buy-and-Hold | **+2.15%** |
| 2 | EMA Crossover | **+1.23%** |
| 3 | Signal Ensemble | **+0.27%** |
| 4 | Grid Trading | **+0.02%** |
| 5 | RSI Mean Reversion | 0.00% |
| 6 | SMA Crossover | -0.21% |
| 7 | Bollinger Bands | -0.34% |
| 8 | Donchian Breakout | -0.92% |
| 9 | MACD Crossover | -1.40% |
| 10 | Momentum + Volatility Filter | -3.71% |

두 실행 모두 Buy-and-Hold가 1위였지만 일부 전략의 수치는 달랐다. 이는 Plugin의 우열이라기보다 Agent가 선택한 세부 파라미터, signal timing, 체결 규칙, backtest 구현 방식의 차이 때문이다. 다음 비교에서는 전략별 알고리즘과 parameter를 고정한 동일 runner를 사용하는 것이 좋다.

```text
공식 tool-ralph:
fresh worker → structured handoff → 다음 fresh worker

Custom Strategy Ralph:
fresh worker → independent evaluator → report 저장
             → 다음 strategy → final reviewer
```

---

## 8. 추가로 보면 좋은 항목

현재 결과만으로는 전략의 우수성을 판단하기 어렵다. 다음 측정이 필요하다.

### 8.1 다음 비교에서 더 측정할 Harness 지표

이번에는 두 실행 모두 10 Round까지 완료했고, 공식 실행은 10 fresh child를 사용했다. Custom 실행은 analyst 10명, evaluator 10명, final reviewer 1명으로 최대 21 agents를 사용한다.

다음 비교에서는 아래 지표를 함께 기록하면 좋다.

- 실제 Round 수
- 총 child agent 수
- Tool 호출 수
- 총 token 사용량
- 실행 시간
- 최종 파일 차이
- 완료 판단 시점
- 오류/재시도 횟수
- evaluator가 발견한 오류 수
- iteration 간 handoff 크기

### 8.2 공통 equity curve

현재 각 리포트는 최종 수익률 중심이다. 다음에는 모든 전략이 동일한 candle 단위 equity curve를 저장해야 한다.

그러면 다음을 공통 기준으로 계산할 수 있다.

- Sharpe ratio
- Sortino ratio
- maximum drawdown
- Calmar ratio
- win rate
- profit factor
- average trade
- exposure
- turnover

### 8.3 Out-of-sample 검증

24시간 데이터를 train/test로 나누거나 기간을 확장한다.

예:

```text
70%: parameter selection
30%: untouched evaluation
```

### 8.4 Walk-forward 검증

한 번의 결과가 아니라 여러 구간에서 반복 검증한다.

```text
window 1 → train/test
window 2 → train/test
window 3 → train/test
```

### 8.5 비용 민감도

Fee와 slippage를 바꾸면서 결과가 얼마나 변하는지 확인한다.

```text
0.00%
0.05%
0.10%
0.20%
```

### 8.6 Plugin 자체의 성능 비교

전략 결과가 아니라 Harness 관점에서도 비교한다.

- 같은 작업을 몇 개의 Agent가 수행했는가?
- 독립 evaluator가 오류를 발견했는가?
- handoff 크기가 얼마나 되었는가?
- Context 재사용과 fresh Context 중 어느 쪽이 효율적인가?
- 실패한 worker를 어떻게 처리했는가?
- 사용자가 중간 취소했을 때 정상적으로 정리되는가?

---

## 9. 현재 구현의 한계

1. 현재 데이터는 24시간뿐이다.
2. 전략 파라미터를 out-of-sample으로 검증하지 않았다.
3. OHLCV만으로는 intrabar 체결 순서를 정확히 알 수 없다.
4. Spread, latency, liquidity, funding, tax를 모델링하지 않았다.
5. 모든 전략에 완전히 동일한 equity curve 형식이 아직 없다.
6. 두 실행의 전략별 세부 파라미터와 backtest 구현이 완전히 동일하지 않아 수치 비교에는 해석상 한계가 있다.
7. 현재 실행 중인 Harness 프로세스는 새 패키지를 재시작 전에는 resolve하지 못하므로, Custom Plugin 실제 호출 증거를 만들려면 Profile rebuild/restart가 필요하다.

---

## 10. 결론

이번 구현의 핵심은 단순히 반복을 요청하는 Prompt를 작성한 것이 아니라, Plugin 코드에서 실제 반복 실행을 제어했다는 점이다.

```text
Fresh Context
+ Shared Workspace
+ Structured Handoff
+ Independent Evaluation
+ Explicit Termination
```

공식 `tool-ralph`는 범용 objective 반복에 적합하고, Custom Strategy Ralph는 여러 전략을 동일 데이터에 적용하고 결과를 검증·비교하는 연구 작업에 적합하다.

따라서 어느 쪽이 항상 더 우수하다고 말하기보다는, 작업의 목적에 따라 적합한 orchestration 구조가 달라진다고 결론 내릴 수 있다.

**이번 결과는 투자 추천이 아니라, RALPH Plugin 설계와 반복 실행 구조를 검증하기 위한 연구 결과다.**
