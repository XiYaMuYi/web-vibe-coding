# ARCHITECTURE.md

> 本文档基于当前代码库的真实状态编写，用于给后续接手的 Agent 提供准确上下文。它优先描述“现在实际是什么”，而不是“原本计划是什么”。如发现实现与理想设计不一致，会以 `[TODO/Debt]` 标注。

---

## 1. 项目总览

当前代码库已经从早期的单一剧情页，演化成一个**星际叙事门户系统**。它的核心不是“一个网页”，而是一组围绕同一世界观协同工作的模块：

1. **主剧情轨**：`index.html` / `story.html` / `story.json` / `js/app.js` / `js/Navigator.js` / `js/Renderer.js` / `js/Interaction.js`
2. **身份卡与商品轨**：`memorial-wall.html` / `wall-test.html` / `js/MemorialWall.js`
3. **悬赏轨**：`bounty-board.html` / `bounty-delivery.html`
4. **品牌与实验页**：`truth-branding.html`
5. **公共系统层**：`EconomyManager.js` / `CommodityService.js` / `FxEngine.js` / `PortalRouter.js` / `global-reset.js`

这几个模块在叙事上是同一个宇宙，在技术上则是**多页面、模块化、状态局部共享**的架构。

---

## 2. 当前产品结构的真实形态

### 2.1 主入口与模块入口

`index.html` 是总入口，但它不再只是“剧情页壳子”，而是一个**模块入口选择器**：

- 首次进入默认应走主剧情
- 后续进入可以切换到其他模块页面
- 入口层通过 `iframe` 承载子页面
- `PortalRouter.js` 提供统一的页面跳转抽象

入口页的职责是：

- 播放全局 BGM
- 让用户选择进入哪个系统模块
- 保持项目整体的星空、仪式感和门户感

### 2.2 主剧情轨

剧情轨是整个项目的“解锁层”和“赚钱层”的前提：

- `story.json` 定义剧情节点、交互、奖励、分支
- `Navigator.js` 负责节点推进、flags、历史栈、条件判断
- `Renderer.js` 只负责把节点渲染到 DOM
- `Interaction.js` 负责 hold / mash / drag / connect 等交互
- `app.js` 是胶水层和事件编排层

剧情轨的真实作用不是单纯讲故事，而是：

- 引导用户获得星辰
- 建立“进入系统”的仪式感
- 让后续模块页有解锁逻辑

### 2.3 身份卡与商品轨

`memorial-wall.html` 与 `wall-test.html` 是项目里第二条非常重要的轨道。

- `memorial-wall.html`：入口与提交页，负责昵称、头像、摄像头、上传、余额展示、商品架入口
- `wall-test.html`：沉浸式展示页，负责 34 张身份卡 / 照片墙展示

这条轨道的核心是“商品身份化”：

- 用户输入昵称
- 提交头像 / 摄像头 / 上传图像
- 形成身份卡或商品卡
- 再进入沉浸式展示页

### 2.4 悬赏轨

`bounty-board.html` 与 `bounty-delivery.html` 是新增的另一条系统轨。

- `bounty-board.html`：发榜 + 接契 + 托管 + 超越退款 + 悬赏卡展示
- `bounty-delivery.html`：交付 + 清算 + 归档 + 退回托管

这条轨不是剧情分支，而是**系统层功能轨**，和商品轨并列，独立于主线存在，但又依赖主线解锁。

### 2.5 品牌与实验页

`truth-branding.html` 及其他历史页面属于扩展模块或实验模块，通常没有与主线完全统一的导航体系，因此后续需要逐步纳入统一模块导航规范。

---

## 3. 真实架构拓扑

### 3.1 剧情轨数据流

