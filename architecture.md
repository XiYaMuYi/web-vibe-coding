# ARCHITECTURE.md

> 本文档基于当前代码库的真实状态编写，用于给后续接手的 Agent 提供准确上下文。它优先描述“现在实际是什么”，而不是“原本计划是什么”。如发现实现与理想设计不一致，会以 `[TODO/Debt]` 标注。

---

## 1. 真实架构拓扑梳理

当前代码库已经从单一的剧情交互引擎，演化成两条物理隔离的产品轨道：

1. **剧情轨**：`index.html` / `app.js` / `Navigator.js` / `Renderer.js` / `story.json`
2. **全栈 3D 轨**：`memorial-wall.html`（入口） + `wall-test.html`（沉浸页） / `js/MemorialWall.js` / 后端 `/api/wall` / 数据库与对象存储

### 1.1 剧情轨的数据流

```text
index.html
  └─ 只负责页面壳、资源引入、首屏挂载
        ↓
js/app.js
  ├─ 初始化 DeviceManager / FxEngine / StoryRenderer / Navigator / Debugger
  ├─ 绑定隐藏彩蛋、摄像头弹窗、调试按钮
  └─ 不直接拥有剧情真相源
        ↓
js/Navigator.js
  ├─ 负责剧情跳转、历史栈、flags、条件判断、回退
  ├─ 接收 Renderer / Interaction 的回调
  └─ 是剧情状态中枢
        ↓
js/Renderer.js
  ├─ 读取 story.json
  ├─ 渲染标题、正文、背景、选项按钮、布局 class
  └─ 只负责把状态表现到 DOM
        ↓
story.json
  └─ 剧情 SSOT（single source of truth）
```

### 1.2 全栈 3D 轨的数据流

```text
memorial-wall.html
  ├─ 入口页：昵称 / 摄像头 / 上传 / 头像生成 / 提交
  └─ 提交成功后跳转 wall-test.html
        ↓
wall-test.html
  └─ 只负责挂载沉浸式 3D 照片墙
        ↓
js/MemorialWall.js
  ├─ 本地 3D 入口层 + 星海引擎
  ├─ 负责 Canvas 头像演化、上传 / 摄像头兜底、状态锁
  ├─ 负责把最终数据 POST 到 `/api/wall`
  └─ 负责在提交后坍塌并进入沉浸模式
        ↓
/api/wall
  ├─ 接收提交数据
  ├─ 进行字段校验
  └─ 写入数据库 / OSS / 头像资源
```

### 1.3 物理隔离机制

这两条轨道的隔离是“真实物理隔离”，不是同页伪隔离：

- **DOM 隔离**
  - 剧情轨在 `index.html` 的主 `#app` 中运行。
  - 3D 轨在 `memorial-wall.html` / `wall-test.html` 的独立根节点中运行。
  - 两者不共享同一个 UI 树。

- **渲染循环隔离**
  - 剧情轨主要依赖 DOM / CSS 动画 / 轻量特效。
  - 3D 轨依赖独立的 `requestAnimationFrame` 循环与 WebGL Canvas。
  - `MemorialWall.js` 的 rAF 循环不应反向驱动剧情页。

- **状态隔离**
  - 剧情轨状态由 `Navigator.flags`、`story.json`、页面 DOM 状态组成。
  - 3D 轨状态由 `localStorage.user_submitted`、本页输入态和后端提交结果组成。
  - 二者不能共用同一份“页面内全局状态对象”来偷懒耦合。

---

## 2. 核心模块与文件真实职责

下面按当前代码库里**真实存在**的文件来说明职责。

### 2.1 剧情轨

#### `index.html`
- 剧情轨入口页。
- 负责挂载主应用壳体、故事卡片区域、摄像头弹窗、彩蛋区。
- 负责加载 `js/app.js`、`js/Renderer.js`、`js/Navigator.js` 等模块。

#### `js/app.js`
- 剧情轨胶水层与启动器。
- 初始化 `DeviceManager`、`FxEngine`、`StoryRenderer`、`Navigator`、`Debugger`。
- 绑定隐藏彩蛋触发、调试按钮、摄像头弹窗入口。
- **不应**直接写剧情分支判断。

#### `js/Navigator.js`
- 剧情路由中枢。
- 负责节点切换、历史栈、flags 写入、条件判断、节点完成后的推进。
- 是剧情轨的状态中心。

#### `js/Renderer.js`
- 剧情渲染器。
- 读取 `story.json` 并将节点内容映射到 DOM。
- 管理布局 class、背景、标题、正文、选项按钮、交互提示。
- **只渲染，不决策**。

#### `js/Interaction.js`
- 物理交互层。
- 处理 mash / hold / drag 等输入动作。
- 交互成功后回调 `Navigator`。

