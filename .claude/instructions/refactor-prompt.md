# [Project Refactoring] 跨页面全局导航与交互体系重构指令

**角色设定**：你现在是本项目（星辰典当行）的首席前端架构师。
**项目路径**：当前工作目录

## 项目现状（必读，已验证）

当前架构是 **MPA（多页面架构）**，`index.html` 使用 `<iframe id="app-frame">` 加载子页面。路由通过 `js/PortalRouter.js` 控制，支持四个路由：story → `story.html`，bounty → `bounty-board.html`，delivery → `bounty-delivery.html`，memorial → `memorial-wall.html`。

各页面 UI 各自为政，无统一导航，无访问控制。`PortalRouter.js` 已存在且是唯一的跨页面路由中枢——**必须扩展现有文件，不要新建第二套路由系统。**

---

## 当前痛点

1. 各页面的 Tab、按钮、入口割裂，无统一导航状态管理
2. 用户可绕过序章直接访问任何页面
3. 视觉风格不统一，各页面按钮样式各自为政
4. 缺乏可扩展的路由鉴权机制

## 重构目标

在不破坏现有功能（星辰经济系统、主线剧情、身份卡、悬赏流转、3D纪念墙交互）的前提下，建立**高可扩展、状态受控、视觉统一**的全局导航体系。

---

## ⚠️ 关键约束（绝对不能违反）

1. **扩展 `js/PortalRouter.js`**，不要新建 `NavigationService.js` 或任何第二套路由系统
2. **现有 `story.json` 状态机逻辑不能改**，剧情节点定义完全保留
3. **`Interaction.js` 的事件绑定不能被打断**，导航栏注入后 mash/hold/drag/connect 必须正常工作
4. **`memorial-wall.html` 是 Three.js 全屏 Canvas 场景**，导航栏不能遮挡 3D 交互、不能吃事件
5. **经济系统（`EconomyManager.js`）完全保留**，localStorage 读写逻辑不动
6. **每完成一个 Phase 后停止，等用户验证再继续下一个 Phase**
7. **不修改 `node_modules`**
8. **`index.html` 是 iframe 容器，不要破坏 iframe 路由机制**

---

## 一、核心路由逻辑与状态机

本项目为 MPA，基于 LocalStorage 实现访问控制：

### 1. 绝对拦截规则 (Story-First Policy)
- 用户首次进入（未持有完成标记），只允许访问 `index.html`（入口）和 `story.html`（主剧情）
- 其他页面（`memorial-wall.html`, `bounty-board.html` 等）如果被强行访问，必须自动重定向回 `index.html` 或显示"坐标未解锁"黑屏提示
- 在 `PortalRouter.navigate()` 中加入 `checkAccess()` 鉴权

### 2. 状态解禁机制 (Unlock Mechanism)
- `story.html` 主线剧情播放完毕后，写入 `localStorage.setItem('stardust_user_state', JSON.stringify({ isStoryCompleted: true, unlockedAt: Date.now() }))`
- 在剧情终章（`node_004`）渲染时或 Navigator.goTo('node_004') 时触发写入
- 解锁后，`index.html` UI 从"单一启动"切换为"全局模块入口展示"

---

## 二、全局导航架构规范

### 注入模式
采用 **App Shell 注入式**：不在 `index.html` 容器上硬编码，而是在各子页面（`story.html`, `bounty-board.html`, `memorial-wall.html`, `bounty-delivery.html`）初始化时，通过 JS 动态挂载导航组件到页面顶部。

### 1. 一级导航 (Global Nav) — 4 个核心枢纽
- `[主剧情 (Story)]`、`[悬赏 (Bounty)]`、`[身份 (Identity)]`、`[归档 (Archive)]`
- 当前所在模块高亮显示
- 未解锁模块置灰 + 锁定图标，点击提示"需完成序章记忆"