```text
index.html
  └─ 页面壳 + 启动选择器 + iframe 承载
        ↓
js/app.js
  ├─ 初始化 DeviceManager / FxEngine / StoryRenderer / Navigator / Debugger
  ├─ 绑定彩蛋、摄像头、调试与过渡行为
  └─ 负责节点切换时的系统级行为编排
        ↓
js/Navigator.js
  ├─ 剧情路由中枢
  ├─ 管理历史栈、flags、节点推进、条件判断
  └─ 调用 Renderer / Interaction 的回调
        ↓
js/Renderer.js
  ├─ 读取 story.json
  ├─ 渲染标题、正文、背景、选项、布局
  └─ 只负责表现，不负责决策
        ↓
story.json
  └─ 剧情 SSOT（single source of truth）
```

### 3.2 身份卡轨数据流

```text
memorial-wall.html
  ├─ 昵称 / 上传 / 摄像头 / 余额 / 商品架入口
  ├─ 扣星辰、提交、状态锁
  └─ 根据 user_submitted 决定是否自动进入沉浸页
        ↓
wall-test.html
  ├─ 沉浸式 3D 照片墙承载页
  └─ 初始化 js/MemorialWall.js
        ↓
js/MemorialWall.js
  ├─ 头像演化、粒子、上传 / 摄像头兜底
  ├─ 状态锁与提交后坍塌
  └─ POST /api/wall
```

### 3.3 悬赏轨数据流

```text
bounty-board.html
  ├─ 悬赏列表、发榜表单、领取托管、测试兜底数据
  ├─ /api/bounty 提交
  ├─ EconomyManager 扣星辰
  └─ localStorage 记录托管状态
        ↓
bounty-delivery.html
  ├─ 读取当前契约
  ├─ 交付 / 退回托管 / 归档
  └─ EconomyManager 返还星辰或完成结算
```

---

## 4. 模块职责拆解

### 4.1 `index.html`

- 统一入口壳
- 播放全局 BGM
- 展示模块选择/启动页
- 通过 `iframe` 承载子页面
- 需要确保首次进入强制主剧情，后续进入允许模块切换

### 4.2 `js/PortalRouter.js`

- 项目级路由抽象层
- 负责将“模块名”映射为真实 HTML 页面
- 负责向 iframe 注入目标页面 URL
- 未来应成为所有模块切换的统一入口

### 4.3 `js/app.js`

- 剧情轨胶水层
- 负责初始化各服务
- 负责特殊按钮分支、黑场、彩蛋、系统切换
- **不应**写死剧情内容

### 4.4 `js/Navigator.js`

- 剧情节点路由中枢
- 负责 flags、条件、历史、回退
- 是主剧情的状态控制器

### 4.5 `js/Renderer.js`

- 剧情显示器
- 只做渲染，不做决策

### 4.6 `js/Interaction.js`

- 负责 hold / mash / drag / connect
- 不直接切剧情，只发出结果事件

### 4.7 `js/FxEngine.js`

- 视觉粒子与过渡特效层
- 管理星尘、闪光、拖尾、背景光效

### 4.8 `js/EconomyManager.js`

- 星辰余额系统
- 所有页面都应通过它读取 / 扣除 / 返还星辰
- 是经济闭环的统一服务层

### 4.9 `js/CommodityService.js`

- 商品 / 身份卡 / 购买状态管理
- 与 `memorial-wall.html` 强关联

### 4.10 `js/MemorialWall.js`

- 3D 照片墙核心前端引擎
- 头像生成、上传、摄像头、沉浸展示

---

## 5. 当前状态体系

### 5.1 剧情轨状态

剧情轨依赖这些状态来源：

- `story.json` 节点数据
- `Navigator.flags`
- `localStorage` 中的少量持久化状态
- 页面 DOM 当前状态

### 5.2 身份卡轨状态

身份卡轨主要依赖：

- `localStorage.user_submitted`
- `localStorage.stardust_balance`
- 当前昵称 / 上传 / 摄像头来源
- `EconomyManager` 的余额

### 5.3 悬赏轨状态

