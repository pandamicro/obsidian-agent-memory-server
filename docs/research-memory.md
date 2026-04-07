# Research Memory

这个文档是 `obsidian-agent-memory-server` 的研究记忆主入口。

## 目的

- 记录每一次有效研究动作，避免上下文丢失
- 显式区分事实、假设、决策和未解问题
- 为后续设计、实现和复盘提供可追溯依据

## 硬规则

- 每一次有效研究步骤都必须追加一条日志
- 未经验证的判断必须标记为“假设”
- 没有足够证据前，不写详细架构，不冻结数据模型
- 研究阶段优先缩小问题边界，不追求一次性完整方案

## 日志模板

```md
## R-XXXX 标题

- 日期:
- 目标:
- 输入:
- 动作:
- 发现:
- 假设:
- 决策:
- 未解问题:
- 下一步:
```

## Research Log

## R-0001 建立研究基线

- 日期: 2026-03-26
- 目标: 为项目建立统一的研究记忆机制和高优先级谨慎约束
- 输入: 当前项目仅有粗粒度目标描述，需求复杂度高，边界尚未收敛
- 动作:
  - 新建本研究记忆文档，作为唯一持续追加入口
  - 新建仓库级 `AGENTS.md`，向后续 Agent 强制注入研究纪律
  - 在 `README.md` 中补充研究入口，降低后续遗漏概率
- 发现:
  - 当前最大风险不是缺实现，而是过早进入实现或过早固化设计
  - 该项目至少同时涉及记忆建模、角色抽象、跨项目隔离/共享和工作流兼容
  - 现阶段最需要的是稳定的研究节奏与记录结构，而不是详细方案
- 假设:
  - 用单一研究记忆文档作为主入口，在早期比拆分多份专题文档更稳妥
- 决策:
  - 从本次开始，后续每一步研究都先写入本文件
  - 详细架构继续保持占位级，不在证据不足时扩写
- 未解问题:
  - 研究日志后续何时从单文档拆分为主题化子文档
  - 哪些问题应优先进入第一轮专项研究
- 下一步:
  - 收敛第一轮研究问题列表
  - 划分研究轨道，避免不同问题混在一次讨论里

## R-0002 确认运行边界并划分第一轮研究轨道

- 日期: 2026-03-26
- 目标: 确认项目底座能力边界，避免把 Obsidian CLI、Obsidian Headless、obsidian-mcp 混为同一层能力
- 输入:
  - Obsidian 官方 CLI 文档
  - Obsidian 官方 Headless 文档
  - `Storks/obsidian-mcp` 官方仓库 README
- 来源:
  - https://obsidian.md/help/cli
  - https://obsidian.md/headless
  - https://github.com/Storks/obsidian-mcp
- 动作:
  - 阅读官方文档，确认 CLI 是否可脱离桌面端独立运行
  - 阅读 Headless 文档，确认其覆盖范围是否等同于 CLI
  - 阅读 `obsidian-mcp` README，确认它的通信方式、依赖关系和工具边界
- 发现:
  - `Obsidian CLI` 是控制桌面端 Obsidian 的命令行桥接层；官方文档明确要求 Obsidian app 运行，若未运行则首次命令会拉起桌面端
  - `Obsidian Headless` 是独立于桌面端的 headless client，但当前官方文档聚焦的是 Sync 相关能力，而不是通用的本地 Vault 读写与 Agent 工具编排
  - `Storks/obsidian-mcp` 是包装官方 CLI 的 stdio MCP server，适合做 Agent 接入层，但它本身不是这个项目想要构建的“记忆服务核心”
  - `Storks/obsidian-mcp` 暴露的能力已经覆盖文件、搜索、任务、标签、属性、链接、插件、workspace、bases、history 等操作，说明“Obsidian 接入层”能力相对丰富
- 假设:
  - 本项目需要把“记忆服务核心”和“Obsidian 接入适配层”严格分开，否则后续会把运行时限制误当成产品能力限制
  - 后续可能需要同时支持 CLI 驱动模式和非桌面端模式，因此不应把桌面端运行依赖写死在系统核心层
- 决策:
  - 第一轮专项研究按 5 条轨道展开：系统边界、记忆模型、Agent 角色、跨项目策略、工作流适配
  - 在更清楚底座边界前，不进入详细架构设计，不定义完整 API，不锁定存储结构
- 未解问题:
  - 若未来需要常驻服务或远程运行，Obsidian CLI 依赖桌面端这一点如何处理
  - `Obsidian Headless` 能否承担部分服务端同步或只读接入职责
  - `obsidian-mcp` 与未来自研 memory server 的关系应是“底层适配器”还是“旁路工具”
- 下一步:
  - 研究轨道 A: 系统边界与运行时拓扑
  - 研究轨道 B: 记忆对象模型与索引边界
  - 研究轨道 C: Agent 角色模型与权限边界
  - 研究轨道 D: 跨项目隔离、共享与冲突策略
  - 研究轨道 E: 不同 Agent 工作流的适配接口

## 第一轮研究轨道

### A. 系统边界与运行时拓扑

- 核心问题: 这个项目究竟是“包在 Obsidian 外的一层服务”，还是“以 Obsidian 为主要运行时的增强层”
- 关键风险: 一旦把 CLI 限制直接带入系统核心，后续很难支持 headless、远程或多客户端模式

### B. 记忆对象模型与索引边界

- 核心问题: 一条 Agent 记忆最小需要包含哪些字段，哪些内容属于衍生索引而非源事实
- 关键风险: 过早定 schema 会把后续角色、项目、工作流耦合进单一结构

### C. Agent 角色模型与权限边界

- 核心问题: Agent 角色是模板、策略、权限集合，还是三者叠加
- 关键风险: 角色抽象一旦含糊，后续跨项目经验复用会失真

### D. 跨项目隔离、共享与冲突策略

- 核心问题: 什么记忆应留在项目内，什么可以提升为跨项目经验
- 关键风险: 隔离不足会污染上下文，共享不足会损失复用价值

### E. 工作流适配接口

- 核心问题: 如何兼容不同项目中的 Agent 工作流，同时不把核心层绑死在某一类 Agent 框架上
- 关键风险: 如果适配接口过早绑定某个客户端协议，迁移成本会很高

## R-0003 调研现有 Agentic Memory 实现并评估 Obsidian 的角色

- 日期: 2026-03-26
- 目标: 调研当前 Codex、Claude Code 等工作流下已经存在的 Agentic Memory 实现，判断它们与“多专业 Agent + 独立记忆 + 可委派协作 + 跨工作区”目标的贴合度，并推敲 Obsidian 适合承担什么职责
- 输入:
  - Claude Code 官方 subagents / memory 文档
  - Codex 官方 subagents / MCP 文档
  - MCP 官方 reference servers 中的 Memory server
  - Memora、mcp-memory-service、Context Portal、Basic Memory、OpenMemory、Graphiti 等项目的一手文档或官方仓库
- 来源:
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/memory
  - https://developers.openai.com/codex/subagents
  - https://developers.openai.com/learn/docs-mcp
  - https://github.com/modelcontextprotocol/servers
  - https://github.com/agentic-box/memora
  - https://github.com/doobidoo/mcp-memory-service
  - https://github.com/GreatScottyMac/context-portal
  - https://docs.basicmemory.com/
  - https://docs.basicmemory.com/reference/technical-information
  - https://docs.mem0.ai/openmemory/overview
  - https://github.com/getzep/graphiti
- 动作:
  - 先确认 Claude Code 和 Codex 自身对 subagent、MCP、持久记忆的原生支持边界
  - 再收集几类有代表性的 memory 实现，按“工作流贴合度 / 结构化程度 / 跨项目能力 / 人类可审阅性”比较
  - 最后回到 Obsidian，判断它更适合作为操作性记忆层，还是提炼后的知识层
- 发现:
  - Claude Code 是当前原生支持最完整的工作流之一。官方文档明确支持自定义 subagent、subagent 级 `mcpServers`、以及 `user` / `project` / `local` 三种持久记忆作用域。它还支持主线程 agent 协调多个 subagent，并明确区分单 session 的 subagents 与跨 session 协调的 agent teams
  - Codex 官方文档已经明确支持 subagents、custom agents、并行代理工作流，以及在 custom agent 中挂载专属 `mcp_servers`。但我在官方文档里没有找到类似 Claude Code 那样的“内建 persistent agent memory directory”能力说明。这里的判断是推断：Codex 目前更像“强协调器 + MCP 容器”，长期记忆更适合外接
  - 官方 MCP 参考仓库已经把 `Memory` 列为 reference server，说明“把 persistent memory 作为 MCP 工具层”已经是社区主流方向之一。但它更像最小参考实现，不足以直接覆盖多专业 Agent 的复杂协作需求
  - Memora 是目前和目标贴合度较高的一类实现：它明确面向 AI agent 的持久记忆，支持 semantic search、knowledge graph、typed edges、cross-session context，并且官方 README 直接给出 Claude Code 和 Codex CLI 的接入方式。它更接近“通用语义记忆后端”
  - mcp-memory-service 明确面向多 agent pipeline，强调“memory is shared across all agents and runs”，提供 `X-Agent-ID` 做 agent 身份隔离，具备 knowledge graph、consolidation、REST + MCP 双接口。这是当前最接近“多 agent 共享/隔离并存的运行时记忆服务”的实现之一，但它偏服务化和数据库化
  - Context Portal（ConPort）更偏“项目工作区记忆库”。它把 decisions、progress、architecture 等上下文放进每工作区一个 SQLite + graph + embedding 的后端，并通过 `workspace_id` 管理多工作区。它非常适合“项目记忆”，但不天然等于“角色化 Agent 记忆”
  - Basic Memory 提供了非常重要的在先思路：它采取 file-first 架构，把 Markdown 作为 source of truth，数据库只是 secondary index；同时它把 Markdown 中的 entities / observations / relations 解析成语义图，还明确支持 Claude、ChatGPT、Codex、Obsidian。它说明“Markdown + semantic graph + MCP”这条路线是可行的
  - OpenMemory 更偏“跨客户端共享的个人/用户级记忆层”。它强调 local-first、跨工具共享、统一 memory operations，但其默认抽象更接近“user memory stream”，不直接等于“多个专业 Agent 各自独立又能互调的专业记忆系统”
  - Graphiti / Zep 代表的是另一类更重型的方案：temporal knowledge graph。它很适合处理随时间变化的事实、冲突、历史状态与生产级检索，但复杂度明显更高，更像底层引擎而不是轻量工作流插件
  - 目前没有看到哪个现成方案可以“开箱即用”地同时满足下面四件事：多个专业 Agent、每个 Agent 独立记忆、跨工作区复用、subagent 之间高质量协作。现有方案通常只解决其中两到三项，需要组合
- 候选实现与贴合度判断:
  - Claude Code 原生 subagent + memory: 对“专业 Agent + 独立记忆 + 委派协作”贴合度最高，但记忆主要还是文件目录级，不是独立的结构化 memory service
  - Codex 原生 subagent + MCP: 对“多 agent 协调 + 专属工具/MCP”贴合度高，但原生长期记忆能力相对弱，需要外接 memory backend
  - Memora: 对“通用 Agent 记忆后端”贴合度高，尤其适合 Claude/Codex 这类 MCP 驱动工作流
  - mcp-memory-service: 对“多 agent 共享服务 + agent 身份隔离 + consolidation”贴合度高，但系统重量更大
  - ConPort: 对“项目工作区记忆”贴合度高，适合每工作区一份项目知识库
  - Basic Memory: 对“Markdown 可审阅记忆 + 图化索引 + 人机共编”贴合度高，是 Obsidian 方向的重要参照
  - OpenMemory: 对“跨客户端个人记忆层”贴合度高，但 role-specific 语义不够强
- 对 Obsidian 的推敲:
  - 优势:
    - 人类可读、可编辑、可审阅，适合作为高价值记忆的最终落点
    - Wikilink、backlink、图谱、手工提炼能力强，适合做跨项目经验关联和长期知识沉淀
    - 与 Git、Markdown、知识库工作流天然兼容，便于版本化和人工校正
    - 如果走类似 Basic Memory 的路线，Obsidian 可以成为 file-first memory layer 的自然承载体
  - 劣势:
    - Obsidian 本身不是高并发、强事务、强隔离的多 agent 运行时记忆后端
    - 多个 subagent 高频写 Markdown 时，冲突、重复、噪音、结构漂移都很容易发生
    - 当前 CLI 路线依赖桌面端运行，不适合直接被假定为稳定的 server runtime
    - 原生缺少 agent identity、memory TTL、冲突合并、时序失效、检索重排等运行时记忆机制
  - 价值判断:
    - Obsidian 最有价值的角色，不是“热路径上的操作性记忆总线”，而是“可审阅、可提炼、可关联的慢记忆 / 冷记忆层”
    - 更合理的方向是让结构化 memory backend 负责高频写入、隔离、检索、去重、事件流；让 Obsidian 负责沉淀精选记忆、角色经验手册、项目复盘、跨项目知识关联
    - 如果强行把 Obsidian 当作唯一 memory backend，最大的风险不是不能做，而是很快会因为噪音和并发写入失控，导致记忆质量下降
- 假设:
  - 目标系统最终大概率需要“双层记忆”：一层是面向 Agent 运行时的结构化/可检索记忆，一层是面向人机共编与提炼的 Obsidian 知识层
  - Claude Code 天然更适合作为第一优先验证对象，因为它已经原生支持 subagent 级 memory；Codex 更适合作为第二验证对象，通过 custom agent + MCP 方式接入同一记忆后端
  - 如果希望真正支持“多个专业 Agent 相互调用”，应该把角色身份、记忆命名空间和调用关系放在 memory system 外层显式建模，而不是完全依赖某个客户端的内建机制
- 决策:
  - 暂不把 Obsidian 视为唯一运行时记忆后端
  - 暂时把 Obsidian 定位为“提炼后的知识层候选”，不是“原始高频操作记忆层”
  - 下一轮研究应转向“角色身份 / 记忆命名空间 / 工作区命名空间”三个模型的交叉设计
- 未解问题:
  - 一条记忆究竟归属于 agent、workspace、project，还是三者的组合
  - subagent 之间的调用关系，是直接互调，还是统一由 coordinator 路由
  - 运行时结构化记忆与 Obsidian 提炼记忆之间，什么触发同步、谁来负责提炼、如何防止噪音上浮
  - 若 Claude Code 与 Codex 同时接入同一后端，agent identity 和 permission boundary 如何统一
- 下一步:
  - 研究轨道 B 与 C 合并推进一次：先定义角色身份模型，再反推最小记忆对象模型
  - 单独补一轮“Obsidian 作为冷记忆层”的边界研究，验证哪些内容适合沉淀、哪些不适合

## R-0004 收紧项目边界到 Agent 专属技能与专属记忆

- 日期: 2026-03-26
- 目标: 明确本项目的最重要边界，避免后续研究继续把工作区、项目或通用知识库需求混入主问题
- 输入:
  - 当前研究记录
  - 用户新增边界要求
- 动作:
  - 将项目边界上升为仓库级最高优先级规则
  - 明确本项目只研究 Agent 专属技能与专属记忆
  - 明确项目产出必须跨项目、跨环境即插即用，且不依赖工作区配置和特定 Agent 后端
- 发现:
  - 如果不主动切断工作区记忆、项目记忆、知识库需求，问题空间会持续膨胀，最终无法得到清晰产品边界
  - “跨项目可用”不等于“以项目或工作区为记忆主实体”；更合理的中心实体应是 Agent 自身
  - “兼容 Claude Code / Codex”不应被理解为依赖它们的原生记忆机制，而应理解为可通过适配层接入它们
- 假设:
  - Agent 专属记忆至少应以 `agent_identity` 为一等公民，而不是以 `workspace` 或 `project` 为一等公民
  - 若要实现真正的即插即用，Agent 的技能包、记忆命名空间、导入导出格式都需要后端无关
- 决策:
  - 本项目范围收敛为“Agent 专属技能 + Agent 专属记忆 + 可移植适配边界”
  - 工作区记忆、项目记忆、团队知识库、通用知识库都不纳入本项目主范围
  - 任何 Claude Code、Codex、MCP、Obsidian 集成都只能作为适配层，不能成为系统前提
  - R-0003 中关于 `workspace` / `project` 的讨论保留为背景调研，但不再作为本项目的中心建模方向
- 未解问题:
  - Agent 专属记忆和外部环境上下文之间，最小必要耦合面是什么
  - 专属技能包与专属记忆之间，哪些是静态资产，哪些是动态资产
  - 如果 Agent 需要在不同环境即插即用，启动时最小 bootstrap 信息是什么
- 下一步:
  - 定义 `agent_identity`、`skill_pack`、`memory_namespace`、`adapter_contract` 的最小模型
  - 重新审视 Obsidian 在该收紧边界下到底承担“经验沉淀层”还是“专属记忆镜像层”

## R-0005 以第一性原则识别初始阶段唯一关键问题

- 日期: 2026-03-26
- 目标: 用第一性原则判断本项目初始阶段必须先研究清楚什么，才能保证后续产出具备真正价值
- 输入:
  - 已收紧的项目边界：只关注 Agent 专属技能与专属记忆
  - 项目目标：产出跨项目、跨环境即插即用的 Agent 员工
- 动作:
  - 从最终价值倒推系统最小成立条件
  - 区分“本质问题”和“实现层问题”
  - 识别若不先解决会导致全局失焦的单一关键问题
- 发现:
  - 这个项目的价值不在“多一个记忆库”，而在“让同一个 Agent 在不同环境中保持连续、自洽、可迁移的专业能力”
  - 因此最核心的对象不是 Vault、workspace、project、Obsidian、MCP 或某个后端，而是“可移植的 Agent 本体”
  - 一个可移植的 Agent 本体，至少必须把四类东西分清：`agent_identity`、`skill_pack`、`dynamic_memory`、`runtime_adapter`
  - 目前真正会让项目失败的，不是存储选型，不是向量检索，不是 Obsidian 集成，而是这四类东西的边界如果不清楚，系统就一定会把环境状态错误地混进 Agent 本体
  - 一旦 Agent 本体和环境耦合，项目就不可能实现“跨项目、跨环境即插即用”
- 假设:
  - 若能先定义出后端无关、环境无关的“可移植 Agent Contract”，后续 Obsidian、MCP、Claude Code、Codex 都只是适配问题
  - 若不能定义出这个 Contract，后续任何实现都会沦为某个工作流的定制插件，而不是独立产品
- 决策:
  - 初始阶段唯一必须优先研究清楚的问题是：
  - `什么是一个可移植 Agent 的最小契约（Portable Agent Contract），以及哪些信息属于 Agent 本体，哪些信息必须严格留在外部环境？`
  - 在这个问题清楚之前，不进入详细 schema、不进入 API 设计、不讨论 Obsidian 的具体文件组织
- 未解问题:
  - `agent_identity` 的最小必要字段是什么
  - `skill_pack` 与 `dynamic_memory` 的分界线是什么
  - 运行时上下文进入 Agent 时，什么可以临时注入，什么绝不能持久化回 Agent 本体
  - `runtime_adapter` 需要保证哪些最小能力，才能让同一个 Agent 在不同后端行为一致
- 下一步:
  - 先定义 Portable Agent Contract 的四个核心对象和边界
  - 再用这个 Contract 反推 Obsidian 在系统中的合理职责

## R-0006 调研 Portable Agent Contract 四对象，并重点判断 dynamic_memory 的价值形态与层级

- 日期: 2026-03-26
- 目标: 在不失焦于 Portable Agent Contract 的前提下，调研 `agent_identity`、`skill_pack`、`dynamic_memory`、`runtime_adapter` 的已有代表性模型，并重点判断 dynamic_memory 中真正有价值的经验应该是什么形态、什么抽象层级、是否需要分层
- 输入:
  - Claude Code 官方 subagent / memory 文档
  - Codex 官方 subagents 文档
  - Letta / MemGPT / LangMem / Graphiti / Basic Memory / A-MEM / Generative Agents 等一手资料
- 来源:
  - https://code.claude.com/docs/en/sub-agents
  - https://code.claude.com/docs/en/memory
  - https://developers.openai.com/codex/subagents
  - https://docs.letta.com/guides/core-concepts/stateful-agents
  - https://docs.letta.com/guides/core-concepts/memory/memory-blocks
  - https://docs.letta.com/guides/core-concepts/memory/context-hierarchy/
  - https://langchain-ai.github.io/langmem/concepts/conceptual_guide/
  - https://research.google/pubs/generative-agents-interactive-simulacra-of-human-behavior/
  - https://arxiv.org/abs/2310.08560
  - https://arxiv.org/abs/2502.12110
  - https://docs.basicmemory.com/reference/technical-information
  - https://github.com/getzep/graphiti
  - https://github.com/doobidoo/mcp-memory-service
  - https://github.com/agentic-box/memora
- 动作:
  - 先用 Claude Code / Codex 官方文档确认现代 Agent 工作流里，什么属于 Agent 配置本体，什么属于外接能力
  - 再用 Letta、LangMem、Generative Agents、Graphiti、A-MEM、Basic Memory 对比 memory 的常见抽象层次
  - 最后只回答本项目真正需要的判断：dynamic_memory 应该记什么，不应该记什么，是否需要不同层级
- 发现:
  - Claude Code 和 Codex 的官方设计都在隐含地区分四种对象：
    - `agent_identity`: `name`、`description`、核心行为说明
    - `skill_pack`: 技能、开发指令、系统提示、工具约束
    - `runtime_adapter`: `mcp_servers`、工具表面、sandbox/permission/runtime 配置
    - `memory`: 持久化学习或跨会话积累
  - 这说明我们的四对象拆分不是拍脑袋，而是与主流 agent workflow 的结构一致
  - 但在一手资料中，真正高质量的 memory 系统几乎没有把“记忆”当成单层 blob：
    - Generative Agents 采用 `observations -> reflections -> plans`
    - LangMem 明确区分 `semantic / episodic / procedural`
    - Letta / MemGPT 强调 `in-context core memory` 与 `out-of-context archival memory`
    - Graphiti 明确区分 `episodes`（原始来源）与带有效期的 `facts / relationships`
    - Basic Memory 区分 `entities / observations / relations`
    - A-MEM 强调新记忆进入后要生成结构化属性、标签、连接，并让旧记忆持续演化
  - 这些资料共同指向一个结论：真正有价值的经验不是“原始对话全文”，而是能够改变未来决策质量的、可压缩、可检索、可验证的经验表示
  - 从第一性原则看，dynamic_memory 的价值标准不应是“记住了多少”，而应是“它是否能在未来环境中稳定提升 Agent 行为”
- 对四对象的阶段性判断:
  - `agent_identity`
    - 定义“这是哪个 Agent”，应该尽量稳定且与环境无关
    - 它不应该承载大量动态经验，否则身份会漂移
  - `skill_pack`
    - 更像静态可分发的专业能力包：角色说明、操作原则、方法模板、默认工具策略
    - 它应当是可移植资产，不应该被每次运行时随意改写
  - `runtime_adapter`
    - 负责把同一个 Agent 接到 Claude Code、Codex、MCP、Obsidian 等不同环境
    - 它是环境桥接层，不应成为 Agent 本体的一部分
  - `dynamic_memory`
    - 是本项目里唯一允许持续演化的“专属经验层”
    - 它的职责不是保存一切，而是积累未来可复用的、属于这个 Agent 的专业经验
- 对 dynamic_memory 的关键判断:
  - 真正有价值的经验，最少应包含三类信息：
    - `情境`: 遇到了什么类型的问题或触发条件
    - `策略`: 当时采用了什么判断路径、方法或操作模式
    - `结果`: 为什么有效、何时失效、可信度如何
  - 只存事实不够，因为 Agent 需要知道“什么时候用”
  - 只存案例也不够，因为 Agent 需要知道“可以抽象成什么稳定规律”
  - 只存规则更不够，因为没有来源和证据，规则会越来越像幻觉
- 对 dynamic_memory 的推荐抽象:
  - `Episode`：
    - 最接近原始经验，但必须经过压缩
    - 应包含：触发情境、关键判断、采取行动、结果、来源、时间、置信度
    - 作用：作为证据层和可回放层
  - `Learning`：
    - 从多个 episode 中提炼出的稳定模式、偏好、启发式、失败教训
    - 应包含：结论、适用范围、反例/失效条件、支撑证据引用
    - 作用：作为 Agent 的主要可检索经验层
  - `Behavior Delta`：
    - 会影响 Agent 行为的高价值经验调整，例如“当任务是 X 时优先走 Y 路径”
    - 它介于 dynamic_memory 与 skill_pack 之间
    - 不应直接覆盖 skill_pack，而应先作为可审阅的行为增量存在
- 是否需要不同层级的记忆划分:
  - 结论：需要，而且这是必要条件，不是优化项
  - 最少需要两层持久记忆：
    - `L1 Episode Layer`：保存压缩后的原始经验与证据
    - `L2 Learning Layer`：保存提炼后的规律、启发式、偏好和反模式
  - 很可能还需要第三层，但它不一定属于 dynamic_memory 本体：
    - `L3 Behavioral Promotion Layer`：将被反复验证的 learning 提升为长期行为规则或 skill patch
    - 这一层更接近 skill evolution，而不是普通 memory storage
  - 运行时 scratch / working memory 当然存在，但它属于运行时上下文，不应直接纳入本项目要解决的“专属持久记忆”核心
- 为什么必须分层:
  - 不分层时，所有内容都会混在一个桶里，结果是：
    - 检索时噪音过高
    - 规则与案例互相污染
    - Agent 难以判断当前读到的是“事实”“经验”还是“应遵循的行为”
  - 分层后，系统才有可能做到：
    - 用 episode 提供证据与可追溯性
    - 用 learning 提供高效决策支持
    - 用 promotion 层控制哪些经验值得固化进长期行为
- 对 Obsidian 的影响:
  - 在这套分层下，Obsidian 更适合承接：
    - 高价值 `Learning`
    - 已稳定的 `Behavior Delta`
    - Agent 的长期经验手册
  - Obsidian 不适合直接承接高频 `Episode` 热写入，除非中间有压缩、筛选、合并和节流机制
- 假设:
  - 本项目最终应把 dynamic_memory 设计成“以 Learning 为主检索对象，以 Episode 为证据后备层”的结构
  - skill_pack 不应被 runtime 自动直接改写；更合理的流程是 episode -> learning -> reviewed behavior delta -> skill pack update
- 决策:
  - 下一轮建模不再问“记忆存哪里”，而是先定义：
    - `Episode` 最小字段
    - `Learning` 最小字段
    - `Behavior Delta` 与 `skill_pack` 的分界线
  - `dynamic_memory` 的中心对象优先设为 `Learning`，而不是原始日志
- 未解问题:
  - 一个 learning 需要多少 episode 证据才有资格升级为 behavior delta
  - 是否需要显式的 `confidence` / `validity` / `last_verified_at` 字段
  - Agent 在不同环境里学到的 episode，哪些可以跨环境迁移，哪些只能局部适用
  - Obsidian 是只镜像 `Learning` / `Behavior Delta`，还是也允许低频落地精选 `Episode`
- 下一步:
  - 定义 Portable Agent Contract 的四对象最小模型
  - 单独细化 `Episode` / `Learning` / `Behavior Delta` 的字段边界

## R-0007 将 Portable Agent Contract 落成独立文档