### 2. 二级导航 (Page-Level Tabs) — 模块内部
- `memorial-wall.html`: [星辰货架] | [典当自我]
- `bounty-board.html`: [发榜] | [接契]
- `bounty-delivery.html`: [交付] | [清算] | [归档]
- 继承统一视觉规范

---

## 三、视觉系统统一化

在 `css/` 目录下创建或扩展全局 CSS，统一定义组件类名：

### 1. 主按钮 (`.btn-primary`)
- 用途：进入、提交、缔结契约
- 特征：青蓝/紫霓虹发光底色，玻璃拟态 (`backdrop-filter`)，高强度 Hover 动效（缩放+光晕扩散）

### 2. 次按钮 (`.btn-secondary`)
- 用途：返回、切换 Tab、关闭
- 特征：极低饱和度背景，1px 半透明描边 (`rgba(255,255,255,0.1)`)

### 3. 危险/警示按钮 (`.btn-danger`)
- 用途：退回托管、重置状态
- 特征：暗橙色/深红色发光，避免廉价高饱和警告色

### 4. 导航栏组件 (`.nav-bar`, `.nav-item`, `.nav-item.active`, `.nav-item.locked`)
- 深空玻璃拟态基底
- 当前页高亮（霓虹边框或光晕）
- 锁定态：置灰 + lock icon + hover 提示

---

## 四、技术实施路径（严格按 Phase 执行）

### Phase 1: 核心服务基建
- 扩展 `js/PortalRouter.js`：
  - 添加 `checkAccess()` 方法，读取 `stardust_user_state` 判断是否解锁
  - 添加 `unlockSystem()` 方法，写入完成标记
  - 添加 `isStoryCompleted()` 检查方法
  - 在 `navigate()` 中调用 `checkAccess()`，未解锁则重定向或提示
- 在 `Navigator.js` 中，确保剧情终章（node_004）结束时调用 `PortalRouter.unlockSystem()`

### Phase 2: 全局导航栏注入
- 新建 `js/GlobalNavInjector.js`（或类似名），封装导航组件的动态注入逻辑
- 在 `story.html`, `bounty-board.html`, `memorial-wall.html`, `bounty-delivery.html` 的初始化流程中注入
- 一级导航 UI 挂载到页面顶部（z-index 需高于页面内容但低于关键交互层）
- 对接 `PortalRouter` 判断当前 Tab 高亮、未解锁 Tab 置灰
- **`memorial-wall.html` 特殊处理**：导航栏 z-index 低于 Three.js canvas，确保不遮挡 3D 交互

### Phase 3: 视觉重构
- 在 `css/navigation.css` 或 `css/global-ui.css` 中统一定义按钮类、导航类
- 各页面逐步替换原有按钮/Tab 样式，统一应用新类名
- **重要**：逐页面替换，每次改完验证该页面功能正常后再改下一个

### Phase 4: 页面级逻辑校准
- `index.html`: 根据 `stardust_user_state` 状态渲染不同开局
  - 未解锁：只显示序章按钮
  - 已解锁：展现全息系统面板（含各模块入口）
- `story.html`: 确保剧情结束处触发 `PortalRouter.unlockSystem()`
- 校对 `memorial-wall`, `bounty-board`, `bounty-delivery` 内部二级流转不受影响

---

## 最终验证标准

1. 不再有各自为政的页面 UI
2. 代码具备强扩展性（新增模块只需在路由表加一条即可）
3. 用户从序章走向广阔星图的体验无缝、丝滑、充满仪式感
4. 所有现有交互（mash/hold/drag/connect、3D 纪念墙、经济系统）正常工作
5. 未解锁页面被正确拦截

---

## 执行要求

**严格按 Phase 1 → 2 → 3 → 4 顺序执行。每完成一个 Phase 就停止，写清楚改了什么文件、改了什么逻辑。**

**不要跳过 Phase，不要一次性全部做完。每个 Phase 完成后停止等待用户验证。**
