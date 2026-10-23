# 火山方舟（Ark）视频生成 / 图片生成 HTTP API 规格

> 来源：全部为官方文档 `ark.volcengine.com`（= `console.volcengine.com/ark`）的 Markdown 镜像页
> （官方说明：「在任一文档页面地址后追加 `.md` 可获取该页的 Markdown 版本」，索引见 <https://ark.volcengine.com/llms.txt>）。
> 抓取时间：2026-10-22。无法从官方文档核实的内容一律标注「未找到」。

---

## 1. 控制台 / API Key 获取地址

| 用途 | URL |
|---|---|
| API Key 管理（创建 / 查看） | <https://ark.volcengine.com/region:cn-beijing/apiKey> |
| 开通管理（开通模型服务） | <https://ark.volcengine.com/region:cn-beijing/openManagement?LLM=%7B%7D&OpenTokenDrawer=false> |
| 文档总索引（llms.txt） | <https://ark.volcengine.com/llms.txt> |

- 一个主账号最多创建 **50 个 API Key**（更多需提工单）。
- API Key 绑定创建时所在的项目空间，**仅能访问该项目的接入点**，不支持跨项目；可额外限制可鉴权的 Model ID / 自定义推理接入点 / 调用 IP。
- 2026-09-17 12:00 (UTC+8) 之后创建的 Key 使用新的明文格式，**鉴权方式不变**，旧 Key 继续有效。
- 来源：<https://ark.volcengine.com/region:cn-beijing/docs/api-key.md>

## 2. Base URL（国内站点）

```
数据面 API（本规格全部接口）：https://ark.cn-beijing.volces.com/api/v3
管控面 API（管理 API Key / 接入点等，非本规格）：https://ark.cn-beijing.volcengineapi.com/
```

- 来源：<https://ark.volcengine.com/region:cn-beijing/docs/base-url-and-authentication.md>

## 3. 认证方式

```http
Authorization: Bearer $ARK_API_KEY
Content-Type: application/json
```

- 名称：`Authorization`，格式：`Bearer <API_KEY>`（文档逐字为 `Authorization: Bearer $ARK_API_KEY`）。
- 也可用 Access Key 签名鉴权（AK/SK，HMAC-SHA256），此时 **`model` 必须填 Endpoint ID**（`ep-` 开头）；API Key 鉴权时 `model` 填 Model ID 或 Endpoint ID 均可。
- 来源：base-url-and-authentication.md、create-video-generation-task-api.md、image-generation-api.md

## 4. 不花钱的鉴权校验方法

**推荐：查询视频生成任务列表（不调用模型，不产生 token 计费）**

```http
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks?page_size=1
Authorization: Bearer $ARK_API_KEY
```

| 情况 | 期望结果 |
|---|---|
| Key 有效 | `HTTP 200`，返回 `{"total": <int>, "items": [...]}`（新账号可为 `{"total":0,"items":[]}`） |
| Key 缺失 / 无效 | `HTTP 401`，错误码 `AuthenticationError`，message: `The API key or AK/SK in the request is missing or invalid. Request ID: {id}.` |
| 账号异常 | `HTTP 401` + `InvalidAccountStatus` |
| 欠费 | `HTTP 403` + `AccountOverdueError` |
| 触发频率限制 | `HTTP 429`（该接口账号维度 QPS 上限为 **1**，见第 10 节） |

**查询不存在任务**：`GET /api/v3/contents/generations/tasks/{id}`（不存在的 id）——文档未给出「任务不存在」的专用错误码，错误码表仅有通用 `404 NotFound.{Parameter}`（`The specified {ResourceType} {ResourceContent} is not found.`）。该场景下的确切 code 与 message：**未找到**（无法核实）。因此建议用上面的 list 接口做校验，而不是造一个不存在的任务 id。

