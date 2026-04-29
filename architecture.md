# Surprise Vibe Coding Architecture

## 1. 项目定位

这是一个**移动端优先、原生技术栈、由 JSON 驱动的互动叙事 Web 应用**。

当前实现遵循“极限开发比赛”原则，优先交付**可控、稳定、易维护的最小闭环**，而不是一次性堆叠所有内容与特效。

### 当前原则
- 不使用 React / Vue / 复杂状态库
- 所有剧情由 `story.json` 驱动
- 所有交互由单一状态机控制
- 所有视觉表现围绕手机屏幕展开
- 所有高风险功能都做了降级和占位

---

## 2. 当前版本与整体蓝图的关系

你说得对：**现在仓库里只是完成了架构蓝图中的一小部分核心骨架**。

### 已完成的核心骨架
- `index.html`：页面骨架、移动端布局、主容器、彩蛋 Modal
- `story.json`：最小可运行状态机样例
- `Renderer.js`：JSON 渲染、打字机、背景切换、图片兜底
- `Interaction.js`：mash / hold / drag 物理交互
- `MediaManager.js`：音频解锁、BGM 切换
- `CameraEgg.js`：摄像头采集 + 原生 canvas 出卡
- `api/avatar.py`：Serverless 占位接口
- `app.js`：主调度器与节点跳转

### 仍然处于占位或半占位的部分
- 剧情内容本身只有测试链路，没有完整章节内容
- 摄像头彩蛋的商汤 AIGC 实际接口尚未接通
- 视觉素材仍使用占位 URL
- 音频资源仍使用占位 URL
- `api/avatar.py` 目前是“打通链路”的模拟实现，不是正式生产版
- 事件体验、文案节奏、转场细节还需继续打磨

---

## 3. 目录结构

```text
web-vibe-coding/
├─ index.html                    # 主入口，移动端优先 UI 骨架
├─ architecture.md               # 架构说明文档
├─ story.json                    # JSON 状态机驱动的剧情配置
├─ api/
│  └─ avatar.py                  # Vercel Serverless Python 接口，占位中转
├─ js/
│  ├─ app.js                     # 全局调度器：启动、跳转、彩蛋、事件绑定
│  ├─ Renderer.js                # JSON 渲染器：文字、图片、节点、兜底
│  ├─ Interaction.js             # mash / hold / drag 物理交互
│  ├─ MediaManager.js            # 音频解锁、淡入淡出、预加载
│  └─ CameraEgg.js               # 摄像头采集、canvas 合成、Base64 导出
├─ assets/
│  ├─ img/                       # 本地图片占位目录
│  ├─ audio/                     # 本地音频占位目录
│  ├─ fonts/                     # 可选字体资源
│  └─ misc/                      # 其他资源
└─ docs/
   ├─ content-plan.md            # 后续剧情与节点规划
   ├─ api-notes.md               # 后端接口与鉴权说明
   └─ deployment.md              # 部署与上线检查清单
```

---

## 4. 核心状态机设计：`story.json`

`story.json` 是整个应用的唯一剧情真相源。

### 数据原则
- 一个文件管理所有节点
- 节点之间通过 `to` / `successTo` 跳转
- 节点既包含文本，也包含背景、音频、交互
- 交互的完成结果必须能回流到状态机跳转

### 推荐结构

```json
{
  "meta": {
    "title": "Surprise Vibe Coding",
    "version": "0.1.0",
    "startNode": "node_000"
  },
  "nodes": {
    "node_000": {
      "id": "node_000",
      "title": "序章",
      "text": "...",
      "background": {
        "image": "https://...",
        "overlay": "linear-gradient(...)"
      },
      "audio": {
        "bgm": "https://...",
        "loop": true,
        "autoplay": false
      },
      "options": [
        {
          "label": "继续",
          "to": "node_001"
        }
      ],
      "interaction": {
        "type": "hold",
        "targetMs": 1800,
        "successTo": "node_001",
        "hint": "..."
      }
    }
  }
}
```

### `interaction` 预留模式
- `type: "mash"`：狂点解锁
- `type: "hold"`：长按蓄力
- `type: "drag"`：拖拽滑动

### `interaction` 推荐字段
- `type`：交互类型
- `targetCount`：狂点目标次数
- `targetMs`：长按目标时长
- `targetPercent`：拖拽目标百分比
- `successTo`：交互成功后的跳转节点
- `hint`：界面提示文案
- `selector`：拖拽绑定范围（可选）

---

## 5. 前端模块拆解

### 5.1 `Renderer.js`
职责：把 `story.json` 渲染到 DOM。

#### 关键能力
- `loadStory()`：拉取 JSON
- `renderNode(nodeId)`：渲染单个节点
- `renderTypewriter(text)`：逐字输出
- `renderOptions(options)`：生成选项按钮
- `setBackground(node)`：双层背景切换
- 图片失败兜底为 CSS 渐变背景
- story 加载失败时显示世界观化错误提示

