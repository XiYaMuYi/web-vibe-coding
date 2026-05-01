# API Reference

> 本文档基于当前仓库真实代码整理，覆盖项目里实际使用到的后端接口、前端请求契约，以及会影响接口行为的浏览器能力。若接口行为与实现存在偏差，以代码为准。

---

## 1. 接口总览

当前项目对外真正使用到的接口主要集中在两类：

### 1.1 后端 HTTP 接口
- `GET /api/wall`
- `POST /api/wall`
- `OPTIONS /api/wall`

### 1.2 浏览器平台能力
这些不是后端 HTTP API，但在当前代码里属于关键依赖接口：
- `navigator.mediaDevices.getUserMedia`
- `localStorage.getItem / setItem`
- `fetch`
- `FileReader`
- `CanvasRenderingContext2D`
- `requestAnimationFrame`

---

## 2. `api/wall.js`

文件路径：`api/wall.js`

这是 3D 星际相册全栈模块的核心后端接口。它负责：
- 接收入口页提交的头像和昵称
- 将 Base64 图片解析后上传到 OSS
- 将昵称和图片地址写入数据库
- 提供照片墙列表读取接口

### 2.1 公共约定

#### CORS
接口会返回以下跨域头：
- `Access-Control-Allow-Origin: *`
- `Access-Control-Allow-Methods: GET,POST,OPTIONS`
- `Access-Control-Allow-Headers: Content-Type, Authorization`
- `Access-Control-Max-Age: 86400`

#### 环境变量依赖
接口运行时依赖：
- `DATABASE_URL`
- `OSS_REGION`
- `OSS_ACCESS_KEY_ID`
- `OSS_ACCESS_KEY_SECRET`
- `OSS_BUCKET`

#### 图片格式要求
`POST /api/wall` 只接受 Data URL 格式的 Base64 图片：

```text
data:image/png;base64,....
data:image/jpeg;base64,....
data:image/webp;base64,....
```

如果格式不符合，会直接报错：
- `Invalid base64 image payload`

---

## 3. `GET /api/wall`

### 用途
读取照片墙列表数据。

### 请求
无请求体。

### 返回
从数据库表 `wall_entries` 读取最近数据：
- `id`
- `nickname`
- `image_url`
- `created_at`

### 成功响应
```json
{
  "ok": true,
  "data": [
    {
      "id": 1,
      "nickname": "匿名访客",
      "image_url": "https://...",
      "created_at": "2026-05-01T12:00:00.000Z"
    }
  ]
}
```

### 失败响应
数据库连接失败时：
```json
{
  "ok": false,
  "error": "Failed to connect database"
}
```

### 备注
- 当前实现最多返回 100 条，按 `created_at DESC, id DESC` 排序。
- `GET` 接口目前不支持分页参数，虽然前端星海引擎内部有分页抓取逻辑，但后端现状是固定 `LIMIT 100`。[TODO/Debt]

---

## 4. `POST /api/wall`

### 用途
提交用户头像卡与昵称，写入数据库并上传图片到 OSS。

### 请求体
当前后端实现实际读取的是：
- `nickname`
- `imageBase64`

### 必填字段
- `imageBase64`

### 可选字段
- `nickname`

### 推荐请求体
```json
{
  "nickname": "小星",
  "imageBase64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA..."
}
```

### 字段说明

#### `imageBase64`
- 必填
- 必须是完整 Data URL
- 用于解析 MIME 类型并上传 OSS

#### `nickname`
- 可选
- 若缺失，后端会自动兜底为 `匿名访客`
- 该字段会写入数据库 `wall_entries.nickname`

### 成功流程
1. 解析 `imageBase64`
2. 上传到 OSS
3. 生成图片公网 URL
4. 写入数据库 `wall_entries`
5. 返回新插入记录

### 成功响应
```json
{
  "ok": true,
  "data": {
    "id": 123,
    "nickname": "小星",
    "image_url": "https://bucket.region.aliyuncs.com/memorial-wall/...png",
    "created_at": "2026-05-01T12:00:00.000Z"
  }
}
```

### 失败响应
#### 缺少图片字段
```json
{
  "ok": false,
  "error": "imageBase64 is required"
}
```

#### 不合法的 Base64 格式
会返回 500，服务端日志中可见：
- `Invalid base64 image payload`

#### 数据库连接失败
```json
{
  "ok": false,
  "error": "Failed to connect database"
}
```