#### `js/FxEngine.js`
- 视觉涂层引擎。
- 管理粒子、拖尾、点击爆发、主题切换。
- 不参与剧情逻辑，不读取 flags。

#### `js/DeviceManager.js`
- 设备 / 端模式管理。
- 负责 `desktop-mode` / `mobile-mode` 的自动识别与切换。

#### `js/CameraEgg.js`
- 剧情轨里的摄像头彩蛋模块。
- 负责摄像头采集、身份卡合成、下载导出。
- 与 3D 照片墙入口页不是同一个功能层。

#### `js/MediaManager.js`
- 音频解锁与 BGM 播放控制。

#### `js/utils.js`
- 纯工具函数。
- 只放无副作用 helper。

#### `story.json`
- 剧情轨唯一真相源（SSOT）。
- 剧情节点、分支、交互要求、状态写入都应在此表达。

### 2.2 全栈 3D 轨

#### `memorial-wall.html`
- 3D 轨入口页。
- 负责 AI 头像演化、摄像头采集、本地图片上传、昵称兜底、提交按钮。
- 根据 `localStorage.user_submitted` 决定是否自动跳转到 `wall-test.html`。
- 当前是前端交互层，不是沉浸页。

#### `wall-test.html`
- 3D 轨沉浸页。
- 当前是 `MemorialWall` 的独立承载页。
- 负责初始化 `js/MemorialWall.js`。

#### `js/MemorialWall.js`
- 3D 照片墙的核心前端引擎。
- 负责：
  - 上层 Portal UI 结构
  - 圆形 Canvas 头像演化
  - 昵称 Hash 驱动粒子密度 / 颜色
  - 图片上传后的 `Pixel Dissolve`
  - 摄像头采集结果作为头像来源
  - 兜底的昵称头像生成
  - `localStorage.user_submitted` 状态锁
  - 提交后 UI 坍塌并进入全屏 3D 星海
  - POST 数据到 `/api/wall`
- 同时也承担一个轻量的 WebGL 场景初始化。

#### `/api/wall`
- 3D 轨的后端提交接口。
- 负责接收头像卡与昵称信息。
- 当前前端提交协议已统一为 `imageBase64` 作为主图字段，并保留昵称文本信息。

#### 数据库 / OSS
- 负责保存头像卡片、昵称、来源字段、图像资源。
- 属于后端持久化层，不应由前端臆造其结构。

---

## 3. 数据流与状态锁红线

### 3.1 剧情轨的数据规范

#### `story.json` 是唯一真相源
- 节点标题、正文、分支、交互、特效主题都应从 `story.json` 读取。
- `Navigator.js` 只能解释数据，不应把剧情写死在代码里。
- `Renderer.js` 只能呈现。

#### 状态写入
- `Navigator.flags` 用于剧情推进的临时状态。
- `setFlags` 由数据驱动写入。
- 不允许把剧情状态隐式塞进全局 DOM 属性当作主要状态源。

### 3.2 3D 轨的数据规范

#### 提交协议
当前 3D 轨入口页的提交，必须围绕最终输出字段组织：

- `imageBase64`：统一头像主字段
- `name` / `nickname`：昵称文本字段
- `avatarMode`：头像来源标识，建议值为 `camera | upload | nickname`
- `avatar`：兼容字段，若后端仍在使用旧字段可保留 [TODO/Debt]

#### 头像优先级
1. 摄像头照片
2. 本地上传图片
3. 昵称生成的 Canvas 头像兜底

#### 状态锁
- `localStorage.getItem('user_submitted')` 是 3D 轨前端状态锁。
- 一旦提交成功，入口页应锁定并跳转沉浸页。
- 已提交用户再次进入时应自动跳过入口页。

### 3.3 [TODO/Debt] 提交协议清理
当前前端和后端的字段命名仍可能存在历史包袱：
- 某些旧逻辑可能还在使用 `avatar`
- 某些后端校验可能只认 `imageBase64`

建议后续把 `/api/wall` 的契约固化成文档并清理兼容分支，避免多字段并行导致歧义。

---

## 4. 视觉红线

这一章是给 Hermes 和视觉 Agent 的硬约束。

### 4.1 动画准则

- **禁止**使用生硬的 `linear` 匀速过渡作为主运动语言。
- 主运动应该使用：
  - `lerp` / 插值曲线
  - 非线性 easing
  - CSS cubic-bezier
- 允许少量线性运动用于机械细节，但不能作为主视觉风格。

### 4.2 3D 质感要求

3D 轨必须维持以下审美基线：
- 辉光 / Bloom 后处理
- PBR 材质，例如 `MeshStandardMaterial`
- 动态星尘 / 星云 / 粒子背景
- 不能用僵硬静态贴图替代动态体积感