悬赏轨的状态至少包含：

```js
{
  itemId,
  amount,
  status,
  escrowAt,
  refundedAt,
  completedAt,
  signature
}
```

并通过 `localStorage` 在 `bounty-board.html` 与 `bounty-delivery.html` 之间共享。

---

## 6. 视觉与交互风格规范

### 6.1 项目整体视觉基调

当前项目已经形成一套稳定的“星空玻璃拟态”语言：

- 深色背景
- 青蓝 / 紫色冷光
- 玻璃拟态卡片
- 轻微粒子 / 星尘 / 背景漂移
- 发光边缘和冷白文字

### 6.2 按钮风格

按钮风格正在逐步统一，推荐分为：

- `btn-primary`：关键动作，如提交、确认、进入、托管
- `btn-secondary`：辅助动作，如返回、关闭、筛选、切换 tab
- `btn-danger`：危险动作，如退回、重置、清除

### 6.3 Tab 风格

Tab 目前在多页面中逐渐成为产品关键导航，因此需要统一：

- 深色玻璃拟态
- 当前激活项高亮
- 锁定态 / 解锁态
- 模块切换与页内切换区分清晰

---

## 7. 真实存在的风险与技术债

### 7.1 入口逻辑逐渐复杂

随着新页面增多，入口层有可能出现：

- 首次进入与后续进入逻辑不一致
- 某些页面可以直接打开，绕过主线
- 模块切换分散在各自页面，缺乏统一路由

#### [TODO/Debt]
后续应进一步固化“首次必须走主剧情，后续才开放模块 tab”的统一入口策略。

### 7.2 页面 tab 与按钮风格不完全一致

项目快速迭代导致：

- 页面自身写了一套 tab
- 下一页又写另一套 tab
- 按钮圆角、阴影、色值、hover 不一致

#### [TODO/Debt]
后续应抽出统一的设计变量和按钮系统，避免风格漂移。

### 7.3 状态持久化分散

目前状态散落在：

- `localStorage`
- 当前页面全局变量
- 少量服务层

#### [TODO/Debt]
后续应整理统一的模块状态约定，避免多个页面对同一状态的解释不一致。

### 7.4 API 契约历史包袱

部分页面存在“前端字段已经换了，但后端/旧逻辑仍有兼容”的风险，例如：

- `avatar` vs `imageBase64`
- `nickname` vs `name`
- 不同页面的状态字段名不完全一致

#### [TODO/Debt]
后续应把 API 契约文档化并收束兼容分支。

---

## 8. 对后续 Agent 的硬性建议

当后续 Agent 接手这个仓库时，请遵守以下原则：

1. **先读主线，再改模块**
   - 先理解 `story.json` / `Navigator.js` / `Renderer.js`
   - 再改悬赏页或身份页

2. **不要在单页里写死跨模块逻辑**
   - 模块切换应通过 `PortalRouter` 或统一导航层

3. **不要破坏主剧情的首入门槛**
   - 剧情是系统解锁层，不应被绕过

4. **不要随意新造视觉体系**
   - 继续沿用“星空玻璃拟态”与冷色冷光语言

5. **优先复用服务层**
   - 星辰余额走 `EconomyManager`
   - 商品/卡片走 `CommodityService`
   - 页面切换走 `PortalRouter`
   - 视觉过渡走 `FxEngine`

---

## 9. 项目一句话定义

这个项目不是一个“多页面网站”，而是一个**以主剧情为入口、以星辰经济为驱动、以身份卡与悬赏系统为延展的星际叙事门户**。

---

## 10. 未来推荐的统一方向

后续最重要的演进方向不是再多做页面，而是：

- 统一入口逻辑
- 统一 tab 导航
- 统一按钮规范
- 统一状态与路由抽象
- 统一模块解锁策略

只要这五件事收束好，这个项目就会从“迭代很快的多页集合”升级成真正可扩展的产品系统。
