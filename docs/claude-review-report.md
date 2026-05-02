# 星辰典当行 — 代码库深度审查报告

> 生成日期: 2026-05-02
> 审查范围: 全量代码库（含架构文档、前端、后端 API、废弃代码）

---

## 1. 项目架构总览

### 1.1 双轨物理隔离机制

项目已经演化为 **两条物理隔离的产品轨道**，通过不同 HTML 入口页实现隔离：

| 轨道 | 入口页 | 核心引擎 | 数据源 | 渲染方式 |
|------|--------|----------|--------|----------|
| **剧情轨** | `story.html` → iframe → `index.html` | `app.js` + `Navigator.js` + `Renderer.js` | `story.json` (SSOT) | DOM/CSS 动画 + Canvas FX |
| **全栈 3D 轨** | `memorial-wall.html` / `wall-test.html` | `MemorialWall.js` (StarEchoEngine) | `/api/wall` + `/api/bounty` + `market-gallery.json` | Three.js WebGL + Bloom 后处理 |

**隔离保证：**
- **DOM 隔离**: 两条轨道运行在不同页面，不共享 UI 树
- **渲染循环隔离**: 剧情轨依赖 DOM/CSS 动画；3D 轨有独立 rAF + WebGL
- **状态隔离**: 剧情轨用 `Navigator.flags` + `story.json`；3D 轨用 `localStorage.user_submitted` + 后端数据
- **状态传递**: 跨页仅通过 `localStorage` 和 URL 参数通信

**额外独立页面（不属于两条主轨）：**
- `bounty-board.html` — 星际悬赏板（独立的悬赏发布/展示页）
- `truth-branding.html` — 真名刻印（抽卡玩法，消耗 100 星尘随机展示真名+lore）

### 1.2 启动链路

```
story.html (全局 BGM + 启动拦截)
  └─ iframe → index.html
       ├─ EconomyManager.js (余额管理)
       ├─ Interaction.js (输入处理 + 事件发射)
       ├─ FxEngine.js (粒子拖尾 Canvas)
       ├─ Navigator.js (剧情路由 + 状态中枢)
       ├─ Renderer.js (DOM 渲染)
       ├─ DeviceManager.js (设备检测)
       ├─ Debugger.js (调试覆盖层)
       └─ app.js (胶水层 + 启动器)
            ├─ 绑定隐藏彩蛋 (顶区 5 次点击 / 长按 3 秒)
            ├─ 绑定调试按钮 (forceMemorialWall)
            ├─ 监听 INTERACTION_SUCCESS → EconomyManager + FxEngine
            └─ 启动故事引擎 → goTo(startNode)
```

### 1.3 项目结构树

```
web-vibe-coding/
├── index.html              # 剧情轨承载页 (被 story.html iframe 加载)
├── story.html              # 剧情轨入口壳 (BGM + iframe 包裹)
├── memorial-wall.html      # 灵魂商铺 (入口页: 头像上传/摄像头/商品购买/提交)
├── wall-test.html          # 沉浸页 (3D 星际回声照片墙)
├── bounty-board.html       # 星际悬赏板 (独立页)
├── truth-branding.html     # 真名刻印 (独立页, 黑洞抽卡)
├── story.json              # 剧情 SSOT (5 个节点)
├── package.json            # 依赖: ali-oss, dotenv, pg
├── vercel.json             # Vercel 配置 (v2, 空)
├── dev-server.js           # 本地 CJS 开发服务器 (静态 + API 代理)
├── architecture.md         # 架构文档 (双轨 + 物理隔离)
├── REFACTORING_PLAN.md     # 重构计划 (5 个 Phase)
├── docs/
│   └── project-status.md   # 项目状态
├── api/
│   ├── wall.js             # 纪念墙后端 (PostgreSQL + 阿里云 OSS)
│   └── bounty.js           # 悬赏板后端 (PostgreSQL + 阿里云 OSS)
├── js/
│   ├── app.js              # 胶水层启动器
│   ├── EconomyManager.js   # 经济系统 (localStorage 余额)
│   ├── CommodityService.js # 商品服务 (目录 + 购买 + 已购状态)
│   ├── Navigator.js        # 剧情路由中枢
│   ├── Renderer.js         # 故事渲染器
│   ├── Interaction.js      # 交互控制器 (mash/hold/drag/connect)
│   ├── FxEngine.js         # 粒子特效引擎
│   ├── DeviceManager.js    # 设备检测
│   ├── MediaManager.js     # 音频管理
│   ├── CameraEgg.js        # 摄像头彩蛋
│   ├── Debugger.js         # 调试覆盖层
│   ├── MemorialWall.js     # 3D 照片墙引擎 (StarEchoEngine)
│   ├── utils.js            # 工具函数
│   ├── progressive-card-loader.js  # 渐进式卡片纹理加载
│   └── global-reset.js     # 全局重置工具
├── css/
│   ├── base.css            # 基础样式 + 响应式布局
│   ├── effects.css         # 玻璃拟态 / 全屏 cinematic 布局
│   ├── cinematic.css       # 电影级特效 (闪烁 / glitch / 场景过渡)
│   └── animations.css      # 关键帧动画
├── data/
│   └── market-gallery.json # 商品目录 (34 个塔罗+星座物品)
├── audio/
│   └── all.mp3             # 全局 BGM (story.html 加载)
├── image/                  # 剧情背景图
└── _deprecated_v1/         # 已废弃的 v1 版本
    ├── index.html
    ├── Renderer.js
    └── base.css
```