### 4.3 色彩管理

当前主色体系是“莫兰迪赛博配色”：
- 背景：`#0B0F19`
- 主高亮：`#00F0FF`
- 辅助紫：`#6B4BFF`
- 冷白高光：`rgba(255,255,255,0.72~0.92)`

其他颜色必须围绕这套冷暗底色进行组织，不能出现突兀的高饱和大面积纯色污染。

### 4.4 文本可读性

- 3D / 玻璃拟态 / 背景动效下，文本必须加 `text-shadow` 或等效边缘光。
- 不能因为追求酷炫而让正文发虚、糊成一片。

### 4.5 全栈 3D 轨的材质与运动红线

- 优先动态生成内容，不要用死贴图凑场面。
- 头像演化区必须保留“生成感”而不是直接把图片塞到页面中间。
- 提交前的引力坍塌必须有明确的中心收束视觉，而不是简单淡出。

---

## 5. `wall-test.html` / `MemorialWall.js` 的真实运行方式

### 5.1 入口页职责
`memorial-wall.html` 负责：
- 昵称输入
- 摄像头拍照
- 本地图片上传
- AI 头像预览
- 提交请求
- 锁定后跳转到 `wall-test.html`

### 5.2 沉浸页职责
`wall-test.html` 负责：
- 只做沉浸页挂载
- 不再承载表单交互
- 不再与摄像头 / 上传 / 提交逻辑混杂

### 5.3 `MemorialWall.js` 的职责边界
`js/MemorialWall.js` 当前承担了较多职责，既包含 Portal UI，又包含 3D 场景初始化和滚动卡片逻辑。

这意味着它是一个“入口 + 场景”混合模块。这个结构可工作，但不够理想。

#### [TODO/Debt]
后续可以考虑将其拆成：
- `MemorialWallPortal.js`：只负责入口层
- `StarEchoEngine.js`：只负责 3D 场景

目前先按现状维护，不强行拆，避免引入不必要风险。

---

## 6. 与后端 / 存储层的通信规范

### 6.1 前端到 `/api/wall`
入口页提交时，至少应包含：
- `imageBase64`
- `name` / `nickname`
- `avatarMode`

建议保留：
- `avatar` 兼容旧字段 [TODO/Debt]

### 6.2 `imageBase64` 的生成规则
- 摄像头照片：从拍照结果转成 Base64
- 上传图片：从本地文件转成 Base64
- 昵称兜底：从 Canvas 导出 Base64

### 6.3 昵称文本信息
昵称必须作为独立文本字段一并保存到后端数据库，不能只存在前端预览里。

---

## 7. 关键文件索引

### 剧情轨
- `index.html`
- `js/app.js`
- `js/Navigator.js`
- `js/Renderer.js`
- `js/Interaction.js`
- `js/FxEngine.js`
- `js/DeviceManager.js`
- `js/MediaManager.js`
- `js/CameraEgg.js`
- `js/utils.js`
- `story.json`

### 3D 轨
- `memorial-wall.html`
- `wall-test.html`
- `js/MemorialWall.js`

### 后端 / 数据层
- `/api/wall`
- 数据库表结构 / OSS 配置（未在前端仓库中完全显式暴露）

---

## 8. 维护规则总结

1. **剧情轨与 3D 轨必须继续物理隔离**。
2. **`story.json` 必须保持剧情 SSOT 地位**。
3. **入口页头像来源必须有优先级**：摄像头 > 上传 > 昵称兜底。
4. **提交协议应以 `imageBase64` 为主字段**，昵称文本必须同步保存。
5. **视觉上坚持莫兰迪赛博底色、Bloom、PBR、动态粒子**。
6. **所有明显的历史兼容与耦合问题都应以 `[TODO/Debt]` 标出，避免后续 Agent 误判为最终设计。**

---

## 9. 当前建议的后续整理项

- [TODO/Debt] 将 `/api/wall` 的请求/响应契约补成独立说明。
- [TODO/Debt] 明确后端保存的字段名：`name`、`nickname`、`imageBase64`、`avatarMode`。
- [TODO/Debt] 评估是否继续保留 `avatar` 兼容字段。
- [TODO/Debt] 考虑把 `MemorialWall.js` 再拆成入口层和沉浸层两个文件，减少单文件职责压力。

---

## 10. 结论

当前项目的真实状态已经不是单一的剧情引擎，而是：

- 一条以 `story.json` 为 SSOT 的剧情轨
- 一条以 `memorial-wall.html` / `wall-test.html` 为前后分工的独立 3D 星际相册轨

后续所有 Agent 接手时，应先确认自己是在改哪条轨，再按对应模块边界进行变更，避免跨轨污染。
