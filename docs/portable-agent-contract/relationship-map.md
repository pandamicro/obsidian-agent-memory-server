# Portable Agent Contract Relationship Map

下面的 Mermaid 图只表达当前阶段已经稳定下来的对象关系，不表达实现细节。

```mermaid
classDiagram
    class ExternalInvoker["外部调用方"]
    class Codex["Codex Agent"]
    class ClaudeCode["Claude Code Agent"]
    class ExplicitTools["外部工具（显式）"]
    class ImplicitTools["外部工具（隐式）"]

    class AgentIdentity["agent_identity"]
    class SkillPack["skill_pack"]
    class DynamicMemory["dynamic_memory"]
    class AdapterContract["adapter_contract"]

    class MemoryIndex["memory_index"]
    class EpisodeExtractor["episode_extractor"]
    class MemoryDistiller["memory_distiller"]
    class Episode["Episode"]
    class Learning["Learning"]
    class BehaviorDelta["Behavior Delta"]
    class FeedbackObject["feedback_object"]

    class RuntimeMemory["运行时记忆层"]
    class FileKnowledge["文件型知识层"]
    class RuntimeEnv["运行环境"]
    class AdapterImpl["adapter implementation"]
    class SessionContext["临时上下文"]

    ExternalInvoker --> Codex : 调用
    ExternalInvoker --> ClaudeCode : 调用
    Codex --> AgentIdentity : 绑定身份
    ClaudeCode --> AgentIdentity : 绑定身份

    ExplicitTools --> AgentIdentity : 显式匹配适配
    ImplicitTools --> AgentIdentity : 隐式行为耦合

    AgentIdentity --> SkillPack
    AgentIdentity --> DynamicMemory
    AgentIdentity --> AdapterContract

    DynamicMemory --> MemoryIndex : 维护索引
    MemoryIndex --> Episode : 检索入口

    DynamicMemory --> EpisodeExtractor : 抽取新经验
    EpisodeExtractor --> Episode : 形成 episode

    DynamicMemory --> MemoryDistiller : 蒸馏管道
    Episode --> MemoryDistiller : 候选输入
    MemoryDistiller --> Learning : 经验抽象
    MemoryDistiller --> BehaviorDelta : 行为升级

    FeedbackObject --> Episode : 证据绑定
    FeedbackObject --> Learning : 有效性判断
    FeedbackObject --> BehaviorDelta : 升降级依据
    BehaviorDelta --> SkillPack : 反哺能力包

    RuntimeMemory --> DynamicMemory
    FileKnowledge --> Learning
    FileKnowledge --> BehaviorDelta

    RuntimeEnv --> AdapterImpl
    AdapterImpl --> AdapterContract
    AdapterContract --> SessionContext
    SessionContext ..> ExplicitTools : 临时注入
    SessionContext ..> ImplicitTools : 环境携带

    Learning ..> FileKnowledge : 稳定沉淀
    BehaviorDelta ..> FileKnowledge : 审阅后沉淀
```

## 读图说明

- 关系视角改为“外部调用 Agent（如 Codex / Claude Code）”而不是内部流水线
- 外部工具分成 `显式` 与 `隐式` 两类，并通过 `agent_identity` 建立适配关系
- `memory_index` 表达 Agent 在 `dynamic_memory` 上的索引能力
- `episode_extractor` 表达 Agent 对新记忆 `Episode` 的抽取能力
- `memory_distiller` 表达从 `Episode` 到 `Learning / Behavior Delta` 的蒸馏能力
- `feedback_object` 仍是 `dynamic_memory` 的支持对象，不是第五个核心对象
- `运行时记忆层` 与 `文件型知识层` 分离，后者可由 Obsidian 承担