- 日期: 2026-03-26
- 目标: 将研究结论从日志提升为独立文档，作为后续建模与评审的统一基线
- 输入:
  - R-0005 中关于唯一关键问题的结论
  - R-0006 中关于四对象与记忆分层的阶段性判断
- 动作:
  - 新建 `docs/portable-agent-contract.md`
  - 将四个核心对象的最小模型、边界、关系和非目标统一整理
  - 保持概念层，不进入 schema 或 API
- 发现:
  - 当四对象和边界被写成独立文档后，后续每次讨论都更容易识别是否失焦
  - `dynamic_memory` 只有放回四对象框架里，才能避免被误当成项目的唯一中心
- 决策:
  - 后续关于 Agent 本体的讨论，以 `docs/portable-agent-contract.md` 为主入口
- 未解问题:
  - 四对象的最小字段边界还需要逐个细化
  - `Behavior Delta` 到 `skill_pack update` 的审阅机制尚未定义
- 下一步:
  - 先细化 `agent_identity` 的最小字段边界

## R-0008 继续澄清 adapter 归属、显性/隐性记忆、知识与经验边界

- 日期: 2026-03-27
- 目标: 回答三个会直接影响 Contract 走向的问题：`runtime_adapter` 是否属于 Agent、本项目是否需要借鉴显性/隐性记忆、以及知识性记忆是否应该被排除
- 输入:
  - 用户提出的三个问题
  - Claude Code / Codex 官方文档
  - Letta、LangMem、Generative Agents、MemGPT、A-MEM 等一手资料
  - 用户提供的知乎链接，作为启发性参考而非证据源
- 动作:
  - 重新审视 `runtime_adapter` 的命名与归属
  - 对比显性/隐性记忆与当前 `Episode / Learning / Behavior Delta` 模型的映射关系
  - 重新定义“知识”和“经验”在本项目中的边界
  - 通过已安装的 `chrome-devtools-mcp` 和本机 Chrome 实际打开知乎文章，尝试读取正文
- 发现:
  - 知乎文章 `https://zhuanlan.zhihu.com/p/1940091301249909899` 在本机浏览器自动读取时返回 `40362` 异常限制提示，未能获取正文，因此该链接未作为证据源使用
  - 用户指出的问题是对的：如果把“具体 adapter 实现”算作 Agent 私有资产，会把环境层错误混入 Agent 本体
  - 更准确的对象不是 `runtime_adapter`，而是 `adapter_contract`
  - `adapter_contract` 属于 Agent 本体，因为 Agent 需要声明自己依赖什么抽象能力
  - 具体 adapter implementation 不属于 Agent，本质上是外部环境中的共享桥接层，可以服务多个 Agent
  - 显性/隐性记忆的类比有启发，但不能原样照搬成人类心理学术语
  - 更适合本项目的映射是：
    - `Episode / Learning` 对应显性、可审阅、可解释的经验层
    - `Behavior Delta -> skill_pack update` 对应逐步程序化的隐性行为层
  - 如果把“隐性记忆”设计成不可解释黑盒，项目会失去可审计性和可迁移性
  - “知识”与“经验”不是互斥关系：
    - `Episode` 更接近经验
    - `Learning` 更接近经验提炼出的知识
    - `Behavior Delta` 更接近知识进一步程序化成行为
  - 因此项目不应排除所有知识性记忆，而应排除“通用知识库式记忆”
- 假设:
  - 对本项目最有价值的，不是一般知识，而是经验驱动、Agent 专属、能稳定提升行为质量的知识化结论
  - 只要这些知识化结论仍然绑定在 Agent 身份和专业职责上，它们就仍属于本项目范围
- 决策:
  - 将 `runtime_adapter` 在主文档中修正为 `adapter_contract`
  - 保留显性/隐性记忆类比，但只作为设计启发，不作为机械映射
  - 本项目排除“通用知识型记忆”，但保留“经验驱动的知识化结论”
- 未解问题:
  - `Behavior Delta` 进入 `skill_pack` 前需要什么审阅阈值
  - 某条 `Learning` 在多大程度上抽象后，会越界成通用知识库条目
  - 同一个 adapter implementation 服务多个 Agent 时，能力暴露如何做到既共享又隔离
- 下一步:
  - 细化 `agent_identity` 最小字段边界
  - 细化 `adapter_contract` 的能力声明格式

## R-0009 通过已登录浏览器补充知乎文章信息

- 日期: 2026-03-27
- 目标: 补充用户提供的知乎文章信息，验证其是否能为 `Portable Agent Contract` 尤其是 `dynamic_memory` 提供有效启发
- 输入:
  - 知乎文章《万字解析 Agent Memory 实现》
  - 已安装的 `chrome-devtools-mcp`
  - 用户本机已打开且可正常阅读该文章的 Chrome 会话
- 动作:
  - 全局安装并校验 `chrome-devtools-mcp`
  - 先尝试直接通过浏览器自动读取正文，遭遇知乎反抓取
  - 改为复用本机 Chrome 已登录上下文的配置，启动可调试副本浏览器
  - 通过 DevTools 连接、页面快照和 DOM 提取读取文章标题、章节结构与关键段落
- 发现:
  - 文章正文可成功读取，之前失败的原因主要是自动化访问路径触发了知乎的防抓取，而不是文章本身不可达
  - 文章对本项目最有价值的增量，不是具体产品盘点，而是三组抽象：
    - 记忆操作不只是 `encode / store / retrieve`，还应明确 `consolidate / reconsolidate / reflect`
    - 记忆内容可区分为经历、知识、技能，这与当前 `Episode / Learning / Behavior Delta` 分层是可对齐的
    - Agent Memory 的工程趋势是“分而治之”，即分层管理、组合多种存储结构、按场景优化检索
  - 文章同时强调了上下文、LLM 参数、外挂存储这三类“记忆区”，这反过来帮助我们收紧本项目边界：
    - 本项目当前不做上下文窗口管理
    - 本项目当前不做参数记忆
    - 本项目聚焦 Agent 专属的外挂长期记忆
  - 文章中的显式/隐式记忆类比支持当前判断：
    - `Episode / Learning` 更适合作为显性、可解释、可审阅的记忆层
    - `Behavior Delta` 更像“向技能程序化迁移”的中间层，而不是直接黑盒化的隐式记忆
  - 文章列举的 `MemoryBank / LETTA / ZEP / A-MEM / MEM0 / MemOS / MIRIX` 说明一点：现有系统的能力越来越强，但复杂度也迅速上升
  - 对本项目而言，这强化了一个约束：初始阶段应先证明“可移植 Agent 专属记忆 contract”成立，而不是一开始复制全能 memory OS
- 假设:
  - 只要先把记忆生命周期和分层边界定义清楚，底层是否使用图、向量或多级摘要，可以作为后续实现策略而非先决条件
  - 对本项目第一阶段而言，文本化 `Episode / Learning` + 审阅态 `Behavior Delta` 已足以支撑有效验证
- 决策:
  - 将知乎文章作为“浏览器验证后可用的补充参考源”，但不提升为唯一理论基线
  - 在 `Portable Agent Contract` 中补入 `dynamic_memory` 的最小生命周期操作
  - 明确本项目当前作用域为 Agent 专属外挂长期记忆，不覆盖工作记忆与参数记忆
- 未解问题:
  - `reflect` 应该由 Agent 自主触发、调度器触发，还是人工触发
  - `consolidate` 与 `reconsolidate` 的触发阈值如何定义，才能避免记忆抖动
  - 当 `Learning` 足够稳定时，何时应升级为 `skill_pack` 的一部分
- 下一步:
  - 继续细化 `agent_identity`
  - 单独定义 `dynamic_memory` 的触发条件与晋升规则

## R-0010 补充互联网一手资料并校准记忆形成策略

- 日期: 2026-03-27
- 目标: 在进入细化设计前，继续用互联网一手资料校准三个问题：记忆是否必须分类型、记忆形成是否应区分热路径与后台反思、Obsidian 在体系中是否更适合做文件型知识层
- 输入:
  - LangMem 官方概念文档
  - Letta 官方 memory blocks 文档
  - Basic Memory 官方技术文档
  - Claude Code 官方 memory 文档
  - Codex / OpenAI MCP 官方文档
  - A-MEM / MemOS 等论文摘要
- 动作:
  - 检索并筛选只会影响当前边界判断的一手资料
  - 对照已有 `Portable Agent Contract`，判断哪些结论应进入主文档，哪些只保留在研究日志
  - 重点审视“Agent 专属记忆”和“工作区/后端记忆”的边界
- 发现:
  - LangMem 明确把长期记忆区分为 `semantic / episodic / procedural`，并强调高质量记忆系统通常是 application-specific，这支持我们继续坚持“Agent 专属 contract 优先于通用大而全 memory 平台”
  - LangMem 同时区分了 `hot path` 与 `background` 的记忆形成方式，这对当前项目非常关键：
    - 运行中更适合捕获少量强信号 `Episode`
    - `Learning` 与 `Behavior Delta` 更适合通过后台反思生成
  - Letta 的 memory blocks 说明“始终注入上下文的共享块”是一个成熟模式，但这类机制更接近运行时上下文层或共享状态层，不等于可移植的 Agent 专属长期记忆
  - Claude Code 官方 memory 明确区分 `user / project / local` 三种记忆位置，这恰好反证了为什么本项目不能依赖宿主工作区或特定后端的内建 memory：这些 memory 天生绑定环境或机器
  - Basic Memory 的技术路线说明，`Markdown files as source of truth + database as secondary index` 是可行的，这进一步强化了 Obsidian 的最佳位置：
    - 不是高频运行时主存储
    - 而是稳定经验对象的人类可读沉淀层
  - MemOS 代表的是更大的问题空间，它尝试同时覆盖 plaintext / activation / parameter memory，这反而说明我们当前把 scope 限制在外挂长期记忆是正确的，否则项目会迅速膨胀成 memory OS
  - A-MEM 继续支持一条判断：当记忆需要上下文描述、链接和演化时，卡片化、链接化的知识表示是有价值的，这和 Obsidian 的笔记网络天然相容
- 假设:
  - 当前项目的第一阶段，不需要先决定向量库、图数据库或具体索引结构，只需要保证 `Episode / Learning / Behavior Delta` 的对象边界和形成策略成立
  - 一旦形成策略被定义清楚，Obsidian 是否作为文件型知识层、以及 secondary index 如何实现，都可以被后置
- 决策:
  - 在主文档里补入 `dynamic_memory` 的 `hot path formation / background formation` 区分
  - 明确 Obsidian 更适合作为文件型知识层，而不是高频运行时主存储
  - 将宿主工作区或后端内建 memory 视为可选输入源，而不是本项目的持久化依赖
- 未解问题:
  - `Episode` 的热写入阈值应如何定义，才能避免噪音进入长期记忆链路
  - `Learning` 的验证周期与失效策略应如何定义
  - Obsidian 文件型知识层与运行时记忆层之间需要单向同步还是双向修订
- 下一步:
  - 细化 `agent_identity`
  - 细化 `dynamic_memory` 的晋升与失效规则
  - 单独评估 Obsidian 作为文件型知识层时的写入节奏与冲突控制

## R-0011 细化 dynamic_memory 的晋升、失效与反思触发规则

- 日期: 2026-03-27
- 目标: 给 `dynamic_memory` 补上最小行为规则，明确什么情况下记忆应晋升、修正、失效或触发反思
- 输入:
  - LangMem 官方概念文档
  - Mem0 官方文档中关于增删改记忆的一般思路
  - A-MEM、MemOS 等关于记忆演化与长期管理的论文摘要
  - 当前项目对“可移植 Agent 专属记忆”的边界约束
- 动作:
  - 将“记忆分层”推进为“记忆演化规则”
  - 补充 `Episode -> Learning -> Behavior Delta -> skill_pack update` 的晋升门槛
  - 补充最小失效状态机与反思触发源
- 发现:
  - 如果没有晋升门槛，`Learning` 会退化成“案例摘要堆积”，无法形成高质量经验层
  - 如果没有失效规则，系统会默认长期记忆只增不减，最终被过期经验污染
  - 如果没有反思触发约束，记忆系统会过度消耗热路径预算，和当前任务争抢上下文与推理资源
  - 对本项目最关键的不是“如何做最强 remembering”，而是“如何只保留真正能跨环境复用的 Agent 专属经验”
  - 因此某条记忆即使技术上为真，只要它依赖单一工作区、单一项目或单一后端偶然条件，也应被视为越界或降级对象
- 假设:
  - `Episode -> Learning` 的最低门槛应是“有可复用判断”而不是“有趣的案例”
  - `Behavior Delta` 只有在能转化为清晰行为改变时才成立，否则仍应留在 `Learning`
  - 默认应优先 `update / deprecate` 而不是直接 `delete`，以保留记忆演化痕迹
- 决策:
  - 在主文档中加入三组最小规则：
    - `晋升规则`
    - `失效规则`
    - `反思触发`
  - 将 `promotion-driven review` 明确为 skill 升级前的强制关口
  - 将“依赖特定工作区/项目/后端”列为记忆失效或降级的重要信号
- 未解问题:
  - `Episode` 进入 `Learning` 时，最低证据数量是固定阈值还是按专业领域动态调整
  - `deprecate` 的对象是否仍参与默认检索，还是只保留在审计视图
  - `reflect` 的执行主体应是 Agent 自身、调度器，还是人工评审混合模式
- 下一步:
  - 单独细化 `agent_identity`
  - 单独定义 `dynamic_memory` 的字段级状态机与检索可见性规则

## R-0012 将反馈机制前置为记忆判断的核心依据

- 日期: 2026-03-27
- 目标: 回答一个比“如何晋升记忆”更基础的问题：Agent 在真实使用过程中，如何知道某条经验是否真的有帮助
- 输入:
  - Anthropic 关于 agent evals 的工程文章
  - OpenAI 官方 eval 指南
  - Claude Code / LangMem / Basic Memory 等关于记忆与运行轨迹的资料
  - Graphite 的实际落地案例
- 动作:
  - 将研究焦点从“理论上的记忆演化”转到“实际使用中的反馈闭环”
  - 提炼哪些反馈信号能够支撑 `dynamic_memory` 的晋升、失效和修正
  - 将这些反馈信号映射回 `Episode / Learning / Behavior Delta / skill_pack`
- 发现:
  - 用户指出的问题是关键的：如果没有真实使用反馈，记忆系统只能靠自我反思做判断，容易陷入自我强化
  - 工程上更可靠的反馈来源通常不是单一评分，而是多信号组合：
    - `environmental outcome feedback`
    - `implicit behavior feedback`
    - `explicit feedback`
    - `review and trace feedback`
  - 真正高价值的经验，往往会在任务结果和后续使用行为里留下痕迹，而不只是被 Agent 解释得“看起来合理”
  - 这意味着本项目不该把“生成经验”当核心能力，而应把“为经验拿到可信反馈”当核心能力
  - `self-reflection only` 只能是弱信号，不能单独驱动长期记忆晋升
  - 对 coding / agent workflow 场景来说，最强的反馈源通常来自环境结果：
    - 测试是否通过
    - 构建是否成功
    - 建议是否被采纳
    - 用户是否继续沿用该产出
  - Graphite 的案例尤其说明一个点：真实落地里，建议被实施的比例、本身就是一种高价值反馈信号
- 假设:
  - 对本项目第一阶段而言，不需要做复杂奖励模型，只要能把多类反馈挂回记忆对象，就足以显著提升判断质量
  - 如果后续要做 Obsidian 沉淀，更应该沉淀“带反馈的经验对象”，而不是纯结论文本
- 决策:
  - 在主文档中增加 `反馈机制`、`反馈优先级`、`反馈对象` 和 `最小闭环`
  - 明确 `observe outcome` 与 `attach feedback` 是记忆系统不可缺的环节
  - 将“经验是否有帮助”的默认判断顺序设为：
    - 环境结果
    - 使用行为
    - 显式评价
    - 自我反思
- 未解问题:
  - 反馈对象的最小字段应如何建模，才能跨后端保持一致
  - `implicit behavior feedback` 在不同运行环境中的采集粒度差异很大，如何保持合同层稳定
  - 一条经验需要累积多少正/负反馈，才足以触发晋升或降级
- 下一步:
  - 单独定义 `feedback object` 的最小模型
  - 再回到 `agent_identity`

## R-0013 定义 feedback object 的最小模型

- 日期: 2026-03-27
- 目标: 把“反馈机制”收敛成一个可移植的支持对象，明确它最少由什么组成、作用于谁、哪些内容绝不能混入
- 输入:
  - R-0012 中关于反馈优先级与最小闭环的结论
  - 当前 `Portable Agent Contract` 的四对象边界
  - 之前调研得到的一手资料中关于运行轨迹、结果反馈、人工复核的共识
- 动作:
  - 决定 `feedback_object` 是否应成为第五个核心对象
  - 定义 `feedback_object` 的最小字段与边界
  - 明确它与 `Episode / Learning / Behavior Delta / skill_pack update` 的关系
- 发现:
  - `feedback_object` 不应升级为第五个核心对象，因为它不定义 Agent 本体，而是为 `dynamic_memory` 提供判断依据
  - 它更像一个支持对象，位于“运行反馈”和“记忆状态更新”之间
  - 如果没有统一的 `feedback_object`，不同来源的反馈会散落在评论、trace、测试结果和人工笔注里，无法稳定驱动记忆演化
  - 但如果把原始运行轨迹直接当反馈对象，又会把大量不可迁移噪音灌进 Agent 记忆层
  - 因此 `feedback_object` 必须是“结构化判断 + 证据引用”，而不是“原始日志副本”
- 假设:
  - 对第一阶段而言，`target_ref / signal_type / polarity / evidence_refs` 已足以支撑有效的反馈闭环
  - 更复杂的打分、权重、聚合规则可以后置
- 决策:
  - 将 `feedback_object` 定义为 `dynamic_memory` 的支持对象，而不是第五个核心对象
  - 主文档中加入 `feedback_object` 的：
    - 作用
    - 最小组成
    - 边界
    - 禁止混入
    - 与记忆对象的关系
  - 明确系统应支持“一个目标对象关联多条反馈”，而不是依赖单条反馈做最终判断
- 未解问题:
  - `strength` 应该是离散等级还是连续分值
  - `scope` 应如何表达“某类环境有效、另一类环境无效”
  - 多条 `feedback_object` 如何在不绑定具体后端的前提下被聚合
- 下一步:
  - 将 `feedback_object` 挂接回 `dynamic_memory` 的晋升与失效规则
  - 再回到 `agent_identity`

## R-0014 拆分 Portable Agent Contract 为主文档与子文档

- 日期: 2026-03-27
- 目标: 将不断扩大的 `Portable Agent Contract` 从单文件结构拆成稳定主入口 + 子文档，降低后续研究和设计迭代的维护成本
- 输入:
  - 当前 `docs/portable-agent-contract.md` 已同时承载总原则、对象定义、记忆规则、反馈模型
  - README 与研究记录中对主入口文档的现有引用
- 动作:
  - 保留 `docs/portable-agent-contract.md` 作为唯一主入口
  - 新建 `docs/portable-agent-contract/` 子目录
  - 按对象边界拆分为：
    - `agent-identity.md`
    - `skill-pack.md`
    - `dynamic-memory.md`
    - `adapter-contract.md`
  - 将主文档改为导航页，只保留总目标、顶层边界、四对象关系、反馈闭环和阅读顺序
  - 同步更新 README 中的文档入口说明，并修正 `runtime_adapter` 的旧表述
- 发现:
  - 主入口路径必须保持稳定，否则会影响已有研究记录、README 和后续引用
  - 拆分时最自然的切法不是按“研究轮次”，而是按“对象边界”
  - `dynamic_memory` 仍然是内容最重的子文档，因为分层、反馈、晋升、失效和反思触发都属于同一对象边界
  - `feedback_object` 继续留在 `dynamic-memory.md` 中是合理的，因为它是支持对象，而不是新的顶层对象
- 假设:
  - 后续只要保持“主入口稳定、细节下沉”的原则，文档规模继续增长也不会再次失控
- 决策:
  - `docs/portable-agent-contract.md` 固定为主文档
  - 对象细节全部进入子文档
  - README 中显式标注主入口和子文档目录
- 未解问题:
  - 未来是否需要再新增“状态机/规则专门子文档”，还是继续保持对象内聚
- 下一步:
  - 将 `feedback_object` 挂接回 `dynamic_memory` 的晋升与失效规则
  - 再回到 `agent_identity`

## R-0015 先定义可进入记忆链路的数据，再细化 feedback object

- 日期: 2026-03-27
- 目标: 回到比 `feedback_object` 更上游的问题，判断哪些运行数据真的有资格进入记忆判断链路
- 输入:
  - 当前 `dynamic_memory` 中关于反馈、晋升、失效的已有结论
  - OpenAI / Anthropic / LangSmith 等关于 trace、eval、运行反馈的工程共识
  - 用户提出的四个关键条件：可获取、可关联、可独立评估、可用于蒸馏
- 动作:
  - 不继续扩张 `feedback_object` 字段，而是先定义数据准入标准
  - 将“什么数据值得进入记忆链路”写成 `dynamic_memory` 的上游约束
  - 区分可接受的数据类型与不应直接进入链路的噪音数据
- 发现:
  - 用户指出的方向是对的：如果不先约束数据准入，`feedback_object` 很容易退化成“原始日志的结构化包装”
  - 不是所有可采集数据都适合作为反馈输入；很多数据只能审计，不能判断记忆价值
  - 对本项目而言，进入记忆链路的数据至少要同时满足四个条件：
    - `observable`
    - `linkable`
    - `evaluatable`
    - `distillable`
  - 这四个条件缺一不可：
    - 不能稳定获取，就无法作为默认机制
    - 不能关联经验使用与结果，就无法支持记忆判断
    - 不能独立评估价值方向，就无法驱动晋升或失效
    - 不能被蒸馏，就只会沦为日志堆积
  - 当前最合理的准入数据类型是：
    - `outcome events`
    - `usage events`
    - `review events`
    - `trace anchors`
  - 当前最不应直接进入记忆链路的是：
    - 全量 transcript
    - 全量工具日志
    - 工作区全量状态快照
    - 与经验使用无明确关联的噪音事件
- 假设:
  - 只要准入标准先明确，后续 `feedback_object` 的设计就能保持轻量且可移植
  - 第一阶段不需要全量 observability 平台，只需要保证关键事件具备可观测和可关联能力
- 决策:
  - 在 `dynamic-memory.md` 中增加 `数据准入标准`
  - 明确四个必要条件：
    - `observable`
    - `linkable`
    - `evaluatable`
    - `distillable`
  - 将这条规则设为后续 feedback 设计的前置约束
- 未解问题:
  - `usage events` 的最小采集粒度如何定义，才能跨环境保持一致
  - `trace anchors` 是否需要统一 ID 规范
  - 某些弱信号数据在单独看时不可评估，但聚合后可评估，是否允许延迟进入链路
- 下一步:
  - 基于数据准入标准回看 `feedback_object` 是否需要收缩字段
  - 再将 `feedback_object` 挂接回 `dynamic_memory` 的晋升与失效规则

## R-0016 基于数据准入标准收缩 feedback object 字段

- 日期: 2026-03-27
- 目标: 用 `observable / linkable / evaluatable / distillable` 四条准入标准反向检查 `feedback_object`，收缩到更稳的第一阶段最小模型
- 输入:
  - R-0013 中定义的 `feedback_object` 初版字段
  - R-0015 中定义的数据准入标准
- 动作:
  - 逐个审视 `feedback_object` 字段是否属于第一阶段必需
  - 将不能稳定跨环境提供、或更像后续聚合层字段的内容降级为可选扩展
  - 在 `dynamic-memory.md` 中明确“核心字段”与“可选扩展”的区别
- 发现:
  - `target_ref / signal_type / polarity / evidence_refs / observed_at` 已足以支撑第一阶段闭环
  - `source / strength / rationale / scope` 都有价值，但并非所有环境都能稳定提供
  - 如果把这些扩展字段过早做成硬性要求，会产生两个问题：
    - 不同运行环境难以对齐
    - `feedback_object` 再次膨胀成半个 observability schema
  - 因此更合理的做法是：
    - 第一阶段只保留最小核心字段
    - 将来源、强度、范围和解释文本后置为可选扩展
- 假设:
  - 第一阶段只要能区分“反馈作用于谁、反馈方向如何、证据是什么、何时发生”，就足以支撑记忆判断闭环
  - 多条反馈聚合、加权、范围修正等问题可以留到后续规则层解决
- 决策:
  - 将 `feedback_object` 的第一阶段核心字段收缩为：
    - `feedback_id`
    - `target_ref`
    - `signal_type`
    - `polarity`
    - `evidence_refs`
    - `observed_at`
  - 将以下字段后置为可选扩展：
    - `source`
    - `strength`
    - `rationale`
    - `scope`
- 未解问题:
  - 在缺少 `strength` 的情况下，多条弱正反馈如何与单条强负反馈比较
  - `source` 后置后，是否会影响后续对“用户反馈”和“系统反馈”的加权差异
- 下一步:
  - 将收缩后的 `feedback_object` 挂接回 `dynamic_memory` 的晋升与失效规则
  - 再回到 `agent_identity`

## R-0017 将收缩后的 feedback object 挂接回记忆规则

- 日期: 2026-03-27
- 目标: 不再停留在“有 feedback object”这层，而是让 `dynamic_memory` 的晋升、失效和反思触发显式依赖 `feedback_object`
- 输入:
  - 已收缩后的 `feedback_object` 最小模型
  - 当前 `dynamic_memory` 的晋升、失效和反思规则
- 动作:
  - 在 `dynamic-memory.md` 中新增 `规则挂接`
  - 明确 `Episode -> Learning`、`Learning -> Behavior Delta`、`Behavior Delta -> skill_pack update` 的最小反馈条件
  - 明确 `update / deprecate / delete` 的最小负向反馈挂接原则
  - 明确 `reflect` 的主要输入应来自新反馈、冲突反馈和待审阅对象，而不是全量历史
- 发现:
  - 如果不把反馈对象显式接回规则，文档会停留在“理论上需要反馈”的状态
  - 真正可执行的规则必须表达成：
    - 什么对象变化需要正向反馈
    - 什么状态降级需要负向或混合反馈
    - 什么情况下应触发反思处理
  - `Episode -> Learning` 这一步最容易被滥用，因此默认应要求至少存在一条能说明“该经验带来更好结果”的反馈对象
  - `skill_pack update` 的反馈门槛必须最高，因为这一步是在把经验静态化
- 假设:
  - 第一阶段即使没有复杂聚合算法，只要先做到“规则显式依赖反馈对象”，系统就能避免大量无证据晋升
- 决策:
  - 在 `dynamic-memory.md` 中把反馈对象正式接入：
    - 晋升规则
    - 失效规则
    - 反思触发
  - 将“没有反馈对象时默认不晋升”设为更安全的默认策略
- 未解问题:
  - 多条反馈对象如何被聚合成“足够支持晋升/降级”的判断，后续仍需单独定义
  - 当正负反馈并存时，优先保守还是优先晋升，仍需规则层细化
- 下一步:
  - 再单独定义反馈聚合与状态变更阈值
  - 然后回到 `agent_identity`

## R-0018 将本次会话沉淀为可复盘 memory case

