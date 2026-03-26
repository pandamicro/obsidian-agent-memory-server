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
