Week 03 — Plugin Grouping & Service Isolation
이번 주 목표: 직접 만든 Plugin을 Group으로 구성하고, 하나의 Agent Preset에 연결해 실행합니다. 나아가 어떤 Service를 왜 isolate해야 하는지 스스로 설계해 봅니다.

지난주에는 Custom RALPH Plugin을 만들었습니다. 이번 주에는 여러 Plugin을 조합하는 방법과 함께, 같은 Service를 공유할 때와 그룹별로 분리할 때 무엇이 달라지는지 고민해 봅니다. isolate의 필요성·설계 설명은 필수, 실제 코드 적용과 Sandbox 실험은 선택입니다.
1. 필수 과제
Task 1. Custom Plugin 2개 이상 만들기
- 서로 기능이 구분되는 Plugin을 최소 2개 만듭니다.
- 주제와 구현 방식은 자유입니다. 복잡한 기능일 필요는 없습니다.
- 가장 간단한 방식은 각 Plugin이 모델이 호출할 수 있는 Tool을 하나씩 등록하는 것입니다.
예시: word-count(단어 수 세기)와 keyword-check(필수 키워드 확인), 또는 file-list(파일 목록 조회)와 file-summary(파일 정보 정리).
Task 2. Plugin Group으로 묶기
- 만든 Plugin들을 cordis:group 아래에 함께 등록합니다.
- 그룹에 들어 있는 Plugin의 목록과 각각의 역할을 확인합니다.
- isolate 없이 Group을 구성했을 때 각 Plugin이 어떤 Service를 공유하는지도 살펴봅니다.
Task 3. 하나의 Agent Preset에 연결하고 실행하기
- 만든 Group을 하나의 Custom Agent Preset에 추가합니다.
- 해당 Preset을 선택해 Agent를 실행합니다.
- Agent가 최소 2개 Plugin의 기능을 모두 사용하도록 작업을 주고, 실행 결과를 기록합니다.
- Group을 활성화/비활성화했을 때 어떤 Tool이 사용할 수 있게 되는지 비교합니다.
- Group으로 묶기만 했을 때와 개별 등록했을 때의 차이도 정리합니다.
Task 4. isolate가 필요한 상황 설계하기 (필수 — 구현 없이 설명 가능)
단순히 Plugin을 묶는 것만으로는 Service가 분리되지 않습니다. 자신이 만든 Group을 기준으로 다음 질문에 답해 보세요.
1. 공유: 현재 두 Plugin이 함께 사용하는 Service는 무엇인가요? (tools, shell, 직접 만든 Service 등)
2. 분리 대상: 여러 Group을 운용한다면 어떤 Service를 따로 두면 좋을까요? 하나를 선택해 보세요.
3. 이유: 그 Service를 공유할 때 생길 수 있는 문제와 분리했을 때 얻는 이점은 무엇인가요?
4. 구성: Provider와 Consumer Plugin을 어떤 Group에 배치할지 간단한 YAML 또는 그림으로 나타내 보세요.
사용한 Plugin이 별도의 Service를 필요로 하지 않는다면, 가상의 Research Group과 Coding Group을 생각해 설계해도 됩니다. **"현재 구성에서는 격리할 필요가 없다"**는 결론도 타당한 이유를 설명하면 괜찮습니다.
핵심 질문: 왜 Group으로 묶었는가? 그리고 무엇을, 왜 isolate해야 하는가?

2. 기본 Group 구성 예시
다음은 Preset의 Plugin 구성 형태를 이해하기 위한 예시입니다. Plugin 이름은 본인이 실제로 개발·설치한 Plugin의 식별자로 바꿔야 합니다.
# @deepseek-ai/dsh-agent-preset의 config 예시
id: week3-group-lab
name: Week 03 Group Lab
plugins:
  - id: my-plugin-group
    name: cordis:group
    group: true
    config:
      - name: '@your-scope/plugin-a'
      - name: '@your-scope/plugin-b'
실제 Preset 생성·적용은 Creator Mode 또는 Plugin Manager를 활용해 진행해도 됩니다. 설치 방식에 따라 Bundle/Patch의 상위 구조나 패키지 경로는 달라질 수 있습니다.

중요: group: true는 Plugin을 묶는 설정이지, 자동으로 Service를 격리하거나 Workflow를 실행하지 않습니다. Agent가 Tool을 호출하려면 해당 Plugin이 Tool을 등록하고, tools 등 의존 Service가 제공되어야 합니다.
isolate를 고민할 때 참고할 예시
# 아래는 Service Scope를 설명하기 위한 간단한 예시입니다.
- id: research-group
  name: cordis:group
  group: true
  isolate:
    shell: true
  config:
    - name: '@deepseek-ai/dsh-bash-sandbox' # 이 그룹의 Shell Provider
    - name: './research-plugin.ts'          # 이 그룹의 Shell Consumer