- 注意：`GET .../tasks` 与 `GET .../tasks/{id}` 都只查询 7 天内的任务记录，不产生生成费用。
- 来源：<https://ark.volcengine.com/region:cn-beijing/docs/list-video-generation-tasks-api.md>、<https://ark.volcengine.com/region:cn-beijing/docs/get-video-generation-task-api.md>、<https://ark.volcengine.com/region:cn-beijing/docs/error-codes.md>

## 5. 视频生成（异步任务）

### 5.1 创建任务

```
POST https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks
```

**文生视频（完整请求体）**

```json
{
  "model": "doubao-seedance-1-0-pro-250528",
  "content": [
    { "type": "text", "text": "写实风格，晴朗的蓝天之下，一大片白色的雏菊花田，镜头逐渐拉近，最终定格在一朵雏菊花的特写上，花瓣上有几颗晶莹的露珠" }
  ],
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "seed": 11,
  "camera_fixed": false,
  "watermark": true
}
```

**响应（异步，仅返回任务 ID）**

```json
{ "id": "cgt-2026******-****" }
```

**图生视频 — 首帧（`role` 可填 `first_frame` 或不填）**

```json
{
  "model": "doubao-seedance-1-0-lite-i2v-250428",
  "content": [
    { "type": "text", "text": "女孩抱着狐狸，女孩睁开眼，温柔地看向镜头，狐狸友善地抱着，镜头缓缓拉出，女孩的头发被风吹动" },
    { "type": "image_url", "image_url": { "url": "https://arkdocs.tos-cn-beijing.volces.com/images/video-generation/i2v_foxrgirl.png" } }
  ],
  "ratio": "adaptive",
  "duration": 5,
  "watermark": true
}
```

`image_url.url` 支持三种来源：公网 URL / Base64（`data:image/png;base64,{base64_image}`，格式名小写）/ 素材 ID（`asset://<ASSET_ID>`）。

**图生视频 — 首尾帧（`role` 必填）**

```json
{
  "model": "doubao-seedance-2-0-260128",
  "content": [
    { "type": "text", "text": "图中女孩对着镜头说\"茄子\"，360度环绕运镜" },
    { "type": "image_url", "image_url": { "url": "https://.../seepro_first_frame.jpeg" }, "role": "first_frame" },
    { "type": "image_url", "image_url": { "url": "https://.../seepro_last_frame.jpeg" }, "role": "last_frame" }
  ],
  "generate_audio": true,
  "ratio": "adaptive",
  "duration": 5,
  "watermark": true
}
```

其他 `content[].type`：`video_url`（`role: reference_video`）、`audio_url`（`role: reference_audio`）、`draft_task`（`{ "type":"draft_task", "draft_task": {"id": "<Draft 任务 ID>"} }`）。
图生视频-首帧 / 图生视频-首尾帧 / 全模态参考生视频 **三者互斥，不可混用**。

### 5.2 关键字段

