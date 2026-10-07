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
├── workspace/
│   ├── week1/      # 주차별 실습과 실행 결과
│   ├── experiments/# Harness / Skill / Tool 비교 실험
│   ├── analysis/   # Harness 구조 분석 및 학습 자료
│   ├── skills/     # 직접 만든 Skill
│   └── presets/    # Preset Agent
├── deepseek-harness/ # 로컬 Harness 소스(Git에서 제외)
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

## Local Development Setup

All-About-Harness의 로컬 폴더는 학습 결과물과 실행 가능한 DeepSeek Harness 소스를 분리해서 관리합니다.

```text
All-About-Harness/
├── workspace/          # 주차별 실습, 실행 결과, 비교 분석
│   └── week1/
├── deepseek-harness/   # 별도로 clone한 DeepSeek Harness 소스코드
├── setup.sh
└── README.md
```

`deepseek-harness/`는 자체 `.git`을 가진 별도 저장소이며, 최상위 `.gitignore`에서 제외됩니다. 따라서 로컬에서는 한 폴더처럼 사용할 수 있지만 All-About-Harness GitHub에는 DeepSeek Harness 소스가 포함되지 않습니다.

### 처음 설정하기

```bash
git clone https://github.com/Pseudo-Lab/All-About-Harness.git
cd All-About-Harness
./setup.sh
```

`setup.sh`는 `All-About-Harness/deepseek-harness`에 소스 저장소를 clone하고 프로젝트가 선언한 pnpm 버전으로 의존성을 설치한 뒤, 이전 산출물을 정리하고 Web UI까지 실행 가능한 상태로 빌드합니다. pnpm 명령이 없으면 Corepack을 사용하고, Corepack도 없으면 Node.js에 포함된 npx로 해당 pnpm 버전을 일회성 실행하므로 pnpm을 미리 전역 설치할 필요가 없습니다. 즉, npx가 내려받은 DSH 패키지 캐시를 직접 수정하는 대신 Git으로 관리되는 소스 checkout을 실행 환경으로 사용합니다.

현재 기준 버전은 로컬 npx에서 확인한 `@deepseek-ai/dsh@0.1.5-rc.3`입니다. [POQOPO/deepseek-harness](https://github.com/poqopo/deepseek-harness)는 이에 대응하는 Git tag `dsh-v0.1.5-rc.3`에서 fork되었고, 기본 작업 브랜치는 `study/npx-0.1.5-rc.3`입니다. setup도 이 tag와 브랜치를 검증하므로 팀원이 서로 다른 기반 버전을 받는 일을 방지합니다.

버전을 의도적으로 바꿀 때는 npm 버전과 Git tag를 함께 지정합니다.

```bash
DEEPSEEK_HARNESS_VERSION=0.1.5-rc.3 \
DEEPSEEK_HARNESS_REF=dsh-v0.1.5-rc.3 \
  ./setup.sh
```

의존성 설치와 빌드 없이 저장소 구성만 확인하려면 다음과 같이 실행합니다.

```bash
./setup.sh --skip-install
```

설치만 하고 빌드를 생략하려면 `./setup.sh --skip-build`를 사용합니다. 정상 setup이 끝난 뒤 Web UI는 다음 명령으로 실행합니다.

```bash
cd deepseek-harness
npm run dsh -- web
```

기본 주소는 `http://127.0.0.1:3080`이며, 터미널에 출력되는 `?token=...`이 포함된 전체 URL로 접속해야 합니다.

### 팀 fork 사용하기

DeepSeek Harness 자체의 변경사항은 프로젝트 fork인 `POQOPO/deepseek-harness`에서 공유합니다. setup의 기본 clone 주소가 이미 이 fork로 설정되어 있습니다.

```bash
./setup.sh
```

remote 역할은 다음과 같습니다.

```bash
cd deepseek-harness
git remote -v
# origin   https://github.com/poqopo/deepseek-harness.git
# upstream https://github.com/deepseek-ai/deepseek-harness.git
```

이후 Harness 소스 변경은 `deepseek-harness` fork의 브랜치에, 학습 기록과 실험 자료는 `All-About-Harness`의 브랜치에 각각 commit합니다.

경로를 다르게 두고 싶다면 `DEEPSEEK_HARNESS_DIR`도 지정할 수 있습니다.

```bash
DEEPSEEK_HARNESS_DIR=/absolute/path/to/deepseek-harness ./setup.sh
```

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
