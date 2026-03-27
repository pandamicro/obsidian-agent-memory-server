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
