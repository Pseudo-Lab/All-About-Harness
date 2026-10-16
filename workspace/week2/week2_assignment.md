# Week 02 — Build Your Own RALPH

> **이번 주 목표:** DeepSeek Harness의 **Creator Mode**로 **Custom RALPH Preset 1개와 검증용 Custom Plugin 1개**를 직접 만들고, 실제 작업에서 검증한 뒤 **공식 `tool-ralph`**와 비교합니다.

지난주에는 동일한 작업을 **Standard / Minimal Preset**에서 실행하며 하네스의 차이를 살펴봤습니다. 이번 주에는 직접 하네스를 구성하고 실험해 봅니다.

## 1. 과제 소개

**주제는 자유입니다.** 글쓰기, 코드 작성, 리서치, 문서 정리 등 반복적으로 점검하고 개선할 수 있는 작업을 선택해 주세요.

이번 과제에서는 **RALPH의 반복 실행 구조**를 설계하는 동시에, **작업 결과를 검증하는 Custom Plugin을 최소 1개 직접 만드는 것**을 필수 목표로 합니다. 결과물의 완성도뿐 아니라 반복 실행, 상태 전달, 검증 결과 활용, 종료 판단을 관찰해 봅니다.

**필수 구현 목표**

- **Custom RALPH Preset 1개** — 반복 실행을 위한 구성 또는 제어 로직 연결
- **Custom Plugin 1개 이상** — 선택한 작업의 결과를 검사하는 실제 동작 가능한 기능 구현
- **실행 및 비교** — Custom RALPH로 작업을 수행하고 공식 `tool-ralph`와 비교

### Task 01. Creator Mode로 Custom RALPH 만들기

DeepSeek Harness의 Creator Mode를 이용해 **RALPH 방식의 반복 실행을 지원하는 Custom Agent Preset**을 제작해 주세요.

다음 요소를 고려해 구성해 보면 좋습니다.

- **반복 실행:** 작업이 완료되지 않았다면 다음 Round를 시작하는 방식
- **Context 관리:** Round마다 새 Context를 사용할지, 이전 대화를 유지할지에 대한 설계
- **상태 전달:** Workspace의 파일, 진행 기록, 구조화된 Handoff 등으로 이전 결과를 전달하는 방법
- **종료 조건:** 완료, 진행 불가, 최대 반복 횟수에 따른 중단 기준

> **중요:** 프롬프트에 “반복해서 개선해”라고 적는 것만으로 새로운 실행 루프가 만들어지지는 않습니다. Preset이 어떤 Plugin / Workflow / Subagent 기능을 활용해 반복 실행을 구현하는지 확인해 주세요. Fresh Context를 구현하지 못했다면 그 차이와 한계를 명시해도 좋습니다.

### Task 02. 검증용 Custom Plugin 1개 만들기 **(필수)**

Creator Mode에서 **직접 만든 Plugin을 최소 1개 구현해 설치하고**, Custom RALPH에서 활용해 보세요. 이번에는 **RALPH가 작업을 제대로 완료했는지 확인하는 검증 기능**을 추천합니다.

- 단순히 프롬프트에 검증 기준을 적는 대신, **실제로 호출할 수 있는 Plugin / Tool 기능**으로 구현해 보세요.
- 검증 대상과 판단 기준을 정하고, 결과를 **통과/실패, 점수, 미충족 항목 등 확인 가능한 형태**로 반환하도록 만들어 보세요.
- Plugin을 설치 또는 활성화한 뒤, **실제 호출 로그와 반환 결과**를 확인해 주세요.
- 검사 결과를 RALPH가 다음 Round에서 참고하거나 완료 여부를 판단하는 데 어떻게 활용하는지도 기록해 주세요.

**검증 Plugin 예시 (선택 사항)**

| 적용 분야 | Custom Plugin 아이디어 | 확인할 내용 |
|---|---|---|
| 글쓰기 | `writing-checker` | 글자 수, 필수 섹션, 지정된 키워드 등 객관적 조건 검사 |
| 코딩 | `test-verifier` | 테스트 실행 결과, 실패한 케이스, 종료 코드 정리 |
| 리서치 | `source-validator` | 참고문헌 URL·인용 형식·누락 여부 검사 |
| 공통 | `progress-checker` | 작업 체크리스트 및 완료 조건 충족 여부 기록 |

> **검증의 범위:** 글자 수나 섹션 유무를 통과했다고 해서 글의 질까지 보장되는 것은 아닙니다. Plugin이 **객관적으로 확인한 조건**과 사람 또는 별도 평가가 필요한 판단을 구분해 주세요. Plugin이 자체 구현한 실제 기능 없이 공식 `tool-ralph`를 단순 호출하는 경우는 이번 Custom Plugin 제작 목표로 보지 않습니다.

### Task 03. 만든 RALPH로 실제 작업 수행하기

원하는 작업을 하나 선택하고 **Custom Plugin을 연결한 Custom RALPH**로 실행해 보세요.

**작업 예시 (선택 사항)**