| 字段 | 类型 / 默认 | 取值与说明 |
|---|---|---|
| `model` | string，必选 | Model ID 或 Endpoint ID（AK/SK 鉴权时必须 Endpoint ID） |
| `content[].type` | string，必选 | `text` / `image_url` / `video_url` / `audio_url` / `draft_task` |
| `content[].text` | string | 提示词。中文 ≤500 字，英文 ≤1000 词 |
| `content[].image_url.url` | string，必选 | URL / Base64 / `asset://<ID>` |
| `content[].role` | string | `first_frame` / `last_frame` / `reference_image` / `reference_video` / `reference_audio` |
| `resolution` | string | `480p`、`720p`、`1080p`、`4k`（各模型支持见第 8 节） |
| `ratio` | string | `16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`、`adaptive` |
| `duration` | integer | 秒，或 `-1`（智能选择）。各模型范围见第 8 节 |
| `frames` | integer | `[29, 289]` 且满足 `25+4n`；与 `duration` 二选一，`frames` 优先；仅 1.0 pro / pro fast |
| `seed` | integer，默认 `-1` | `[-1, 2147483647]`；仅 1.0 pro / pro fast |
| `camera_fixed` | boolean，默认 `false` | 仅 1.0 pro / pro fast；参考图场景不支持 |
| `watermark` | boolean，默认 `false` | `true` 时右下角加「AI 生成」水印（**视频默认 false**） |
| `generate_audio` | boolean，默认 `true` | 有声视频；仅 Seedance 2.5 / 2.0 系列 |
| `return_last_frame` | boolean，默认 `false` | `true` 时查询接口返回 `content.last_frame_url`（jpeg） |
| `output_format` | string，默认 `mp4` | `mp4` / `mov`；仅 Seedance 2.5 |
| `omni_reference_task_type` | string，默认 `auto` | `auto` / `reference` / `edit` / `extend`；仅 2.5 |
| `draft` | boolean，默认 `false` | 样片模式，仅 2.5；开启时仅支持 480p |
| `service_tier` | string，默认 `default` | `default`（在线）/ `flex`（离线，价格 50%）；`flex` 仅 1.0 pro / pro fast |
| `priority` | integer，默认 `0` | `[0,9]`，越大越优先；仅 2.5 / 2.0 系列 |
| `callback_url` | string | Webhook 地址，状态变化时 POST，body 结构 = 查询接口返回体 |
| `execution_expires_after` | integer，默认 `172800` | 超时阈值（秒），范围 `[3600, 259200]`；超时 → `expired` |
| `safety_identifier` | string | 终端用户唯一标识，≤64 字符 |
| `tools[].type` | string | `web_search`；仅 2.5 / 2.0 系列 |

弱校验方式（可选）：把参数追加到提示词尾部，如 `"--rs 720p --rt 16:9 --dur 5 --seed 11 --cf false --wm true"`；request body 直传为强校验（推荐）。

### 5.3 查询任务

```
GET https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks/{id}
```

```json
{
  "id": "cgt-2026****-****",
  "model": "doubao-seedance-2-0-260128",
  "status": "succeeded",
  "content": { "video_url": "https://ark-content-generation-cn-beijing.tos-cn-beijing.volces.com/xxx" },
  "usage": { "completion_tokens": 108900, "total_tokens": 108900 },
  "created_at": 1779348818,
  "updated_at": 1779348874,
  "seed": 78674,
  "resolution": "720p",
  "ratio": "16:9",
  "duration": 5,
  "framespersecond": 24,
  "service_tier": "default",
  "execution_expires_after": 172800,
  "generate_audio": true,
  "draft": false,
  "priority": 0
}
```

**`status` 全部取值（6 个）**

| 值 | 含义 |
|---|---|
| `queued` | 任务排队中 |
| `running` | 任务运行中 |
| `cancelled` | 任务已取消（仅 `queued` 可被取消，取消状态 24h 后自动删除） |
| `succeeded` | 任务成功 |
| `failed` | 任务失败 |
| `expired` | 任务超时（超过 `execution_expires_after`） |

Webhook（`callback_url`）回调的 `status` 集合为 `queued` / `running` / `succeeded` / `failed` / `expired`（成功与失败回调失败会在 5 秒内重试，最多回调 3 次）。

**成功时视频 URL 字段路径**：`content.video_url`（顶层），类型 string，有效期 **24 小时**（Seedance 2.5 产物下载次数上限 100 次）。
尾帧图路径：`content.last_frame_url`（需创建时 `return_last_frame: true`）。

**失败时错误字段路径与格式**

```
error.code    -> string 错误码
error.message -> string 错误提示
```
任务成功时 `error` 为 `null`。错误码为字符串枚举（点分格式），如 `InvalidParameter.TaskTypeConstraint`、`SensitiveContentDetected`、`OutputVideoSensitiveContentDetected`、`InternalServiceError`；完整表见 <https://ark.volcengine.com/region:cn-beijing/docs/error-codes.md>。
注意：Seedance 2.5 某些任务类型需排队到任务被消费时才返回报错信息（异步报错）。

