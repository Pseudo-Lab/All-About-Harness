# All About Harness

> **좋은 Agent를 만드는 것은 무엇일까?**

**All About Harness**는 DeepSeek Harness를 직접 분석하며 Agent를 구성하는 Harness, Skill, Tool 등의 요소가 Agent의 동작과 성능에 어떤 영향을 주는지 공부하고 실험하는 프로젝트입니다.

단순히 DeepSeek Harness의 사용법을 익히는 것에서 끝나지 않고, **잘 동작하는 Agent Harness의 조건을 찾아보고 직접 활용할 수 있는 Harness와 Preset Agent를 만드는 것**을 목표로 합니다.

📎 [Project Page](https://pseudo-lab.com/projects/d48a8689-f2a3-4d8e-9c7e-96f7321f9125)

---

## Why Harness?

최근에는 같은 LLM을 사용하더라도 어떤 환경에서 Agent를 실행하는지에 따라 결과가 크게 달라지고 있습니다.

Agent는 단순히 Model만으로 동작하지 않습니다.

```text
Model
  ↓
Harness
  ├─ Prompt / Context
  ├─ Tool
  ├─ Skill
  ├─ Memory
  ├─ Agent Loop
  └─ Permission / Runtime
  ↓
Agent Behavior
```

그렇다면 이런 질문을 해볼 수 있습니다.

* 같은 Model이라도 Harness가 달라지면 Agent의 성능은 얼마나 달라질까?
* Skill과 Tool은 Agent의 행동을 어떻게 변화시킬까?
* 좋은 Harness는 어떤 구조를 가져야 할까?
* 특정 작업에 특화된 Agent를 어떻게 재사용 가능한 형태로 만들 수 있을까?

**All About Harness는 이 질문들을 직접 구현하고 실험하며 답을 찾아가는 프로젝트입니다.**

---

## Goals

### 1. Understand Agent Harness

DeepSeek Harness를 직접 뜯어보며 Agent가 Model, Tool, Skill, Context와 어떻게 상호작용하는지 이해합니다.

### 2. Experiment with Harness

Model과 Task를 고정하고 Harness, Skill, Tool 등의 구성을 변경하며 Agent의 동작과 성능 차이를 비교합니다.

### 3. Build Our Own Harness

분석과 실험을 바탕으로 실제로 사용할 수 있는 Harness와 특정 작업에 특화된 **Preset Agent**를 만들어봅니다.

---

## What We Study

프로젝트에서는 DeepSeek Harness를 중심으로 다음 내용을 살펴봅니다.

### Harness Architecture

* Agent와 Harness의 관계
* Agent Loop
* Model Adapter
* Tool System
* Context & Session
* Permission & Guard
* Planning

### Cordis

DeepSeek Harness의 기반이 되는 Cordis의 **Everything is a Plugin** 구조를 살펴봅니다.

```text
Cordis

├─ LLM Plugin
├─ Tool Plugin
├─ Agent Loop Plugin
├─ Session Plugin
├─ Prompt Plugin
└─ Permission Plugin
```

Plugin, Service, Event, Effect, Lifecycle 등의 구조를 분석하며 Agent Runtime을 어떻게 확장 가능한 구조로 설계했는지 알아봅니다.

### Skill & Preset

Agent가 특정 작업을 더 잘 수행하도록 만드는 Skill의 구조를 살펴보고 직접 만들어봅니다.

여러 Skill과 Tool, Prompt 구성을 묶어 특정 목적에 맞는 **Preset Agent**를 설계하고 구현합니다.

---

## Experiments

Harness의 구성 요소가 실제 Agent 성능에 어떤 영향을 주는지 직접 비교합니다.

예를 들어 다음과 같은 실험을 진행할 수 있습니다.

```text
Same Model
Same Task
Same Dataset

        ↓

Harness A
Prompt Only

Harness B
Prompt + Tools

Harness C
Prompt + Tools + Skill

Harness D
Custom Harness

        ↓

Compare
```

실험에서는 다음과 같은 지표를 활용할 예정입니다.

* Task Success Rate
* Tool Selection Accuracy
* Number of Tool Calls
* Token Usage
* Latency
* Failure / Recovery
* Output Quality

실험 방식과 평가 기준은 프로젝트를 진행하며 계속 개선합니다.

---

## Roadmap

### Phase 1 — Understand

DeepSeek Harness와 Agent Harness의 기본 구조를 이해합니다.

* Agent와 Harness
* DeepSeek Harness Architecture
* Cordis
* Plugin / Service / Event
* Agent Loop

### Phase 2 — Build

Harness의 주요 구성 요소를 직접 사용하고 구현해봅니다.

* Tool
* Skill
* Context
* Plugin
* Agent 구성

### Phase 3 — Experiment

같은 Model과 Task에서 Harness 구성을 변경하며 성능 차이를 비교합니다.

* Harness 비교
* Skill 비교
* Tool 구성 비교
* Agent Behavior 분석
* Evaluation

### Phase 4 — Create

실험 결과를 바탕으로 직접 활용할 수 있는 결과물을 만듭니다.

* Custom Harness
* Preset Agent
* Example Agent
* Usage Guide
* Experiment Report

---

## Outputs

프로젝트에서 공부하고 실험한 내용은 가능한 한 재사용할 수 있는 형태로 공개합니다.

```text
All-About-Harness
│
├── docs/           # Harness 구조 분석 및 학습 자료
├── experiments/    # Harness / Skill / Tool 비교 실험
├── skills/         # 직접 만든 Skill
├── presets/        # Preset Agent
├── examples/       # 실행 예제
└── README.md
```

최종적으로 다음 결과물을 남기는 것을 목표로 합니다.

* DeepSeek Harness Architecture Guide
* Harness / Skill / Tool Experiment Results
* Custom Skills
* Preset Agents
* Harness Implementation Guide
* Reusable Agent Examples

---

## How We Work

이 프로젝트는 **Study + Build + Experiment** 방식으로 진행합니다.

```text
Learn
  ↓
Analyze
  ↓
Build
  ↓
Experiment
  ↓
Share
```

단순히 자료를 읽는 것보다 직접 코드를 실행하고 수정하면서 구조를 이해하는 것을 중요하게 생각합니다.

실험 과정에서 나온 성공 사례뿐 아니라 **잘 동작하지 않았던 구조와 시행착오도 함께 기록**합니다.

---

## Contributing

Agent Harness, Skill, Tool, Agent Evaluation과 관련해 함께 실험해보고 싶은 아이디어가 있다면 언제든 Issue나 Discussion으로 공유해주세요.

다음과 같은 질문도 환영합니다.

* 이런 Harness 구성도 비교해보면 어떨까요?
* 이런 Agent Task로 실험해보면 어떨까요?
* 이 Skill은 다른 환경에서도 잘 동작할까요?
* LangChain / LangGraph / Claude Code와 비교하면 어떨까요?

---

## Team

**PseudoLab 13th Season — All About Harness**

좋은 Agent를 만드는 것이 더 좋은 Model인지, 더 좋은 Harness인지 직접 확인해봅니다. 🚀