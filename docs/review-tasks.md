# 审查任务清单 — 2026-04-29

> 基于 `/review` 触发 code-review skill 的审查结果
> 状态说明：🔴 必须修 | 🟡 建议修 | 🟢 预留/故意 | 🔵 待确认

---

## 一、🔴 必须修复（确定的 bug，影响演示或安全）

### BUG-001: Mash 双触发（移动端）
- **文件**: `js/Interaction.js:92-93`
- **问题**: `click` 和 `touchstart` 同时绑定，移动端单次点击可能计为两次
- **严重**: 高 — 比赛中如果评审用手机，狂点挑战会双倍计数
- **建议**: 改用 `pointerdown` 统一处理，或加强 debounce 逻辑（目前 60ms 不够）

### BUG-002: innerHTML XSS 向量
- **文件**: `js/app.js:129`
- **问题**: `button.innerHTML = locked ? \`🔒 ${option.label}\` : option.label;`
- **严重**: 高 — 虽然当前 story.json 数据可控，但如果后续接入外部内容源就是 XSS
- **建议**: 改用 `textContent` + 独立的 emoji 文本节点

### BUG-003: layout thrashing（打字机性能）
- **文件**: `js/Renderer.js:107`
- **问题**: `el.textContent += chars[index]` 每次都触发 DOM read+write
- **严重**: 中 — 长文本场景会明显卡顿，比赛中体验感差
- **建议**: 用字符串 buffer 累积，每帧设置一次 `textContent`

### BUG-004: `transition: all` 性能损耗
- **文件**: `css/base.css:14`
- **问题**: `transition: all 0.5s ease` 动画所有 CSS 属性
- **严重**: 中 — 导致不必要的重排，在低端设备上明显卡顿
- **建议**: 改为 `transition: opacity 0.5s ease, transform 0.5s ease`

### BUG-005: JSON.parse 无容错
- **文件**: `js/app.js:74`
- **问题**: `JSON.parse(button.dataset.setFlags)` 如果数据非法会抛未捕获异常
- **严重**: 中 — 比赛中一旦触发直接中断流程
- **建议**: 包裹 try-catch，非法时 fallback 到 `null`

---

## 二、🟡 建议修复（不影响演示，但修了更稳）

### WARN-001: CameraEgg.js getUserMedia 无 PermissionDeniedError 处理
- **文件**: `js/CameraEgg.js:22`
- **问题**: `getUserMedia` 被拒绝时只 catch 了通用 error，错误信息不透明
- **建议**: 检查 `error.name === 'NotAllowedError'` 给出友好的提示

### WARN-002: AudioManager 脚本未加载
- **文件**: `index.html` / `js/MediaManager.js`
- **问题**: `MediaManager.js` 中有 `window.AudioManager?.fadeBGM` 引用，但 `AudioManager` 脚本不在 HTML 中
- **建议**: 要么加上脚本引用，要么暂时移除音频相关调用（如果是预留功能）

### WARN-003: Canvas z-index 9999 可能遮挡
- **文件**: `js/FxEngine.js:42`
- **问题**: canvas 以 `mix-blend-mode: screen` + `z-index: 9999` 覆盖整个页面
- **建议**: 如果后续要加第三方 SDK 或悬浮按钮，会被遮挡

### WARN-004: 工具函数重复
- **文件**: `js/utils.js` 和 `js/FxEngine.js`
- **问题**: `rand` 和 `clamp` 在多处定义
- **建议**: 统一用 `window.Utils`

### WARN-005: `!important` 泛滥
- **文件**: `css/base.css:417-429`
- **问题**: 13 个 `!important` 在同一规则块， specificity 混乱
- **建议**: 主题确定后重构 CSS cascade

### WARN-006: Tailwind CDN 体积
- **文件**: `index.html`
- **问题**: `<script src="https://cdn.tailwindcss.com">` 是 JIT 编译器 ~400KB
- **建议**: 上线前用 Tailwind CLI 生成最小 CSS bundle

---

## 三、🟢 预留/故意设计（不是 bug，但需确认后保留）

### PLACEHOLDER-001: 资源 URL 占位符
- **位置**: `story.json` 全部 image/audio URL
- **当前值**: `cdn.example.com`
- **状态**: 确认是预留占位符，等待主题确定后替换
- **注意**: 上线前必须全部替换为真实资源

### PLACEHOLDER-002: `node_004` 自循环
- **位置**: `story.json:151`
- **当前**: `"to": "node_004"` 指向自身
- **状态**: 确认是故意设计 — 终章"系统接管"，交互 `successTo` 也指向自身
- **注意**: 这是有意为之的无限循环态，不是 bug

### PLACEHOLDER-003: `submitAvatar` 函数
- **文件**: `js/CameraEgg.js:32-39`
- **问题**: POST 到 `/api` 但从未被调用
- **状态**: 预留 API 端点，等待纪念卡生成功能完善后接入
- **建议**: 暂时注释掉或在函数顶部加 `// TODO: 待 API 就绪后启用`

### PLACEHOLDER-004: 循环依赖（Navigator ↔ InteractionController）
- **文件**: `js/Navigator.js:72-74`
- **状态**: 当前工作正常，故事线不会触发无限循环（节点图是 DAG，除了 node_004 的有意循环）
- **建议**: 框架阶段可接受，上线前解耦

### PLACEHOLDER-005: `.mobile-mode` vs `.desktop-mode` CSS 冲突
- **文件**: `css/base.css:398-410`
- **状态**: 两套模式重叠属性互相覆盖，当前通过 JS 切换 body class 工作
- **建议**: 主题确定后统一重构

---

## 四、🔵 待确认（需要你决定）

### TBD-001: 无测试覆盖
- **状态**: 框架阶段正常吗？比赛前需要加测试吗？

### TBD-002: Frame budget check 逻辑
- **文件**: `js/FxEngine.js:189`
- **状态**: `FRAME_BUDGET_MS` 检查在 rAF 回调内，效果存疑。是留着优化还是删掉？

### TBD-003: 图片预加载策略
- **文件**: `js/Renderer.js:62-76`
- **状态**: 当前每次切换才加载，相邻节点未预加载。比赛体验需不需要优化？

### TBD-004: `DeviceManager.js` mountToggle 按钮
- **文件**: `js/DeviceManager.js:50-69`
- **状态**: 动态创建的设备切换按钮，样式引用了多处 CSS。比赛时需要这个功能吗？

---

## 统计

| 类别 | 数量 | 状态 |
|------|------|------|
| 🔴 必须修 | 5 | 确认是 bug，需修 |
| 🟡 建议修 | 6 | 建议修，不影响演示 |
| 🟢 预留/故意 | 5 | 不是 bug，确认保留 |
| 🔵 待确认 | 4 | 需要你决定 |