**任务列表**：`GET /api/v3/contents/generations/tasks`，query 参数 `filter.model`（Endpoint ID，精确）、`filter.service_tier`、`filter.status`、`filter.task_ids`（可重复传）、`page_num`（默认 1）、`page_size`（默认 20，范围 `[1,500]`）；返回 `{ "total": <int>, "items": [...] }`，`items[].content.video_url`。

**取消/删除**：`DELETE /api/v3/contents/generations/tasks/{id}`（取消 `queued` 中的任务，或删除任务记录）。

来源：create-video-generation-task-api.md、get-video-generation-task-api.md、list-video-generation-tasks-api.md、video-generation-tutorial.md

## 6. 图片生成（同步接口）

```
POST https://ark.cn-beijing.volces.com/api/v3/images/generations
```

**请求（文生图）**

```json
{
  "model": "doubao-seedream-5-0-pro-260628",
  "prompt": "充满活力的特写编辑肖像，模特眼神犀利，头戴雕塑感帽子……",
  "size": "2K",
  "output_format": "png",
  "watermark": true
}
```

**请求（图生图 / 多图生图）**

```json
{
  "model": "doubao-seedream-5-0-pro-260628",
  "prompt": "将图1的服装换为图2的服装",
  "image": ["https://.../1.png", "https://.../2.png"],
  "size": "2K",
  "sequential_image_generation": "disabled",
  "response_format": "url",
  "watermark": false
}
```

`image` 为 `string | string[]`（URL 或 Base64 `data:image/<小写格式>;base64,<...>`）。

**响应**

```json
{
  "model": "doubao-seedream-5-0-pro-260628",
  "created": 1757321139,
  "data": [
    { "url": "https://...", "size": "3104x1312" }
  ],
  "usage": { "generated_images": 1, "output_tokens": 18000, "total_tokens": 18000 }
}
```

**成功时图片 URL 字段路径：`data[].url`**（当 `response_format: "url"` 时返回，链接 24 小时内有效）；`response_format: "b64_json"` 时为 `data[].b64_json`。
其他字段：`data[].size`（`"2048x2048"`）、`data[].output_format`（5.0 pro/flash）；组图部分失败 → `data[].error.code` / `data[].error.message`；整个请求无图 → 顶层 `error.code` / `error.message`。

**关键字段**

| 字段 | 默认 | 取值 |
|---|---|---|
| `prompt` | — | 图片生成场景必选；中文 ≤300 字，英文 ≤600 词 |
| `size` | 见第 8 节 | `1K`/`1.5K`/`2K`/`3K`/`4K`/`auto` 或 `"<宽>x<高>"` |
| `response_format` | `url` | `url` / `b64_json` |
| `output_format` | `jpeg` | `png` / `jpeg`（仅 5.0 pro/flash/lite） |
| `watermark` | **`true`** | `true` 右下角加「AI 生成」水印 |
| `sequential_image_generation` | `disabled` | `auto`（组图）/ `disabled`（单图）；仅 5.0 lite / 4.5 / 4.0 |
| `sequential_image_generation_options.max_images` | `15` | `[1,15]`；参考图数 + 生成图数 ≤ 15 |
| `stream` | `false` | `true` 时 SSE 流式（`image_generation.partial_succeeded` / `completed`） |
| `layer_decomposition` | `false` | `true` 图层拆分（仅 5.0 pro/flash） |
| `background` | `opaque` | `transparent` / `opaque`（仅 5.0 pro/flash） |
| `optimize_prompt_options.mode` | `standard` | `standard` / `fast` |
| `tools[].type` | — | `web_search`（仅 5.0 lite） |

同步调用（非流式）为一次性返回，**无需轮询**；官方亦提供 OpenAI 兼容调用：`base_url="https://ark.cn-beijing.volces.com/api/v3"` + `client.images.generate(...)`。