---

## 2. 已完成功能清单

### 2.1 剧情轨 (Story Track)

| 模块 | 状态 | 说明 |
|------|------|------|
| JSON 驱动剧情引擎 | ✅ 完成 | `story.json` 为 SSOT，支持 5 个节点 |
| 打字机文字渲染 | ✅ 完成 | `Renderer.js` 逐字输出，支持中断 |
| 双层背景切换 | ✅ 完成 | 节点可声明 `background.image` |
| 节点选项按钮 | ✅ 完成 | 支持 `requires` 条件锁定 |
| Hold 交互 | ✅ 完成 | 长按 1800ms，进度条 + 震动 + 模糊反馈 |
| Mash 交互 | ✅ 完成 | 快速点击 10 次，shake 动画 |
| Drag 交互 | ✅ 完成 | 拖拽距离判定，clip-path 揭露效果 |
| Connect 交互 | ✅ 完成 | Canvas 星座连线，4 节点 4 连线 |
| 场景过渡动画 | ✅ 完成 | 3 秒黑场过渡 (fade → 换背景 → fade-in) |
| 粒子拖尾特效 | ✅ 完成 | 5 种主题 (neon/meteor/ink/glitch/smoke) |
| 点击爆发特效 | ✅ 完成 | 5 种 (ripple/shatter/shockwave/pixel/splatter) |
| 音频解锁 + 淡入淡出 | ✅ 完成 | `MediaManager.js`，Web Audio API 解锁 |
| 星辰经济系统 | ✅ 完成 | `EconomyManager.js`，localStorage 持久化 |
| 隐藏彩蛋 | ✅ 完成 | 顶区 5 次点击或长按 3 秒触发摄像头 |
| 摄像头身份卡 | ✅ 完成 | `CameraEgg.js`，拍照 + Canvas 合成 + 下载 |
| 设备自适应 | ✅ 完成 | desktop-mode / mobile-mode 自动切换 |
| 调试覆盖层 | ✅ 完成 | `\` 键切换，显示节点/FX/按钮信息 |
| 闲置惩罚 | ✅ 完成 | 10 秒无操作扣 5 星尘 + Toast |
| 全屏 Iframe 壳 | ✅ 完成 | `story.html` 包裹全局 BGM |

### 2.2 全栈 3D 轨 (3D Track)

| 模块 | 状态 | 说明 |
|------|------|------|
| Three.js 场景 | ✅ 完成 | 动态加载 three@0.160.0 + EffectComposer |
| Bloom 后处理 | ✅ 完成 | UnrealBloomPass，强度 1.5 |
| PBR 材质 | ✅ 完成 | MeshStandardMaterial + RoomEnvironment |
| 3000 粒子星系背景 | ✅ 完成 | BufferGeometry + 三色混合 |
| 240 张 Mock 卡片 | ✅ 完成 | 引力轨道运动 + 距离透明度衰减 |
| 60 张 Ghost 卡片 | ✅ 完成 | 半透明远处卡片 |
| 中心恒星 | ✅ 完成 | SphereGeometry + 多层光环旋转 |
| 速度控制 | ✅ 完成 | 4 档速度按钮 (x0.08/x0.12/x0.16/x0.20) |
| 渐进式纹理替换 | ✅ 完成 | `progressive-card-loader.js`，picsum → 真实图片 |
| 昵称输入 + 头像上传 | ✅ 完成 | `memorial-wall.html` |
| 摄像头采集 | ✅ 完成 | `getUserMedia` + 拍照 + Canvas 头像演化 |
| 昵称 Hash 头像 | ✅ 完成 | FNV-1a hash 驱动粒子颜色/密度 |
| 提交到后端 | ✅ 完成 | POST `/api/wall` (PostgreSQL + 阿里云 OSS) |
| 商品目录展示 | ✅ 完成 | `market-gallery.json` 34 个商品 |
| 购买流程 | ✅ 完成 | 确认弹窗 → 扣费 → 下载 → 已购状态锁定 |
| 购买后 OSS 下载 | ✅ 完成 | 硬编码 `downloadUrlMap` 指向阿里云 OSS |
| 全局重置 | ✅ 完成 | `global-reset.js`，清除 localStorage 并跳转 |
| 测试/正式模式 | ✅ 完成 | `?test` 参数切换 |

### 2.3 独立功能页

| 页面 | 状态 | 说明 |
|------|------|------|
| 悬赏板 (`bounty-board.html`) | ✅ 完成 | 全息悬赏卡展示 + 提交台 + 图片拖拽上传 |
| 真名刻印 (`truth-branding.html`) | ✅ 完成 | 黑洞视觉 + 20 个真名随机抽取 + lore 揭示 |
| 星辰经济 HUD | ✅ 完成 | 跨页同步，`EconomyManager` 共享 localStorage |

### 2.4 后端 API

| 端点 | 状态 | 说明 |
|------|------|------|
| `POST /api/wall` | ✅ 完成 | 接收昵称 + Base64 头像 → 上传 OSS → 写入 PostgreSQL |
| `GET /api/wall` | ✅ 完成 | 返回最近 100 条纪念墙记录 |
| `POST /api/bounty` | ✅ 完成 | 接收描述 + 金额 + Base64 图片 → 上传 OSS → 写入 PostgreSQL |
| `GET /api/bounty` | ✅ 完成 | 返回最近 100 条悬赏记录 |

---

## 3. 重构计划进度

根据 `REFACTORING_PLAN.md` 的 5 个 Phase 评估：

| Phase | 计划内容 | 完成状态 | 说明 |
|-------|----------|----------|------|
| **Phase 0** | 建立记忆锚点 `REFACTORING_PLAN.md` | ✅ **已完成** | 文件存在，包含架构原则和执行顺序 |
| **Phase 1** | 抽离 `EconomyManager` 与 `CommodityService` | ✅ **已完成** | 两个文件均已实现并投入使用。`EconomyManager` 提供 `getBalance/addStardust/spendStardust/canAfford/onChange/reset`；`CommodityService` 提供 `loadCatalog/getCatalog/purchaseItem/isPurchased/canPurchase/onChange/reset` |
| **Phase 2** | 重构 `Interaction.js` 为事件总线 | ✅ **已完成** | 已有 `on/emit` 事件系统，`complete()` 函数触发 `INTERACTION_SUCCESS` 事件，`app.js` 监听该事件处理经济和特效。idle penalty 也通过事件通知 |
| **Phase 3** | 解耦 `memorial-wall.html` 入口页 | ⚠️ **部分完成** | 已拆分为 `memorial-wall.html`(入口) + `wall-test.html`(沉浸)，但入口页仍有大量内联 JS 逻辑（购买、上传、摄像头模态、渲染市场等），未完全抽离到独立模块 |
| **Phase 4** | 扩展 `story.json` 经济语义 | ✅ **已完成** | `story.json` 节点已包含 `rewardStardust` 和 `costStardust` 字段，`Navigator.applyEconomy()` 已解释这些字段 |

**总体评估: 4.5 / 5 Phase 完成**。Phase 3 是唯一未完成项，入口页的 JS 逻辑仍混在 HTML `<script>` 标签中。

---

## 4. 技术债务与已知问题

### 4.1 TODO/Debt 汇总（来自 architecture.md + 代码扫描）

| # | 位置 | 内容 | 优先级 |
|---|------|------|--------|
| D1 | `architecture.md` §3.3 | `/api/wall` 提交协议清理：`avatar` vs `imageBase64` 字段并存，需固化契约 | 中 |
| D2 | `architecture.md` §5.3 | `MemorialWall.js` 应拆成入口层 (`MemorialWallPortal.js`) + 沉浸层 (`StarEchoEngine.js`) | 低 |
| D3 | `architecture.md` §9 | `/api/wall` 请求/响应契约补成独立说明 | 低 |
| D4 | `architecture.md` §9 | 明确后端字段名：`name`/`nickname`/`imageBase64`/`avatarMode` | 低 |
| D5 | `architecture.md` §9 | 评估是否继续保留 `avatar` 兼容字段 | 低 |

### 4.2 运行时 Bug 和潜在问题

| # | 严重程度 | 位置 | 描述 |
|---|----------|------|------|
| B1 | **高** | `api/wall.js` L61 | `console.log('【Debug】读取到的完整 URL:', process.env.DATABASE_URL)` — **生产环境会打印数据库连接字符串到日志**，敏感信息泄露 |
| B2 | **高** | `api/bounty.js` | 无认证/鉴权保护，任何人都可以向 `/api/bounty` POST 数据（包括扣星尘逻辑仅在前端校验） |
| B3 | **高** | `api/wall.js` | 同上，无认证保护，任何人都可以提交纪念墙数据 |
| B4 | **中** | `index.html` | 缺少 `MediaManager.js` 的 `<script>` 引用 — 音频模块已实现但未在入口页加载。`story.html` 有全局 `<audio>` 元素但 `MediaManager` 的 fadeBGM 功能在剧情节点中不会被调用 |
| B5 | **中** | `story.json` | 所有 `audio.bgm` 使用 `https://cdn.example.com/audio/bgm-*.mp3` 占位 URL — 这些域名不存在，音频实际不会播放 |
| B6 | **中** | `app.js` L157-158 | `forceMemorialWall()` 直接清空 `app.innerHTML` 并在 `stage` 上挂载 MemorialWall，但未清理 `#bg-layer` 和 `#fx-canvas`，可能导致残留渲染循环 |
| B7 | **中** | `Interaction.js` L24 | `targetElement()` 查找 `#stage` 或 `document.body` — 但 `index.html` 中没有 `#stage` 元素，交互绑定会回退到 `body`，可能干扰其他页面元素交互 |
| B8 | **中** | `Interaction.js` L50-55 | `setBodyBlur()` 给背景层加 blur — 但 `index.html` 的背景层 ID 是 `#bg-layer`，Interaction 查找的是 `#bgLayerA` / `#bgLayerB`，**blur 效果不会生效** |
| B9 | **中** | `progressive-card-loader.js` | 使用 `engine.THREE` 但 `StarEchoEngine` 在 `initThree` 后才设置 `this.THREE`，如果 loader 执行时机不对可能为 undefined |
| B10 | **中** | `memorial-wall.html` L792-826 | `downloadUrlMap` 硬编码 34 个阿里云 OSS URL — 如果文件被删除或 bucket 变更，所有下载都会失败 |
| B11 | **低** | `css/base.css` L129 + L200 | `#scene-toast` 被定义了**两次**，第二次会覆盖第一次的样式（位置、动画方式不同） |
| B12 | **低** | `EconomyManager.js` L39-43 | `spendStardust` 中 `readBalance()` 被调用两次（检查 + 写入），存在竞态条件（多 tab 同时操作时） |
| B13 | **低** | `Interaction.js` L88-95 | `applyIdlePenalty()` 使用 `EconomyManager.setBalance()` 直接设值，绕过了 `spendStardust` 的校验逻辑 |
| B14 | **低** | `CameraEgg.js` L37-42 | `submitAvatar()` 向 `/api` POST（路径不完整），这个函数从未被调用过（入口页直接向 `/api/wall` POST） |
| B15 | **低** | `dev-server.js` L79 | `JSON.parse(body)` 无 try-catch，如果 body 不是合法 JSON 会抛出 500 错误 |
| B16 | **低** | `bounty-board.html` L61 | CSS 中 `rgba(0, 0, 255, 0.72)` 应为 `rgba(0, 0, 0, 0.72)` — 蓝色而非黑色，可能是 typo |

