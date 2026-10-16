# Week 02 — Build Your Own RALPH

> **이번 주 목표:** DeepSeek Harness의 **Creator Mode**로 **RALPH 방식의 반복 실행을 구현한 Custom Plugin을 최소 1개** 직접 만들고, 해당 Plugin을 사용하는 **Agent Preset**을 구성해 실제 작업에 적용한 뒤 **공식 `tool-ralph`**와 비교합니다.

지난주에는 동일한 작업을 **Standard / Minimal Preset**에서 실행하며 하네스 구성에 따른 차이를 살펴봤습니다. 이번 주에는 직접 실행 방식을 설계하고 만들어봅니다.

## 1. 과제 소개

**활용 주제는 자유입니다.** 글쓰기, 코드 작성, 리서치, 문서 정리처럼 여러 번 시도하거나 수정할 수 있는 작업을 골라주세요.

이번 과제에서 직접 만들 Plugin은 **RALPH의 반복 실행을 담당하는 Plugin**입니다. 검증 기능은 필요에 따라 추가할 수 있지만 필수는 아닙니다.

**필수 목표**

- **Custom RALPH Plugin 1개:** 작업을 여러 Round에 걸쳐 실행하고, 다음 Round로의 진행과 종료를 제어하는 기능 구현
- **Custom Agent Preset 1개:** 만든 Plugin을 연결한 에이전트 구성
- **실제 실행 및 비교:** 자유롭게 선택한 작업을 수행하고 공식 `tool-ralph`와 결과 및 동작 방식 비교

### Task 01. Creator Mode로 Custom RALPH Plugin 만들기

Creator Mode를 이용해 **RALPH 방식의 반복 실행을 제어하는 Custom Plugin**을 직접 구현해 보세요. 공식 `tool-ralph`를 그대로 연결하는 것보다, **반복 로직을 어떤 방식으로 구현했는지** 확인할 수 있는 것이 중요합니다.

최소한 다음 세 가지 기능을 구현하는 것을 목표로 합니다.

1. **반복 실행:** 작업이 끝나지 않았다면 다음 Round를 시작할 것
2. **상태 전달:** 이전 Round의 작업 결과나 진행 상황을 다음 Round에서 활용할 것
3. **종료 조건:** 완료 또는 최대 반복 횟수에 도달했을 때 실행을 멈출 것

가능하다면 다음 요소도 고려해 보세요.

- **Fresh Context:** Round마다 새로운 Child Agent / Session을 생성하는가? 아니면 같은 대화의 Context를 유지하는가?
- **Handoff:** 파일, Workspace, 구조화된 보고서 등 무엇을 다음 Round로 넘기는가?
- **실패 처리:** Tool 오류, 진행 불가, 사용자 취소 시 어떻게 종료하는가?
- **완료 검증:** 완료 선언을 그대로 믿는가, 테스트나 명시적인 기준으로 확인하는가?

> **중요:** System Prompt에 “완료될 때까지 반복해”라고 적는 것만으로는 **반복 실행 Plugin**이 구현된 것이 아닙니다. 여러 Round를 실제로 시작하고 종료시키는 제어 로직이 있어야 합니다. Fresh Context까지 구현하기 어렵다면, **같은 세션에서 반복하는 구조**를 구현하고 공식 RALPH와의 차이 및 한계를 설명해도 됩니다.

> **공식 구현과 구분:** 이번 Custom Plugin은 **공식 `tool-ralph`를 단순 호출하는 래퍼**로 만들지 않습니다. 반복 실행을 제어하는 부분을 직접 설계해 보세요.

### Task 02. Custom Agent Preset에 연결하기

직접 구현한 Plugin을 **Creator Mode에서 설치 또는 활성화**하고, 이를 사용하는 **Custom Agent Preset**을 만들어 보세요.

- Preset에서 어떤 Plugin과 Tool을 사용하도록 구성했는지 확인
- 만든 Custom RALPH Plugin이 실제로 호출되는지 확인
- 실행 로그 또는 결과 화면을 통해 반복 동작 확인

Plugin의 설치 성공과 실제 사용 가능 여부는 다를 수 있으므로, **실제로 한 번 이상 호출해 동작을 확인**해 주세요.

### Task 03. 직접 만든 RALPH 실행하기

만든 Preset으로 원하는 작업을 하나 실행해 보세요.