来源：<https://ark.volcengine.com/region:cn-beijing/docs/image-generation-api.md>、<https://ark.volcengine.com/region:cn-beijing/docs/model-list.md>

## 7. 当前可用模型 ID

### 视频（Seedance）

| Model ID | 能力 / 状态 |
|---|---|
| `doubao-seedance-2-5-260628` | 2.5：全模态参考 / 首尾帧 / 首帧 / 文生视频 / 编辑 / 延长，4~30s，mp4+mov |
| `doubao-seedance-2-0-260128` | 2.0：全模态参考 / 首尾帧 / 首帧 / 文生视频 / 编辑 / 延长，4~15s，最高 4k |
| `doubao-seedance-2-0-fast-260128` | 2.0 fast：同上，最高 720p，更快 |
| `doubao-seedance-2-0-mini-260615` | 2.0 mini：同上，最高 720p，高性价比 |
| `doubao-seedance-1-0-pro-250528` | 1.0 pro：首尾帧 / 首帧 / 文生视频，2~12s（`即将下线`） |
| `doubao-seedance-1-0-pro-fast-251015` | 1.0 pro fast：首帧 / 文生视频，2~12s（`即将下线`） |
| `doubao-seedance-1-0-lite-t2v-250428` | 1.0 lite 文生视频（见 models.json；model-list 视频表中未列出） |
| `doubao-seedance-1-0-lite-i2v-250428` | 1.0 lite 图生视频（create API 文档示例中使用；model-list 视频表中未列出） |

### 图片（Seedream）

| Model ID | 能力 / 状态 |
|---|---|
| `doubao-seedream-5-0-pro-260628` | 5.0 pro：图层拆分 / 交互编辑 / 单图生成 / 多图生图，1K~2K |
| `doubao-seedream-5-0-flash-260915` | 5.0 flash：图层拆分 / 透明背景 / 快速，1K~2K |
| `doubao-seedream-5-0-260128`（同时支持 `doubao-seedream-5-0-lite-260128`） | 5.0 lite：组图 / 单图 / 联网搜索，2K~4K（`即将下线`） |
| `doubao-seedream-4-5-251128` | 4.5：组图 / 单图，2K/4K（`即将下线`） |
| `doubao-seedream-4-0-250828` | 4.0：组图 / 单图，1K/2K/4K（`即将下线`） |

来源：<https://ark.volcengine.com/region:cn-beijing/docs/model-list.md>、<https://ark.volcengine.com/models.json>

## 8. 分辨率 / 时长 / 比例 可选值

### 视频

| 模型 | `resolution` | `duration`（秒） |
|---|---|---|
| Seedance 2.5 | 默认 `720p`；`480p`、`720p`、`1080p` | 默认 `-1`；`[4, 30]` 或 `-1` |
| Seedance 2.0 系列 | 默认 `720p`；`480p`、`720p`、`1080p`、`4k` | `[4, 15]` 或 `-1` |
| Seedance 2.0 fast / mini | 默认 `720p`；`480p`、`720p` | `[4, 15]` 或 `-1` |
| Seedance 1.0 pro | 默认 `1080p`；`480p`、`720p`、`1080p` | `[2, 12]` |
| Seedance 1.0 pro fast | 默认 `1080p`；`480p`、`720p`、`1080p` | `[2, 12]` |

`ratio` 可选值：`16:9`、`4:3`、`1:1`、`3:4`、`9:16`、`21:9`、`adaptive`。

- 默认值：2.5 / 2.0 系列默认 `adaptive`；1.0 pro 文生视频默认 `16:9`、图生视频默认 `adaptive`。
- **Seedance 1.0 系列文生视频不支持 `adaptive`**（图生视频支持）；Seedance 2.5 在视频编辑 / 延长 / 首帧（首尾帧）任务中**仅支持 `adaptive`**。
- 帧率固定 24 fps；`frames` 取值 `[29,289]` 且满足 `25+4n`，仅 1.0 pro / pro fast。