### 4.3 架构层面问题

| # | 问题 | 影响 |
|---|------|------|
| A1 | `truth-branding.html` 和 `bounty-board.html` 的所有 JS 逻辑全部内联在 HTML `<script>` 中，未抽离到独立 `.js` 文件 | 代码复用困难，维护成本高 |
| A2 | `downloadUrlMap` 硬编码在 `memorial-wall.html` 中，与 `market-gallery.json` 的商品数据不关联 | 数据不同步风险 |
| A3 | 前端经济校验 (`canAfford`/`spendStardust`) 完全在客户端执行，后端 API 不校验余额 | 恶意用户可绕过限制提交悬赏 |
| A4 | `story.html` 使用 `<iframe>` 包裹 `index.html`，iframe 内的调试和热更新更困难 | 开发体验下降 |
| A5 | Three.js 依赖通过 `import()` 动态加载 CDN URL，在网络差的环境下加载失败后无降级方案 | 3D 轨道完全不可用 |
| A6 | `progressive-card-loader.js` 是一个 IIFE 自执行脚本，在 `wall-test.html` 中加载后无法被控制或重新触发 | 缺少生命周期管理 |

---

## 5. 新需求开发建议

### 5.1 在哪个模块扩展

| 新需求方向 | 建议扩展模块 | 原因 |
|-----------|-------------|------|
| 新增剧情节点 | `story.json` + `Navigator.js` | 已有成熟的数据驱动架构，只需按 schema 添加节点 |
| 新增交互类型 | `Interaction.js` → 添加 `bindXxx()` 方法 | 事件总线架构已支持扩展 |
| 新商品/物品 | `data/market-gallery.json` + `memorial-wall.html` 的 `downloadUrlMap` | 需同步更新两端 |
| 新的经济消耗场景 | 在 `story.json` 节点中添加 `costStardust` 字段 | `Navigator.applyEconomy()` 已支持 |
| 新的独立功能页 | 新建 HTML + 独立 JS 文件（参考 `truth-branding.html` 模式） | 保持物理隔离原则 |
| 后端数据表扩展 | `api/` 下新增 `.js` 文件 | 已有 `wall.js` / `bounty.js` 的模式可复用 |
| 3D 场景增强 | `MemorialWall.js` 中的 `StarEchoEngine` 类 | 中心化的 Three.js 场景管理 |