- 日期: 2026-03-27
- 目标: 把本次连续研究会话整理成一个可复盘的 memory case，作为未来分析 `Episode / feedback_object / Learning / Behavior Delta` 提炼质量的样本
- 输入:
  - 本次会话中的边界收敛、问题识别、纠偏、浏览器读取、反馈前置、数据准入、feedback 收缩与规则挂接等关键动作
- 动作:
  - 新建 `docs/cases/2026-03-27-research-agent-memory-case.md`
  - 将样本按四层结构整理：
    - `Episode Candidates`
    - `Feedback Candidates`
    - `Learning Candidates`
    - `Behavior Delta Candidates`
  - 显式列出“哪些内容不应进入长期记忆”
- 发现:
  - 这次会话已经足以生成一批高质量 `Episode` 与 `feedback_object` 候选
  - 多个 `Learning` 已经具备较强的可复用性
  - 但绝大多数内容仍不足以直接晋升到 `Behavior Delta`，因为跨任务累计反馈还不够
- 假设:
  - 这种真实会话 case，比单纯理论文档更适合未来检验当前记忆模型是否可用
- 决策:
  - 将该案例保存在仓库内，作为后续 memory 蒸馏与反馈聚合研究的样本
- 未解问题:
  - 未来是否需要建立多 case 对比目录，用于比较不同任务类型下的 Episode 与反馈质量
- 下一步:
  - 定义反馈聚合与状态变更阈值
  - 然后回到 `agent_identity`

## R-0019 按 dynamic-memory 标准反评 case，并反向评估 dynamic-memory 设计

- 日期: 2026-03-27
- 目标: 用当前 `dynamic-memory.md` 的标准重新评估刚提炼出的 case，并反向判断我们自己的 `dynamic-memory` 设计是否已经足够指导真实提炼
- 输入:
  - `docs/cases/2026-03-27-research-agent-memory-case.md`
  - 当前 `docs/portable-agent-contract/dynamic-memory.md`
- 动作:
  - 按 `Episode / feedback_object / Learning / Behavior Delta` 四层标准回评该 case
  - 单独评估当前 `dynamic-memory` 设计在本阶段的指导边界
  - 将结论直接回写到 case 文档中
- 发现:
  - case 中的大部分 `Episode` 候选是成立的，但若按严格 schema 入库，仍需补齐 `decision_path / source / timestamp / confidence`
  - `feedback_object` 候选总体可用，但环境结果型与行为型反馈明显强于纯显式评价
  - `Learning` 候选中只有一部分足够稳，另一些更像协作经验或场景化经验
  - `Behavior Delta` 候选目前仍然证据不足，无法安全静态化
  - 当前 `dynamic-memory` 设计对以下层面已经足够：
    - `Episode` 提炼
    - `feedback_object` 最低建模
    - `Learning` 初步筛选
    - `Behavior Delta` 的高门槛约束
  - 但它对以下层面仍然不够：
    - 反馈聚合
    - 状态变更阈值
    - 正负反馈冲突裁决
    - 检索可见性规则
- 假设:
  - 当前 `dynamic-memory` 已经足够作为第一阶段提炼框架，但还不足以作为稳定判定框架
- 决策:
  - 在 case 文档中补入：
    - `按 dynamic-memory 标准反评`
    - `对 dynamic-memory 设计的反向评估`
  - 将当前 `dynamic-memory` 的阶段定位固定为：
    - 适合作为 `第一阶段提炼框架`
    - 还不适合作为 `第二阶段稳定判定框架`
- 未解问题:
  - 反馈聚合与状态阈值应如何表达，才能既可执行又不绑定单一后端
- 下一步:
  - 定义反馈聚合与状态变更阈值
  - 然后回到 `agent_identity`

## R-0020 以框架方式定义 feedback aggregation 与 state transition threshold

- 日期: 2026-03-27
- 目标: 在不冻结算法和数值阈值的前提下，为 `dynamic_memory` 补上反馈聚合与状态变化门槛的基础框架
- 输入:
  - 当前 `dynamic-memory.md` 中已经存在的 `feedback_object`、规则挂接、晋升/失效/反思规则
  - R-0019 中关于“第一阶段提炼框架已足够，但稳定判定框架仍不足”的结论
- 动作:
  - 在 `dynamic-memory.md` 中新增：
    - `feedback aggregation`
    - `state transition threshold`
  - 两部分都只定义目标、最小输入/输出、原则与非目标
  - 刻意不引入固定权重、数值公式或后端绑定实现
- 发现:
  - 当前最需要的不是“算得更精确”，而是先把判断链路补完整
  - `feedback aggregation` 与 `state transition threshold` 必须分开：
    - aggregation 解决“反馈整体说明了什么”
    - threshold 解决“这些说明是否足以触发状态变化”
  - 用 `supporting / conflicting / insufficient` 和 `ready / hold / review / block` 这类条件型输出，足以支撑第一阶段框架，又不会过早冻结实现
- 假设:
  - 只要先把这两层抽象补齐，后续无论是规则实现、人工审阅还是半自动策略，都有稳定挂点
- 决策:
  - 将 `feedback aggregation` 固定为方向性判断框架，而不是评分系统
  - 将 `state transition threshold` 固定为条件门槛框架，而不是数值阈值表
- 未解问题:
  - 后续是否需要将不同对象类型的 threshold 再拆成独立子文档
  - 冲突反馈在多大程度上默认进入 `review` 而不是 `hold`
- 下一步:
  - 如继续细化，应先做“反馈冲突处理与检索可见性”的框架
  - 然后回到 `agent_identity`

## R-0021 以框架方式细化 agent_identity

- 日期: 2026-03-27
- 目标: 在不进入 ID 生成算法和注册机制的前提下，补足 `agent_identity` 的判断框架，明确身份锚点、连续性判断和最小生命周期
- 输入:
  - 当前 `agent-identity.md` 中已有的最小字段
  - 整个 `Portable Agent Contract` 对“可移植 Agent 员工”的边界要求
- 动作:
  - 在 `agent-identity.md` 中新增：
    - `身份锚点`
    - `连续性判断`
    - `身份生命周期`
    - `非目标`
  - 刻意不定义：
    - ID 生成算法
    - 自动比对规则
    - 注册中心或认证机制
- 发现:
  - `agent_identity` 的难点不在字段罗列，而在“什么变化仍算同一个 Agent”
  - 名称调整、技能增长、环境适配，不应被误判为新 Agent
  - 使命改写、专业角色切换、血缘断裂，才更接近身份变化
  - 用 `established / evolving / forked / retired` 这种最小生命周期表达，已经足以支持第一阶段判断
- 假设:
  - 当前阶段只要先固定身份判断原则，后续无论是文件存储、数据库还是注册服务，都能围绕同一逻辑实现
- 决策:
  - 将 `agent_id + canonical_name + specialization + mission + lineage` 固定为身份锚点集合
  - 将“增强不等于换人，分叉才更接近新身份”固定为默认判断原则
- 未解问题:
  - 后续是否需要单独定义 `fork` 与 `clone` 的区别
  - `mission` 变化到什么程度才算“根本改写”，还需要更多 case 支撑
- 下一步:
  - 如继续留在框架层，可补 `冲突处理` 与 `检索可见性`
  - 也可以开始回到更系统化的 `agent / memory / feedback` 关系图

## R-0022 新增 Mermaid 关系图并固定图示规范

- 日期: 2026-03-27
- 目标: 为 `Portable Agent Contract` 增加一张稳定的对象关系图，并把图示规范固定为 Mermaid
- 输入:
  - 当前已形成的 `agent_identity / skill_pack / dynamic_memory / adapter_contract / feedback_object` 关系
  - 用户要求今后所有示意图统一使用 Mermaid
- 动作:
  - 新建 `docs/portable-agent-contract/relationship-map.md`
  - 用 Mermaid 绘制 `agent / skill / memory / feedback / adapter / environment` 的关系图
  - 在主入口 `docs/portable-agent-contract.md` 中加入子文档导航
  - 在项目侧 `AGENTS.md` 中加入“以后所有示意图统一使用 Mermaid”
- 发现:
  - 当前对象关系已经足够稳定，适合抽成一张高层图
  - 把图示规范提前固定，有助于后续文档风格一致，也方便后面继续增图
- 假设:
  - 当前这张图更适合作为关系总览，而不是流程图或状态机图
- 决策:
  - 用 Mermaid 作为本项目后续所有示意图的统一格式
  - 将关系图保存在 `Portable Agent Contract` 子目录下，作为长期入口之一
- 未解问题:
  - 未来是否需要继续补：
    - 反馈聚合图
    - 状态变化图
    - 身份演化图
- 下一步:
  - 如继续细化，可补 `冲突处理 / 检索可见性`
  - 或继续新增关系图对应的子图

## R-0023 统一 dynamic-memory 三流程数据协议的初步拆解

- 日期: 2026-04-01
- 目标: 梳理 `dynamic-memory` 三条流程的重叠字段、职责边界和潜在公共载体，为统一数据协议做准备
- 输入:
  - `docs/portable-agent-contract/dynamic-memory.md`
  - `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
  - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
  - `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
  - `docs/portable-agent-contract/relationship-map.md`
- 动作:
  - 对比三条流程的核心对象、生命周期操作、门控条件与输出类型
  - 检查它们是否已经共享足够的元数据与状态表达
  - 判断更适合“统一信封”还是“完全共用字段集”
- 发现:
  - 三条流程在概念层已共享一批核心语义：`agent_identity`、`Episode`、`Learning`、`Behavior Delta`、`evidence_refs`、`review_state`、`applicability`
  - 现有文档更像职责拆分，而不是通信协议拆分；因此三者之间缺少一个显式的公共载体
  - 短期反馈侧重证据采集与状态归因，蒸馏侧重对象晋升与回退，长期索引侧重检索门控与注入
  - 若三条流程直接交换各自的专属结构，容易出现字段重复、状态语义不一致和对象身份漂移
- 假设:
  - 更稳妥的方向不是把三条流程压缩为完全同构，而是先定义一个跨流程公共信封，再允许每条流程持有最小扩展字段
- 决策:
  - 在用户确认协议形态前，不冻结统一 schema
  - 后续设计优先回答“公共信封必需字段是什么”以及“哪些字段只允许某一流程拥有”
- 未解问题:
  - 是否需要以 `memory_event` 作为三流程统一入口对象
  - 公共字段是否应覆盖 `state / evidence / relation / target / visibility`
  - 三条流程之间同步的基本单位应是“对象”还是“事件”
- 下一步:
  - 等待用户确认统一策略偏向 `公共信封 / 完全共用 / 分层共享`
  - 基于选择，再提出 2-3 种可行方案并进入设计讨论

## R-0024 评估 dynamic-memory 三流程是否具备公共数据层条件

- 日期: 2026-04-01
- 目标: 判断 `short-term feedback`、`memory distillation`、`long-term memory index` 是否已经具备统一公共信封与共享核心数据层的条件
- 输入:
  - `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
  - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
  - `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
  - `docs/portable-agent-contract/agent-identity.md`
  - `docs/portable-agent-contract/skill-pack.md`
  - `docs/portable-agent-contract/adapter-contract.md`
- 动作:
  - 交叉比对三条流程的对象、字段、状态、证据与可见性规则
  - 识别哪些字段是路由/归属/审阅/检索通用元数据，哪些字段只属于局部流程
  - 判断“公共信封”与“完全共用 payload”是否应分开处理
- 发现:
  - 三条流程已经共享足够多的公共语义，尤其是 `agent_identity`、`evidence_refs`、`review_state`、`applicability`、`state`、`visibility` 这一组跨流程概念
  - 它们的差异主要在流程目标，而不是底层数据语义：
    - 短期反馈偏证据采集与归因
    - 记忆蒸馏偏对象晋升、回退与再整合
    - 长期索引偏检索门控与注入决策
  - 因此，三者具备统一“公共信封”的条件
  - 但三者暂不具备直接压成“完全同构 payload”的条件；强行同构会让局部流程不得不携带大量只对别的流程有意义的字段
  - 更合理的做法是：公共信封负责跨流程通信，公共核心对象负责稳定语义，流程扩展字段只放在各自子类型里
- 假设:
  - 如果后续实现发现三流程频繁互传同一批局部字段，那么这些字段可以再上移到公共核心层
  - 当前阶段先保留局部扩展，比过早强制扁平化更稳
- 决策:
  - 结论先收敛为：`公共信封成立，完全共用暂不成立，分层共享更符合现状`
  - 后续若进入设计，应优先抽出“公共元数据层”和“流程 payload 层”的边界
- 未解问题:
  - 公共信封的最小字段是否应包含 `event_type / object_ref / target_ref / evidence_refs / review_state / visibility / timestamps`
  - `Episode / Learning / Behavior Delta / feedback_object` 哪些应进入公共核心，哪些应留作流程局部类型
  - 哪些字段属于纯运行时状态，哪些字段应持久化进入 memory 本体
- 下一步:
  - 让用户确认是否继续沿“公共信封 + 分层共享”推进
  - 如果确认，再进入公共字段最小集的设计

## R-0025 收敛 dynamic-memory 的最小公共字段集与非统一边界

- 日期: 2026-04-01
- 目标: 在确认“公共信封 + 分层共享”方向后，进一步判断三流程最小公共字段集，以及哪些字段不应被统一
- 输入:
  - `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
  - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
  - `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
  - `docs/portable-agent-contract/agent-identity.md`
- 动作:
  - 将三流程字段按三层重新归类：
    - 公共信封层
    - 公共核心对象层
    - 流程扩展层
  - 检查每个字段是服务“通信”“对象语义”还是“局部操作策略”
  - 判断哪些字段若被上移会导致语义污染
- 发现:
  - `dynamic-memory` 三流程已经足够支撑一个最小公共信封，公共信封应优先承载“跨流程路由与审阅元数据”，而不是对象详情
  - 更合理的公共信封最小字段候选为：
    - `message_id`
    - `identity_id`
    - `object_kind`
    - `object_ref`
    - `event_type`
    - `target_ref`
    - `evidence_refs`
    - `review_state`
    - `visibility`
    - `state`
    - `applicability`
    - `created_at`
    - `observed_at`
    - `updated_at`
  - 其中：
    - `identity_id / object_kind / object_ref / event_type` 负责跨流程路由
    - `target_ref / evidence_refs` 负责关联与证据回放
    - `review_state / visibility / state` 负责审阅、注入、失效判断
    - `applicability` 负责从蒸馏与长期检索之间共享情境命中语义
    - 时间字段负责回放顺序、反馈有效期和状态迁移追踪
  - 目前具备公共核心语义的对象字段，只适合抽到“对象基类”层，不适合全部塞进公共信封：
    - `Episode`
      - 至少需要情境、动作、结果、证据引用
    - `Learning`
      - 至少需要 `claim / applicability / failure_conditions / evidence_refs`
    - `Behavior Delta`
      - 至少需要可执行结论、`review_state / applicability / evidence_refs / state`
    - `feedback_object`
      - 至少需要 `signal_type / polarity / target_ref / evidence_refs / observed_at`
  - 以下字段当前不应统一到公共核心：
    - 短期反馈局部字段：
      - `signal_type`
      - `polarity`
      - `feedback aggregation`
      - `state transition threshold`
    - 蒸馏流程局部字段：
      - `promotion_target`
      - `failure_conditions`
      - `consolidate / reconsolidate / reflect` 这类操作态字段
    - 长期索引局部字段：
      - `last_inject_turn`
      - `cooldown_turns`
      - `soft_hit_counter`
      - `injected_events`
      - `MemoryHint`
  - 上述非统一字段的共同特征是：它们服务局部流程控制，而不是记忆对象本体，也不是跨流程必需通信字段
- 假设:
  - 若后续实现中发现 `promotion_target` 不只是索引/蒸馏控制字段，而是多个流程都必须依赖的长期晋升目标，则它可以再上移为公共核心字段
  - 若未来要支持统一事件总线，`message_id + event_type + object_ref` 这组字段可作为最小事件键
- 决策:
  - 公共信封只统一“通信所需最小字段”，不承载完整对象内容
  - 对象共性应分两层表达：
    - 信封层：通信与路由
    - 对象层：`Episode / Learning / Behavior Delta / feedback_object` 的公共语义字段
  - 流程控制字段继续留在各自子流程，避免把统一协议做成巨型控制面板
- 未解问题:
  - `review_state / visibility / state` 是否应进一步统一成一个更抽象的“可见性与生命周期状态机”
  - `applicability` 是否应成为 `Learning` 与 `Behavior Delta` 的必填字段，而 `Episode` 仅允许可选
  - `target_ref` 与 `object_ref` 是否需要区分“事件作用对象”和“当前消息承载对象”
- 下一步:
  - 若继续设计，可先写一版“公共信封 + 四类对象基型”的最小协议草案
  - 然后再回到三条子流程，检查是否有字段需要回填或改名以减少语义分叉

## R-0026 收紧当前阶段目标为“只定义公共信封”

- 日期: 2026-04-01
- 目标: 避免在 `dynamic-memory` 三流程协议统一中继续上升到对象基型设计，先把当前阶段收敛到最小可用公共信封
- 输入:
  - R-0024 与 R-0025 的研究结论
  - 用户新增约束：现阶段保持简单直接，不做过度设计
- 动作:
  - 停止继续展开第二层对象公共核心
  - 将当前阶段目标收缩为“只定义公共信封”
  - 保留对象基型讨论为后续可选研究，而不是当前交付物
- 发现:
  - 目前最稳定、最有共识的部分是跨流程通信字段，而不是对象基型
  - 若现在继续定义 `Episode / Learning / Behavior Delta / feedback_object` 的公共核心，容易在证据不足时把对象模型过早冻结
  - 公共信封已经足够支撑三流程之间的通信、短期记忆触发、蒸馏管道衔接与提取入口统一
- 假设:
  - 只要公共信封稳定，后续对象内部结构即使继续调整，也不会破坏流程之间的基本协议兼容性
- 决策:
  - 当前阶段只定义公共信封
  - 第二层对象公共核心暂不进入正式设计
  - 第三层流程扩展继续保留在各自子流程文档中
- 未解问题:
  - 公共信封字段是否还需要进一步压缩
  - `target_ref` 与 `object_ref` 是否都需要保留
  - 时间字段是保留 `created_at / observed_at / updated_at` 三个，还是先缩到两个
- 下一步:
  - 直接收敛公共信封的最小字段集
  - 然后再决定这些字段应写入哪个正式文档

## R-0027 压缩 dynamic-memory 公共信封到第一阶段最小集合

- 日期: 2026-04-01
- 目标: 将公共信封从“候选字段集合”压缩到真正第一阶段必需的最小字段
- 输入:
  - R-0025 中列出的 14 个公共信封候选字段
  - 用户新增要求：现阶段继续压缩，保持简单直接
- 动作:
  - 按“没有它是否还能完成跨流程通信”这一单一标准逐项筛选
  - 将对象语义字段、审阅字段、流程控制字段尽量移出公共信封
  - 保留少量必要的可选字段，用于兼容反馈挂接场景
- 发现:
  - 第一阶段公共信封不需要承载完整状态判断，只需要支撑“谁发的、是什么对象、发生了什么、关联到谁、证据在哪、何时发生”
  - 因此，以下字段可以压缩出公共信封：
    - `review_state`
    - `visibility`
    - `state`
    - `applicability`
    - `created_at`
    - `updated_at`
  - 上述字段虽然重要，但它们更接近对象本体状态或流程门控条件，而不是最小通信必需字段
  - 第一阶段更稳的公共信封最小集合应为：
    - `message_id`
    - `identity_id`
    - `object_kind`
    - `object_ref`
    - `event_type`
    - `evidence_refs`
    - `observed_at`
  - 其中 `target_ref` 不应作为全局必填字段，但应保留为可选字段：
    - 在 `feedback_object` 场景中需要它表达“这条反馈作用于谁”
    - 在 `Episode / Learning / Behavior Delta` 自身流转时，不一定需要它
- 假设:
  - 若后续发现 `event_type + object_ref` 已足以唯一描述动作语义，`message_id` 甚至还可以再评估是否下沉为实现层
- 决策:
  - 第一阶段公共信封先压到：
    - 必填：
      - `message_id`
      - `identity_id`
      - `object_kind`
      - `object_ref`
      - `event_type`
      - `evidence_refs`
      - `observed_at`
    - 可选：
      - `target_ref`
- 未解问题:
  - `message_id` 是否属于协议层必需，还是实现层生成即可
  - `evidence_refs` 是否允许为空数组，还是要求至少一条弱引用
  - `observed_at` 是否应统一改名为更中性的 `timestamp`
- 下一步:
  - 若进入正式设计，可直接以这 7+1 字段写出公共信封草案
  - 然后检查三条子流程文档是否需要回填同名字段以减少歧义

## R-0028 收敛 Codex 环境下实验性 agent_identity MVP 的问题边界

- 日期: 2026-04-01
- 目标: 在进入 MVP 定义阶段前，基于全仓库文档判断“给 Codex 环境使用的实验性 agent_identity 最小实现”应落在哪一层
- 输入:
  - `README.md`
  - `docs/portable-agent-contract.md`
  - `docs/portable-agent-contract/agent-identity.md`
  - `docs/portable-agent-contract/skill-pack.md`
  - `docs/portable-agent-contract/adapter-contract.md`
  - `docs/portable-agent-contract/relationship-map.md`
  - 最近提交历史
- 动作:
  - 复读主入口与子文档，确认仓库当前仍处于契约和研究阶段，而不是实现阶段
  - 对比 `agent_identity`、`skill_pack`、`adapter_contract` 的边界，判断 MVP 应该先最小实现哪个组合
  - 检查最近提交，确认当前演化重点仍是文档契约收敛，而不是代码实现
- 发现:
  - 当前仓库还没有运行时代码，稳定资产主要是研究文档与 `Portable Agent Contract`
  - `agent_identity` 已有概念上的最小组成与边界，但还没有落到“在 Codex 环境中如何最小携带、加载、识别”的实验性实现层
  - 从关系图与顶层约束看，若 MVP 过早把 `dynamic_memory` 或完整 `adapter_contract` 拉进来，会明显扩大范围
  - 更稳妥的 MVP 起点应优先验证：Codex 环境下，一个实验性 Agent 身份最少需要哪些文件、字段和装载约定，才能被视为“可移植 Agent 本体的起点”
- 假设:
  - 第一版 MVP 大概率更像“身份包 + 启动约定 + 最小兼容目录结构”，而不是完整服务或完整记忆闭环
- 决策:
  - 在用户进一步确认 MVP 目标前，不进入详细实现计划
  - 下一步应先澄清：这个 MVP 更偏“文档化契约样例”，还是“可在 Codex 环境直接挂载的最小资产包”
- 未解问题:
  - MVP 是否需要包含 `skill_pack` 的最小骨架，还是只聚焦 `agent_identity`
  - MVP 是否需要显式绑定 Codex 当前会话机制，例如 agent 配置文件、目录结构、启动入口
  - “实验性最小实现”是否要求能被真实加载运行，还是只要求计划阶段定义清楚
- 下一步:
  - 向用户确认 MVP 的目标形态与最低成功标准
  - 再基于答案提出 2-3 种收敛方案

## R-0029 将 Codex agent_identity MVP 的成功标准收敛为“可运行原型”

- 日期: 2026-04-01
- 目标: 固定本轮 MVP 设计的最低成功标准，避免把“可运行原型”和“文档样例 / 可挂载资产包”混在一起
- 输入:
  - 用户确认选择 `可运行原型`
  - 用户新增约束：
    - 计划需要写明服务进程管理
    - 计划需要写明短期记忆和长期记忆部署环境
    - 结构可以完整，但每个部分必须是极简最小实现
    - 即使主体功能很弱，也要先把流程串起来
    - 优先保证未来每一步都能做可靠性验证
- 动作:
  - 将本轮目标从“身份包样例”升级为“可运行原型”
  - 固定原型设计原则为：链路优先、功能最小、验证优先
- 发现:
  - 用户当前要验证的不是单个对象定义，而是“Codex 环境中的最小全链路骨架”能否成立
  - 因此 MVP 不应只停留在 `agent_identity` 文档字段，而应至少覆盖：
    - 身份加载入口
    - 运行中的服务/进程边界
    - 短期记忆与长期记忆的最小部署落点
    - 可观测、可回放、可逐步验真的流程串联
  - 但用户同时强调每个部分都应保持极简，这意味着原型的重点是“链路成立”，不是“能力完整”
- 假设:
  - 更稳妥的原型方向会把复杂能力留空实现或 stub 化，但保留明确的接口、目录、进程和验证点
- 决策:
  - 本轮后续设计以“可运行原型”作为最低交付标准
  - 计划必须覆盖服务进程管理，以及短期/长期记忆的部署环境
- 未解问题:
  - 原型应该优先做单进程最小串联，还是允许拆成 2 个最小进程
  - `agent_identity` 在原型中是由文件直接加载，还是由独立服务注册和分发
  - 短期记忆和长期记忆是否需要物理分离部署，还是先逻辑分离即可
- 下一步:
  - 继续澄清原型的最小运行形态
  - 然后给出 2-3 种可行 MVP 方案对比

## R-0030 将 Codex agent_identity MVP 的运行形态收敛为“文件优先单进程”

- 日期: 2026-04-01
- 目标: 固定实验性 `agent_identity` MVP 的最小运行形态，避免后续计划同时混入多进程和存储重型方案
- 输入:
  - 用户确认：
    - 原型最低成功标准为 `可运行原型`
    - 运行形态选择 `单进程优先`
    - 方案选择 `文件优先单进程`
- 动作:
  - 对比 `内存优先原型 / 文件优先单进程 / 嵌入式数据库单进程`
  - 依据“链路优先、验证优先、实现极简”的标准收敛方案
- 发现:
  - `内存优先原型` 虽然更快，但对部署边界和可靠性验证帮助不足
  - `嵌入式数据库单进程` 更易扩展，但会过早把焦点拉到存储实现
  - `文件优先单进程` 最符合当前目标：
    - `agent_identity` 可由文件直接加载
    - 短期记忆与长期记忆可用不同目录做最小部署隔离
    - 同一进程可串起加载、写入、蒸馏、提取与验证流程
    - 后续每一步都容易替换为更强实现而不破坏整体链路
- 假设:
  - 第一版 MVP 可以把许多处理逻辑做成最小 stub，只保留清晰的 I/O、目录边界和进程生命周期
- 决策:
  - Codex 环境下实验性 `agent_identity` MVP 采用 `文件优先单进程`
  - 后续计划应围绕“一个最小服务进程 + 两类文件部署目录 + 可回放验证点”展开
- 未解问题:
  - 这个单进程是 CLI 驱动的短生命周期进程，还是常驻本地服务
  - 短期记忆与长期记忆目录的最小命名和边界如何定义
  - 对 Codex 环境的接入形式，是通过命令调用、MCP 包装，还是本地脚本入口
- 下一步:
  - 进入设计第一节：定义 MVP 的最小组成部分
  - 再逐节确认后写入 `plans/mvp/`

## R-0031 确认 Codex agent_identity MVP 的最小组成并进入计划编写

- 日期: 2026-04-01
- 目标: 将 `文件优先单进程` MVP 的组成边界固定下来，作为计划编写的直接输入
- 输入:
  - 用户确认 `文件优先单进程` 方案方向正确
  - 已提出的 5 个最小组成：
    - `agent_identity` 资产文件
    - 单进程运行入口
    - 短期记忆目录
    - 长期记忆目录
    - 最小验证脚本或验证命令