宽高像素值（节选，`:16:9`）：720p → 1280×720（1.0 系列 1248×704）；1080p → 1920×1080（1.0 系列 1920×1088）；4k 仅 2.0 系列 3840×2160。

### 图片 `size`

| 模型 | 档位 / 像素值 |
|---|---|
| 5.0 pro / flash | 默认 `2K`；`1K`、`1.5K`、`2K`；或 `"宽x高"`，总像素 `[921600, 4624220]`，宽高比 `[1/16, 16]` |
| 5.0 pro / flash（图层拆分） | 默认 `auto`；`1K`、`1.5K`、`2K`、`auto` |
| 5.0 lite | `2K`、`3K`、`4K`；或 `"宽x高"`，默认 `2048x2048`，总像素 `[3686400, 16777216]` |
| 4.5 | `2K`、`4K`；或 `"宽x高"`，默认 `2048x2048`，总像素 `[3686400, 16777216]` |
| 4.0 | `1K`、`2K`、`4K`；或 `"宽x高"`，默认 `2048x2048`，总像素 `[921600, 16777216]` |

2K 常见映射：`1:1` 2048×2048、`16:9` 2816×1584、`9:16` 1584×2816、`21:9` 3136×1344。

来源：create-video-generation-task-api.md、video-generation-tutorial.md、image-generation-api.md、model-list.md

## 9. 建议的轮询间隔与任务超时

- **在线推理（`service_tier=default`）**：官方示例轮询间隔 **10 秒**，并且 create 文档的 Python 示例设置 **30 分钟** deadline（`deadline = time.monotonic() + 30 * 60`，超时抛 `TimeoutError`）。
- **离线推理（`service_tier=flex`）**：官方示例轮询间隔改为 **60 秒**，Go 示例 deadline 设为 **24 小时**。
- **任务超时**：`execution_expires_after` 默认 **172800 秒（48 小时）**，可设范围 `[3600, 259200]`；超时后任务自动终止并置为 `expired`。创建文档建议「不论哪种 service_tier，都建议根据业务场景设置合适的超时时间」。
- 查询频率上限：账号维度 QPS —— 查询任务 **20**、查询任务列表 **1**、取消/删除任务 **20**。10 秒轮询远低于上限。
- 任务记录仅保存 **7 天**（`[T-7d, T)`）；视频 URL 有效期 **24 小时**，建议生成后立即转存。
- 来源：video-generation-tutorial.md、create-video-generation-task-api.md

## 10. 其他注意事项

1. **异步 header：未找到**任何「必须开启异步 header」的要求。所有官方 cURL 示例只带 `Content-Type: application/json` 与 `Authorization: Bearer $ARK_API_KEY`。创建任务本身就是异步接口（返回 `id`，再轮询或用 `callback_url`）。
2. **限流 / 并发（模型维度，在线推理，非刚性保障）**
   | 模型 | 最大 RPM | 最大并发任务数 |
   |---|---|---|
   | Seedance 2.5 | 企业 600 / 个人 180 | 企业 10 / 个人 3 |
   | Seedance 2.0（非 4k） | 企业 600 / 个人 180 | 企业 10 / 个人 3 |
   | Seedance 2.0 / 2.0 fast / mini（4k） | 15 | 1 |
   | Seedance 1.0 pro / pro fast | 600 | 10（离线上限 TPD 5000 亿） |
   图片生成模型（Seedream 全系）：最大 **IPM 500**（张/分钟）。
   超限返回 `HTTP 429`（`RateLimitExceeded.EndpointRPMExceeded`、`ModelAccountTpmRateLimitExceeded`、`QuotaExceeded` 等）。
