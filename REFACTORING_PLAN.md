# REFACTORING_PLAN

本文档作为《星辰典当行》渐进式解耦重构的记忆锚点。后续任何改动前，应先读取本文件，确保不偏离以下架构原则。

---

## 1. 当前审计现状（五个维度）

### 1. 经济系统
- 当前星辰余额主要依赖 `localStorage.stardust_balance`。
- 增减、扣费、展示逻辑仍散落在入口页与交互事件中。
- 需要抽成独立的 `EconomyManager`，只提供：`addStardust(amount)`、`spendStardust(amount)`、`canAfford(amount)`、`onChange()`。

### 2. 商品系统
- 当前商品主要由 `data/market-gallery.json` 驱动，但购买、下载、库存、已购状态仍混在页面逻辑中。
- 需要抽成独立的 `CommodityService`，统一负责商品加载、购买前校验、扣费、库存扣减、已购状态记录。

### 3. 交互与表现层
- `Interaction.js` 仍是输入、判定、业务结果的混合层。
- 需要将其收敛为纯事件发射器，只在达标时 `emit('INTERACTION_SUCCESS', payload)`。
- 星辰增减与视觉特效应由业务层 / Fx 层监听事件后独立处理。

### 4. 路由与页面状态边界
- `memorial-wall.html` 与 `wall-test.html` 已是物理隔离页面，但状态传递主要依赖 `localStorage`。
- 独立页面之间只能通过 `localStorage` 或 URL 参数传递状态。
- 同页内部模块需由清晰状态机管理挂载与销毁。

### 5. 剧情节点扩展性
- `story.json` 仍是剧情 SSOT。
- 需要扩展 schema，使节点可以声明 `rewardStardust`、`costStardust` 等经济语义。
- 引擎只解释字段，不硬编码业务奖励/扣费规则。

---

## 2. 解耦方案总纲

### 经济系统：`EconomyManager`
职责：
- 管理星辰余额
- 统一读写 `localStorage`
- 发布余额变化事件

### 商品系统：`CommodityService`
职责：
- 加载商品库
- 统一商品购买流程
- 调用 `EconomyManager` 扣费
- 管理库存与已购列表

### 交互系统：纯事件发射器
职责：
- 仅负责输入判定与事件派发
- 不直接操作余额、不直接播放视觉特效

### 路由状态边界
职责：
- 独立页面间通过 `localStorage` / URL 参数传递
- 页面内模块由状态机统一管理

### 剧情节点扩展
职责：
- 节点可以声明奖励、消耗、解锁条件
- `Navigator.js` / `Renderer.js` 只消费 schema，不写死业务规则

---

## 3. 重构执行原则

1. **严格分步执行**：每个 Phase 完成后，必须等待确认再进入下一步。
2. **保留主干可运行**：任何改动都不能破坏当前可用的入口页、提交链路与 3D 星图挂载。
3. **先抽象，后迁移**：先建立服务，再替换调用点，避免一次性大改。
4. **UI 只订阅状态，不直接改业务数据**。
5. **核心语义以文档和 schema 为准**，不要把规则散落在点击事件里。

---

## 4. 推荐重构顺序

- Phase 0：建立记忆锚点 `REFACTORING_PLAN.md`
- Phase 1：抽离 `EconomyManager` 与 `CommodityService`
- Phase 2：重构 `Interaction.js` 为事件总线
- Phase 3：解耦 `memorial-wall.html` 入口页
- Phase 4：扩展 `story.json` 经济语义

---

## 5. 当前最重灾区

1. `memorial-wall.html`：经济、商品、提交、下载、跳转、重置混在一起。
2. `js/Interaction.js`：输入与业务结果耦合。
3. `js/MemorialWall.js`：UI 与沉浸引擎耦合，后续可继续拆分。

---

## 6. 验收标准

- 经济增减由 `EconomyManager` 统一管理。
- 商品交易由 `CommodityService` 统一管理。
- 交互成功只发事件，不直接改余额或播特效。
- 入口页 UI 通过订阅状态更新。
- `story.json` 可表达奖励 / 消耗语义。