- 动作:
  - 固定 MVP 的最小组成边界
  - 明确当前阶段不再扩展：
    - 完整 `skill_pack`
    - 复杂检索
    - 后台蒸馏器
    - MCP 服务化
- 发现:
  - 这 5 个部分已经足以支撑一条从身份加载到记忆落点再到验证回读的最小闭环
  - 当前最重要的是让链路成立且可验证，而不是让每个子模块都具备强功能
  - 将复杂能力排除出 MVP，有助于把后续每一步验证都保持在可解释范围内
- 假设:
  - 只要这 5 个部分的 I/O 边界和目录边界清楚，后续就可以逐步替换内部实现而不重写整条链路
- 决策:
  - 以这 5 个部分作为 Codex 环境实验性 `agent_identity` MVP 的最小组成
  - 进入计划编写阶段，计划落在 `plans/mvp/`
- 未解问题:
  - 单进程入口的最小交互形式到底是一次性 CLI 命令还是本地常驻服务
  - 长期记忆第一版写出的是正式对象，还是占位对象
- 下一步:
  - 编写面向实现的 MVP 完整计划

## R-0032 为 Codex agent_identity MVP 补充执行任务清单

- 日期: 2026-04-01
- 目标: 将已确认的 MVP 计划进一步压缩为可直接执行的任务清单，避免计划停留在结构描述层
- 输入:
  - `plans/mvp/2026-04-01-codex-agent-identity-mvp-plan.md`
  - 已确认的 MVP 组成、运行形态与边界
- 动作:
  - 在计划文件中增加任务清单、执行顺序和最小验收走查
  - 将任务拆到“文件格式 / CLI 协议 / 身份加载 / 短期写入 / 长期落点 / 回读摘要 / 错误与重复运行验证”七个动作
- 发现:
  - 当前 MVP 的主要风险不是缺设计，而是执行时范围重新膨胀
  - 将任务顺序固定后，更容易在实现期逐步验证链路，而不是并行扩写多个子系统
- 假设:
  - 只要先固定文件格式和 CLI 协议，后续实现阶段的大部分返工都可以避免
- 决策:
  - 计划文件不只保留结构说明，也保留执行顺序与最小验收路径
- 未解问题:
  - 文件格式最终选型仍未确认
  - CLI 命令的参数形式仍未确认
- 下一步:
  - 如进入实现前最后确认，应优先敲定文件格式与 CLI 协议

## R-0033 调研 Codex agent_identity MVP 与后续迭代的技术选型

- 日期: 2026-04-01
- 目标: 为 `文件优先单进程` 的 Codex `agent_identity` MVP 以及后续项目迭代选择更稳妥的技术路线
- 输入:
  - 仓库当前状态：纯文档与研究阶段，无既有代码栈负担
  - OpenAI Developers / Codex 官方文档
  - MCP 官方文档与官方 SDK 文档
- 来源:
  - https://developers.openai.com/api/docs/models
  - https://openai.com/codex/
  - https://modelcontextprotocol.io/docs/sdk
  - https://github.com/modelcontextprotocol/typescript-sdk
  - https://github.com/modelcontextprotocol/python-sdk
- 动作:
  - 对比 TypeScript、Python、Go 在 MCP 生态、单进程文件原型、后续服务化、Codex 适配上的成本
  - 评估 MVP 阶段与后续迭代是否应采用同一技术栈
  - 评估文件格式、测试框架、运行时与后续存储演化路线
- 发现:
  - MCP 官方当前将 TypeScript、Python、C#、Go 列为 Tier 1 SDK，说明这几种语言都具备正式支持
  - 但 TypeScript SDK 与 Python SDK 的 `main` 分支当前都是 v2 预发布，官方仍建议生产使用 v1.x；这意味着如果项目很快要进入 MCP 服务化，应避免直接绑定不稳定分支
  - 对当前仓库最重要的不是“最快写出脚本”，而是“让 MVP 与后续 MCP 服务化保持一条连续演化路径”
  - 从这一点看，TypeScript 更稳：
    - 文件优先单进程 CLI 非常自然
    - 后续接 MCP 服务、Streamable HTTP、stdio 都有官方 TypeScript SDK 与 Node 侧中间件
    - JSON、Schema、CLI、文件 I/O、跨平台运行都较顺手
    - 与 Codex / MCP / Inspector 生态的例子和工具链贴合度高
  - Python 也可行，且原型速度很快，但当前官方明确提示主分支仍在 v2 开发中；如果后续目标是长期 MCP 服务化，会多一层版本迁移与依赖管理成本
  - Go 在长期服务稳定性上有吸引力，但对当前以“极简原型 + 文件优先 + 快速迭代验证”为主的阶段来说，收益不如 TypeScript
  - 文件格式方面：
    - `agent_identity` 更适合 JSON 或 YAML 这类强结构格式
    - 短期记忆和长期记忆原型更适合 JSON 文件，而不是一开始就用 Markdown
    - Obsidian/Markdown 更适合作为后续长期知识层，而不是 MVP 的运行时主格式
  - 测试与验证方面，第一阶段最需要的是：
    - fixture 驱动的目录级验证
    - CLI 黑盒测试
    - 文件产物校验
- 假设:
  - 若项目在 MVP 后很快进入 MCP 服务化与多客户端接入，TypeScript/Node 的收益会进一步放大
  - 若未来项目目标发生变化，转向重数据处理或研究脚本密集型工作流，Python 仍可作为辅栈引入，而不必成为主栈
- 决策:
  - 推荐主栈为：
    - `TypeScript + Node.js`
  - 推荐 MVP 技术组合为：
    - 运行时：`Node.js`
    - 语言：`TypeScript`
    - 包管理：`pnpm`
    - CLI 运行：`tsx`
    - schema 校验：`zod`
    - 测试：`vitest`
    - 文件持久化：`JSON` 文件
  - 推荐后续演化路线为：
    - MVP：文件优先单进程 CLI
    - 下一阶段：在同一代码基上增加 MCP server 入口
    - 再下一阶段：为短期运行时引入轻量索引或 SQLite，但长期知识层继续保持文件优先
- 未解问题:
  - `agent_identity` 更适合 JSON 还是 YAML
  - 第一阶段是否直接引入 MCP SDK，还是先做纯 CLI 内核，下一阶段再挂 MCP 入口
  - `pnpm + tsx` 是否已足够，还是需要同时引入构建产物流程
- 下一步:
  - 向用户汇报技术选型建议与备选方案
  - 如用户认可，再把 MVP 计划中的文件格式和 CLI 入口按该技术栈补具体

## R-0034 将技术选型结论写入 MVP 计划目录

- 日期: 2026-04-01
- 目标: 将已确认的技术选型从研究记录沉淀为 `plans/mvp/` 下的独立文档，作为后续实现计划的输入
- 输入:
  - R-0033 的技术选型结论
  - 用户确认偏好 `TypeScript + Node.js`
- 动作:
  - 在 `plans/mvp/` 下新增技术选型文档
  - 固定 MVP 与后续迭代的推荐主栈、推荐工具组合、非目标和演化路线
- 发现:
  - 将技术选型与 MVP 实施计划分开，有利于后续独立调整实现节奏，而不需要重写技术判断
- 假设:
  - 只要主栈不变，后续 CLI、MCP 服务化、轻量索引增强都可以在同一代码基中连续演化
- 决策:
  - 技术选型文档单独保存在 `plans/mvp/` 下
- 未解问题:
  - `agent_identity.json` 的最小结构尚未冻结
  - CLI 最小命令协议尚未冻结
- 下一步:
  - 继续定义 `agent_identity` 文件结构与 CLI 命令协议

## R-0035 将单进程 CLI 交互模式收敛为“混合模式”

- 日期: 2026-04-01
- 目标: 固定 MVP CLI 的最小交互方式，避免后续在“单命令全包”和“完全拆分子命令”之间反复摇摆
- 输入:
  - 用户对 CLI 交互差异的澄清需求
  - 用户确认接受 `混合模式`
- 动作:
  - 对比：
    - `一次性 run`
    - `子命令拆分`
    - `混合模式`
  - 结合 MVP 的“链路跑通 + 可靠性验证”目标收敛 CLI 方案
- 发现:
  - 如果只保留一个 `run`，虽然操作最短，但初始化与验证职责会被耦合进同一入口
  - 如果完全拆成多个子命令，结构最清晰，但第一版命令面会更宽，不够极简
  - `混合模式` 更适合当前阶段：
    - `run` 作为主入口，保证链路跑通
    - `init` 作为显式初始化入口
    - `verify` 作为显式验证入口
    - 必要时 `run` 可补最小自动初始化
- 假设:
  - 这种模式可以在不扩大第一版复杂度的前提下，保留未来做回归验证和排错的清晰切口
- 决策:
  - MVP CLI 采用 `混合模式`
  - 后续应围绕最少三个命令设计：
    - `init`
    - `run`
    - `verify`
- 未解问题:
  - `run` 是否默认自动创建缺失目录
  - `verify` 是只做文件结构检查，还是顺带做一次最小回读验证
- 下一步:
  - 定义 `agent_identity.json` 最小结构
  - 定义 `init / run / verify` 的最小命令协议

## R-0036 定义 `agent_identity.json` 与 CLI 最小协议

- 日期: 2026-04-01
- 目标: 为 Codex `agent_identity` MVP 固定第一版 JSON 身份文件结构与单进程 CLI 最小命令协议
- 输入:
  - `TypeScript + Node.js` 技术选型
  - `混合模式` CLI 交互方案
  - 当前 `agent_identity` 契约文档
- 动作:
  - 在 `plans/mvp/` 下新增独立契约文档
  - 固定 `agent_identity.json` 的五个最小字段
  - 固定 CLI 的三个最小命令：`init / run / verify`
- 发现:
  - 当前最稳妥的 `agent_identity` 文件仍应只保留五个身份字段，不承载任何运行时或工具配置
  - `init / run / verify` 已足够覆盖：
    - 初始化
    - 主链路执行
    - 结构与回读验证
  - 将 JSON 结构与 CLI 协议单独文档化，有利于后续实现时独立评审命令面与身份文件，而不污染总体计划
- 假设:
  - 只要这份契约保持稳定，后续即使把 CLI 核心逻辑抽到 MCP 服务层，也不需要重写身份资产结构
- 决策:
  - 在 `plans/mvp/` 下新增 `agent_identity.json` 与 CLI 契约文档
- 未解问题:
  - `run` 是否允许自动提示或自动补初始化
  - 是否需要在第一版就支持自定义根目录参数
- 下一步:
  - 若用户认可，可进入具体实现准备

## R-0037 补充 CLI 功能边界与命令使用说明

- 日期: 2026-04-01
- 目标: 将当前 CLI 的功能边界和全部命令使用方式正式写回计划文档，避免实现期对 CLI 职责产生扩张
- 输入:
  - 用户要求：
    - 将 CLI 功能边界写回文档
    - 同时补充所有指令使用说明
  - 已有 `agent_identity` 与 CLI 契约文档
- 动作:
  - 在 CLI 契约文档中增加：
    - `CLI 功能边界`
    - `总体使用方式`
    - `init / run / verify` 的使用说明
    - 命令之间不可互相替代的边界
  - 在总 MVP 计划中增加对该契约文档的引用
- 发现:
  - 若不把 CLI 边界显式写回文档，后续实现时很容易把 CLI 从“最小闭环入口”膨胀成“总控 runtime”
  - 将边界说明和命令使用说明放在同一契约文档中，更利于实现时直接对照
- 假设:
  - 只要 CLI 边界保持清晰，后续即使扩展 MCP 入口，也可以把 CLI 保持为稳定的本地验证界面
- 决策:
  - CLI 边界与命令使用说明统一保存在 `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md`
- 未解问题:
  - `run` 现在只定义为报错并提示先 `init`，后续是否需要支持自动初始化
- 下一步:
  - 若继续推进，可进入实现前最后确认或直接进入实现

## R-0038 明确当前 Codex 与 CLI 的调用关系

- 日期: 2026-04-01
- 目标: 消除“CLI 不负责 MCP server 时，Codex 如何使用原型”的歧义，并把当前接入方式写回文档
- 输入:
  - 用户问题：若 CLI 不负责 MCP server，Codex 怎么和 CLI 通信
  - 当前 MVP 边界：CLI 是本地单进程、文件优先、非 MCP
- 动作:
  - 在 CLI 契约文档中新增 `Codex 当前接入方式`
  - 明确当前调用链是：
    - Codex -> shell command -> CLI -> 本地文件目录
  - 在总 MVP 计划中补充“当前 Codex 接入方式”的简述
- 发现:
  - 当前阶段最稳妥的方式仍是让 Codex 通过本地命令直接调用 CLI，而不是提前引入 MCP 包装层
  - 这样可以把“核心链路验证”和“协议封装验证”分开，减少调试歧义
  - CLI 在当前阶段是 Codex 的直接接入入口；MCP 只是后续演化方向，不是当前前提
- 假设:
  - 只要 CLI 的输入输出和目录布局保持稳定，后续增加 MCP wrapper 时不会破坏当前本地验证路径
- 决策:
  - 当前 Codex 与原型 CLI 的通信方式固定为本地 shell 调用
  - 后续若进入 MCP 化，应以共享核心逻辑为原则，而不是替换 CLI
- 未解问题:
  - 后续 MCP 化时，是否保留完全一致的命令语义和参数面
- 下一步:
  - 若继续推进，可进入实现前最后确认或直接开始实现

## R-0040 记录 MVP CLI 实现期的环境约束与最小实现决策

- 日期: 2026-04-01
- 目标: 记录开始实现 MVP CLI 时实际发现的运行环境事实，以及因此做出的最小实现决策
- 输入:
  - 本机 Node / npm / pnpm 可用性检查
  - MVP 计划与 CLI 契约文档
- 动作:
  - 检查本机运行环境
  - 验证 Node 24 是否可直接执行 `.ts`
  - 验证 Node 内置测试是否可直接运行 `.ts` 测试文件
- 发现:
  - 当前环境具备：
    - `node v24.13.0`
    - `npm`
  - 当前环境不具备：
    - `pnpm`
  - Node 24 可通过 `--experimental-strip-types` 直接运行 `.ts` 文件
  - Node 24 内置测试也可通过 `--test --experimental-strip-types` 直接运行 `.ts` 测试
  - 因此第一版 CLI 可以在不安装额外依赖的前提下，用纯 Node 内建能力完成最小可验证实现
- 假设:
  - 这种零依赖实现更适合当前 MVP，因为它能把验证重点放在链路和目录边界，而不是包管理和构建流程
- 决策:
  - 第一版 CLI 实现采用：
    - TypeScript 源文件
    - Node 原生 `--experimental-strip-types`
    - Node 内置 test runner
  - 暂不引入外部运行依赖
  - `pnpm` 保留为后续工程化选项，不作为当前实现前提
- 未解问题:
  - 后续若进入更完整工程化阶段，是否仍保持零依赖运行，还是回到 `pnpm + tsx + vitest`
- 下一步:
  - 在当前实现基础上继续扩展 CLI 工程骨架与后续命令能力

## R-0041 固定 `init` 为 session 外动作

- 日期: 2026-04-02
- 目标: 修正当前框架中 `init` 的语义位置，确保其不被误解为每个 session 的固定前置步骤
- 输入:
  - 用户新增强调：本项目核心特点是跨 session 的 Agent，`init` 不应属于每个 session
  - 当前 MVP 计划与 CLI 契约文档
- 动作:
  - 回查现有文档中 `init / run / verify` 的边界描述
  - 将 `init` 明确收敛为 session 外的资产初始化动作
  - 将 `run` 明确收敛为 session 内主入口
- 发现:
  - 若不显式固定这条边界，后续实现很容易把 `init` 设计成“每轮先执行一次”的启动步骤
  - 这会直接破坏“同一个 Agent 跨 session 持续存在”的核心前提
- 假设:
  - 只要 `init` 被固定为 session 外动作，后续无论是 CLI 还是 MCP 接入，都更容易保持 Agent 资产与 session 生命周期分离
- 决策:
  - `init` 固定为 Agent 资产初始化动作，不属于每个 session
  - `run` 固定为 session 内一次执行链路的主入口
  - 同一个 Agent 初始化一次后，应跨多个 session 复用同一身份文件与记忆目录
- 未解问题:
  - 后续是否要显式增加“provision”或“bootstrap”之类更不易误解的命令名
- 下一步:
  - 在后续实现与文档中持续保持这条边界

## R-0042 为 Unity 优化专家默认 Agent 预置长期记忆

- 日期: 2026-04-02
- 目标: 创建一个新的默认 Agent，其身份定位为 Unity 项目优化专家，并基于官方资料预置一批第一阶段长期记忆
- 输入:
  - 用户要求：
    - 创建新的默认 Agent
    - 身份是 Unity 项目优化专家
    - 对内存垃圾和性能瓶颈极度苛刻
    - 预先在网上检索 Unity 和 C# 性能优化的通用经验并形成长期记忆
  - Unity 官方手册 / API 文档
  - Microsoft 官方 C# / .NET 性能文档
- 来源:
  - https://docs.unity3d.com/es/2021.1/Manual/Profiler.html
  - https://docs.unity3d.com/cn/2021.2/Manual/performance-incremental-garbage-collection.html
  - https://docs.unity3d.com/kr/current/ScriptReference/Pool.ObjectPool_1.html
  - https://docs.unity3d.com/ru/2019.4/Manual/BestPracticeUnderstandingPerformanceInUnity7.html
  - https://learn.microsoft.com/en-us/dotnet/csharp/advanced-topics/performance/
  - https://learn.microsoft.com/en-us/dotnet/api/system.buffers.arraypool-1
- 动作:
  - 基于现有 `agents/` 目录结构创建新的默认 Agent 资产目录
  - 编写符合当前最小契约的 `agent_identity.json`
  - 从官方资料中提炼一批适合长期保留的通用优化经验，写入长期记忆目录
- 发现:
  - Unity 官方明确强调应先使用 Profiler 识别 CPU、memory、renderer 等具体瓶颈，再迭代优化
  - Unity 官方明确说明 Incremental GC 能降低 GC spike，但不会让总 GC 成本更低
  - Unity 官方 API 已提供 `UnityEngine.Pool.ObjectPool<T>`，适合作为频繁创建/销毁对象场景的优先起点
  - Unity 官方手册建议在热路径中使用属性 ID 的整数接口，而不是重复使用字符串接口
  - Microsoft 官方文档强调：性能优化前先测基线，只在 hot path 上做内存优化，并在每次修改后重新测量
  - Microsoft 官方文档说明 `ArrayPool<T>` 适合降低频繁数组创建/销毁造成的 GC 压力
- 假设:
  - 这批经验足够作为 Unity 优化专家 Agent 的第一阶段长期记忆基线，但还不能替代项目级具体 profiling 结果
- 决策:
  - 新增默认 Agent：`unity-optimization-agent`
  - 预置长期记忆只采用官方一手资料
  - 长期记忆内容保持通用经验层，不混入具体项目结论
- 未解问题:
  - 后续是否要为该 Agent 增加 Unity 专项 `skill_pack`
  - 是否要单独预置“避免 LINQ、避免 per-frame allocation、非分配物理 API”等更多 Unity 细项记忆
- 下一步:
  - 用现有 CLI 对新 Agent 运行 `verify`

## R-0043 回答预设 identity 与外部 Codex session 使用条件

- 日期: 2026-04-03
- 目标: 回答当前仓库中有哪些预设 `agent_identity`，并判断现有 MVP 是否已经满足外部 Codex session 直接使用的条件
- 输入:
  - `agents/` 目录
  - `projects/cli/src/cli.ts`
  - `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md`
  - `docs/research-memory.md` 中关于 `init / run / verify` 边界与 Codex 接入方式的既有记录
  - `projects/cli/test/cli.test.ts` 的执行结果
- 动作:
  - 盘点 `agents/` 下现有身份资产
  - 核对 CLI 的输入输出和目录布局
  - 运行 CLI 测试，验证 `init / run / verify` 的本地闭环
- 发现:
  - 当前仓库中存在两个预设 `agent_identity`：
    - `research-agent`
    - `unity-optimization-agent`
  - `research-agent` 定位为研究型 Agent，`unity-optimization-agent` 定位为 Unity 性能优化专家
  - CLI 当前以本地 shell 命令方式工作，`init / run / verify` 都围绕 `agents/<agent_id>/...` 的本地目录布局展开
  - `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md` 已明确当前 Codex 接入方式不是 MCP，而是本地命令调用
  - `npm --prefix projects/cli test` 通过，说明当前最小链路在本仓库内可运行
- 假设:
  - “外部 Codex session 可使用”在这里不是指某个固定后端能力，而是指该 session 具备对同一仓库工作区的本地 shell 执行能力
  - 如果外部 session 不能访问这个仓库、不能执行本地命令，或没有 Node 24 环境，那么当前 MVP 不能直接成立
- 决策:
  - 将当前 MVP 的使用条件收敛为“同一工作区内、可执行本地命令的 Codex session”
  - 暂不把 MCP、远程服务或跨机器接入视为当前 MVP 已满足的能力
- 未解问题:
  - 是否需要为“外部 Codex session”补一份显式的接入说明，避免把“本地 shell 调用”误解成“任意远程会话都可直接使用”
  - 是否要把 `research-agent` / `unity-optimization-agent` 进一步整理成统一的预置目录索引页
- 下一步:
  - 若继续完善，可补一份“预设 Agent 索引”或“外部会话接入说明”

## R-0039 固定项目初始框架为 `projects/cli` 与 `agents/`

- 日期: 2026-04-01
- 目标: 在开始实现前固定最小工程骨架，避免后续把代码目录与 agent 运行目录混放
- 输入:
  - 用户要求：
    - 开始搭建项目框架
    - 框架根目录为 `projects/`
    - 当前先落 `cli`
    - 增加 `agents/` 作为默认 agent 存储目录和记忆目录
    - 每个 agent 内设置 `agent_identity.json` 和记忆目录
- 动作:
  - 固定代码工程目录与运行时 agent 数据目录分离
  - 决定先创建：
    - `projects/cli/`
    - `agents/<default-agent>/identity/agent_identity.json`
    - `agents/<default-agent>/memory/short-term/`
    - `agents/<default-agent>/memory/long-term/`
    - `agents/<default-agent>/runs/`
- 发现:
  - 将 `projects/` 与 `agents/` 分离，能避免后续把源码、构建产物和运行时记忆数据混在一起
  - 这种布局也更贴近当前 MVP 目标：CLI 是工程，agent 目录是默认运行时资产
- 假设:
  - 第一版先放一个默认 agent 样例，比只建空目录更利于后续尽快验证 `init / run / verify`
- 决策:
  - 当前实现骨架固定为：
    - `projects/cli/`
    - `agents/` 作为默认 agent 资产与记忆根目录
- 未解问题:
  - 默认 agent 的命名最终是否继续使用 `research-agent`
  - 是否需要在第一版就支持多个 agent fixture
- 下一步:
  - 创建最小目录结构和默认 agent 样例

## R-0044 讨论本机全局 `agents` 命令的包装方式

- 日期: 2026-04-03
- 目标: 设计一个能在本机其他项目中直接调用的 `agents` 命令入口，并让它稳定指向当前仓库的 CLI
- 输入:
  - 用户要求：在本机其他项目中直接调用 `agents` 命令
  - 当前 CLI 实现：`projects/cli/src/cli.ts`
  - 当前 CLI 使用 `process.cwd()` 作为运行根目录
- 动作:
  - 复核当前 CLI 的运行方式和目录边界
  - 讨论 `PATH` 级入口、仓库内 launcher、npm bin 三种包装方式
  - 确认当前更适合固定绝对路径的本机 launcher
- 发现:
  - 当前 CLI 若从任意项目调用，会把调用者所在目录作为运行根目录，这符合“在别的项目里操作该项目自身的 agents 目录”的预期
  - 如果 wrapper 在进入 CLI 前 `cd` 回本仓库，会把记忆读写错误地固定到 memory-server 仓库，不符合跨项目调用目标
  - 对“本机其他项目直接调用”的需求，最关键的是让 `agents` 命令进入用户 `PATH`，而不是只在仓库内存在
- 假设:
  - 当前仓库路径可以视为固定绝对路径，因此 wrapper 可以先采用硬编码仓库位置
  - 如果后续需要搬迁仓库，再补一层环境变量或重装脚本即可
- 决策:
  - `agents` 的包装入口应使用本机 `PATH` 中的可执行 launcher
  - launcher 只负责转发参数到当前仓库的 CLI，不改变调用者工作目录
  - 入口实现优先考虑 POSIX shell shim，避免把 Node 安装路径或项目构建物额外固化进系统级路径
- 未解问题:
  - launcher 是否只放在用户级目录，如 `~/.local/bin/agents`，还是还要在仓库内保留一份受控副本
  - 是否需要提供一个一键安装/更新脚本，帮助重建这个 PATH 入口
- 下一步:
  - 若继续实现，可创建 launcher 并把它挂到用户 `PATH`

## R-0045 落地本机全局 `agents` launcher 并验证跨目录调用

- 日期: 2026-04-03
- 目标: 将仓库内 `projects/cli` 暴露为本机可直接调用的 `agents` 命令，并验证它在其他目录下仍以调用者 cwd 作为运行根目录
- 输入:
  - 已批准的 launcher 设计
  - `projects/cli/src/cli.ts`
  - `projects/cli/test/cli.test.ts`
  - 本机 `PATH` 配置
- 动作:
  - 新增仓库内 `bin/agents` POSIX launcher
  - 将 launcher 通过 `~/bin/agents` 暴露到本机 `PATH`
  - 给 launcher 增加测试，验证它在任意 cwd 下会写入该 cwd 对应的 `agents/` 目录
  - 运行 `npm --prefix projects/cli test`
  - 从 `/tmp` 执行 `agents verify --agent-id research-agent`，确认命令已被 shell 解析且仍按当前目录运行
- 发现:
  - `bin/agents` 能把参数无损转发到 `projects/cli/src/cli.ts`
  - launcher 未改变调用者 cwd，因此在 `/tmp` 执行时会尝试读取 `/private/tmp/agents/research-agent/identity`
  - `command -v agents` 解析到 `/Users/screamcart-agent0/bin/agents`，说明本机入口已经可见
  - CLI 测试新增的 launcher 用例通过，说明仓库内路径与实际入口一致
- 假设:
  - 目前采用固定绝对路径指向仓库，适合当前单机使用场景；如果仓库搬迁，需要重新安装 launcher
- 决策:
  - 保留 `bin/agents` 作为仓库内受控入口
  - 使用 `~/bin/agents` 作为本机全局暴露点
  - 不在 launcher 中切换工作目录，以保持跨项目调用语义
- 未解问题:
  - 后续是否要把 launcher 安装步骤做成一个可重复执行的 `install` 脚本
  - 是否需要同时维护 `~/.local/bin/agents` 作为第二个暴露点
- 下一步:
  - 若继续工程化，可补一个安装脚本和卸载脚本，但当前已满足本机调用需求

## R-0046 说明其他仓库路径如何启用特定 `agent_identity`

- 日期: 2026-04-03
- 目标: 回答“在本机其他仓库路径里，如何用新的 `agents` 命令启用特定 `agent_identity`”
- 输入:
  - `projects/cli/src/cli.ts`
  - 当前 `agents` launcher
  - 用户问题：在本机其他仓库路径该怎么启用特定 agent identity
