# Portable Agent Contract Relationship Map

下面的 Mermaid 图只表达当前阶段已经稳定下来的对象关系，不表达实现细节。

```mermaid
flowchart TD
    AI[agent_identity]
    SP[skill_pack]
    DM[dynamic_memory]
    AC[adapter_contract]

    EP[Episode]
    LE[Learning]
    BD[Behavior Delta]
    FO[feedback_object]

    RT[运行时记忆层]
    FK[文件型知识层]
    ENV[运行环境]
    ADP[adapter implementation]
    CTX[临时上下文]

    AI --> SP
    AI --> DM
    AI --> AC

    SP --> CTX
    DM --> EP
    DM --> LE
    DM --> BD

    EP --> LE
    LE --> BD
    BD --> SP

    FO --> EP
    FO --> LE
    FO --> BD
    FO --> SP

    RT --> DM
    FK --> LE
    FK --> BD

    ENV --> ADP
    ADP --> AC
    AC --> CTX

    CTX -.临时注入.-> ENV
    DM -.外挂长期记忆.-> RT
    LE -.稳定沉淀.-> FK
    BD -.审阅后沉淀.-> FK
```

## 读图说明

- `agent_identity` 约束同一个 Agent 的连续性
- `skill_pack` 是静态能力包
- `dynamic_memory` 是动态经验层
- `adapter_contract` 描述 Agent 对运行环境的能力要求
- `feedback_object` 是 `dynamic_memory` 的支持对象，不是第五个核心对象
- `Episode -> Learning -> Behavior Delta -> skill_pack` 是推荐升级路径
- `运行时记忆层` 与 `文件型知识层` 分离，后者可由 Obsidian 承担
