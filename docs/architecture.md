# 工程架构

本工程将网页展示、HTTP 接口、业务规则和持久化分开。前端不能直接访问数据库，状态变更经过后端校验和事务。对外接口以[接口约定 V0.4](苹什么_前后端接口约定_V0.4.md)为准。

## 数据流

页面组件 → GardenProvider → REST 数据访问 → 资源路由 → ResourceService → domain 规则 → Repository 事务 → PostgreSQL／PGlite。

HTTP 使用 snake_case，内部 TypeScript 领域模型使用 camelCase。前端数据层将资源 DTO 转成既有页面视图，Provider 协调加载、保存和错误提示。树阶段由共享纯领域函数依据服务端收获事实推导；客户端不提交阶段或收获计数。

资源写接口返回该操作结果；前端随后通过分页列表与 bootstrap 重新读取并更新共享缓存。bootstrap 只返回未归档项目和引导状态，不包含全部历史记录。目前前端为复用页面共享状态，按列表分页聚合读取数据；后续可按页面需要进一步减少历史数据加载量。

## 层的职责

| 层           | 路径                                    | 职责                                                         |
| ------------ | --------------------------------------- | ------------------------------------------------------------ |
| HTTP 契约    | packages/contracts/src/http.ts          | snake_case 请求校验、资源 DTO、分页与反馈结构                |
| 内部模型     | packages/contracts/src/garden.ts        | 领域命令和兼容历史数据的快照结构，不作为对外命令接口         |
| 业务领域     | packages/domain                         | 纯函数执行规则、成长阶段、目标完成和成果快照                 |
| 前端页面     | apps/web/src/features                   | 表单、导航、反馈与展示                                       |
| 前端数据访问 | apps/web/src/lib/garden                 | REST 调用、分页、DTO 转换、保留原请求以幂等重试、旧缓存迁移  |
| 资源路由     | apps/api/src/modules/garden/*.routes.ts | 按项目、记录、任务、目标、成果、报告分文件校验参数和解析会话 |
| 展示映射     | http-presenters.ts                      | 从内部状态生成 DTO、服务端成长变化与报告                     |
| 应用服务     | resource.service.ts                     | 生成请求指纹，组合领域操作与数据库事务                       |
| 数据访问     | apps/api/src/repositories               | 会话、快照、持久幂等结果、唯一身份约束、数据库生命周期       |

项目详情组件继续按目标、任务、记录、成果和设置拆分。纯领域层不导入 React、Fastify 或数据库客户端。

## 持久化与幂等

users、web_sessions 保存身份和会话；garden_snapshots 保存每用户完整聚合状态，包括项目、目标、任务、记录、成长事件、进度事件、成果和原文批次上下文。用户花园仍是跨对象一致提交的事务边界。

Repository 使用 SELECT FOR UPDATE 串行化同一用户的写入。api_operations 以用户和 Idempotency-Key 建立数据库唯一约束，在业务事务中持久化请求指纹与首次响应，不受旧内部 500 次命令缓存限制。重放直接返回存储的业务结果；不同正文或不同路径复用 key 会冲突。

garden_entity_links 是不可重复的身份绑定索引，以用户、绑定类型和来源 ID 为主键，保证一个任务对应一个行动、一个目标对应一个成果、一个行动对应一个成长事件。新增迁移会从既有快照填充这些约束，不删除历史用户数据。

早期实体表保留在迁移历史中，当前完整对象事实仍以快照为准，不同时维护第二套业务数据。资源 API 已分页，但数据库读取仍采用每用户快照；大规模数据时可在 Repository 内改成实体存储或查询投影。

两个数据库驱动使用同一套 SQL 迁移。启动迁移失败时不接受业务请求。默认开发使用 PGlite，正式生产可切换 PostgreSQL；云端当前 HTTPS 测试环境继续使用独立 PGlite 目录。

## 会话、输入与扩展

匿名 Cookie 为 HttpOnly、SameSite=Lax，HTTPS 使用 Secure。服务端仅保存令牌哈希；业务身份来自会话，跨站写请求检查 Origin。当前没有跨设备账号恢复。

文字和确认卡片暂存 sessionStorage。结果未知时同时保留逻辑操作编号和实际 HTTP 请求，重试不会因为日期变化或重新生成编号造成重复保存；确认成功后才清空。旧 localStorage 原型通过只允许空花园执行的导入扩展迁移，旧缓存保留。

目标建议保存为普通 Record，不替换当前 Goal。普通记录和任务完成不自动推进目标；关联具体 Goal 的 Action 由用户确认实际贡献后可推进，或通过独立进度接口更新。项目可有多个 Goal 和一个主要 Goal；目标成熟只创建待摘成果，手动收获后才计入独立果篮和树阶段。收获与结束项目、创建下一目标分别提交。

现已接入 Python/FastAPI AI 服务，Node 根据当前会话读取项目上下文并调用 Python。AI 只生成候选草稿，用户确认后调用 record-batches/commit，不直接修改数据库。供应商密钥只存在于 Python 服务配置中。语音采用 `qwen-audio-3.1-asr-flash`，确认免费额度和用完即停后启用；细节见根目录的 `AI接入说明.md`。正式账号可替换会话解析，业务仍只接受服务端确认的身份。

## V1.1 兼容与视图

`styles/journal.css` 管理水彩手帐主题、树林和收获场景；`Illustration.tsx` 统一引用参考素材和操作图标；`GardenVisuals.tsx` 集中渲染四阶段树、五档目标苹果和果篮；GoalCard 负责多目标与主要目标选择，ResultsList 区分树上待摘与已收获。HomePage 只组合项目森林，不实现业务计数规则。

本次不改变数据库事实存储方式，使用兼容的可选 `Project.treeStageThreshold` 和已有 Record.goalId/contribution、Result.harvestedAt。旧快照没有阈值时默认 3（已有显式 1/2 配置保持），不清空、不自动补录收获。API project 保留旧 `goal` 字段并新增完整 `goals`，record 新增关联与贡献，便于旧客户端兼容读取。

## Figma 21 页面与动效

`features` 按种树、项目、目标、记录、报告、时间线、收藏、分享和设置分目录。`design/components.tsx` 提供场景标题、筛选、指标和开关；业务状态仍只通过 GardenProvider 和 REST API 修改。

`design/welcome-motion.ts` 保留 Figma MCP 返回的欢迎页动画片段；`motion-data.json` 保存本地 .fig 的逐节点轨道，`motion-profiles.ts` 解析时间、插值与弹簧，`use-design-motion.ts` 将原节点绑定到实际数据界面。重复列表复用同组轨道，进度动画归一化到真实进度；输入获得焦点、页面隐藏时暂停，系统减少动态效果或用户关闭动效时停止。

`public/assets/figma21` 保存新文件的可见素材和矢量图标。导出时忽略已经被隐藏的旧图层，优先使用可见 @4x 新素材；移动端 WebP 保持原比例并压缩。原始哈希、节点与尺寸记入 manifest；重建脚本在 `apps/web/scripts/import-figma21.py` 和 `export-figma-motion.py`。字体沿用完整手写字体分片。

浏览器偏好与业务事实分开：`lib/preferences.ts` 管理本机设置，项目分类单独随 Project 持久化，`features/settings/use-garden-preferences.ts` 应用主题和前台提醒。日签图片由前端根据真实成果和任务生成。AI 拆任务经过 Node 会话与项目归属校验，再调用 Python 结构化模型；用户确认之前不写入数据库。
