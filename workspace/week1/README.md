# Week 1 — Creator, Standard, Minimal

첫 주에는 DeepSeek Harness의 세 가지 Agent preset이 같은 요청을 어떻게 다르게 처리하는지 살펴봅니다.

## 비교 대상

| UI 이름 | 내부 preset ID | 핵심 구성 |
|---|---|---|
| Creator mode | `cordis` | Standard의 전체 기능 + 런타임 검사, plugin 실험, custom preset 제작 지원 |
| Standard mode | `standard` | 파일 편집, Shell, 검색, Skill, Plan, Goal, Subagent, Workflow를 제공하는 전체 coding agent |
| Minimal mode | `minimal` | 고정 system prompt와 persistent shell만 제공하는 단일-tool agent |

PTC mode는 이번 주 비교에서 제외합니다.

## 이번 주 질문

1. 세 모드는 같은 요청에서 최종 output을 어떻게 다르게 작성하는가?
2. 문제를 이해하고 해결하기까지 어떤 trajectory를 거치는가?
3. 제공되는 도구의 차이가 실제 도구 선택과 작업 순서에 어떤 영향을 주는가?
4. Creator는 실제로 Cordis runtime 검사나 plugin 기능을 사용하는가?
5. Minimal은 전용 도구가 없는 작업을 persistent shell로 어떻게 대체하는가?

## 비교 방법

같은 모델, 같은 workspace, 같은 권한 설정, 같은 prompt를 사용해 각각 새로운 세션을 만듭니다. 세션을 시작하기 전에 preset을 선택하고, 실행 도중에는 추가 힌트나 후속 prompt를 주지 않습니다.

각 실행에서 다음 두 부분을 따로 기록합니다.

### Output

- 최종 답변의 정확성
- 요청 완료 여부
- 만들어지거나 변경된 결과물
- 검증 결과와 남은 한계
- 설명의 구체성과 신뢰성

### Trajectory

- 첫 행동과 문제 접근 방식
- 호출한 도구와 호출 순서
- 파일 탐색 및 수정 방식
- 실패한 호출과 복구 과정
- 테스트 및 검증 방식
- 총 tool call, model request, token, latency
- 반복되거나 불필요했던 행동

## 기록표

| 항목 | Creator | Standard | Minimal |
|---|---|---|---|
| 최종 결과 | | | |
| 작업 성공 여부 | | | |
| 첫 행동 | | | |
| 주요 도구 | | | |
| Tool call 수 | | | |
| Model request 수 | | | |
| 실패와 복구 | | | |
| 테스트/검증 | | | |
| Token 사용량 | | | |
| 실행 시간 | | | |
| 특징적인 행동 | | | |

## 실행 기록 수집

각 세션이 끝나면 다음을 보관합니다.

- 최종 응답
- Trajectory 화면의 주요 단계
- `/export`로 내려받은 session log
- 변경된 파일 또는 생성된 결과물
- 위 기록표에 들어갈 정량 지표

한 번의 실행만으로 어느 mode가 더 좋다고 결론 내리기보다, 첫 주에는 세 mode가 문제를 바라보고 도구를 사용하는 방식의 차이를 관찰하는 데 집중합니다.