- 动作:
  - 回查 CLI 的 `rootDir = process.cwd()` 语义
  - 回查 `init / run / verify` 的目录落点
  - 将启用流程收敛为“在目标仓库 cwd 下初始化或复用本地 identity”
- 发现:
  - `agents` 命令会按调用时的当前目录作为根目录，因此每个仓库路径都拥有自己的 `agents/<agent_id>/...`
  - `init` 会在当前仓库下创建 `agents/<agent_id>/identity/agent_identity.json` 和记忆目录
  - `run` / `verify` 会在同一当前仓库路径下读取同一套 identity 与记忆文件
- 假设:
  - “启用特定 agent identity”在用户语境里指在目标仓库中创建并使用该 identity，而不是切换到全局共享的单一状态
- 决策:
  - 对任意本机仓库路径，启用步骤都应是：进入该仓库目录 -> `agents init --agent-id <id>` -> `agents run ...`
  - 若目标仓库里已经存在对应 identity，则可直接跳过 `init`
- 未解问题:
  - 是否需要再提供一个“复制预设 identity 到新仓库”的快捷命令
  - 是否要把 `research-agent` / `unity-optimization-agent` 进一步整理成可枚举的预设列表
- 下一步:
  - 如果需要，可补一份面向使用者的最短命令说明

## R-0047 将当前仓库明确为本机机器级共享源

- 日期: 2026-04-03
- 目标: 把“当前仓库作为这台机器上所有仓库可引用的共享 `agent_identity` 源”写成仓库级硬规则
- 输入:
  - 用户要求：本机所有仓库都可以引用本仓库的所有 `agent_identity`
  - 当前 `agents` launcher
  - 当前 `AGENTS.md`
- 动作:
  - 将共享语义上升为 `AGENTS.md` 的最高优先级规则
  - 明确调用者仓库只是运行上下文，不是 identity 真源
  - 保持当前 CLI 的 cwd 语义不变，但把身份与共享记忆的归宿明确指向当前仓库
- 发现:
  - 仅有本机 launcher 还不足以表达“全局共享”的产品目标，必须把共享源、写回路径和调用者角色写进仓库级约束
  - 如果不把共享源写进 `AGENTS.md`，后续很容易重新滑回每仓库一份独立 identity 的默认理解
- 假设:
  - 机器级共享的语义可以先以本仓库为 canonical source 来表达，后续如需迁移，只改共享源定位，不改共享规则本身
- 决策:
  - 当前仓库被定义为本机 `agent_identity` 与共享记忆的机器级共享源
  - 其他仓库通过全局 `agents` 命令访问并写回同一份共享身份与共享记忆
  - 默认不为其他仓库创建平行 identity 副本
- 未解问题:
  - 后续是否需要把共享源定位进一步抽象成可配置路径，而不是直接绑定到当前仓库
  - 是否需要增加一个显式的“共享身份列表”文档，方便其他仓库知道可引用哪些 identity
- 下一步:
  - 如果继续推进，实现层需要再把 launcher 与共享源定位对齐，避免只在文档层生效

## R-0048 将 `agents` 运行时切换为默认共享根

- 日期: 2026-04-03
- 目标: 让通过全局 `agents` 命令启动的 CLI 默认使用当前仓库作为共享根，而不是调用者仓库的本地目录
- 输入:
  - `projects/cli/src/cli.ts`
  - `bin/agents`
  - 现有测试与文档
  - `/tmp` 下的真实 launcher smoke test
- 动作:
  - 在 CLI 中新增共享根解析逻辑，优先读取 `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT`
  - 在 launcher 中默认注入共享根，并保留环境变量覆盖口
  - 更新测试，使 launcher 在另一个 cwd 下写入共享共享根而不是调用者工作区
  - 从 `/tmp` 真实执行 `agents run --agent-id research-agent --input "global shared root smoke test"`
  - 随后执行 `agents verify --agent-id research-agent`
- 发现:
  - 通过 launcher 从 `/tmp` 运行时，输出文件实际落在 `/Users/screamcart-agent0/obsidian-agent-memory-server/agents/research-agent/...`
  - `agents verify` 在独立调用中成功读取了刚写入的 long-term 对象，说明共享根读写链路成立
  - 直接运行 CLI 仍保留 `process.cwd()` 语义，便于本地测试和特殊覆盖场景
  - `npm --prefix projects/cli test` 通过，说明共享根改动没有破坏 direct CLI 行为，也没有破坏 launcher 路径
- 假设:
  - 目前“全局共享”主要由 launcher 驱动；如果后续希望所有入口都强制共享，还需要进一步收紧直接 CLI 的默认行为
- 决策:
  - 全局 `agents` launcher 默认指向当前仓库共享根
  - `OBSIDIAN_AGENT_MEMORY_SERVER_SHARED_ROOT` 作为显式覆盖口保留
  - 直接执行 CLI 仍保持本地 cwd 语义，不作为全局入口默认路径
- 未解问题:
  - 是否需要继续把 `research-agent` 之外的预设 identity 也补齐完整 memory skeleton，方便其他仓库即开即用
  - 是否要新增一个显式命令，区分“共享根运行”与“本地 cwd 运行”
- 下一步:
  - 如果继续推进，可把共享根配置抽成更明确的安装文档或 bootstrap 脚本

## R-0049 区分 Codex session 挂载与全局 skill 的角色

- 日期: 2026-04-03
- 目标: 回答“将 `agents` 挂载到另一个 Codex session 中”时，是否需要一个独特的全局 skill，以及它和共享 launcher 的关系
- 输入:
  - 用户问题：需要将 `agents` 挂载到另一个 Codex session 中
  - OpenAI 官方文档中的 Skills / Codex 相关页面
  - 当前仓库的 `agents` launcher 与共享根实现
- 动作:
  - 查阅官方文档，确认 Skills 是模型支持的工具能力之一
  - 对比“共享状态源”和“session 内使用入口”两层职责
  - 结合当前 launcher 设计，判断 skill 是否能替代 machine-level mount
- 发现:
  - 官方文档显示，GPT-5.4 / GPT-5.4 mini / GPT-5.4 nano 等模型支持 `Skills` 工具能力
  - 官方导航也把 `Skills` 作为工具类别之一列出，说明它是受支持的工具形态，而不是本项目所需的机器级共享状态存储
  - 当前仓库的 `agents` 共享语义来自 launcher + 共享根环境变量，而不是来自 Codex session 本身
  - 因此，“全局 skill”最多可以充当会话内的使用说明或调用包装，不会自动把本机 launcher 注入到另一个独立 session，也不会替代共享根
- 假设:
  - 如果另一个 Codex session 与当前机器共享同一文件系统和 PATH，那么它可以通过安装同一个 `agents` launcher 来复用共享源
  - 如果另一个 Codex session 是隔离环境或远程环境，则仅靠 skill 不足以让它看到本机路径
- 决策:
  - 共享状态仍以机器级 launcher + 共享根为主
  - skill 只能作为可选的使用说明层或 bootstrap 层，不作为共享记忆的真源
  - 若需要另一个 Codex session 直接“挂载”，优先让它获得同样的 launcher、共享根和环境变量，而不是先发明一个全局 skill
- 未解问题:
  - 是否要为另一个 Codex session 设计一个专门的 bootstrap skill，用来标准化安装与调用流程
  - 如果未来要支持远程/隔离 session，是否需要把共享根升级成远程服务或 MCP 后端
- 下一步:
  - 如果继续推进，可把“Codex session 接入说明”单独整理成一页文档

## R-0050 为 Codex session 增加发现入口与 bootstrap skill

- 日期: 2026-04-03
- 目标: 让另一个 FullAccess Codex session 能发现共享 `agent_identity`，选择对应 agent，并通过 `agents` 读写同一份共享记忆
- 输入:
  - 用户要求：在另一个 Codex session 中可发现当前存在的 agents，存取记忆
  - 当前共享根 launcher 语义
  - 新增的 `agents list` 命令
  - 新增并安装的 `agents-bootstrap` skill
- 动作:
  - 在 CLI 中新增 `list` 命令，枚举共享根下的有效 `agent_identity`
  - 将 `list` 输出为 JSON 数组，便于 session 内解析和选择
  - 创建薄的 `agents-bootstrap` skill，仅负责 `list -> run -> verify` 的会话流程
  - 将该 skill 安装到本机 Codex skills 目录
  - 运行 `npm --prefix projects/cli test`
  - 从 `/tmp` 真实执行 `agents list`
- 发现:
  - `agents list` 能返回当前共享根里的有效 agent 列表，并包含 identity 元数据与路径
  - `agents list` 在 `/tmp` 也能工作，说明另一个 session 只要拥有 PATH 中的 launcher 和共享根访问权限，就能发现当前共享源
  - 薄 bootstrap skill 只提供会话流程，不承担记忆真源职责
- 假设:
  - 未来如果另一个 session 需要更强的自动化，可以在 bootstrap skill 之上再叠加更强的编排层，但不应把 skill 本身当成共享状态存储
- 决策:
  - `agents list` 作为共享 identity 的发现入口
  - `agents-bootstrap` 作为会话内最薄入口说明 skill
  - 读写记忆仍通过共享 launcher 和共享根完成
- 未解问题:
  - 是否需要把 `agents list` 增加筛选参数，以支持更细粒度的会话选型
  - 是否需要在 skill 中加入自动选择规则，减少 session 手动决策
- 下一步:
  - 如果继续推进，可以先为 `agents list` 增加更稳定的机器可读选项，再扩展自动选择逻辑

## R-0057 纠正对 Codex hooks 的触发边界理解

- 日期: 2026-04-03
- 目标: 回答“为什么前面聊了这么多 wrapper 和注入机制，现在才确认 hooks 能满足需求”
- 输入:
  - 用户对 hooks 机制的追问
  - OpenAI 官方 Codex hooks 文档
  - 当前仓库的 wrapper / invariant block / agents-bootstrap 设计
- 动作:
  - 重新核对 hooks 可触发事件与可注入字段
  - 对比 compaction 与 turn 边界
  - 修正先前把 wrapper 说得过重的理解
- 发现:
  - Codex hooks 确实提供了会话级触发点：`SessionStart`、`UserPromptSubmit`、`Stop`、`PreToolUse`、`PostToolUse`
  - `SessionStart`、`UserPromptSubmit`、`Stop` 支持 `systemMessage`，可以用于重新注入极短约束
  - hooks 配置位于 `~/.codex/hooks.json` 或 `<repo>/.codex/hooks.json`，并通过 `config.toml` 的 `codex_hooks = true` 开启
  - 官方文档没有明确给出一个 `Compaction` 事件 hook，因此无法把“压缩瞬间”当作直接注入点
  - 先前把 wrapper 讲重了，原因是当时还没定位到 hooks 文档，而是把问题误当成只能靠外层脚本解决
- 假设:
  - 如果 Codex 在内部发生 compaction，但没有对外暴露对应 hook，那么最接近的策略仍是 turn 边界重注入，而不是 compaction 瞬时注入
- 决策:
  - 以后对长会话的约束重注入，优先使用 hooks，而不是纯 wrapper
  - wrapper 退化为安装、路径和环境准备层
  - 如果需要“压缩后立即恢复约束”，只能通过 turn 边界和会话重启间接实现
- 未解问题:
  - 是否需要把 invariant block 的内容压缩到足以在 `systemMessage` 中频繁重发而不造成噪音
  - 是否需要一个专门的 `stop_continue` 或 `session_start` hook 脚本模板
- 下一步:
  - 如果继续推进，应该直接产出 hooks 配置和注入脚本，而不是继续扩展 wrapper 讨论

## R-0058 清理冗余的会话触发推导记录

- 日期: 2026-04-03
- 目标: 删除已经被后续结论覆盖的重复推导，降低 memo 噪音
- 动作:
  - 移除 R-0051 到 R-0056
  - 保留 R-0049、R-0050 与 R-0057 作为关键转折和最终结论
- 发现:
  - R-0051 到 R-0056 主要重复了启动上下文、长会话协议、周期性注入和 wrapper 控制的同一条推导链
  - 这些内容的最终结论已经被 R-0057 的 hooks 纠正所覆盖
- 决策:
  - 研究 memo 只保留对未来判断仍有增量信息的记录
  - 对已经被后续结论吸收的中间推导，优先删除而不是长期保留

## R-0059 收敛 Codex hooks 的记忆注入边界与脚本分工

- 日期: 2026-04-03
- 目标: 为 `short-term-feedback` 与 `long-term-memory-index` 设计最小 hooks 触发面和对应脚本职责
- 输入:
  - 用户要求：增加 hooks 注册机制，让其他 Codex session 在特定时机存储或提取记忆
  - 现有动态记忆文档：`short-term-feedback.md`、`long-term-memory-index.md`
  - 官方 Codex hooks 文档
- 动作:
  - 核对 hooks 的官方触发边界与可注入能力
  - 收敛“记忆写入/提取”与“turn 内提示注入”的责任分层
  - 约束脚本实现必须复用现有 `agents` CLI，而不是直接写文件
- 发现:
  - `SessionStart` 适合做会话启动时的长期记忆预热/冷启动恢复
  - `UserPromptSubmit` 适合做每轮输入前的短期反馈归并与检索触发
  - `Stop` 适合做收尾记账、状态回填和必要的记忆落盘
  - `PreToolUse` / `PostToolUse` 适合作为 Bash 级证据采集与结果回填的局部护栏，但不应承担全局记忆主流程
  - 由于 `PreToolUse` 目前只拦截 Bash，脚本分工应避免依赖它做完整的记忆系统
  - `short-term-feedback` 更适合挂在 turn 级反馈收集与状态更新脚本上，`long-term-memory-index` 更适合挂在启动/提取/停止三个阶段脚本上
- 假设:
  - hooks 输出到 `systemMessage` 的内容应该足够短，只负责提醒与触发，不应塞入完整记忆正文
  - 记忆读写最终仍由 `agents` CLI 处理，hooks 只负责决定何时触发
- 决策:
  - 以 hooks 作为会话边界触发器，以脚本作为记忆操作执行器
  - 先设计最小的 4 个脚本角色：启动预热、输入前检索、停止回写、工具前后证据整理
  - 后续实现优先保持脚本薄、逻辑集中、可审计
- 未解问题:
  - `SessionStart` 是否需要区分 startup 与 resume 两种路径
  - `Stop` 是否同时承担 long-term 和记忆摘要的最终 flush
  - `PreToolUse` / `PostToolUse` 是否只用于 Bash，还是未来需要预留扩展位
- 下一步:
  - 基于这组边界，直接写出 hooks 方案和脚本清单的设计稿

## R-0060 定稿 Codex hooks 的设计文档与实施计划