### 5.2 红线和边界

**绝对不可做的（红线）：**

1. **不要在剧情轨中引入 Three.js 或 WebGL** — 会破坏渲染循环隔离
2. **不要在 `index.html` 中直接操作 `localStorage.stardust_balance`** — 必须通过 `EconomyManager`
3. **不要在 `Interaction.js` 中直接写业务逻辑**（如余额增减、特效播放） — 它只应发射事件
4. **不要把 `story.json` 的剧情逻辑硬编码到 JS 中** — 保持数据驱动
5. **不要在两条轨道之间共享全局 JS 对象** — 只能使用 `localStorage` 或 URL 参数
6. **不要在后端 API 中跳过认证** — 当前的 wall/bounty API 缺少基本鉴权，新增 API 必须加上

**可以做的（推荐做法）：**

1. 新的独立功能页可以使用内联 `<script>`（如 `truth-branding.html`），但超过 200 行时应考虑拆分
2. 新的经济相关操作应通过 `EconomyManager` 的公开 API
3. 新商品的图片 URL 应在 `market-gallery.json` 中定义，而非硬编码在 HTML 中
4. CSS 变量 (`--color-stardust`, `--color-bg`) 应被复用，不要引入新的不协调颜色

### 5.3 开发流程建议

1. **新增页面** → 先确认归属哪条轨道 → 在对应 CSS 命名空间下写样式 → 复用 `EconomyManager` 做余额显示
2. **新增后端 API** → 在 `api/` 下建文件 → 复用 `api/wall.js` 的模式（CORS → DB 连接 → 校验 → 操作 → 返回）
3. **新增剧情节点** → 编辑 `story.json` → 测试 `Navigator.goTo()` → 确认交互和背景正常
4. **修改经济逻辑** → 先更新 `EconomyManager.js` → 在各页面中通过 `onChange` 监听更新 UI