3. **内容审核**：输入 / 输出各模态均会审核，命中返回 `HTTP 400`，错误码如 `InputImageSensitiveContentDetected`、`OutputVideoSensitiveContentDetected`、`OutputImageSensitiveContentDetected`、`SensitiveContentDetected.SevereViolation`、`InputImageSensitiveContentDetected.PrivacyInformation`（含真人）、`.PolicyViolation`（版权）、`OutputImageSensitiveContentDetected.DeepFake`、`InputTextRiskDetection` 等。组图场景中某张图因审核失败**不影响**同请求其他图片；内部服务异常（500）则不再继续后续图片。
4. **开通与门槛**：调用前需在控制台开通对应模型服务，否则 `404 ModelNotOpen`。开通 Seedance 2.5 / 2.0 系列需满足任一条件：账户余额 > 200 元、购买 200 元档及以上专属节省计划、或已购买对应资源包并有余额。
5. **Seedance 2.5 / 2.0 系列不支持直接上传含真人人脸的参考图 / 视频**；需使用平台提供的素材 / 虚拟人像 / 已授权素材方案（可用本账号近 30 天内上述模型生成的含人脸原始产物作为二次创作输入）。
6. **输入体积限制**：单张图片 < 30 MB（格式 jpeg/png/webp/bmp/tiff/gif，2.0 系列及以上额外支持 heic/heif），宽高比 `[0.4, 2.5]`，边长 px `[300, 6000]`；单个参考视频 ≤ 200 MB（mp4/mov）；单段音频 ≤ 15 MB（wav/mp3）；**请求体 ≤ 64 MB，大文件勿用 Base64**。
7. **任务 ID 有效期 7 天**（从 `created_at` 算起）；Draft 任务 ID 有效期 7 天。
8. **水印默认值不同**：视频 `watermark` 默认 `false`，图片 `watermark` 默认 `true`——适配器需显式设置，避免产出不一致。
9. **鉴权范围**：API Key 只能访问创建时所在项目的接入点；跨项目迁移接入点会导致原 Key 鉴权失效。`model` 可用 Model ID，也可用 Endpoint ID（获得限流 / 计费 / 监控等能力）。
10. 图片生成 `size` 两种方式（分辨率档位 vs `"宽x高"`）**不可混用**；`background: transparent` 仅支持输入 1 张带透明通道的图，且 `output_format` 不能为 `jpeg`（否则报错）。

来源：create-video-generation-task-api.md、video-generation-tutorial.md、image-generation-api.md、model-list.md、error-codes.md、api-key.md

---

## 官方来源 URL 汇总

| 主题 | URL |
|---|---|
| API Key 获取与配置 | <https://ark.volcengine.com/region:cn-beijing/docs/api-key.md> |
| Base URL 与鉴权 | <https://ark.volcengine.com/region:cn-beijing/docs/base-url-and-authentication.md> |
| 创建视频生成任务 | <https://ark.volcengine.com/region:cn-beijing/docs/create-video-generation-task-api.md> |
| 查询视频生成任务 | <https://ark.volcengine.com/region:cn-beijing/docs/get-video-generation-task-api.md> |
| 查询视频生成任务列表 | <https://ark.volcengine.com/region:cn-beijing/docs/list-video-generation-tasks-api.md> |
| 取消或删除视频生成任务 | <https://ark.volcengine.com/region:cn-beijing/docs/cancel-or-delete-video-generation-tasks-api.md> |
| 视频生成教程（轮询 / Webhook / 限流 / 图片裁剪） | <https://ark.volcengine.com/region:cn-beijing/docs/video-generation-tutorial.md> |
| 图片生成 API | <https://ark.volcengine.com/region:cn-beijing/docs/image-generation-api.md> |
| 模型列表（视频 / 图片能力、限流、ID） | <https://ark.volcengine.com/region:cn-beijing/docs/model-list.md> |
| 模型目录 JSON | <https://ark.volcengine.com/models.json> |
| 错误码（含 401 / 429 / 审核错误） | <https://ark.volcengine.com/region:cn-beijing/docs/error-codes.md> |
| 文档总索引 | <https://ark.volcengine.com/llms.txt> |