#### 目前状态
- 已实现最小闭环
- 仍可继续增强文字节奏、段落分镜、切图转场

---

### 5.2 `Interaction.js`
职责：处理玩家的物理交互。

#### 关键能力
- `bind(interaction, onComplete)`
- `unbind()`
- `mash`：点击计数 + 震动反馈
- `hold`：按住时持续增长进度条变量
- `drag`：根据滑动距离更新 CSS 变量与 transform

#### 目前状态
- 已能驱动状态机跳转
- 已具备清理事件监听与残留状态的机制
- 仍有进一步优化空间，比如多触点兼容、阈值动态调整

---

### 5.3 `MediaManager.js`
职责：音频解锁与 BGM 管理。

#### 关键能力
- 首次 `touchstart/click` 解除移动端音频限制
- `playBGM()`：播放当前节点 BGM
- `fadeBGM()`：旧音乐淡出，新音乐淡入
- `preload()`：提前创建 Audio 实例

#### 目前状态
- 已满足 iOS / 微信浏览器的基本解锁逻辑
- 可继续做更稳的预缓存、错峰加载、网络失败回退

---

### 5.4 `CameraEgg.js`
职责：摄像头彩蛋的采集与出卡。

#### 关键能力
- `getUserMedia()` 获取摄像头
- 原生 `<canvas>` 绘制最终纪念卡
- `drawImage()` 叠加视频帧
- `fillText()` 写入身份代号
- `toDataURL()` 生成 Base64
- `downloadCard()` 提供下载

#### 目前状态
- 已完成“原生 canvas 出卡”底层路线
- 商汤 AIGC 后端链路尚待接入真实 API

---

### 5.5 `app.js`
职责：全局调度器。

#### 关键能力
- 页面启动
- 初始节点进入
- 节点切换统一入口 `goToNode()`
- 交互成功后跳转
- 选项按钮跳转
- 隐藏彩蛋触发
- 摄像头 Modal 打开关闭

#### 目前状态
- 是整个项目的“控制面板”
- 目前已经把渲染、交互、音频、彩蛋串成了一条线

---

## 6. 摄像头与 AIGC 彩蛋的数据流

### 当前设计
1. 玩家触发隐藏彩蛋入口
2. 打开摄像头 Modal
3. 前端调用 `getUserMedia`
4. Canvas 绘制当前帧
5. 前端可把 Base64 发给 `/api/avatar`
6. Python Serverless 负责签名、转发、鉴权
7. 返回卡通化图片 URL
8. 前端合成纪念卡并提供下载

### 当前实现状态
- 前端采集与本地出卡：已具备
- 真正的后端 AIGC 转发：占位中
- 接口层 CORS：已预留并按你的规则写死

---

## 7. 响应式与兼容性策略

### Mobile-First
- 主体内容锁定在手机视口体验
- 桌面端居中限制宽度：`max-width: 480px`
- 桌面外围留白并加毛玻璃

### 兼容策略
- 背景图失败：CSS 渐变兜底
- 音频限制：首次 touch/click 解锁
- 彩蛋摄像头：关闭时立刻释放硬件
- 交互残留：跳转时强制解绑事件与定时器

---

## 8. 第三方依赖

### 前端
- Tailwind CSS CDN
- 目前未引入任何前端构建依赖

### 后端
`requirements.txt` 建议仅保留：

```txt
requests
```

如果后面真接商汤接口，可能再补：
- `python-dotenv`：本地环境变量管理
- `pydantic`：请求结构校验（可选）

---

## 9. 这份架构里最关键的功能节点

### 第一优先级
- `story.json` 状态机
- `Renderer.js` 渲染引擎
- `Interaction.js` 交互引擎
- `app.js` 跳转调度

### 第二优先级
- `MediaManager.js` 音频稳定性
- 摄像头彩蛋闭环
- 后端 `/api/avatar`

### 第三优先级
- 大量剧情内容
- 更炫的视觉特效
- 更完整的结局分支
- 更多隐藏彩蛋

---

## 10. 结论

当前代码库是**正确的骨架，不是完整成品**。

你现在看到的是：
- 入口已搭好
- 状态机已通
- 交互已通
- 摄像头彩蛋链路已起步
- 但剧情内容、资源素材、AIGC 后端和大量表现层仍在待补

这也意味着，后续最合理的推进方式不是继续“加零碎代码”，而是先确认：
1. **要做多长的故事**
2. **要几个分支节点**
3. **彩蛋到底是主菜还是隐藏惊喜**
4. **视觉要更偏赛博、治愈、悬疑还是荒诞**
5. **比赛时间里最值得押注的是内容还是交互表现**

---

*本文档用于项目协作与后续开发对齐。*
