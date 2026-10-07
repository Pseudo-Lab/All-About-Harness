# Week 1 — Skill은 많을수록 좋을까?

첫 주에는 Agent가 사용할 수 있는 Skill과 도구가 많을수록 항상 좋은지 확인합니다.

## 실험 질문

Minimal mode와 Standard mode에서 각각 새로운 세션을 만들고 다음과 같은 질문을 입력합니다.

```text
오늘 서울 날씨는 어땠어?
```

## 실험 방법

1. Minimal mode를 선택하고 새 세션을 만듭니다.
2. 실험 질문을 입력하고 답변이 완료될 때까지 기다립니다.
3. 사용한 토큰 수와 전체 실행 시간을 기록합니다.
4. Standard mode를 선택하고 새로운 세션을 만듭니다.
5. 같은 질문을 입력하고 토큰 수와 전체 실행 시간을 기록합니다.
6. 두 결과의 정확성, 토큰 사용량, 실행 시간을 비교합니다.

두 실행에서는 같은 모델과 같은 환경을 사용하며, 실행 도중 추가 질문이나 힌트를 주지 않습니다.

## 비교 기록

| 항목 | Minimal mode | Standard mode |
|---|---:|---:|
| 답변 요약 | | |
| 사용 도구 | | |
| 입력 토큰 | | |
| 출력 토큰 | | |
| 전체 토큰 | | |
| 실행 시간 | | |

## 확인할 점

- 두 mode가 실제 날씨 정보를 확인했는가?
- 답변의 정확성과 구체성에 차이가 있는가?
- Standard mode의 추가 Skill과 도구가 이 질문에 실제로 도움이 되었는가?
- 더 많은 기능이 토큰 사용량이나 실행 시간을 증가시켰는가?

실험 결과를 바탕으로 단순한 질문에서도 많은 Skill과 도구가 유리한지, 필요한 기능만 제공하는 구성이 더 효율적인지 살펴봅니다.

## 첫 주차 과제

Standard mode보다 Minimal mode에서 더 좋은 답변이 나오는 질문을 3개 찾아봅니다.

각 질문을 두 mode의 새 세션에서 실행하고 다음 항목을 정리합니다.

- 질문과 두 mode의 답변 요약
- Minimal mode의 답변이 더 좋다고 판단한 이유
- 각 mode의 입력, 출력, 전체 토큰 사용량
- 각 mode의 전체 실행 시간

## 제출물

각자 다음 경로에 실험 결과를 Markdown 또는 HTML로 작성합니다.

```text
workspace/week1/<GitHub-ID>/result.md
workspace/week1/<GitHub-ID>/result.html
```

두 형식 중 하나만 제출하면 됩니다. 결과에는 다음 내용을 포함합니다.

- 실행 시각과 사용한 모델
- 선택한 질문 3개와 두 mode의 답변 요약
- 각 mode가 사용한 Tool
- 질문별 입력, 출력, 전체 토큰 사용량
- 질문별 전체 실행 시간
- 각 질문에서 Minimal mode의 답변이 더 좋다고 판단한 이유

API key, access token, credential 파일이나 민감한 session log는 올리지 않습니다.

## 제출 방법

공용 `main`에 직접 commit하지 않고 개인 branch에서 Pull Request를 만듭니다.

```bash
git switch main
git pull --ff-only
git switch -c week1/<GitHub-ID>-skill-comparison

mkdir -p workspace/week1/<GitHub-ID>
# result.md 또는 result.html 작성

git add workspace/week1/<GitHub-ID>
git commit -m "Add week 1 experiment for <GitHub-ID>"
git push -u origin week1/<GitHub-ID>-skill-comparison
```

push가 끝나면 GitHub에서 `main`을 대상으로 Pull Request를 생성합니다. 저장소에 branch를 push할 권한이 없다면 자신의 fork에 branch를 push한 뒤 원본 저장소로 Pull Request를 보냅니다. 최종 merge는 리뷰 후 관리자가 진행합니다.