- 日期: 2026-04-03
- 目标: 将 hooks 触发面、脚本职责和实现顺序固定为可执行文档
- 发现:
  - 设计文档已写入 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`
  - 实施计划已写入 `docs/plans/2026-04-03-codex-hooks-memory-registration.md`
  - 方案收敛为机器级 `~/.codex/hooks.json` 注册 + repo 管理的薄脚本 + 共享 `agents` CLI 写回
- 决策:
  - 先实现 `SessionStart`、`UserPromptSubmit`、`Stop`
  - 再实现 `PostToolUse`
  - `PreToolUse` 只保留 Bash 级护栏
  - 记忆读写继续复用现有 `agents` 命令，不新增直接写盘主路径

## R-0061 落地 Codex hooks 运行时与本机注册

- 日期: 2026-04-03
- 目标: 实现机器级 hooks 注册、共享 driver、事件适配器和最小测试覆盖
- 发现:
  - 已新增 `.codex/hooks.json` 作为 hooks registry 模板
  - 已新增 `scripts/codex-hooks/` 下的 `contracts.ts`、`state.ts`、`driver.ts` 和五个事件适配器
  - 已新增 `scripts/codex-hooks/install-hooks.sh`，并把 registry 安装到 `/Users/screamcart-agent0/.codex/hooks.json`
  - 通过 `scripts/codex-hooks/test/*.test.ts` 验证了 registry 结构、SessionStart / UserPromptSubmit / Stop 的 memory flow、PreToolUse 阻断、PostToolUse evidence capture，以及重复事件去重
- 决策:
  - 记忆写回仍通过现有 `agents` CLI
  - 事件适配器保持薄层，去重和状态回填集中在共享 driver
  - 机器级 registry 与 repo-local template 可同时存在，但 side effect 必须由事件键去重保证幂等

## R-0062 真实 Codex session smoke 在 Stop 阶段失败并开始采集 hook 输入证据

- 日期: 2026-04-03
- 目标: 定位跨 session smoke 中 `Stop` hook Failed 的真实原因
- 输入:
  - 真实 `codex exec` smoke 结果
  - 现有 hook driver / state / registry 代码
- 动作:
  - 复核 `Stop` 的 flush 路径和状态持久化路径
  - 排查是否为 `agents run` 失败、hook 返回协议不兼容，或 stdin payload 结构与本地假设不一致
  - 为 hook runtime 增加可选 debug 落盘，准备抓取真实 stdin / stdout
- 发现:
  - 真实 smoke 中 `SessionStart` 与 `UserPromptSubmit` 显示 Completed，但 `Stop` 显示 Failed
  - 目前没有看到可直接证明 `Stop` 失败点的原始 hook payload 和 stderr
  - `Stop` 失败很可能发生在 flush 相关路径，但也可能是 Codex hook 协议与本地假设不一致
- 假设:
  - 真实 Codex session 的 hook payload 字段或返回约束，与当前 driver 的本地测试假设存在偏差
  - 需要先采集原始 stdin/stdout，再决定是否收敛 `Stop` 返回值或调整 flush 条件
- 决策:
  - 先加 debug 证据采集，不直接扩大实现范围
  - 在拿到真实 payload 之前，不把 `Stop Failed` 归因到单一代码分支
- 未解问题:
  - Codex hooks 在真实 session 中的 stdin JSON schema 是否与本地 `HookInput` 定义一致
  - `Stop` 是否允许 `hookSpecificOutput`，或者只能返回更小的响应
  - `agents run` 在 flush 阶段是否真的成功执行
- 下一步:
  - 用 debug 环境重新跑一轮真实 `codex exec`
  - 读取 `/tmp` 中的 raw stdin / response / stderr 日志
  - 基于证据修正 `Stop` 的实现或返回形状

## R-0063 修正 Stop 为纯 side effect 后，跨 session smoke 成功

- 日期: 2026-04-03
- 目标: 让真实 Codex session 的 `Stop` hook 从 Failed 变成 Completed，并完成跨 session smoke
- 输入:
  - R-0062 采集到的真实 stdin / stdout 日志
  - 真实 `codex exec` smoke 复跑结果
- 动作:
  - 基于真实 payload 发现 `Stop` 输入包含 `stop_hook_active: false`
  - 将 `Stop` 从“flush + 回传额外上下文”改为“flush 但只返回 `continue: true`”
  - 重新运行真实 `codex exec`，并在 debug 目录核对 hook 日志与 state
- 发现:
  - `SessionStart` / `UserPromptSubmit` 在真实 session 中均为 Completed
  - 修改前 `Stop` 在真实 session 中会 Failed
  - 修改后 `Stop` 在真实 session 中变为 Completed
  - 跨 session smoke 成功时，shared root 内新增了 long-term object，内容来自 `Stop` flush 的 `[hook flush] ... assistant=hook-smoke-ok`
  - hooks state 也成功落在 `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STATE_ROOT` 指定目录下
- 假设:
  - 真实 Codex hooks 对 `Stop` 的返回约束比 `SessionStart` / `UserPromptSubmit` 更严格，至少不希望 `Stop` 再回传额外的 `hookSpecificOutput`
- 决策:
  - `Stop` 保持纯 side effect，避免向 Codex 返回额外上下文
  - 记忆回写仍保留在 `Stop`，但成功与否不再依赖 `Stop` 的附加输出
- 未解问题:
  - `stop_hook_active: false` 是否意味着未来还需要显式区分 stop hook 激活态与普通 stop 事件
  - 是否要为 `Stop` 的 flush 失败增加更明确的持久化告警字段
- 下一步:
  - 将本次 smoke 结果回写到设计文档对应段落，确保后续实现不再依赖 `Stop` 附加上下文

## R-0064 收敛仓库专用开发测试 identity 为 `agentic-memory-expert`

- 日期: 2026-04-03
- 目标: 为本仓库的开发与测试引入一个默认 identity，并确保它不会对其他仓库的 Codex session 暴露
- 输入:
  - 用户要求：创建一个仓库专用的开发测试 identity，负责 agentic-memory 框架开发和经验积累
  - 用户约束：只要是本仓库的开发需求都可以用，但不要暴露给其他仓库的 Codex session
  - 当前 `agents` 共享根与 Codex hooks 运行时
- 动作:
  - 收敛命名从“sandbox test agent”改为 `agentic-memory-expert`
  - 采用 `agent_identity + repo-local scope sidecar` 的方式做可见性隔离
  - 将本仓库默认绑定指向该 identity，并保留其他既有 identity 作为可选项
- 发现:
  - 单靠 identity 名称不能阻止跨仓库暴露，必须有运行时 scope 校验
  - 对其他仓库隐藏 `agentic-memory-expert` 的关键不是“改名”，而是把它标记为 repo-local 并让 CLI / launcher 读取 workspace root
- 假设:
  - 当前仓库作为 canonical workspace root，足以满足本需求的隔离边界
- 决策:
  - 本仓库默认开发 / 测试 identity 使用 `agentic-memory-expert`
  - 仅在本仓库 workspace root 下可见和可调用
  - 其他仓库 session 即使接触到共享 launcher，也应被 scope 规则拒绝或过滤
- 未解问题:
  - `agentic-memory-expert` 的 scope sidecar 是否应采用单一 workspace root，还是为未来分支工作区预留多 root 结构
  - 是否需要进一步把默认绑定从 `.codex/agent-memory` 提升到更显式的仓库级配置文件
- 下一步:
  - 实现 repo-local scope sidecar、CLI 过滤和 launcher workspace root 透传
  - 将本仓库的默认 binding 切换为 `agentic-memory-expert`

## R-0065 `agentic-memory-expert` 落地并通过 repo-local 可见性烟雾测试

- 日期: 2026-04-03
- 目标: 完成本仓库默认开发 / 测试 identity 的实际落地，并验证它在其他仓库 session 中不可见
- 输入:
  - 新增的 `agents/agentic-memory-expert/` identity 资产
  - repo-local scope sidecar
  - 更新后的 launcher 和 CLI scope 过滤
  - 更新后的 repo 默认 binding
- 动作:
  - 创建 `agentic-memory-expert` identity、scope 和最小记忆骨架
  - 将 launcher 改为透传 caller workspace root
  - 将 CLI 的 `list / run / verify` 改为基于 workspace root 的 scope 校验
  - 将本仓库默认 binding 切到 `agentic-memory-expert`
  - 运行 CLI 与 hooks 测试
  - 真实执行 `agents list` / `agents run` / `agents verify`
- 发现:
  - 本仓库 `agents list` 能看到 `agentic-memory-expert`
  - 其他 workspace root 下的 `agents list` 不会返回它
  - 其他 workspace root 下对 `agentic-memory-expert` 的 `run / verify` 会被 scope 拒绝
  - `agentic-memory-expert` 已生成第一条 long-term object，`agents verify --agent-id agentic-memory-expert` 通过
  - CLI 测试与 Codex hooks 测试都通过
- 假设:
  - 现有 repo-local scope 规则已经足够满足“本仓库可用、其他仓库不可见”的当前需求
- 决策:
  - 本仓库的默认开发 / 测试 identity 固定为 `agentic-memory-expert`
  - 该 identity 仅对当前仓库 workspace root 开放
  - 保留 `research-agent` 和 `unity-optimization-agent` 作为共享可见 identity
- 未解问题:
  - 是否需要为分支工作区预留多 workspace root scope 结构
  - 是否需要把 repo-local scope 进一步抽象成统一的 `agent_scope` 契约
- 下一步:
  - 若未来需要多工作区复用，再讨论 scope 的多 root 扩展

## R-0066 真实 Codex session 在默认 binding 下使用 `agentic-memory-expert`

- 日期: 2026-04-03
- 目标: 验证本仓库根目录下的真实 Codex session 是否会默认进入 `agentic-memory-expert`
- 输入:
  - 当前仓库根目录
  - 更新后的 repo-local binding
  - 更新后的 hooks runtime
- 动作:
  - 在本仓库根目录运行真实 `codex exec`
  - 观察 hooks 日志和最终输出
- 发现:
  - 真实 session 成功输出 `agentic-memory-expert-smoke-ok`
  - hooks 日志中出现双份 event 记录，说明全局与 repo-local registry 同时被加载
  - 由于 driver 的 event 去重和 state flush，实际记忆写入没有出现重复污染
- 假设:
  - 目前的双 registry 加载是 Codex hooks 的既有行为，而不是本项目的 scope 逻辑失效
- 决策:
  - 保留当前双 registry 结构，只依赖 driver 去重保障幂等
  - 如果后续噪音太高，再考虑把 repo-local template 和 active registry 进一步拆分
- 未解问题:
  - 是否要进一步减少 repo-local template 与 user-global active registry 的重复加载噪音
  - 是否需要在 docs 中明确说明双 registry 依赖去重是可接受的临时状态
- 下一步:
  - 暂无，除非后续需要降低 hooks 噪音

## R-0067 将当前 session 挂载到 `agentic-memory-expert`

- 日期: 2026-04-03
- 目标: 让当前 Codex session 直接以 `agentic-memory-expert` 作为开发上下文的默认 identity
- 输入:
  - 用户要求：现在开始在当前 session 挂载 `agentic-memory-expert`
  - 当前仓库的 repo-local binding
  - 当前 hooks 运行时状态
- 动作:
  - 确认仓库级 binding 已指向 `agentic-memory-expert`
  - 检查 hooks state root 是否已有旧 session state 需要迁移
  - 发现当前可见 hooks state root 下没有现成的旧 state 可迁移
- 发现:
  - 当前仓库 binding 已能让后续 hook 事件解析到 `agentic-memory-expert`
  - 没有发现需要回填的旧 session state，因此无需做额外迁移
- 假设:
  - 当前 session 的后续 turn 会按 repo-local binding 自动进入 `agentic-memory-expert`
- 决策:
  - 将当前 session 视为已挂载到 `agentic-memory-expert`
  - 后续开发、测试和记忆写入默认使用该 identity
- 未解问题:
  - 是否需要在未来为“当前 session 已挂载”的状态建立显式标记文件
- 下一步:
  - 继续以 `agentic-memory-expert` 作为当前仓库开发身份

## R-0068 收敛外部 Codex session 的 identity 选择与持续提示边界

- 日期: 2026-04-04
- 目标: 回答在外部 session 挂载时，是否应让用户选择 `agent_identity`，以及 hooks 是否应持续提示当前 identity
- 输入:
  - 用户要求：在外部 session 挂载时，需要让用户选择使用哪个 agent identity，并在 hook 中时刻提示 identity
  - 现有设计文档：`docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`
  - 当前 hooks / binding 研究结论
- 动作:
  - 复核现有 hooks 设计文档中 `Identity binding` 段落与 hook matrix
  - 对比当前机制里“谁决定何时触发记忆动作”和“谁决定 session 属于哪个 identity”
  - 收敛外部 session 下 identity 选择与持续提示应分别落在哪一层
- 发现:
  - 现有 hooks 设计已经明确：hooks 只负责“何时触发记忆动作”，不负责决定 session 属于哪个 `agent_identity`
  - 当前 binding 来源优先级只覆盖显式环境变量、repo-local binding 文件和 bootstrap 默认值，还没有明确“多 identity 可见时如何让用户选择”的交互路径
  - `SessionStart`、`UserPromptSubmit`、`Stop` 可以输出 `systemMessage` 或 `additionalContext`，足以承担“持续提醒当前 identity”的最小提示职责
  - 如果把 identity 选择逻辑直接塞进 hook 事件处理器，会把“会话 bootstrap 选择”与“turn 级记忆注入”耦合到一起，增加状态分叉和失败路径
  - 对外部 session 更稳的边界是：bootstrap 层完成可见 identity 枚举与用户选择，hooks 层只读取已绑定的 `agent_id` 并持续提示
- 假设:
  - “让用户选择”应优先理解为 session 启动期的显式选择，而不是每个 turn 都重新选择
  - “时刻提示 identity”应理解为每个关键 hook 事件注入极短提示，而不是持续输出长文案
- 决策:
  - 倾向把 identity 选择放在 external session bootstrap / mount 流程，而不是主 hooks driver
  - 倾向让 `SessionStart` 和 `UserPromptSubmit` 固定注入短 identity 提示；`Stop` 是否提示只保留最短收尾信息
  - 在未完成 bootstrap 选择前，hooks 继续 fail-open，不擅自绑定到某个共享 identity
- 未解问题:
  - 外部 session 在发现多个可见 identities 时，是否必须强制用户显式选择，还是允许 fallback 到默认 identity
  - identity 提示文案是否需要区分“repo-local identity”和“shared identity”
  - 如果 session 中途切换 identity，是否允许热切换，还是要求新开 session
- 下一步:
  - 先和用户确认 external session 的选择策略
  - 再把该策略写回设计文档，之后再进入实现

## R-0069 落地外部 workspace 强制 mount 选择与 hooks identity 提示 MVP

- 日期: 2026-04-04
- 目标: 在 MVP 中实现“外部 session 强制选择 identity 或明确 no-mount”，并让 hooks 停止隐式选 identity
- 输入:
  - 用户确认：必须强制用户选择，并提供明确的“不挂载”选项；选择此项时不挂载任何 hook
  - 当前 `projects/cli`、`scripts/codex-hooks` 实现
- 动作:
  - 先写失败测试，覆盖 `mount` 交互流程和 unbound workspace 的 hooks 惰性行为
  - 在 CLI 中新增 `agents mount`，列出可见 identities 并要求显式选择
  - 选择具体 identity 时，为当前 workspace 写入 binding 并安装 workspace-local `.codex/hooks.json`
  - 选择 `Do not mount hooks` 时，移除该 workspace 的 hooks 与 binding
  - 修改 hooks driver，去掉“单一可见 identity 自动绑定”的 fallback
  - 将 hook 输出中的 identity 提示统一为 `Mounted identity`
  - 更新设计文档与 README
- 发现:
  - 当前 driver 的确存在“若只剩一个可见 identity 就自动绑定”的隐式行为，这与用户的强制选择要求冲突
  - 通过 workspace-local `agents mount`，可以把“是否挂载 hooks”收敛为当前 workspace 的显式状态，而不必把选择逻辑塞进每个 hook 事件
  - 即便机器上仍存在全局 hooks registry，只要 driver 不再隐式选 identity，未绑定 workspace 也会保持 inert
- 假设:
  - 对于 MVP，“未绑定时 hooks inert”足以满足“不干扰记忆收集”的目标
  - 如果未来要做到更严格的“物理上完全不执行任何 hooks”，还需要进一步处理 machine-global registry 的装配边界
- 决策:
  - 外部 workspace 的 identity 绑定通过 `agents mount` 完成
  - hooks runtime 只接受显式 binding，不再做自动选择
  - `SessionStart`、`UserPromptSubmit`、`PostToolUse`、`PreToolUse` 的输出提示统一显式带上当前 mounted identity
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/driver.test.ts scripts/codex-hooks/test/event-adapters.test.ts`
  - `npm --prefix projects/cli test`
- 未解问题:
  - 当前 `agents mount` 仍是 terminal 交互；如果后续要给 skill 或 bootstrap 脚本调用，是否需要补一个显式 flag 模式
  - machine-global registry 与 workspace-local registry 的长期分工是否还要继续收敛
- 下一步:
  - 如需继续推进，可把 `agents-bootstrap` skill 改成显式引导 `agents mount`

## R-0070 纠偏为 Session 内部完成 identity 选择与初始化

- 日期: 2026-04-04
- 目标: 纠正“外部 workspace 先执行 `agents mount`”与用户真实需求之间的偏差
- 输入:
  - 用户澄清：所有操作都必须在 Codex session 内部完成，不能依赖人工执行命令行初始化
  - 用户期望：`SessionStart` hook 主动提示用户选择一个 identity，由 Codex 在 session 内部接收选择并调用 CLI 完成初始化
  - 当前 MVP：显式 `agents mount` + workspace binding + hooks inert fallback
- 动作:
  - 对照当前 MVP 与用户目标的差异
  - 收紧“选择发生在 session 外”与“选择发生在 session 内”两种方案的边界
- 发现:
  - 当前 MVP 把 identity 选择放在 session 外部的命令行步骤，和用户要求冲突
  - 用户真正要的是“SessionStart 触发一个会话内协议”，而不是“让人先在 shell 里准备好绑定文件”
  - 这意味着 hooks 不只是读取 binding，还要在首次进入 session 时把“需要选择 identity”明确暴露给 Codex，再由 Codex 驱动 CLI 完成绑定
  - 基于当前已知 hooks contract，`SessionStart` 可以注入提示文本；是否存在原生选项 UI 证据不足，因此当前更稳的理解是“文本协议式选择”，不是先假定有专门的 picker UI
- 假设:
  - session 内选择流程大概率应表现为：`SessionStart` 注入要求 -> 用户回复选项/identity 名称 -> Codex 调用 `agents` CLI 落盘绑定 -> 后续 turns 使用该 identity
  - 若需要真正的可点击选项 UI，可能需要依赖 Codex 客户端额外能力；当前证据不足，不能先写死
- 决策:
  - 暂停把 `agents mount` 视为最终交互形态
  - 后续设计应改成“SessionStart 注入选择协议 + session 内调用 CLI 完成绑定”
- 未解问题:
  - 用户选择应使用数字选项、identity 文本，还是两者都支持
  - 未选择前，当前 session 的其他 hooks 是否完全静默，还是持续提醒未绑定
  - 绑定完成后，是否需要在同一 session 立即二次注入 identity 上下文，还是等下一轮生效
- 下一步:
  - 先确认 session 内选择协议的最小交互形态

## R-0071 落地 SessionStart 注入选择协议与 UserPromptSubmit 会话内初始化

- 日期: 2026-04-04
- 目标: 让未绑定的 Codex session 在 session 内部完成 identity 选择，而不是依赖 session 外命令
- 输入:
  - 用户确认：支持 `选择 + 任务`
  - 用户补充：选项中必须明确包含“不适用 Agent Identity”
  - 当前 hooks driver / tests
- 动作:
  - 先增加失败测试，覆盖 `SessionStart` 选择提示、`数字 / agent_id / no identity` 解析，以及 `选择 + 任务`
  - 为 hooks session state 增加 `identity_selection_declined`
  - 在 `SessionStart` 中对未绑定 session 注入固定选择协议
  - 在 `UserPromptSubmit` 中优先解析选择协议，并调用 `agents verify --agent-id <id>` 完成所选 identity 初始化
  - 对 `no identity` 增加 session 级静默态，后续 turns 不再反复要求选择
  - 更新设计文档以反映“session 内选择”取代“session 外 mount”作为主路径
- 发现:
  - 仅靠 `SessionStart` 不能直接完成选择；真正的选择落点必须在下一次 `UserPromptSubmit`
  - 在当前 hooks contract 下，最稳的交互形态是“文本协议”，而不是假定存在原生 picker UI
  - 通过 `systemMessage + additionalContext` 可以让 Codex 在首轮先询问用户，再在用户回复时由 hooks 解析并初始化
  - `选择 + 任务` 不需要修改原始 prompt，只需在 hook 注入中明确“前导选择 token 已被消费，剩余文本才是真正任务”
- 假设:
  - 当前 Codex hooks 的文本协议已经足够支持 MVP；如果未来需要更强 UX，再考虑专门的选项 UI 能力
- 决策:
  - 主路径改为：`SessionStart` 提示选择 -> `UserPromptSubmit` 解析选择 -> hooks 调 CLI 初始化 -> 后续按绑定 identity 正常工作
  - 明确保留 `No identity (Not applicable Agent Identity / 不适用 Agent Identity)` 作为一等选项
  - `no identity` 采用 session 级静默态，不写入长期绑定
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - `npm --prefix projects/cli test`
- 未解问题:
  - 若外部 workspace 之前遗留了旧 binding 文件，是否仍应允许其跳过选择协议，还是未来完全改成 session-only 绑定
  - 是否要把 `agents mount` 降级为调试/兼容命令，而不是主交互入口
- 下一步:
  - 若继续推进，可在真实外部 session 做一次 smoke，验证首轮询问与选择后初始化是否符合预期

## R-0072 真实外部 Codex session 验证会话内 identity 选择协议

- 日期: 2026-04-05
- 目标: 在真实外部 Codex session 中验证 `SessionStart` 询问、`UserPromptSubmit` 选择解析和 `选择 + 任务` 初始化链路
- 输入:
  - 当前 hooks runtime
  - 临时外部 workspace / 临时 shared root
  - 真实 `codex exec`
- 动作:
  - 在临时 shared root 中初始化 `research-agent` 与 `unity-optimization-agent`
  - 在未预绑 identity 的临时外部 workspace 中运行真实 `codex exec`
  - 首条用户消息直接使用 `1 reply exactly session-choice-smoke-ok`
  - 打开 `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_DEBUG_DIR` 与独立 state root，抓取真实 hook stdin/stdout
- 发现:
  - 真实 session 中 `SessionStart` 已输出 identity 选择协议，并明确列出 `0. No identity (Not applicable Agent Identity / 不适用 Agent Identity)`
  - 真实 session 中 `UserPromptSubmit` 已正确把 `1 reply exactly session-choice-smoke-ok` 解析为“选择 `research-agent` + 剩余任务”
  - hooks session state 成功记录 `agent_id = research-agent`
  - 本次 `codex exec` 最终失败点是网络请求流断开，而不是 hooks 逻辑失败
- 假设:
  - 在网络稳定的真实 session 中，当前会话内选择协议应已足以完成首轮初始化
- 决策:
  - 视“session 内 identity 选择协议”已通过真实 hooks 层验证
  - 后续若再出现“看不到效果”，应优先区分 hooks 逻辑与 Codex 网络/执行层故障
- 未解问题:
  - 是否需要再补一轮完全成功的真实外部 smoke，以拿到 assistant 最终输出层面的正向证据
- 下一步:
  - 收敛 `agents mount` 为兼容/调试入口
  - 处理运行期产物清理策略

## R-0073 收敛 `agents mount` 定位并新增运行期产物清理脚本

- 日期: 2026-04-05
- 目标: 解决两类后续维护问题：旧 `agents mount` 与新 session 内选择主路径之间的定位冲突，以及 runtime 产物污染工作树的问题
- 输入:
  - 当前 CLI / hooks README
  - 当前工作树中的未跟踪 runtime 产物
- 动作:
  - 将 README 中的主路径改为 session 内选择协议
  - 将 `agents mount` 降级为兼容 / 调试入口
  - 新增 `scripts/cleanup-runtime-artifacts.sh`
  - 先用测试验证脚本只会删除未跟踪 runtime 文件，再对当前仓库执行一次清理
- 发现:
  - `agents mount` 仍可作为兼容入口，但不应继续在文档中被描述为推荐主路径
  - 当前仓库内累计了大量未跟踪 runtime 记忆文件，会干扰 `git status`
  - 用 `git ls-files --others --exclude-standard` 可以安全地只定位未跟踪 runtime 文件，而不碰已跟踪 seed 数据
- 决策:
  - `agents mount` 保留，但定位为兼容 / 调试命令
  - `scripts/cleanup-runtime-artifacts.sh` 采用默认 dry-run、`--apply` 才删除的安全策略
  - 该脚本仅清理 `agents/*/memory/{short-term,long-term}` 与 `agents/*/runs` 下的未跟踪文件
- 验证:
  - `node --test --experimental-strip-types scripts/test/cleanup-runtime-artifacts.test.ts`
  - `scripts/cleanup-runtime-artifacts.sh`
  - `scripts/cleanup-runtime-artifacts.sh --apply`
- 未解问题:
  - 是否还需要把该清理脚本接入一个更高层的维护命令，避免用户记忆脚本路径
- 下一步:
  - 如有需要，可再把清理能力提升为 `agents cleanup-runtime`

## R-0074 排查 Happy 真实 session 未出现 identity 主动询问

- 日期: 2026-04-05
- 目标: 定位 Happy 真实 session `cmnl93bq5n7j73d14z36tbse2` 为什么没有出现预期的 identity 主动询问
- 输入:
  - 用户反馈：真实 Happy session 中没有看到 agent identity 主动 prompt
  - Happy session id: `cmnl93bq5n7j73d14z36tbse2`
  - Codex 本地 session / hook state / Happy 日志
- 动作:
  - 核对该 Happy session 的启动日志
  - 核对对应 Codex thread id 与 hook state
  - 检查目标 workspace `/Volumes/P44Pro/neonspark` 是否已有 binding 文件
  - 检查 Codex 本地 session transcript 中首轮实际 assistant 输出
- 发现:
  - 该 Happy session 确实启动了一个新的 Codex thread：`019d5c04-30ab-7732-872f-001dd78e96f0`
  - 目标 workspace 中不存在 `.codex/agent-memory/active-agent.json` 或 `active-agent-id.txt`
  - 对应 hook state 记录了 `SessionStart` 与 `UserPromptSubmit` 都已触发，但 session 结束时既没有 `agent_id`，也没有 `identity_selection_declined`
  - 这说明 hooks 并没有被绕过；相反，hooks 运行了，但未成功把“选择 identity”转化为显式的用户可见交互
  - 同一 thread 的首轮 assistant 实际输出直接进入了用户原始任务处理，而不是先询问 identity
- 假设:
  - 当前 `SessionStart` / `UserPromptSubmit` 通过 `systemMessage` 与 `additionalContext` 注入的“请先选择 identity”约束，强度不足以保证模型一定先询问用户
  - 也就是说，当前方案实现了“内部提示”，但没有实现“强制的对外显式询问”
- 决策:
  - 不再把“SessionStart 已注入 systemMessage”误判为“用户一定会看到主动 prompt”
  - 后续要把目标改成“强制阻断未绑定 session 的任务执行，直到用户完成选择”，而不是仅靠提示文案劝导模型
- 未解问题:
  - Codex hooks 是否允许用 `stopReason` 或等价机制在未绑定时阻断 turn，逼迫进入选择流程
  - 如果不能硬阻断，是否需要把 identity 选择协议做成更强的 `UserPromptSubmit` 解析与重写策略
- 下一步:
  - 研究 hooks 是否存在可靠的 turn 级 fail-closed 手段
  - 若存在，改为未绑定时强制拦截普通任务输入

## R-0075 将初始 hook 方向从阻断式选择改为严格自动匹配

- 日期: 2026-04-05
- 目标: 根据用户最新约束，纠正未绑定 session 的初始 hook 行为方向
- 输入:
  - 用户反馈：阻断式处理与 Codex agent 默认行为容易冲突，不适合辅助型 agent
  - 用户要求：若 session start 已有具体需求，则判断哪个 agent 更适合并自动选择；找不到严格符合的 identity 时宁可不挂载
- 动作:
  - 重新评估“显式选择优先”与“严格自动匹配优先”的交互取舍
  - 收紧新目标的成功判据：只有高置信度匹配才挂载，否则保持未挂载
- 发现:
  - 对辅助型 agent 而言，阻断用户原始任务会破坏默认工作流，尤其是在用户进入 session 时已经带着明确需求
  - 当前更合适的方向不是“强制先选”，而是“尽量不打断用户”，只在证据足够强时自动挂载
  - 因此，初始 hook 的责任应改成严格路由，而不是交互门禁
- 假设:
  - `SessionStart` 和首轮用户输入组合起来，可能足够支持一次高标准的 agent 匹配判断
  - 高标准匹配需要明确的拒绝条件，不能因为弱相关关键词就挂载某个 identity
- 决策:
  - 暂停推进 fail-closed 阻断方案
  - 下一轮设计改为：`SessionStart` / 初始上下文做严格自动匹配；高置信度命中才挂载，否则不挂载
- 未解问题:
  - 初始匹配到底允许使用哪些证据：用户第一条消息、workspace 路径、repo 特征、预置规则，还是它们的组合
  - 自动匹配命中后，是否需要对用户显式告知“已自动挂载哪个 identity，以及为什么”
- 下一步:
  - 先和用户确认严格自动匹配允许使用的证据来源，再设计规则

## R-0076 确认严格自动匹配证据源采用方案 3

- 日期: 2026-04-06
- 目标: 固化严格自动匹配的证据来源范围，进入可实现状态
- 输入:
  - 用户选择: `3`
  - 候选策略:
    1) 仅首条用户消息
    2) 首条用户消息 + workspace/repo 路径
    3) 首条用户消息 + workspace/repo 路径 + 预定义 specialization 规则
- 动作:
  - 记录用户明确选择 `3`
  - 将“严格匹配阈值”和“宁可不挂载”作为实现前置约束
- 发现:
  - 仅用首条消息或路径都容易误判，无法满足“严格匹配”要求
  - 方案 `3` 允许把可解释规则前置化，并为“不挂载”提供明确拒绝条件
- 假设:
  - 预定义 specialization 规则需保持保守，优先高 precision，必要时牺牲 recall
- 决策:
  - 初始 hook 自动选择采用方案 `3`
  - 命中条件不充分时保持 unmounted，不注入阻断式选择协议
- 未解问题:
  - 首条消息在不同 session 入口是否总可得；若不可得，需要在首个 `UserPromptSubmit` 再尝试一次严格匹配
  - 当多个 identity 同时命中规则时，是否一律视为歧义并不挂载
- 下一步:
  - 在 hooks driver 中实现 strict auto-match 与拒绝条件
  - 用测试覆盖命中、歧义、低置信和 no-mount 分支

## R-0077 落地 strict auto-match（方案 3）并完成回归验证

- 日期: 2026-04-06
- 目标: 将初始 hook 行为改为“严格自动匹配优先，未命中则不挂载且不阻断”
- 输入:
  - R-0076 已确认的方案 `3`
  - 用户约束: 避免阻断式流程；宁可不挂载也不误挂载
  - 现有 hooks driver 与测试集
- 动作:
  - 在 `scripts/codex-hooks/driver.ts` 新增 agent profile 读取与 specialization 规则
  - 新增 strict 判定函数：只在唯一且高置信命中时自动挂载
  - `SessionStart` 从“强制选择提示”改为“尝试 strict auto-match，失败即 inert”
  - `UserPromptSubmit` 保留显式选择能力（数字 / agent_id / no identity），并在无显式选择时执行 strict auto-match
  - 对 auto-mount 成功分支输出 `Auto-mounted ... via strict match` 说明
  - 更新 `scripts/codex-hooks/test/driver.test.ts`，覆盖唯一命中和歧义 no-mount
  - 更新 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md` 描述新主路径
  - 跑 hooks/cli/cleanup 全量相关测试
  - 停止 Happy 相关进程后重建 `packages/happy-cli`
- 发现:
  - 之前 auto-match 分支会被 `shouldRefreshPrompt` 误拦截，导致命中后仍不挂载；已修复为“auto-match 命中时绕过该拦截”
  - strict 规则在“研究 + Unity”混合提示下会正确判为歧义并拒绝挂载
  - 无绑定且无 strict 命中时，hooks 现在保持静默，不再强制注入选择协议
- 假设:
  - 当前 specialization 规则仍是保守启发式，后续需通过真实 session 样本继续校准 precision/recall
- 决策:
  - MVP 进入“non-blocking strict auto-match”主路径
  - 显式 `no identity` 继续保留，并优先于自动匹配
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - `npm --prefix projects/cli test`
  - `node --test --experimental-strip-types scripts/test/cleanup-runtime-artifacts.test.ts`
  - `HOME=/tmp corepack yarn workspace happy build`（在 Happy repo）
- 未解问题:
  - 是否需要把 strict rules 抽到可配置文件，避免后续继续在 driver 中硬编码
  - 是否需要记录 auto-match 拒绝原因（弱命中/多命中）用于线上诊断
- 下一步:
  - 在真实 Happy session 再做 smoke，检查首轮具体需求下的自动挂载可见性

## R-0078 对标 oh-my-codex 的 hooks 设计并提炼 README 启发

- 日期: 2026-04-06
- 目标: 学习 `oh-my-codex` 对 Codex hooks 的使用方式，评估对本仓库 `scripts/codex-hooks/README.md` 设计的可迁移启发
- 输入:
  - `oh-my-codex` 官方仓库（main）
  - 本仓库 `scripts/codex-hooks/README.md`
- 来源:
  - https://github.com/Yeachan-Heo/oh-my-codex
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/docs/hooks-extension.md
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/cli/hooks.ts
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/hooks/extensibility/loader.ts
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/hooks/extensibility/dispatcher.ts
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/hooks/extensibility/events.ts
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/hooks/extensibility/plugin-runner.ts
  - https://github.com/Yeachan-Heo/oh-my-codex/blob/main/src/scripts/notify-hook.ts
  - `scripts/codex-hooks/README.md`
- 动作:
  - 读取 `oh-my-codex` hooks 文档与实现代码，聚焦事件模型、插件模型、容错边界、团队场景行为
  - 对照当前 `scripts/codex-hooks/README.md` 的定位（thin runtime + agents CLI 主导）
  - 提炼仅影响 README 信息架构的启发点（不冻结实现）
- 发现:
  - `oh-my-codex` 将 hooks 作为“可插拔扩展层”而不是单一脚本：提供 `omx hooks init/status/validate/test` 全链路脚手架与校验入口
  - 其插件默认启用，且用显式环境变量关闭（`OMX_HOOK_PLUGINS=0`），并提供超时配置（`OMX_HOOK_PLUGIN_TIMEOUT_MS`）
  - 事件模型显式区分 `native` 与 `derived`，并使用统一 envelope（`schema_version/event/source/context/session_id/thread_id/turn_id/mode`）
  - 派生信号（如 `needs-input`、`pre-tool-use`、`post-tool-use`）是可选门控（默认关闭），体现“先稳定主事件，再渐进增加推断事件”的策略
  - 运行时容错非常明确：插件在独立 runner 子进程执行，带超时与 SIGTERM/SIGKILL 兜底；异常记日志但不阻断主流程（best effort）
  - 团队场景下默认抑制 worker 侧副作用（只保留 leader 侧 canonical side-effect），避免重复通知/重复写入
  - `notify-hook` 不是只做通知，而是承担事件归一、去重、状态落盘、再分发到 hooks extensibility 的“薄编排总线”角色
- 假设:
  - 本项目若继续坚持“thin runtime + agents CLI 主导”，仍可借鉴其“文档层先定义事件契约、容错语义、可观测性语义”的做法，而不需要复制其整套插件系统
  - 对当前阶段最有价值的迁移不是新增复杂能力，而是让 README 明确：哪些是硬契约、哪些是 best-effort、哪些只在特定模式触发
- 决策:
  - 当前不引入 `oh-my-codex` 式完整插件框架
  - 优先将其可迁移经验用于 `scripts/codex-hooks/README.md` 信息结构增强：
  - 增加“事件分类与触发矩阵（native/derived）”
  - 增加“失败语义（fail-open/fail-closed）与超时策略”
  - 增加“副作用边界（leader/worker 或 mounted/unmounted 分支）”
  - 增加“可观测性（state/log/debug 路径与最小排障步骤）”
  - 增加“扩展策略声明（当前不开放插件，仅保留未来扩展位）”
- 未解问题:
  - 当前 hooks 是否需要引入“派生事件开关”概念，还是保持纯原生事件直到 strict auto-match 进一步稳定
  - 当前 memory flush 与后续候选事件是否需要统一 envelope，避免 Stop 阶段语义漂移
  - 若未来支持多 runtime（不仅 Codex），README 中“契约层”与“Codex 适配层”如何分栏避免耦合误读
- 下一步:
  - 基于上述启发，先提出一版 `scripts/codex-hooks/README.md` 重构目录草案（仅文档，不改协议实现）
  - 待确认后再落地 README 重写，并补对应最小契约测试点

## R-0079 基于核心设计文档筛选并融入 oh-my-codex 高价值 hooks 经验

- 日期: 2026-04-06
- 目标: 以 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md` 为主文档，吸收 `oh-my-codex` hooks 经验中对本项目真正有价值的部分
- 输入:
  - `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`
  - `oh-my-codex` hooks 文档与实现（events/loader/dispatcher/plugin-runner/notify-hook）
  - 项目边界约束（仅 Agent 专属技能与专属记忆，不转向通用 workflow 平台）
- 动作:
  - 在核心设计文档新增“对标经验筛选”章节，显式区分可迁移与不迁移项
  - 新增 MVP 事件契约章节，统一 envelope 字段和 `native/derived` 语义
  - 将 `derived` 事件设为默认关闭、显式开关开启，并要求 `confidence/parser_reason`
  - 在失败策略中补充超时降级、重复失败抑制、防 warning 风暴约束
  - 新增“可观测性与排障最小面”，固定最小排障路径
- 发现:
  - 仅靠“hooks 是 thin glue”不足以约束运行时行为，仍需在设计文档层定义最小事件契约与失败语义
  - `oh-my-codex` 的高价值不在插件框架本身，而在“事件归一 + 容错隔离 + 可观测性”这三件基础工程纪律
  - 若不显式写出“不迁移项”，后续很容易把本项目带向插件生态或团队 workflow 扩展
- 假设:
  - 当前 `derived` 事件默认关闭可显著降低误判与语义漂移风险；后续再基于真实样本决定是否扩大使用范围
- 决策:
  - 保留并强化：统一事件 envelope、best-effort 副作用、超时降级、最小可观测面
  - 明确排除：通用插件系统、团队通知总线、workflow 平台化扩张
- 未解问题:
  - `OBSIDIAN_AGENT_MEMORY_SERVER_HOOK_DERIVED_SIGNALS` 是否应在实现层立即落地，还是先保持文档约束
  - 高成本逻辑的“可中断执行”在当前 driver 中是否需要独立执行器
- 下一步:
  - 对照当前 `scripts/codex-hooks/driver.ts` 做一次“契约-实现一致性检查”，列出已满足/未满足项
  - 仅在证据充分后再决定是否推进 derived 开关和超时预算参数化

## R-0080 对比 codex-hooks 核心设计文档与当前 MVP 实现的重构差距分析

- 日期: 2026-04-06
- 目标: 对比 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md` 与当前 `scripts/codex-hooks` MVP 实现，识别为达到文档目标需优化/重构的部分
- 输入:
  - 核心设计文档（含 R-0078/R-0079 融合后的事件契约、失败策略、可观测性约束）
  - 当前实现：`scripts/codex-hooks/{driver.ts,state.ts,contracts.ts,*.ts}`
  - 现有测试：`scripts/codex-hooks/test/*`
- 动作:
  - 逐项核对文档目标与代码行为
  - 标记“已对齐/部分对齐/未对齐”
  - 提炼优先级重构清单（必须项/增强项）
- 发现:
  - 已对齐：薄适配脚本 + 共享 driver 分层、主流程事件（SessionStart/UserPromptSubmit/Stop）、Bash 护栏与证据回填、strict auto-match 与 no-identity inert 路径
  - 部分对齐：去重已实现但 key 维度与文档建议不完全一致；失败基本 fail-open 但缺少结构化 warning 与重复失败抑制
  - 未对齐：统一事件 envelope（native/derived）尚未落地；derived 开关与字段约束未实现；`agents` 调用缺少超时预算；可观测性路径与文档口径不一致（文档写 repo-local state，实现默认写 `~/.codex/memories/...`）
  - 关键风险：文档已声明的运行语义（事件契约/降级策略）若不在代码与测试中固化，会导致后续行为漂移
- 假设:
  - 先做“契约层收敛（envelope + timeout + observability 口径统一）”再做功能增强，可最低成本降低回归风险
- 决策:
  - 下一轮优先重构目标应聚焦四项：
  - 事件 envelope 统一化
  - `agents` 调用超时与降级
  - 可观测性路径与日志语义统一
  - 测试补齐文档新增约束
- 未解问题:
  - session state 归宿最终是 repo-local 还是 machine-level；目前文档与实现不一致
  - pending feedback 保存“完整对象”还是“id sidecar”作为最终口径
- 下一步:
  - 产出逐文件改造方案与最小变更序列（先不改行为，再逐步切换）

## R-0081 确认进入 codex-hooks 契约收敛重构切片阶段

- 日期: 2026-04-06
- 目标: 在用户确认后，将 R-0080 的差距分析转为可执行的逐文件改造清单与最小变更切片
- 输入:
  - 用户确认“同意”推进重构清单
  - R-0080 的 P0/P1 差距
- 动作:
  - 冻结重构优先级：先契约收敛，再能力增强
  - 产出按文件归属的改造任务与分批落地顺序
- 发现:
  - 若直接并行改动 driver/state/install/tests，回归定位成本高
  - 先做“输入契约层 + 不改行为适配”可降低风险并提升可测试性
- 假设:
  - 采用 4-5 个小切片可在不破坏现有 strict auto-match 主路径的前提下完成契约升级
- 决策:
  - 采用最小切片顺序：`event envelope -> timeout/degrade -> observability/path alignment -> dedupe/failure suppression -> tests`
- 未解问题:
  - state 最终归宿口径（repo-local vs machine-level）需在切片 3 前最终确认
- 下一步:
  - 输出逐文件改造清单与每个切片的验收标准

## R-0082 冻结 session state 归宿为 machine-level 并完成文档口径收敛

- 日期: 2026-04-06
- 目标: 将 R-0080 的关键决策点（state 归宿）从待定改为已定，并同步修正文档口径
- 输入:
  - 用户明确选择：`B`（Machine level 的跨 agent / 跨 session states）
  - 当前实现 `resolveStateRoot` 默认路径
- 动作:
  - 更新 `scripts/codex-hooks/README.md`：
    - 主流程描述改为 strict auto-match 主路径
    - 补充 machine-level state 默认路径与覆盖变量
  - 更新 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`：
    - 状态模型新增 machine-level 归宿声明
    - 可观测性章节把 state 路径改为 machine-level 实际路径
    - 开放问题从“是否迁移 state”改为“machine-level state schema 明确化”
- 发现:
  - 当前实现与用户偏好一致（machine-level），主要问题是文档口径滞后
  - README 仍残留旧“SessionStart 强制选择”表述，已与 strict auto-match 主路径不一致
- 决策:
  - session state 归宿正式冻结为 machine-level
  - 后续实现重构不再引入 repo-local state 作为默认归宿
- 未解问题:
  - machine-level state 的 schema 版本化与迁移策略仍待定义
- 下一步:
  - 进入 PR-1：实现事件 envelope 归一层（不改变现有业务决策）

## R-0083 落地 PR-1：接入 Hook Envelope 归一层并完成 machine-level 口径同步

- 日期: 2026-04-06
- 目标: 在不改变现有业务策略的前提下，先实现事件契约的最小落地（envelope 归一）并完成 state 归宿口径收敛
- 输入:
  - 用户确认：state 归宿采用 B（machine-level）
  - R-0081 切片顺序（PR-1: event envelope）
- 动作:
  - 更新 `scripts/codex-hooks/README.md`：
    - 主流程改为 strict auto-match 主路径
    - 明确 machine-level state 默认路径与覆盖环境变量
  - 更新 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`：
    - 明确 state 归宿为 machine-level
    - 可观测性章节路径改为 machine-level 实际路径
  - 在 `scripts/codex-hooks/contracts.ts` 增加：
    - `HookEnvelope` / `HookEventSource` 类型
    - `normalizeHookEnvelope(...)` 归一函数
  - 在 `scripts/codex-hooks/driver.ts` 各事件入口接入 envelope 归一（SessionStart/UserPromptSubmit/Stop/PreToolUse/PostToolUse）
  - 新增契约测试 `scripts/codex-hooks/test/contracts.test.ts`
- 发现:
  - envelope 接入可在不改变 strict auto-match 与 flush 语义的情况下先建立契约层稳定性
  - machine-level state 与用户目标一致，主要成本在文档口径同步而非实现迁移
- 假设:
  - 先完成契约层落地后，再做 timeout/degrade 改造可降低回归排查成本
- 决策:
  - PR-1 完成，下一步进入 PR-2（`agents` 调用超时与降级语义）
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 结果: 15 passed, 0 failed
- 未解问题:
  - envelope 目前仅归一并局部使用，后续是否将 eventKey 与 failure suppression 完全切换到 envelope 字段（PR-4 再处理）
- 下一步:
  - 在 `runAgentsCommand` 引入可配置 timeout 和错误分类（timeout/spawn/exit）
  - 补充 fail-open 与重复失败抑制测试

## R-0084 落地 PR-2：agents 调用超时预算与降级语义

- 日期: 2026-04-06
- 目标: 为 hooks driver 的 `agents` CLI 调用补齐超时预算与错误分类，满足 fail-open 与可诊断性目标
- 输入:
  - PR-2 目标：timeout/degrade
  - 当前 `runAgentsCommand` 仅按退出码判断
- 动作:
  - 在 `scripts/codex-hooks/driver.ts` 中引入：
    - `AgentsCommandReason`（`ok` / `timeout` / `spawn_error` / `exit_nonzero`）
    - `readAgentsTimeoutMs`（默认 12000ms，范围 1000-120000）
    - `spawnSync(..., timeout)` 并按错误类型归类
  - 为 `createMemoryHookDriver` 增加 `agentsTimeoutMs` 可选参数
  - 将 `list/verify/run` 路径统一接入 timeout 参数
  - 调整失败提示语义（区分 timed out / spawn failed / failed）
  - 新增测试 `scripts/codex-hooks/test/agents-timeout.test.ts`，覆盖 verify 超时时 SessionStart fail-open
  - 更新 README 与核心设计文档：记录 timeout 配置项
- 发现:
  - 在 list 成功、verify 超时场景下，driver 能保持 `continue: true` 并返回可诊断信息，不阻断主任务
  - timeout 预算参数化后，可在测试与真实环境分别采用不同阈值
- 决策:
  - PR-2 完成，继续维持 fail-open 主策略
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 结果: 16 passed, 0 failed
- 未解问题:
  - 失败抑制（同一事件重复错误降噪）尚未落地，留在 PR-4
  - install 冲突检测（global/repo 双活）尚未落地，留在 PR-3/PR-5
- 下一步:
  - 进入 PR-3：可观测性增强与安装冲突检测

## R-0085 落地 PR-3：machine-level 可观测性增强与安装冲突检测

- 日期: 2026-04-06
- 目标: 补齐 PR-3 的两项能力：machine-level observability logs 与 global/repo 双活冲突防护
- 输入:
  - PR-3 目标：observability + install conflict guard
  - 当前实现已有 machine-level state root
- 动作:
  - 在 `scripts/codex-hooks/state.ts` 新增：
    - `getHookLogPath(stateRoot)`
    - `appendHookLog(stateRoot, payload)`（JSONL best-effort）
  - 在 `scripts/codex-hooks/driver.ts` 各事件入口新增 `received` 日志，以及 verify 路径调用结果日志（含 reason/code）
  - 升级 `scripts/codex-hooks/install-hooks.sh`：
    - 支持 `--workspace <path>` 与 `--force`
    - 默认检测 workspace 下 `.codex/hooks.json` 冲突并阻断（exit 2）
    - `--force` 显式旁路并输出 warning
  - README 与核心设计文档同步：
    - 补充 machine-level logs 路径
    - 补充安装冲突检测与 `--force` 规则
  - 新增测试：
    - `scripts/codex-hooks/test/install-hooks.test.ts`
    - `driver.test.ts` 中新增 machine-level observability log 断言
- 发现:
  - 以 JSONL 写 machine-level logs 能在不侵入主流程的前提下提供最低限度诊断证据
  - 安装脚本加入冲突检测后，可显式避免“global + repo-local 双活”误配置
- 决策:
  - PR-3 完成，继续保持 best-effort logging（日志失败不阻断 hooks）
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 结果: 19 passed, 0 failed
- 未解问题:
  - 失败抑制（重复错误降噪）尚未落地，留在 PR-4
- 下一步:
  - 进入 PR-4：去重键口径收敛 + repeated failure suppression

## R-0086 落地 PR-4：去重键口径收敛与重复失败抑制

- 日期: 2026-04-06
- 目标: 将去重键与文档口径对齐，并实现最小可用的 repeated failure suppression，降低 warning 风暴风险
- 输入:
  - 文档约束：去重键以 `session_id + turn_id + event` 为核心
  - R-0084/R-0085 后的 driver 现状
- 动作:
  - 在 `scripts/codex-hooks/driver.ts` 收敛 `eventKey` 维度，移除 `tool_name` 参与去重
  - 在 `scripts/codex-hooks/state.ts` 增加 `recent_failures` 状态与 helper：
    - `trackFailure(...)`
    - `clearFailure(...)`
  - 在 verify/run 失败路径接入失败跟踪与抑制：
    - 第一次失败保留可见错误
    - 同键后续失败返回 `continue: true` 且不重复输出 `systemMessage`
  - 新增测试：
    - `scripts/codex-hooks/test/failure-suppression.test.ts`（重复 verify 失败抑制）
    - `driver.test.ts` 增补同 `event/session/turn` 但不同 `tool_use_id` 仍去重
  - 文档同步：核心设计文档补充“首个失败可见、后续同键静默降级”策略
- 发现:
  - 在不引入复杂 backoff 策略的前提下，“首错可见 + 同键静默”已可明显降低重复错误噪音
  - 去重键收敛后，同 turn 内重复触发的幂等性更贴近设计口径
- 决策:
  - PR-4 完成，保留当前最小抑制策略，后续可再按真实样本评估是否引入时间窗口与指数退避
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 结果: 21 passed, 0 failed
- 未解问题:
  - 失败抑制键是否应进一步纳入 operation 粒度 + 时间窗口（当前为最小实现）
- 下一步:
  - 进入 PR-5：补剩余契约文档同步与测试矩阵收口（包含 derived 开关占位测试）

## R-0087 落地 PR-5：契约收口（derived 占位、契约测试补齐、状态矩阵）

- 日期: 2026-04-06
- 目标: 完成 PR-5 收口，固化“已实现/部分实现/规划中”边界并补足契约回归护栏
- 输入:
  - PR-5 范围：文档收口 + 契约测试 + derived 占位
- 动作:
  - 在 `scripts/codex-hooks/contracts.ts` 增加 `HOOK_DERIVED_SIGNALS_ENV` 与 `isDerivedSignalsEnabled(...)`
  - 新增测试 `derived-signals.test.ts`：
    - 验证 derived 开关默认关闭与显式开启 token
    - 验证开启开关不改变当前 native 主路径（MVP）
  - 新增测试 `stop-contract.test.ts`：
    - 验证 Stop 仍是 side-effect 导向，不依赖 `hookSpecificOutput`
  - 更新 README：
    - 增加 derived 开关占位说明
    - 增加实现状态摘要（Implemented/Partial/Planned）
  - 更新核心设计文档：
    - 增加“实现状态矩阵（MVP 收口）”
- 发现:
  - 当前代码已具备 derived 开关契约占位，但确实尚未产出 derived 事件；该边界需要文档显式声明
  - Stop 侧契约测试补齐后，可防止后续误回归到依赖额外输出
- 决策:
  - PR-5 完成，本轮重构切片（PR-1~PR-5）收口
- 验证:
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 结果: 24 passed, 0 failed
- 未解问题:
  - derived 事件产出与 `confidence/parser_reason` 驱动动作仍属下一阶段
- 下一步:
  - 若进入下一轮，可专项设计 derived 事件最小闭环（仅观测，不触发破坏性 side effects）

## R-0088 按用户指令收缩 hooks 到 prompt-focused 主链路

- 日期: 2026-04-06
- 目标: 按用户最新偏好，移除 `PreToolUse` / `PostToolUse`，只保留 prompt-focused 主链路
- 输入:
  - 用户要求："移除 PreToolUse 和 PostToolUse 的 hook，我们重点关注在用户 prompt"
- 动作:
  - 更新仓库模板 `.codex/hooks.json`，删除 `PreToolUse` 与 `PostToolUse`
  - 运行 `scripts/codex-hooks/install-hooks.sh` 同步到 `~/.codex/hooks.json`
  - 验证仓库级与机器级 hooks key 均为 `SessionStart, UserPromptSubmit, Stop`
- 发现:
  - 当前机器级与仓库级 registry 已保持一致，Bash 工具前后拦截链路已从注册层停用
- 决策:
  - 当前运行面聚焦在 `SessionStart/UserPromptSubmit/Stop` 三个事件
- 未解问题:
  - 相关测试（Pre/Post）后续是否保留为可选模式，或转入兼容分支
- 下一步:
  - 若继续收敛，可把 README 与核心设计文档的 Hook matrix 同步改为“默认三事件，Pre/Post 为可选扩展”

## R-0089 同步核心设计文档为三事件默认注册策略

- 日期: 2026-04-06
- 目标: 将 `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md` 与当前 hooks 实际注册状态同步（默认三事件）
- 输入:
  - 用户要求：同样更新核心设计文档
  - 当前 registry：`SessionStart/UserPromptSubmit/Stop`
- 动作:
  - 在文档约束段明确区分“Codex 可用事件集合”与“本项目当前默认注册集合”
  - 将 `PreToolUse/PostToolUse` 定位改为可选扩展（默认不注册）
  - 调整 Hook matrix、数据流、fail-closed 条件、对接点、集成测试建议、rollout 顺序
  - 在实现状态矩阵中新增“默认注册事件集（3 hooks）”和“Pre/Post 默认未启用”
  - 修正文档章节标题，避免 `PreToolUse` 重复标题歧义
- 发现:
  - 文档与运行时 registry 已收敛到一致口径：默认三事件，Bash 扩展可选
- 决策:
  - 后续若恢复 Pre/Post，需按“可选扩展开关”而非默认注册回归
- 未解问题:
  - 是否需要把 Pre/Post 变更为单独 profile（例如 prompt-focused vs bash-guarded）
- 下一步:
  - 若需要，可补一个 `hooks profile` 文档小节定义默认/扩展两套注册清单

## R-0090 评估 research-agent 与 unity-optimization-agent 的 hooks 记忆碎片收集质量

- 日期: 2026-04-06
- 目标: 评估截至当前 `research-agent` 与 `unity-optimization-agent` 的记忆碎片收集效果，并判断短期记忆是否足以进入蒸馏
- 输入:
  - `agents/research-agent/*`
  - `agents/unity-optimization-agent/memory/{short-term,long-term}/*`
  - `agents/unity-optimization-agent/runs/*`
  - `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
  - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
  - `projects/cli/src/cli.ts`（`handleRun` 落盘逻辑）
- 动作:
  - 统计两个目标 agent 当前短期/长期/runs 数量
  - 抽样核对 `short-term` 字段完整性（事件主键、候选信号、来源类型）
  - 核对 `long-term` 与 `runs` 是否为可追溯蒸馏对象，还是占位性输出
  - 对照短期反馈准入标准（`observable/linkable/evaluatable/distillable`）给出门槛判断
- 发现:
  - `research-agent` 当前为 `short-term=0, long-term=0, runs=0`，没有可评估碎片
  - `unity-optimization-agent` 当前为 `short-term=5, long-term=11, runs=5`；其中 5 条短期事件均来自 `[hook flush] ...` 输入串
  - `unity-optimization-agent` 的 5 条短期事件中，`event_id/session_id/source_kind/promotion_target/candidates` 顶层字段均为空或缺失；`candidates` 不是结构化数组
  - 短期事件的可用证据主要以“原始长文本 input”存在，`evidence_refs` 只指向 `input:<message_id>`，缺少结构化 outcome/feedback 对象
  - 对应长期对象多数是 `Placeholder memory derived from input: ...`，属于原文镜像，不是 `Episode -> Learning` 的蒸馏产物
  - `projects/cli/src/cli.ts` 的 `handleRun` 当前实现是“写短期 captured + 写长期 placeholder + 写 run summary”，未执行结构化解析、冲突归并或晋升判定
- 假设:
  - `research-agent` 零样本很可能是近期 session 未绑定到该 identity（而非 hooks 完全不可用）；该判断尚未做独立 mount/binding 复核
- 决策:
  - 现阶段 hooks 的“捕获能力”可判定为有效（能稳定留存原始输入），但“蒸馏前置质量”不足（结构化反馈字段缺失）
  - 对 `unity-optimization-agent`，当前短期记忆可用于“人工复盘/人工抽取”，不足以直接自动蒸馏为 `Learning` 或 `Behavior Delta`
- 未解问题:
  - 是否在 `Stop` 路径引入最小 parser，把 `session/agent/workspace/candidates` 从输入串提升为结构化字段
  - 是否定义最小 feedback 聚合对象（`supporting/conflicting/insufficient`）并落盘，以满足 `evaluatable/distillable`
  - 是否对“仅占位 long-term”设置低优先级或延迟晋升，避免长期记忆噪音
- 下一步:
  - 先补一个“最小结构化提取层”（只抽关键 envelope 与 candidates），不改现有 fail-open 主链路
  - 再补蒸馏门控：只有满足 `observable+linkable+evaluatable+distillable` 才允许 `Episode -> Learning`

## R-0091 聚焦短期记忆抓取：MVP 结构与 plans/mvp 的主要问题及优化方向

- 日期: 2026-04-06
- 目标: 围绕“短期记忆抓取”评估 MVP 结构与 `plans/mvp` 设计，识别当前主要问题并给出可执行优化顺序
- 输入:
  - `plans/mvp/2026-04-01-codex-agent-identity-mvp-plan.md`
  - `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md`
  - `projects/cli/src/cli.ts`
  - `projects/cli/test/cli.test.ts`
  - `docs/portable-agent-contract/dynamic-memory.md`
  - `docs/portable-agent-contract/dynamic-memory/short-term-feedback.md`
- 动作:
  - 对照 MVP 计划中的“最小字段完整性”与当前 `run` 落盘结构
  - 对照短期反馈准入标准（`observable/linkable/evaluatable/distillable`）与现有事件可评估性
  - 检查测试是否覆盖“短期质量门槛”而不仅是“文件存在性”
- 发现:
  - `plans/mvp` 将重点放在“链路跑通”，允许弱实现，这在 M1 阶段合理；但当前讨论已转向“可蒸馏性”，目标函数发生变化
  - `projects/cli/src/cli.ts` 的 `handleRun` 仍是最小写盘：短期事件写入 `input` 原文、长期对象写入 `Placeholder summary`；未做结构化提取、反馈挂接、晋升门控
  - 当前短期事件虽满足公共信封最小必填字段，但对 `short-term-feedback` 文档中的准入标准支持不足：可观测可追溯弱、可评估性不足、蒸馏门控缺失
  - `projects/cli/test/cli.test.ts` 当前主要验证“文件生成与基本字段存在”，未覆盖“候选信号结构化抽取、证据引用质量、蒸馏前门控判定”
  - `plans/mvp` 中“事件文件字段完整”缺少机器可执行的“完整性定义”（例如哪些字段可空、哪些必须具备语义质量）
- 假设:
  - 若保持当前“原文直写 + 占位长期对象”策略不变，短期记忆会持续累积为日志形态，后续蒸馏成本将转移到人工清洗
- 决策:
  - 短期抓取优化应优先做“结构化提取与质量门控”，而非先扩展更多 hook 事件
  - 在不破坏 fail-open 与最小链路前提下，先引入轻量 sidecar/derived 字段，提升 `evaluatable/distillable`
- 未解问题:
  - `input` 原文在短期事件中的保留策略：默认保留、截断保留、还是外置引用
  - `feedback_object` 是否单独文件化，还是先以内嵌 sidecar 形态落在短期事件旁路
  - 门控失败（insufficient）时是否还要立即写长期占位对象
- 下一步:
  - 补一版“短期记忆质量契约（MVP+）”文档，明确结构化字段、准入判定和失败降级
  - 再将 CLI 与 hooks 的当前实现切到“先判定、后晋升”的最小策略

## R-0092 落地 MVP 短期记忆质量补强并冻结长期写入

- 日期: 2026-04-06
- 目标: 在不扩大 MVP 边界前提下，补齐短期记忆采集质量要求；暂停长期记忆准入判断与长期写入
- 输入:
  - 用户约束：只关注短期记忆质量；当前不做长期准入判断，也不写任何长期记忆
  - 现有实现：`projects/cli/src/cli.ts`、`scripts/codex-hooks/driver.ts`
  - 现有测试：`projects/cli/test/cli.test.ts`、`scripts/codex-hooks/test/*.test.ts`
- 动作:
  - CLI `run` 改为“仅写短期事件 + 运行摘要”，移除长期对象写入
  - CLI `run` 增加短期结构化解析与质量字段：`source_kind/session_id/workspace_root/assistant_summary/candidates/quality`
  - CLI `verify` 改为验证短期事件（不再依赖长期对象存在）
  - hooks memory context 改为读取 `short-term` 最新摘要，提示 `Latest short-term ref`
  - hooks `Stop` 改为短期收口，不触发长期写入路径
  - 状态模型移除 `pending_long_term_candidates`
  - 同步更新 MVP 计划/契约文档与 short-term-feedback 文档的阶段注记
  - 同步更新 CLI 与 hooks 测试用例
- 发现:
  - 保留现有 `agents run` 入口并让其只写短期事件，可在不新增命令面的情况下完成“长期冻结”
  - 将 `verify` 从“必须回读长期对象”改为“回读最新短期事件”，可以避免未产生长期对象时的误失败
  - 默认三事件 hooks（SessionStart/UserPromptSubmit/Stop）在短期优先模式下仍可稳定运行
- 假设:
  - 现有 `quality.status=pass/needs_review` 足以作为 MVP 阶段的短期采集质量分层；后续如需更细粒度可再扩展
- 决策:
  - MVP 当前阶段执行“short-term first”：短期质量强制、长期写入冻结
  - 长期相关判断与晋升动作延期到下一阶段专项
- 验证:
  - `npm --prefix projects/cli test`：11 passed, 0 failed
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`：24 passed, 0 failed
- 未解问题:
  - `quality` 口径是否需要固定成单独 schema 文档（当前已实现，但尚未独立 schema 文件）
  - 后续恢复长期流程时，如何保证从 `short-term quality` 到长期晋升门控的可追溯映射
- 下一步:
  - 补一份短期质量契约（字段级）与样例库，锁定“可用且达标”的判定标准
  - 在 hooks debug 输出中增加短期质量采样统计（仅观测，不触发新行为）

## R-0093 检查 research-agent 在外部调研会话后的短期记忆新产出与质量

- 日期: 2026-04-07
- 目标: 核查 `research-agent` 是否出现新的 short-term memory，并判断其是否满足当前 MVP 短期质量要求
- 输入:
  - `agents/research-agent/memory/short-term/*`
  - `agents/research-agent/runs/*`
  - 当前短期质量要求（R-0092 + `short-term-feedback.md`）
- 动作:
  - 统计 `research-agent` short-term/runs 数量
  - 读取最新 short-term 事件与对应 run 摘要
  - 对照 `source_kind`、结构化字段和 `quality` 对象进行判定
- 发现:
  - 当前 `research-agent` 已有新产出：`short-term=1`、`runs=1`
  - 最新事件为 `2026-04-07T02-02-31.553Z-3ba0b2bf-96ea-43d4-a6ab-4112a2303efb.json`
  - 该事件 `source_kind=direct_input`，`input` 为“挂载当前会话并准备 research 工作流”
  - 质量对象存在且字段完整：`observable=true`、`linkable=true`、`evaluatable=true`、`distillable=false`、`status=pass`
  - 结构化会话字段为空：`session_id/workspace_root/assistant_summary=null`，`candidates=[]`
- 假设:
  - 该条记录更像手动/直接 `agents run` 输入，而不是来自 hook flush 的会话回填
- 决策:
  - 按当前 MVP “短期质量最小要求”判定：该条记录合格（有完整 `quality` 对象且 `status=pass`）
  - 按“外部调研会话应产生 hook flush 结构化证据”的更高预期判定：当前证据不足（未见 `hook_flush` 结构化字段）
- 未解问题:
  - 外部 Claude 调研 session 是否真的触发了本机 hooks->agents 回填路径，还是仅做了手动挂载输入
- 下一步:
  - 在该外部会话再触发一次明确的 hook flush 场景后复检：期待 `source_kind=hook_flush` 且含 `session_id/workspace_root/candidates`

## R-0094 基于 vault-global-search 与 Claude Code dream 相关线索设计“扩面采集 + 模型收敛”路径

- 日期: 2026-04-07
- 目标: 在当前 MVP 阶段讨论如何提升短期记忆采集质量，重点覆盖“扩大上下文采集”与“模型收敛摘要”两条路径
- 输入:
  - 用户新增要求：
    1) hooks 不仅收集直接 input，还要从 Codex 数据库收集更具体上下文
    2) 上下文扩大后，需要推理模型做收敛和总结
  - vault-global-search（当前仓库内 Obsidian CLI）检索结果
  - `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`
  - `docs/research-memory.md` 中 R-0078/R-0079 对 `oh-my-codex` 的源码级研究记录
- 动作:
  - 按 vault-global-search 流程执行 Obsidian CLI 检索（`Claude Code dream` / `ClaudeCode` / `Claude Code`）
  - 扩展 Top 命中文档，抽取与 `native/derived`、事件信封、容错边界、可观测性相关证据
  - 基于现有边界推导“短期记忆扩面采集 + 模型收敛”最小可行路径
- 发现:
  - Obsidian CLI 在当前仓库对 `Claude Code dream` 无直接命中；`ClaudeCode`/`Claude Code` 的高相关命中集中在：
    - `docs/portable-agent-contract/relationship-map.md`
    - `docs/research-memory.md`（R-0078/R-0079）
    - `docs/portable-agent-contract/dynamic-memory/codex-hooks-memory-registration.md`
  - R-0078/R-0079 已明确吸收 `oh-my-codex` 的关键经验：`native/derived` 事件区分、统一 envelope、默认关闭 derived、显式开关和可观测性优先
  - 当前实现已具备 `derived` 开关占位，但尚未产出 derived 事件，也未接入模型摘要链路
- 假设:
  - “Codex database” 在当前上下文中可落到两类可观测源：
    - hooks runtime 可见的 stdin 事件字段（session/thread/turn/tool）
    - 本地可读取的 Codex 运行痕迹（如 transcript/state/debug artifacts，受环境可见性限制）
  - 采用“两段式管道”（规则扩面采集 -> 模型收敛）可在不破坏 fail-open 主链路的前提下提升短期记忆质量
- 决策:
  - 将后续方案定义为 `MVP+短期质量增强`，不把长期晋升/长期准入重新拉回当前范围
  - 模型参与限定在 `derived` 层，且默认关闭；`native` 主链路继续纯规则、可回退
- 未解问题:
  - Codex 本机可稳定读取的“数据库级”上下文清单需先做可用性探针（字段、路径、大小、权限）
  - 模型摘要的 token 预算、失败超时和隐私脱敏边界需先冻结
- 下一步:
  - 先做 context adapter 的只读探针（不改变现有短期落盘）
  - 再加 derived summarizer（默认关闭），输出结构化短期候选并记录 `confidence/parser_reason`

## R-0095 评估 short-term 生成策略：在线线程筛选 vs 离线采集过滤

- 日期: 2026-04-07
- 目标: 在“short-term 必须经推理模型过滤”的前提下，比较两种生成策略并给出建设性建议
- 输入:
  - 用户提出两种方案：
    1) 每次 hook 结束前启动 AI thread 在线筛选并直接落 short-term
    2) 先沉淀中间采集数据集，再离线过滤转化为 short-term
  - 当前 hooks 边界：三事件默认链路、fail-open、短期优先
- 动作:
  - 从可靠性、延迟、失败影响、可观测性、质量一致性、运维复杂度六个维度对比
  - 结合当前 MVP 风险偏好提出分阶段建议
- 发现:
  - 在线线程筛选优势是“即时可用”，但会把模型时延和失败路径耦合到主交互链路；若处理不当，易影响用户会话稳定性
  - 离线过滤优势是“可控可回放可重跑”，适合先把质量口径做稳；但短期内记忆有时滞，实时性较弱
  - 两者并非互斥，更合理的是“双轨”：主链路保持轻量采集，质量生成由异步/离线任务产出
- 假设:
  - 若必须立即在线筛选，仍需强制降级策略：模型失败时不阻断会话，并把样本回退到待处理队列
- 决策:
  - 推荐先以“中间采集数据集 + 离线过滤”作为主路径，先把质量标准和可观测性跑稳
  - 在线线程筛选作为可选加速路径，默认关闭，仅在低风险场景灰度
- 未解问题:
  - 离线批次频率（按时间/按事件量）与模型预算上限如何设定
  - 在线模式下的最大超时与重试次数阈值
- 下一步:
  - 定义 `raw_capture` 与 `short_term_candidate` 的最小契约字段
  - 设计统一的质量标签（accept/review/reject）与人工复核入口

## R-0096 按新策略落地 MVP：run 写 raw_capture、distill 产 short-term，并补 AI 环境接入

- 日期: 2026-04-07
- 目标: 将“hooks 直接产物不是 short-term，short-term 必须经模型过滤”融入 MVP 计划并完成最小实现
- 输入:
  - 用户要求：先更新 MVP 计划文档，再落地；并明确 AI agent 环境搭建
  - 当前代码基：`projects/cli`、`scripts/codex-hooks`
- 动作:
  - 更新计划文档：
    - `plans/mvp/2026-04-01-codex-agent-identity-mvp-plan.md`
    - `plans/mvp/2026-04-01-agent-identity-and-cli-contract.md`
    - 明确新链路：`run -> raw_capture`，`distill -> short-term`
    - 增加 AI 环境变量与 provider 说明（`mock/openai`）
  - 落地 CLI：
    - `init` 新增 `memory/raw-capture/`
    - `run` 改为写 `raw_capture` 事件（不直接写 short-term）
    - 新增 `distill` 命令：读取 pending raw_capture，调用 provider 过滤，写 short-term
    - 支持 `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER` 与 `OPENAI_API_KEY`
  - 调整 hooks 相关读取语义：短期摘要读取兼容 `summary` 字段
  - 先改测试再实现（TDD）：更新 CLI 与 hooks 测试，新增 distill 测试
- 发现:
  - 在保持现有 `agents run` 调用面的情况下，切到 raw_capture-first 可最小化对 hooks driver 的冲击
  - 使用 provider 切换（`mock` 用于回归、`openai` 用于集成验证）可同时满足稳定性与真实过滤需求
- 假设:
  - OpenAI `responses` JSON schema 输出在当前运行环境可稳定返回结构化内容；如后续出现输出漂移需增加容错解析
- 决策:
  - MVP 当前正式采用两阶段短期链路：采集与过滤解耦
  - short-term 只接受 `distill` 输出，不接受 hooks 直接原文写入
- 验证:
  - `npm --prefix projects/cli test`：12 passed, 0 failed
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`：24 passed, 0 failed
- 未解问题:
  - openai provider 的超时、重试、预算上限仍需在下一轮收敛
  - distill 失败样本的复跑与人工复核入口尚未定义
- 下一步:
  - 增加 distill provider 的超时与错误分类
  - 固化 `raw_capture` 与 `short-term` 的 schema 版本化文档

## R-0097 实现 distill provider 与 ~/.codex/config.toml 联动

- 日期: 2026-04-07
- 目标: 让 `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER` 与 Codex `config.toml` 联动，默认从 `config.toml` 读取 provider/model
- 输入:
  - 用户要求：所有 provider 都配置在 `config.toml`，distill 侧应联动
  - 当前实现：distill provider 仅读取环境变量
  - 本机配置样本：`~/.codex/config.toml` 包含 `model_provider` 与 `[model_providers.*]`
- 动作:
  - 在 `projects/cli/src/cli.ts` 增加最小 TOML 解析（面向当前字段）
  - 增加运行时解析优先级：
    1) `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER`（覆盖）
    2) `~/.codex/config.toml` 的 `model_provider`
    3) 默认 `mock`
  - model 解析优先级：
    1) `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`
    2) `config.toml` 的 `model`
    3) 默认模型名
  - 读取 provider section：`[model_providers.<provider>]` 的 `base_url` / `wire_api` / `requires_openai_auth`
  - distill 调用改为 provider-runtime 驱动；当 provider 需要 OpenAI 鉴权时使用 `OPENAI_API_KEY`
  - 新增测试：`distill provider/model can be resolved from ~/.codex/config.toml`
  - 同步更新 CLI README 与 MVP 文档中的 AI 环境说明
- 发现:
  - 使用 `HOME` 指向临时目录可稳定测试 `~/.codex/config.toml` 联动
  - 在 `mock` provider 下可完成无网络回归，同时保留真实 provider 的运行时入口
- 假设:
  - 当前最小 TOML 解析足以覆盖本项目已用字段；若 `config.toml` 后续出现复杂数组/内联表，可再升级解析器
- 决策:
  - distill provider 正式采用“config.toml 默认 + 环境变量覆盖”策略
- 验证:
  - `npm --prefix projects/cli test`：13 passed, 0 failed
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`：24 passed, 0 failed
- 未解问题:
  - provider 认证方式除 `requires_openai_auth` 外的更细粒度凭据映射尚未扩展
- 下一步:
  - 若接入更多 provider，补充 provider-auth 映射与超时/重试策略

## R-0098 关键步骤提交前验证与提交边界决策

- 日期: 2026-04-07
- 目标: 落实“关键步骤必须提交”，并在脏工作区中明确本轮提交边界
- 输入:
  - 用户明确要求关键步骤需要提交修改
  - 当前工作区存在大量 `agents/**` 运行产物与 `.DS_Store` 未跟踪文件
- 动作:
  - 重新执行验证：
    - `npm --prefix projects/cli test`
    - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`
  - 确认本轮提交边界：仅提交代码、文档、测试；排除运行时产物
- 发现:
  - CLI 测试 `13 passed, 0 failed`
  - Hooks 测试 `24 passed, 0 failed`
  - 运行时产物体量大且与实现无关，不应进入关键步骤提交
- 决策:
  - 本轮按“功能改动+验证通过”形成关键里程碑 commit
  - 不把 `agents/**` 与 `.DS_Store` 纳入提交
- 假设:
  - 当前新增与修改的 hooks/cli 测试足以覆盖本轮行为变更；更细粒度回归由后续迭代补充

## R-0099 Distill 实现从 CLI 拆分到独立工程 `projects/reve`

- 日期: 2026-04-07
- 目标: 保持 `projects/cli` 纯净，避免 distill/总结实现受 Agent 运行环境耦合干扰
- 输入:
  - 用户明确要求：`run/verify` 留在 CLI，`distill` 独立到 `projects/reve`
  - 用户要求 `reve` 具备可外部周期调用能力，并可在 stop hook 中主动触发
- 动作:
  - 形成迁移决策：
    - CLI 移除 `distill` 逻辑与命令
    - 新增 `projects/reve` 承载 `distill` 与后续长期总结能力
    - 新增仓库入口 `bin/reve`
  - 将上述决策追加到 MVP 计划与 CLI 合同文档
- 决策:
  - 本轮采用“完全拆分”路径，而非 CLI 代理过渡
  - hooks 侧优先支持 `bin/reve` 调用，保持 fail-open
- 假设:
  - 现有 `raw_capture`/`short-term` 文件契约无需修改即可完成迁移

## R-0100 完成 `projects/reve` 落地并接入 hooks 可选 stop 触发

- 日期: 2026-04-07
- 目标: 将 distill 实现从 `projects/cli` 完整迁移到 `projects/reve`，并提供独立调用入口
- 输入:
  - 已批准方案：完全拆分（CLI 不再承载 distill 命令）
  - 用户补充：支持外部周期调用，或 stop hook 主动触发
- 动作:
  - 新增 `projects/reve`：
    - `projects/reve/src/cli.ts`：承载 distill 全部实现
    - `projects/reve/test/reve.test.ts`：覆盖 mock distill 与 config.toml provider 解析
    - `projects/reve/package.json` 与 `projects/reve/README.md`
  - 新增 `bin/reve` 入口，复用共享根与 workspace 根环境变量约定
  - `projects/cli/src/cli.ts` 移除 distill 相关逻辑与命令分支，保留 `init/run/verify/list/mount`
  - hooks 侧调整：
    - 测试中 distill 调用从 `agents distill` 切换为 `bin/reve distill`
    - `Stop` 增加可选主动触发（默认关闭，fail-open）：
      - `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STOP_TRIGGER_DISTILL`
      - `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_REVE_TIMEOUT_MS`
      - `OBSIDIAN_AGENT_MEMORY_SERVER_HOOKS_STOP_DISTILL_LIMIT`
  - 文档同步更新：CLI README、hooks README、MVP plan/contract
- 决策:
  - 保持 MVP 冻结边界：仍不启用长期记忆写入，仅迁移短期 distill 能力与边界
  - stop 主动触发仅作为可选加速路径，默认关闭
- 验证:
  - `npm --prefix projects/cli test`：11 passed, 0 failed
  - `npm --prefix projects/reve test`：2 passed, 0 failed
  - `node --test --experimental-strip-types scripts/codex-hooks/test/*.test.ts`：24 passed, 0 failed

## R-0101 调整 reve distill 默认模型为 gpt-5.2

- 日期: 2026-04-07
- 目标: 响应用户要求，更新 distill 默认模型
- 输入:
  - 用户明确要求将默认 distill 模型改为 `gpt-5.2`
- 动作:
  - 修改 `projects/reve/src/cli.ts` 中 runtime 默认模型回退值：
    - `gpt-5.4-mini` -> `gpt-5.2`
- 决策:
  - 仅修改默认回退值，不改变优先级：
    1) `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL`
    2) `~/.codex/config.toml` 的 `model`
    3) 代码默认值 `gpt-5.2`

## R-0102 旧 short-term 向 raw_capture 迁移与真实 provider 连通性验证

- 日期: 2026-04-07
- 目标:
  - 将过时 short-term 文档尽量转为 `raw_capture`
  - 使用真实 provider（非 mock）验证 reve distill 连通性
- 输入:
  - 用户要求：不要用 mock，验证真实 agent 环境连通性
  - 当前历史数据：`agents/*/memory/short-term/*.json` 旧格式（含 `input`，无 `source_message_id`）
- 动作:
  - 新增迁移脚本：`scripts/migrate-legacy-short-term-to-raw-capture.mjs`
  - dry-run 与实跑结果一致：
    - `agentic-memory-expert`: 48 条
    - `research-agent`: 1 条
    - `unity-optimization-agent`: 8 条
    - 共 57 条旧 short-term 生成对应 raw_capture
  - 真实 provider 连通性验证：
    - 默认 provider 读取到 `codex`（`~/.codex/config.toml`）
    - `requires_openai_auth = true`
    - 新增一条 raw_capture 后执行 `bin/reve distill`（不使用 mock）
- 发现:
  - `bin/reve distill` 返回 `Distilled short-term records: 0 / Skipped raw captures: 1`
  - 运行环境 `OPENAI_API_KEY` 未设置（长度 0）
  - 网络到 provider base_url 可达（`/v1/models` 返回 HTTP 401）
- 结论:
  - 真实链路可达网络层，当前阻塞点是鉴权凭据缺失，而非本地 distill 逻辑
  - 在未注入有效 key 前，真实 provider 路径会被计为 skipped

## R-0103 增加仓库级 env file 加载与生效验证

- 日期: 2026-04-07
- 目标: 为 `agents/reve` 提供统一环境变量文件，并验证其在运行时真实生效
- 输入:
  - 用户要求：设置 env file 存储环境变量，并确保可生效
- 动作:
  - `bin/agents` 与 `bin/reve` 启动时自动加载：
    - 默认 `REPO_ROOT/.env.agent-memory`
    - 可由 `OBSIDIAN_AGENT_MEMORY_SERVER_ENV_FILE` 覆盖
  - 新增 `.env.agent-memory.example`（模板）
  - `.gitignore` 增加 `.env.agent-memory`（避免本地密钥入库）
  - 文档补充：CLI/REVE README 说明自动加载机制
  - 生效验证（非单元测试、真实命令执行）：
    - 使用临时 env 文件写入
      - `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER=mock`
      - `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL=gpt-5.2`
    - 执行 `bin/agents init/run` + `bin/reve distill`
    - 产物显示 `model_provider=mock`、`model_name=gpt-5.2`
- 结论:
  - env file 已能在 launcher 层生效并影响 distill 运行时配置解析

## R-0104 真实 AI 环境连通性复测：鉴权通过但 provider 返回空输出

- 日期: 2026-04-07
- 目标: 在用户填充 env 后，验证真实 provider 路径是否可产出 short-term
- 输入:
  - `.env.agent-memory` 已配置：
    - `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_PROVIDER=codex`
    - `OBSIDIAN_AGENT_MEMORY_SERVER_DISTILL_MODEL=gpt-5.2`
    - `OPENAI_API_KEY` 已填充
- 动作:
  - 执行真实链路（非 mock）：
    1) `bin/agents run --agent-id research-agent --input "..."`
    2) `bin/reve distill --agent-id research-agent --limit 5`
  - 补充连通性探针：
    - `GET https://gmn.chuangzuoli.com/v1/models`（带 Authorization）
    - `POST https://gmn.chuangzuoli.com/v1/responses`（简单输入）
    - `POST https://gmn.chuangzuoli.com/v1/chat/completions`
- 发现:
  - `v1/models` 返回 `HTTP 200`，说明 key 与网络可用
  - `v1/responses` 与 `v1/chat/completions` 均返回 `200`，但响应里 `output`/`message.content` 为空
  - `bin/reve distill` 结果：`Distilled short-term records: 0`, `Skipped raw captures: 1`
- 结论:
  - 当前阻塞点已从“鉴权缺失”转为“provider 返回空文本内容”
  - distill 代码路径可达，但因缺少可解析模型输出被判定为 skipped

## R-0105 通过 responses 流式回退修复空输出，并在真实 provider 生成有效 short-term

- 日期: 2026-04-07
- 目标: 在真实 provider 下消除 `skipped`，稳定产出可用 short-term
- 输入:
  - 已确认 `v1/responses` 非流式返回 `status=completed` 但 `output=[]`
  - 同一 provider 在 `stream=true` 下存在 `response.output_text.done` 事件且包含文本
- 动作:
  - 在 `projects/reve/src/cli.ts` 中增强 `distillWithResponsesApi`：
    - 优先走原有非流式
    - 若缺少可解析输出，则自动回退到 `stream=true`
    - 解析 SSE `data:` 行并提取 `response.output_text.done.text`
  - 使用真实 provider 复测：
    1) `bin/agents run --agent-id research-agent --input "..."`
    2) `bin/reve distill --agent-id research-agent --limit 5`
  - 再用结构化 `hook flush` 输入（含 evidence refs）复测质量
- 发现:
  - 真实 provider 下已从 `skipped` 转为实际写入
  - 新产物示例：
    - `source_message_id = e2278baa-2284-48e7-9876-3f7699324c5f`
    - `model_provider = codex`
    - `model_name = gpt-5.2`
    - `quality.status = pass`
    - `summary = \"Distill succeeded with provider codex.\"`
- 结论:
  - 当前链路已可在真实 AI 环境生成“正确且可评估”的 short-term memory

## R-0106 MVP2 预研：reve 需要从单次 distill 进化为后台 consolidation driver

- 日期: 2026-04-07
- 目标: 为 mvp2 的 `raw_capture -> short-term -> long-term` 完整驱动器确定问题边界
- 输入:
  - 仓库契约：
    - `docs/portable-agent-contract/dynamic-memory.md`
    - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
    - `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
  - Vault 研究：
    - `30_研究/ClaudeCode/ClaudeCode.md`
  - 当前实现：
    - `projects/reve/src/cli.ts`
- 发现:
  - 契约层已经明确对象分层：
    - `Episode`：压缩证据层
    - `Learning`：跨案例稳定经验层
    - `Behavior Delta`：可执行行为增量
  - 当前 `reve` 只实现了 `raw_capture -> short-term(Episode)` 的单对象生成
  - 缺失的核心不只是“long-term 落盘”，而是：
    - consolidation gate
    - 批次选择器
    - `Episode -> Learning` 聚合规则
    - 失败回滚与幂等
    - 后台运行与可观测
  - Claude Code 的 dreaming 对 mvp2 最有价值的不是 prompt 文案，而是控制语义：
    - stop-hook 触发但后台执行
    - 多重 gate（enabled/time/session/lock）
    - fork 子代理执行 consolidation
    - lock 同时承担互斥与时间基线
    - 任务态/UI/analytics 三层可观测
- 初步判断:
  - mvp2 若直接做到 `Behavior Delta`，范围会明显超出“驱动器和蒸馏流程跑通”
  - 更合理的最小闭环是：
    - `raw_capture -> short-term(Episode) -> long-term(Learning)`
    - `Behavior Delta` 先保留接口与对象占位，不纳入第一轮可执行目标

## R-0107 MVP2 设计约束补充：长期产物宜先落在 `Learning`，驱动器语义借鉴 Claude Code dreaming

- 日期: 2026-04-07
- 目标: 基于契约文档与 Claude Code dreaming 研究，进一步收敛 `reve` 在 mvp2 的最小问题空间
- 输入:
  - `docs/portable-agent-contract/dynamic-memory.md`
  - `docs/portable-agent-contract/dynamic-memory/memory-distillation.md`
  - `docs/portable-agent-contract/dynamic-memory/long-term-memory-index.md`
  - `/Users/screamcart-agent0/PandaVault/30_研究/ClaudeCode/ClaudeCode.md`
  - `projects/reve/src/cli.ts`
- 动作:
  - 复核 `Episode / Learning / Behavior Delta` 三层对象在契约中的职责边界
  - 对照 Claude Code dreaming 的 gate、lock、fork、观测语义，筛出可迁移到 `reve` 的控制要点
  - 结合当前 `reve distill` 代码，定位 mvp2 与现状之间的结构性缺口
- 发现:
  - 契约层已经明确：
    - `Episode` 是蒸馏后的案例/证据层，适合作为 short-term 产物
    - `Learning` 是跨 `Episode` 聚合后的稳定经验层，适合作为 mvp2 的 first-pass long-term 产物
    - `Behavior Delta` 是审阅态可执行行为增量，按长期索引文档仍是长期检索主锚点，但形成门槛更高
  - 当前 `projects/reve/src/cli.ts` 仅支持：
    - 扫描 pending `raw_capture`
    - 单条调用模型生成 `episode`
    - 写入 run summary
    - 不具备 batch selection、`Episode -> Learning` consolidation、失败回滚、锁互斥、后台任务可观测
  - Claude Code dreaming 对 mvp2 最可迁移的不是 prompt，而是驱动器控制语义：
    - stop-hook 触发但以后台任务执行
    - gate 顺序偏保守，先 cheap checks 后 expensive checks
    - 单 lock 同时承载互斥和“上次成功 consolidation 时间”
    - fork 子代理/子线程执行 consolidation，而主对话只保留简短完成反馈
    - 任务态、详情态、事件态三层可观测
  - 契约文档与 Claude Code 研究之间存在一个关键差异：
    - 契约文档中的“记忆驱动器”描述更偏 session 侧同步检索/注入
    - Claude Code dreaming 体现的是后台 consolidation worker
    - 这两者并不冲突，但在 mvp2 中应先聚焦“形成链路”，暂不扩展到运行时注入链路
- 假设:
  - mvp2 若先打通 `raw_capture -> Episode -> Learning`，可以在不引入审阅与行为注入复杂度的前提下验证 `reve` 的核心价值
  - `Behavior Delta` 更适合保留为对象占位和索引兼容目标，而不是第一轮真正写入/注入的执行对象
  - `reve` 的第一版后台驱动器未必需要真正 fork AI 子代理；只要具备独立 run record、锁、回滚和批次边界，也可先满足 mvp2 验证需求
- 决策:
  - 暂不把 Claude Code dreaming 的 UI 形态视为实现要求，只借鉴其 gate/lock/background/observability 控制语义
  - 暂不把长期检索注入器纳入当前 mvp2 讨论；当前讨论只聚焦“形成链路”
- 未解问题:
  - mvp2 的长期产物是否明确只做 `Learning`，还是要同时生成 `Behavior Delta` 草案
  - `Episode -> Learning` 的批次边界应按时间窗、session 数，还是按主题/信号聚类形成
  - 后台驱动器是否必须以真实 AI 子线程形态运行，还是先以 `reve` 独立进程运行即可
- 下一步:
  - 向用户确认 mvp2 的长期对象范围
  - 基于确认结果，提出 2-3 种 `reve` 驱动器方案并比较取舍

## R-0108 确认 MVP2 长期对象范围为 `Learning only`

- 日期: 2026-04-07
- 目标: 锁定 mvp2 的长期对象范围，避免 `reve` 驱动器设计同时混入 `Behavior Delta` 审阅链
- 输入:
  - 用户对范围问题的直接确认：`Learning Only`
- 动作:
  - 将本轮设计目标收敛为：
    - `raw_capture -> Episode -> Learning`
  - 保留 `Behavior Delta` 仅作为未来兼容占位，不纳入当前真实生成目标
- 发现:
  - 该范围确认后，mvp2 可以集中验证三件事：
    - `raw_capture` 批次选择是否稳定
    - `Episode` 是否能被聚合为高质量 `Learning`
    - `Learning` 是否具备未来可继续晋升的证据链
  - 当前不需要引入：
    - `Behavior Delta` 审阅状态
    - 执行上下文注入门控
    - `skill_pack update` 变更链
- 决策:
  - mvp2 first-pass long-term object 明确限定为 `Learning`
- 未解问题:
  - `Learning` 的形成单位应按时间批、session 批还是主题批
  - `Learning` 落盘后需要哪些最小索引字段来支撑未来 `Behavior Delta` 晋升
- 下一步:
  - 对比 2-3 种 `reve` 驱动器方案
  - 给出推荐路径并等待用户批准设计

## R-0109 确认 MVP2 先实现纯离线批处理驱动，后台实时性后置

- 日期: 2026-04-07
- 目标: 锁定 `reve` 在 mvp2 的第一阶段运行形态，避免过早引入后台触发与实时增强复杂度
- 输入:
  - 用户决策：先实现方案 3 `纯离线批处理`
- 动作:
  - 将 mvp2 第一阶段驱动器收敛为“手动触发的离线批处理”
  - 将“后台 worker 驱动、实时提取与记忆注入”下沉为后续增量阶段
- 发现:
  - 当前最优先验证目标不是实时性，而是蒸馏效果是否稳定、长期对象是否有质量
  - 纯离线批处理可以把问题收敛为：
    - 批次选择
    - `Episode` 形成质量
    - `Episode -> Learning` 聚合质量
    - 幂等、回滚、run record
  - 在该阶段，手动触发比 stop-hook 背景触发更利于反复测试 prompt、provider 与对象结构
- 决策:
  - mvp2 第一阶段采用手动触发的 `reve` 纯离线批处理模式
  - 触发增强顺序明确为：
    1. 先跑通离线批处理蒸馏效果
    2. 再在其基础上增量实现后台实时性与记忆提取
- 未解问题:
  - 离线批处理的最小命令接口应是单命令 `drive`，还是拆成 `distill/consolidate` 两阶段命令
  - `Learning` 的批次形成应默认按固定窗口，还是按主题聚类
- 下一步:
  - 给出基于纯离线批处理的 `reve` 设计分段说明
  - 待用户批准后写入设计文档并提交

## R-0110 MVP2 离线批处理设计获批并固化为正式设计文档

- 日期: 2026-04-07
- 目标: 将已确认的 mvp2 第一阶段方案固化为可执行的设计文档，作为后续 implementation plan 的依据
- 输入:
  - 用户确认：按 `纯离线批处理 -> 后台增强` 的两阶段顺序推进
  - 用户确认：按步骤执行设计文档、提交、实现计划
- 动作:
  - 编写 `docs/plans/2026-04-07-reve-mvp2-offline-distillation-design.md`
  - 将设计边界明确收敛为：
    - 手动触发
    - `raw_capture -> Episode -> Learning`
    - `distill / consolidate / drive` 三命令形态
    - 不纳入后台 worker、长期注入与 `Behavior Delta`
- 发现:
  - `distill` 与 `consolidate` 分离有利于手动评估蒸馏质量，避免把短期问题和长期聚合问题混在一次调试里
  - `drive` 作为编排入口是必要的，但不应额外承载业务语义
  - 第一阶段最关键的工程约束是：
    - `Learning` 幂等
    - 锁冲突保护
    - 失败时只留下 run record，不留下半完成业务状态
- 决策:
  - 将该设计文档作为 mvp2 第一阶段唯一正式设计基线
- 未解问题:
  - `Learning` 的最小证据门槛是否固定为至少 2 条 `Episode`
  - `needs_more_evidence` 是否落盘为中间对象
- 下一步:
  - 提交设计文档与研究记录
  - 使用 `writing-plans` 生成实现计划