- **Writing RALPH:** 글 작성 → 검토 → 수정
- **Coding RALPH:** 기능 구현 → 테스트 → 오류 수정
- **Research RALPH:** 자료 조사 → 근거 확인 → 보완

가능하면 **2회 이상 Round가 진행되는 작업**을 선택해 반복 구조를 관찰해 주세요. 한 번에 종료된다면 왜 그렇게 판단했는지도 좋은 분석 대상입니다. **검증용 Plugin이 언제 호출되었고, 결과가 다음 실행이나 완료 판단에 어떻게 반영되었는지** 남겨 주세요.

### Task 04. 공식 `tool-ralph`와 비교하기

**Task 03과 동일한 작업**을 DeepSeek Harness의 공식 `tool-ralph`로도 실행해 보세요.

비교를 위해 가능한 한 아래 조건을 맞춰 주세요.

- 동일한 **모델**과 **작업 지시문** 사용
- 파일 작업이라면 **동일한 초기 파일 상태**에서 각각 시작
- **최대 Round 수**를 같게 설정 (예: 5회)
- 두 실행의 로그와 결과물을 **각각 보관**

공식 `tool-ralph`는 매 Round에 **새 Child Agent**를 실행하고, **공유 Workspace와 제한된 Handoff**로 진행 상황을 전달하는 구조입니다. 생성한 Custom RALPH와 이 방식이 어떻게 다른지 살펴보세요.

검증 비교는 **두 실행의 최종 결과물에 같은 검사 기준을 적용**하는 것을 권장합니다. 가능하다면 만든 검증 Plugin으로 양쪽 결과물을 각각 검사해 보고, 공식 RALPH 실행 도중에도 해당 Plugin을 사용하게 했는지는 별도로 구분해 적어 주세요. 

> **공정한 비교를 위해:** Custom RALPH 내부에서 공식 `tool-ralph`를 그대로 호출했다면 두 실행이 같은 반복 엔진을 사용할 수 있습니다. 이 경우에는 **반복 엔진 비교**가 아니라 **Preset 설정·Prompt·Tool 조합 비교**라는 점을 명시해 주세요.

## 2. 비교 항목

| 비교 항목 | Custom RALPH | 공식 `tool-ralph` |
|---|---|---|
| 반복 실행 방식 |  |  |
| Context 초기화 / 유지 |  |  |
| 이전 작업 결과 전달 방식 |  |  |
| 실제 실행 Round 수 |  |  |
| 완료 및 중단 판단 |  |  |
| 검증용 Custom Plugin 호출 및 결과 |  |  |
| 검증 실패 후 재작업 여부 |  |  |
| Tool 호출 / Token 사용량 *(확인 가능할 경우)* |  |  |
| 최종 결과 및 발견한 문제 |  |  |

단순히 어느 쪽이 더 좋았는지보다 **왜 서로 다르게 동작했는지**를 중심으로 작성해 주세요. 공식 RALPH의 완료 보고 역시 별도의 독립 평가 결과가 아닌 에이전트의 보고라는 점을 참고해 주세요.

## 3. 제출 내용

아래 내용을 간단하게 정리해 주세요. 형식은 자유입니다.

1. **Custom RALPH 소개** — 목적, Preset 구성, 반복 실행 구현 방식
2. **Custom Plugin 소개** — Plugin이 검사하는 조건, 주요 구현 내용, 설치·연결 방식 및 실제 호출 결과
3. **실행 과정** — 테스트 작업, 주요 Round별 진행 상황, 검증 실패 후 수정 여부, 로그 또는 스크린샷
4. **공식 `tool-ralph` 비교** — 동일 작업과 검증 기준으로 비교한 결과 및 차이점
5. **결론** — 잘 동작한 점, 한계, 개선 아이디어

**제출 시 반드시 포함:** Custom Preset 설정 또는 관련 코드, 직접 구현한 Plugin 코드/설정, **Plugin 실행 증거**(로그·출력·스크린샷 중 하나), 실험 비교 요약. 작업용 Repository 또는 GitHub 링크를 첨부해 주세요.

- **제출 위치:** [All About Harness GitHub](https://github.com/Pseudo-Lab/All-About-Harness) 내 `workspace/week2/<GitHub ID>/` *(폴더 구조 예시)*
- **제출 기한:** 다음 스터디 시작 전, **수요일 21:00**

## 4. 참고 자료

- [DeepSeek Harness — GitHub](https://github.com/deepseek-ai/deepseek-harness)
- [Creator Mode의 Preset 구성](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/README.md)
- [Creator Mode의 Plugin Manager](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/boot/plugin-manager/README.md)
- [공식 `tool-ralph` 설명](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/experimental/tool-ralph/README.md)

---

**이번 주에 함께 이야기해 볼 질문**

> 내가 만든 **검증용 Plugin**이 RALPH의 수정과 종료 판단에 어떤 영향을 주었을까요? 같은 작업에서 Custom RALPH와 공식 `tool-ralph`는 어떤 차이를 보였을까요?