| 예시 | 반복할 작업 |
|---|---|
| **Writing RALPH** | 초안 작성 → 검토 → 수정 |
| **Coding RALPH** | 기능 구현 → 테스트 → 오류 수정 |
| **Research RALPH** | 자료 조사 → 부족한 근거 확인 → 보완 |

가능하면 **2회 이상 Round가 발생하는 작업**을 선택해 보세요. 한 번에 종료되었다면 어떤 기준으로 그렇게 판단했는지도 기록해 주세요.

**관찰할 내용:** 각 Round에서 무엇을 했는지, 이전 상태가 어떻게 전달되었는지, 언제·왜 종료했는지.

### Task 04. 공식 `tool-ralph`와 비교하기

**Task 03에서 실행한 동일한 작업**을 공식 `tool-ralph`로도 실행해 보세요.

비교 조건은 가능한 한 통일해 주세요.

- 동일한 **모델**과 **작업 지시문** 사용
- 파일 작업은 **동일한 초기 Workspace 상태**에서 각각 시작
- 가능한 한 **최대 Round 수**를 동일하게 설정 (예: 5회)
- 두 실행의 **로그와 최종 결과물을 각각 보관**

공식 `tool-ralph`는 매 Round마다 새로운 Child Agent를 실행하고, **공유 Workspace와 제한된 구조화 Handoff**로 진행 상황을 전달합니다. 직접 만든 Plugin은 어떤 구조를 택했고, 그 선택 때문에 결과가 어떻게 달라졌는지 살펴보세요.

> **참고:** 공식 `tool-ralph`의 완료 여부는 작업 에이전트의 보고를 기반으로 하며, 별도의 독립 평가기가 완성을 보증하지는 않습니다. 가능한 경우 최종 산출물은 사람의 검토나 같은 체크리스트를 사용해 따로 평가해 주세요.

## 2. 비교 항목

| 비교 항목 | Custom RALPH Plugin | 공식 `tool-ralph` |
|---|---|---|
| 반복 실행 제어 방식 |  |  |
| 새 Context 생성 여부 |  |  |
| 이전 Round 상태 전달 방식 |  |  |
| 실행된 Round 수 |  |  |
| 완료 및 종료 조건 |  |  |
| 오류·진행 불가 처리 |  |  |
| Tool 호출 / Token 사용량 *(확인 가능할 경우)* |  |  |
| 최종 결과 및 발견한 한계 |  |  |

**핵심은 어느 쪽이 더 우수한지 단정하는 것이 아니라, 서로 다른 하네스 설계가 에이전트의 실제 동작에 어떤 차이를 만들었는지 확인하는 것**입니다.

## 3. 제출 내용

형식은 자유입니다. 아래 내용을 간단하게 정리해 주세요.

1. **Custom RALPH 소개:** 어떤 목적으로 만들었고, 반복 실행을 어떻게 구현했는지
2. **Plugin 및 Preset 구성:** 직접 작성한 Plugin 코드·설정, Preset 연결 및 설치 방법
3. **실행 기록:** 사용한 작업, Round별 진행 상황, 실제 Plugin 호출 로그나 스크린샷
4. **공식 `tool-ralph` 비교:** 동일 작업으로 실행한 결과와 구조적 차이
5. **결론:** 잘 동작한 점, 구현 과정에서 어려웠던 점, 개선할 부분

**반드시 포함할 것:** Custom RALPH **Plugin 코드/설정**, 이를 사용하는 **Preset 구성**, **실제 반복 실행 증거**, **공식 `tool-ralph` 비교 요약**.

- **제출 위치:** [All About Harness GitHub](https://github.com/Pseudo-Lab/All-About-Harness) → `workspace/week2/<GitHub ID>/` *(예시 경로)*
- **제출 방식:** 작업 내용을 정리해 **Pull Request(PR)** 제출
- **제출 기한:** 다음 스터디 시작 전 **수요일 21:00**

## 4. 참고 자료

- [DeepSeek Harness — GitHub](https://github.com/deepseek-ai/deepseek-harness)
- [Creator Mode의 Preset 구성](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/README.md)
- [Creator Mode의 Plugin Manager](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [공식 `tool-ralph` 설명 및 구현](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/tool-ralph/README.md)

---

**이번 주에 함께 이야기해 볼 질문**

> 내가 직접 만든 RALPH Plugin은 **어떤 방식으로 반복 실행을 제어했는가?** 그리고 공식 `tool-ralph`와 비교했을 때 **Context 관리, 상태 전달, 종료 조건**에서 어떤 차이가 있었는가?