위 예시에서 격리하는 것은 Plugin이나 그룹 이름이 아니라 ctx.shell Service입니다. 그룹 안에 Shell을 제공하는 Plugin과 사용하는 Plugin을 함께 배치해야 하며, dsh-bash-sandbox가 동작하려면 별도로 ctx.sandbox, ctx.sandboxPolicy 등 필수 Service가 제공되어야 합니다. 그룹 밖에 등록한 다른 Tool이 이 Shell을 자동으로 사용하게 되는 것은 아닙니다.
3. 선택 심화 과제 — isolate 직접 적용하고 Sandbox 실험하기
Task 4에서 세운 설계를 실제로 구현해 보세요. 가장 쉬운 접근 중 하나는 그룹 안에서 shell Service를 격리하고, dsh-bash-sandbox를 Provider로 배치하는 것입니다.

주의: isolate는 어떤 Service를 참조하는지 분리하고, Sandbox는 파일 읽기·쓰기 권한을 제한합니다. 서로 다른 기능이므로 둘 다 확인해야 합니다. 이 실험은 선택 사항입니다.
Task 5. 격리한 Shell과 Sandbox 연결하기 (선택)
1. 테스트용 작업 폴더를 별도로 만듭니다. 예: /absolute/path/to/week3-lab.
2. 자신이 만든 Group에 isolate: { shell: true }를 설정하고, 그룹 안에 Shell Provider(dsh-bash-sandbox)와 Shell Consumer Plugin을 넣습니다.
3. Sandbox Provider(dsh-sandbox-local)와 Policy(dsh-sandbox-policy)가 해당 실행 환경에서 제공되는지 확인합니다. 이미 등록되어 있다면 중복 Provider를 만들지 않습니다.
4. read-only 모드에서 파일 읽기와 테스트 파일 쓰기를 비교하고, workspace-write 모드에서도 같은 실험을 합니다.
5. 그룹 안의 Consumer가 실제 격리된 ctx.shell을 호출했는지 확인합니다. 단순히 YAML을 작성한 것만으로 실험을 완료한 것은 아닙니다.


구분해서 알아두기
- dsh-bash-sandbox는 Plugin 패키지 이름입니다. isolate: { dsh-bash-sandbox: true }처럼 적지 않습니다.
- isolate에 적는 키는 shell, sandboxPolicy 같은 Service 이름입니다. isolate는 Service 참조 범위만 분리하며, 파일 접근 권한을 직접 제한하지는 않습니다.
- 그룹별로 서로 다른 Shell Provider까지 두고 싶다면 올바른 Service 키인 shell을 격리하고, Provider와 이를 사용하는 Plugin을 같은 그룹의 Service Scope에 연결해야 합니다.
- workspaceRoot는 Agent 세션에 작업 디렉터리가 없는 경우 등에 쓰이는 대체 경로입니다. 일반적인 Agent 실행에서는 세션의 작업 디렉터리가 실제 쓰기 범위의 기준이 될 수 있으니 함께 확인하세요.
- Sandbox 제한은 주로 파일 접근에 관한 것이며 네트워크·프로세스 권한 전체를 격리하지 않습니다. 테스트는 안전한 별도 폴더에서 진행하고, 중요한 파일에는 쓰기 테스트를 하지 마세요.

4. 제출 형식
기존 스터디 Repository에 결과를 정리해 Pull Request(PR) 를 올려주세요.
workspace/week3/<GitHub ID>/
├── README.md         # 구현·실행 결과 및 느낀 점
├── plugins/          # 직접 작성한 Plugin 코드 또는 링크
└── (선택) config/     # Group / Preset YAML, 실행 로그 등
README.md에 다음 사항을 포함하면 됩니다.
- 제작한 Plugin 2개 이상의 이름과 역할
- Group 및 Agent Preset 구성 방법(YAML, 코드 또는 화면 캡처)
- 하나의 Agent에서 각 Plugin을 실제로 호출한 실행 결과
- 그룹으로 묶으며 알게 된 점, 어려웠던 점
- 필수: isolate 대상으로 고려한 Service, 분리 이유, Provider·Consumer 배치 설계(또는 격리하지 않아도 되는 이유)
- 선택: 실제 isolate 적용 결과 및 Sandbox Provider·Policy 구성과 read-only/workspace-write 실험 결과

## 5. 참고자료

- [Agent Preset — Plugin 구성](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/preset/agent-preset/README.md)
- [Standard Preset 실제 그룹 설정](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/bundle/web-app/presets/standard.patch.yml)
- [Your first Plugin](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/index.md)
- [Build a Tool](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/basic/tool.md)
- [Service Isolation](https://github.com/deepseek-ai/deepseek-harness/blob/master/docs/user/develop/framework/service.md)
- [Bash Local 실행 설정](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/shell/bash-local/README.md)
- [Bash Sandbox 및 접근 권한](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/shell/bash-sandbox/README.md)
- [Sandbox Policy 설정](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sandbox/sandbox-policy/README.md)
- [Sandbox 실행 Provider](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/sandbox/sandbox-local/README.md)