---

## 6. 总结

**项目成熟度评估：**

| 维度 | 评分 (1-5) | 说明 |
|------|-----------|------|
| 架构清晰度 | 5 | 双轨隔离策略明确，architecture.md 文档完善 |
| 代码可维护性 | 4 | 核心模块职责清晰，但入口页内联 JS 过多 |
| 重构完成度 | 4.5/5 | 4 个 Phase 已完成，Phase 3 入口页拆分待完善 |
| 安全性 | 2 | 后端 API 无鉴权，数据库连接字符串可能泄露 |
| 可扩展性 | 4 | JSON 驱动架构 + 事件总线便于扩展 |
| 视觉质量 | 4 | Bloom/PBR/粒子/电影级过渡均已实现 |
| 文档完整度 | 4 | architecture.md + REFACTORING_PLAN.md + project-status.md 三份文档齐全 |

**最需要优先解决的问题：**
1. **B1** — 移除 `api/wall.js` 中的 DATABASE_URL 日志打印（安全漏洞）
2. **B3/B4** — 后端 API 添加基础鉴权（如 API Key 或 rate limiting）
3. **Phase 3** — 将 `memorial-wall.html` 的内联 JS 逻辑抽离到独立模块
4. **B5** — 替换 `story.json` 中的占位音频 URL 或移除音频依赖