### 备注
- 当前后端并不读取 `name` 字段，只读取 `nickname`。[TODO/Debt]
- 前端如果仍传 `name`，不会影响数据库写入，但该值不会被保存，必须补传 `nickname`。
- 目前也没有单独保存 `avatarMode`，若需要追踪头像来源，后端需要新增字段或存储逻辑。[TODO/Debt]

---

## 5. `OPTIONS /api/wall`

### 用途
CORS 预检。

### 行为
- 直接返回 `204`
- 不写业务数据

### 适用场景
浏览器在 `POST` 前会自动发起预检请求时使用。

---

## 6. 前端调用接口的真实位置

### 6.1 `memorial-wall.html`
入口页会在点击“进入星门”时调用：
- `fetch('/api/wall', { method: 'POST', ... })`

当前前端应统一提交：
- `nickname`
- `imageBase64`

如果前端只传 `avatar` 或只传 `name`，会和后端实现脱节。

### 6.2 `js/MemorialWall.js`
`MemorialWall` 也会提交同一接口，负责把最终选中的头像来源转成可上传的 Base64 数据。

### 6.3 `wall-test.html`
沉浸页不直接提交数据，它只挂载照片墙引擎。

---

## 7. 浏览器能力接口

这些不是后端接口，但当前项目对它们的依赖已经接近“接口级别”，因此需要一起记录。

### 7.1 `navigator.mediaDevices.getUserMedia`

#### 用途
在 `memorial-wall.html` 中打开浏览器摄像头。

#### 输入
```js
navigator.mediaDevices.getUserMedia({
  video: { facingMode: 'user' },
  audio: false,
});
```

#### 输出
返回 `MediaStream`，用于：
- 绑定到 `<video>` 预览
- 点击拍照后绘制到 Canvas

#### 失败场景
- 权限被拒绝
- 设备不支持摄像头
- 非安全上下文

#### 当前行为
失败时 UI 会提示摄像头不可用，继续允许用户使用上传图片或昵称兜底。

---

### 7.2 `localStorage`

#### 用途
用于前端状态锁。

#### 当前 key
- `user_submitted`

#### 作用
- 提交成功后写入该值
- 入口页再次打开时，如果发现该值存在，会自动跳转到沉浸页

#### 说明
这是前端锁定逻辑，不是权限系统，不应作为安全判断依据，只是体验层状态锁。

---

### 7.3 `FileReader`

#### 用途
把本地上传图片转成 Data URL。

#### 典型流程
- `<input type="file">`
- `FileReader.readAsDataURL(file)`
- 结果写入头像预览和提交体

---

### 7.4 Canvas 2D API

#### 用途
- 生成昵称粒子头像
- 画上传图片的 Pixel Dissolve
- 从摄像头帧生成最终头像
- 在兜底模式下导出 `imageBase64`

#### 关键接口
- `CanvasRenderingContext2D.drawImage`
- `arc`
- `createRadialGradient`
- `getContext('2d')`
- `canvas.toDataURL('image/png')`

---

### 7.5 `requestAnimationFrame`

#### 用途
在 `js/MemorialWall.js` 的沉浸页中驱动 3D 星海与卡片飞行动画。

#### 特点
- 与剧情轨独立
- 不应共享主剧情页面的动画状态

---

## 8. 数据库契约摘要

虽然数据库代码不在前端仓库里完全展开，但从 `api/wall.js` 可以反推当前最低使用契约：

### 表：`wall_entries`
当前读写字段：
- `id`
- `nickname`
- `image_url`
- `created_at`

### 当前写入方式
- `nickname`：来自前端提交的昵称，若缺失则后端兜底 `匿名访客`
- `image_url`：由 OSS 上传结果生成

### [TODO/Debt]
当前数据库并没有在前端仓库里显式记录 `avatarMode`、`sourceType`、`imageBase64_raw` 等字段，若业务需要精确追踪来源，需要同步扩表。

---

## 9. 当前接口使用约束

### 9.1 前端提交最小必需项
- `imageBase64`

### 9.2 前端建议提交项
- `nickname`
- `imageBase64`
- `avatarMode`

### 9.3 接口契约注意事项
- 后端当前只认 `nickname`，不认 `name`
- 后端当前只认 `imageBase64`
- `imageBase64` 必须是 Data URL，不是纯裸 Base64

---

## 10. 建议的后续文档拆分

如果后续接口继续增多，建议再拆成两个独立文档：

1. `API_REFERENCE.md`
   - 只放 HTTP 接口和契约

2. `BROWSER_APIS.md`
   - 只放摄像头、Canvas、storage、动画等前端平台接口

当前先统一放在一份文档里，便于其他 Agent 立即接手。
