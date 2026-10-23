# 阿里云百炼 DashScope 万相 / HappyHorse 视频与图片生成 API 规格

> 全部事实来自阿里云官方文档（help.aliyun.com / alibabacloud.com/help）。文档快照时间为 2026-10-11 至 2026-10-21。
> 未在官方文档中验证到的内容一律标注 **未找到**，不做推测。

## 0. 关于 "HappyHorse" 是否存在

**存在，且是官方在售模型族**（国内站与国际站均列出）。
- 国内站模型列表「视频生成」中列出：`happyhorse-1.1-t2v`、`happyhorse-1.0-t2v`、`happyhorse-1.1-i2v`、`happyhorse-1.0-i2v`、`happyhorse-1.1-r2v`、`happyhorse-1.0-r2v`、`happyhorse-1.0-video-edit`。
- 官方 API 参考页存在：《HappyHorse-文生视频API参考》《HappyHorse-图生视频-基于首帧API参考》。
- 官方定位：视频生成与编辑总览页明确「文生视频推荐使用 `happyhorse-1.1-t2v`」「首帧生视频推荐 `happyhorse-1.1-i2v`」「参考生视频推荐 `happyhorse-1.1-r2v`」「视频编辑推荐 `happyhorse-1.0-video-edit`」。
- 它与万相（Wan）是并列的两个模型族，不是万相的别名。

---

## 1. 控制台 / API Key 获取地址（百炼控制台）

| 用途 | URL |
| --- | --- |
| 模型广场（开通模型，华北2/北京） | https://bailian.console.aliyun.com/cn-beijing/model/market |
| API Key 管理页（右上角可切换地域） | https://bailian.console.aliyun.com/cn-beijing/model/settings/api-key |
| 免费额度余量页 | https://bailian.console.aliyun.com/cn-beijing/costing-balance/free-quota |
| 模型用量页 | https://bailian.console.aliyun.com/cn-beijing/costing-balance/usage-statistics |
| 模型监控（调用日志/Request ID） | https://bailian.console.aliyun.com/cn-beijing/model/telemetry |

- API Key 无失效时间限制；可另生成「临时 API Key」（最长 1800 秒）。
- 账号+地域维度最多 50 个 API Key；单个主账号最多 20 个业务空间（含默认空间）。
- 地域相互独立：**每个地域有独立的接入域名、API Key 和模型列表，不能跨地域混用**。

---

## 2. Base URL（国内站点：原生 DashScope vs OpenAI 兼容）

### 2.1 DashScope 原生协议（视频 / 图片生成走这里）

| 域名类型 | 华北2（北京） | 说明 |
| --- | --- | --- |
| DashScope 共享域名 | `https://dashscope.aliyuncs.com/api/v1` | 仍可用 |
| 业务空间专属域名（推荐生产） | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/api/v1` | 更高吞吐/更低时延/空间级隔离 |

原话：「如需使用 DashScope 原生 API，请将上表 URL 中域名后的路径替换为 `/api/v1`，例如北京地域为 `https://dashscope.aliyuncs.com/api/v1`。」

### 2.2 OpenAI 兼容模式

| 域名类型 | 华北2（北京） |
| --- | --- |
| DashScope 共享域名 | `https://dashscope.aliyuncs.com/compatible-mode/v1` |
| 业务空间专属域名 | `https://{WorkspaceId}.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |
| 试用域名 | `https://trial.cn-beijing.maas.aliyuncs.com/compatible-mode/v1` |

### 2.3 关键区别（重要）

- **OpenAI 兼容模式仅用于对话/文本类**。官方「OpenAI Chat接口兼容」页文档化的 endpoint 只有 `POST {base_url}/chat/completions`；「支持的模型列表」为：Qwen 大语言模型（商业版/开源版）、Qwen-VL、Qwen-Coder、Qwen-Omni、Qwen-Math、DeepSeek、Kimi、GLM、MiniMax。**不包含任何万相 wanx / wan2.x / wan3.0 / HappyHorse 模型**。并明确注明「Qwen-Audio 不支持 OpenAI 兼容协议，仅支持 DashScope 协议」。
- 因此：**视频生成、图片生成必须使用 DashScope 原生路径**（`/api/v1/services/aigc/...`），不能走 `/compatible-mode/v1`。
- OpenAI 兼容模式下的图片生成 endpoint（如 `/v1/images/generations`）：**未找到**官方文档。
- 免费额度页另有一条旁证：图像/视频生成模型不支持通过「文本生成类 Base URL」直接调用，经文本 Base URL 请求此类模型返回 HTTP 400。

### 2.4 跨地域与鉴权

- API Key 按地域绑定；用 A 地域 Key 调 B 地域 endpoint → HTTP 401，`Incorrect API key provided`，code=`invalid_api_key`。
- `{WorkspaceId}` 在控制台「业务空间详情」页查看。专属域名仅限该空间所属 API Key 调用；DashScope 共享域名支持跨业务空间 Key。

---

## 3. 认证方式：请求头

| 请求头 | 必选 | 值/格式 |
| --- | --- | --- |
| `Authorization` | 是 | `Bearer sk-xxxx`（`Bearer` + 空格 + API Key） |
| `Content-Type` | 创建任务时是 | `application/json` |
| `X-DashScope-Async` | 视频/图片**异步**创建任务时**必选** | `enable` |
| `X-DashScope-OssResourceResolve` | 传入 OSS 临时 URL（`oss://...`）时 | `enable` |

- 缺少 `X-DashScope-Async: enable`（视频/图片异步接口）会报错：`current user api does not support synchronous calls`。
- 查询任务（GET `/api/v1/tasks/{task_id}`）**只需要** `Authorization`。

---

## 4. 不花钱的鉴权校验方法

### 4.1 用不存在的 task_id 区分「Key 无效」与「任务不存在」（推荐）

`GET {base_url}/api/v1/tasks/{任意UUID}`（需带 `Authorization`）：

| 情形 | HTTP | 响应 |
| --- | --- | --- |
| Key 无效/缺失 | 401 | `{"code":"InvalidApiKey","message":"No API-key provided."...}` 或 `invalid_api_key` / `Incorrect API key provided.` |
| Key 有效但任务不存在 | **200** | `{"request_id":"...","output":{"task_id":"...","task_status":"UNKNOWN"}}` |

即：**401 + InvalidApiKey ⇒ Key 无效；200 + `output.task_status == "UNKNOWN"` ⇒ Key 有效但任务不存在**（`UNKNOWN` 被官方明确定义为「任务不存在或状态未知」，也是 task_id 超过 24 小时有效期后的返回）。
此调用不创建任何任务，不产生费用。

### 4.2 list 类接口（存在）

`GET {base_url}/api/v1/tasks?start_time=&end_time=&status=&model_name=&page_no=&page_size=`（仅需 `Authorization`）

- 出参：`request_id`、`data[]`（`task_id` / `status` / `model_name` / `region` / `gmt_create` / `start_time` / `end_time` / `api_key_id` / `caller_uid` / `request_id` / `user_api_unique_key`）、`page_no`、`page_size`、`total_page`、`total`。
- 时间格式 `YYYYMMDDhhmmss`；未指定时默认查最近 24 小时；起止跨度不超过 24 小时。
- 默认 `page_size=10`；限额 20 QPS。
- 注意：**未传 `task_id` 时**该接口返回列表；传 `task_id` 只返回该任务。空列表 + 200 同样证明 Key 有效。

### 4.3 其它可用的错误码

- `400 InvalidParameter` → `Model not exist.`（model 名写错）
- `401 Arrearage` → `Access denied, please make sure your account is in good standing.`（账号欠费）
- `400 AllocationQuota.FreeTierOnly`（HTTP 403）→ 免费额度耗尽且已开启「用完即停」

---

## 5. 视频生成（异步任务）

### 5.1 通用要点

- 视频生成耗时「通常为 1-5 分钟」，只支持异步。
- 流程：**创建任务（拿 task_id）→ 轮询查询结果**。
- `task_id` 有效期 **24 小时**；成功后返回的 `video_url` 有效期也是 **24 小时**。

### 5.2 文生视频 — method + path

```
POST {base_url}/api/v1/services/aigc/video-generation/video-synthesis
Headers:
  Authorization: Bearer sk-xxxx
  Content-Type: application/json
  X-DashScope-Async: enable
```

完整 JSON 请求体示例（官方 HappyHorse 示例）：

```json
{
  "model": "happyhorse-1.1-t2v",
  "input": {
    "prompt": "一座由硬纸板和瓶盖搭建的微型城市，在夜晚焕发出生机。一列硬纸板火车缓缓驶过，小灯点缀其间，照亮前路。"
  },
  "parameters": {
    "resolution": "720P",
    "ratio": "16:9",
    "duration": 5
  }
}
```

万相 2.7 文生视频示例（多镜头、含 negative_prompt / audio_url / prompt_extend / watermark / seed）：

```json
{
  "model": "wan2.7-t2v-2026-06-12",
  "input": {
    "prompt": "一只小猫在月光下奔跑",
    "negative_prompt": "花朵",
    "audio_url": "https://help-static-aliyun-doc.aliyuncs.com/xxx.mp3"
  },
  "parameters": {
    "resolution": "720P",
    "ratio": "16:9",
    "prompt_extend": true,
    "watermark": true,
    "duration": 15,
    "seed": 12345
  }
}
```

### 5.3 图生视频（wan2.7 新版协议：首帧 / 首尾帧 / 视频续写 / 音频驱动）

```
POST {base_url}/api/v1/services/aigc/video-generation/video-synthesis
Headers: Authorization + Content-Type + X-DashScope-Async: enable
```

首帧生视频（+驱动音频）：

```json
{
  "model": "wan2.7-i2v-2026-04-25",
  "input": {
    "prompt": "一幅都市奇幻艺术的场景……",
    "media": [
      { "type": "first_frame", "url": "https://help-static-aliyun-doc.aliyuncs.com/.../rap.png" },
      { "type": "driving_audio", "url": "https://help-static-aliyun-doc.aliyuncs.com/.../rap.mp3" }
    ]
  },
  "parameters": { "resolution": "720P", "duration": 10, "prompt_extend": true, "watermark": true }
}
```

首尾帧生视频：

```json
{
  "model": "wan2.7-i2v-2026-04-25",
  "input": {
    "prompt": "写实风格,一只小黑猫好奇地仰望天空,镜头从平视角度逐渐升高,最后以俯视角度捕捉到它好奇的眼神。",
    "media": [
      { "type": "first_frame", "url": "https://wanx.alicdn.com/material/20250318/first_frame.png" },
      { "type": "last_frame",  "url": "https://wanx.alicdn.com/material/20250318/last_frame.png" }
    ]
  },
  "parameters": { "resolution": "720P", "duration": 10, "prompt_extend": false, "watermark": true }
}
```

`media[].type` 可选值：`first_frame`（首帧）、`last_frame`（尾帧）、`driving_audio`（驱动音频）、`first_clip`（首视频片段）。
**仅支持以下组合**，非法组合报错：
- 首帧：`first_frame`
- 首帧+音频：`first_frame+driving_audio`
- 首尾帧：`first_frame+last_frame`
- 首尾帧+音频：`first_frame+last_frame+driving_audio`
- 视频续写：`first_clip`、`first_clip+last_frame`

每种 `type` 在 `media` 数组中**最多出现一次**。

图像输入限制（wan2.7-i2v）：JPEG/JPG/PNG（不支持透明通道）/BMP/WEBP；宽高范围 [240, 8000] px；宽高比 1:8 ~ 8:1；≤20MB。
视频输入（first_clip）：mp4/mov；时长 2-10s；宽高 [240, 4096]；比例 1:8 ~ 8:1；≤100MB。
音频输入：wav/mp3；时长 2-30s；≤15MB。

### 5.4 图生视频（wan2.6 及更早的旧协议，仅支持首帧）

```
POST {base_url}/api/v1/services/aigc/video-generation/video-synthesis
```

```json
{
  "model": "wan2.6-i2v-flash",
  "input": {
    "prompt": "一只小猫在草地上奔跑",
    "negative_prompt": "花朵",
    "img_url": "https://cdn.translate.alibaba.com/r/wanx-demo-1.png",
    "audio_url": "https://help-static-aliyun-doc.aliyuncs.com/xxx.mp3"
  },
  "parameters": { "resolution": "720P", "duration": 10, "prompt_extend": true, "shot_type": "multi", "audio": true, "watermark": false, "seed": 12345 }
}
```

旧协议首帧字段为 `input.img_url`（不是 `media[]`）。`parameters` 额外支持：
- `shot_type`：`single`（默认）/ `multi`，仅 wan2.6 系列，且仅在 `prompt_extend=true` 时生效；优先级 `shot_type > prompt`。
- `audio`：`true`（默认）/ `false`，仅 `wan2.6-i2v-flash`；优先级 `audio > audio_url`。

### 5.5 首尾帧（wan2.2-kf2v-flash / wan2.1-kf2v-plus）— **注意是不同的 path**

```
POST {base_url}/api/v1/services/aigc/image2video/video-synthesis
```

```json
{
  "model": "wan2.2-kf2v-flash",
  "input": {
    "first_frame_url": "https://wanx.alicdn.com/material/20250318/first_frame.png",
    "last_frame_url":  "https://wanx.alicdn.com/material/20250318/last_frame.png",
    "prompt": "写实风格，一只黑色小猫好奇地看向天空，镜头从平视逐渐上升，最后俯拍它的好奇的眼神。",
    "negative_prompt": "人物"
  },
  "parameters": { "resolution": "480P", "prompt_extend": true }
}
```

- 必选：`input.first_frame_url`、`input.last_frame_url`（**公网 HTTP/HTTPS URL**）。
- `duration` **固定为 5 秒且不支持修改**。
- 首尾帧仅支持无声视频。

### 5.6 查询任务

```
GET {base_url}/api/v1/tasks/{task_id}
Headers: Authorization: Bearer sk-xxxx
```

成功响应（视频）：

```json
{
  "request_id": "99243b47-ec5f-9413-9993-xxxxxx",
  "output": {
    "task_id": "4673458e-28be-4a05-bf2a-xxxxxx",
    "task_status": "SUCCEEDED",
    "submit_time": "2026-04-20 17:55:17.075",
    "scheduled_time": "2026-04-20 17:55:17.129",
    "end_time": "2026-04-20 17:56:36.658",
    "orig_prompt": "…",
    "video_url": "https://dashscope-result.oss-cn-beijing.aliyuncs.com/xxx.mp4?Expires=xxx"
  },
  "usage": {
    "duration": 5,
    "input_video_duration": 0,
    "output_video_duration": 5,
    "video_count": 1,
    "SR": 720,
    "ratio": "16:9"
  }
}
```

### 5.7 `task_status` 的全部取值（唯一权威列表）

- `PENDING` — 任务排队中
- `RUNNING` — 任务处理中
- `SUCCEEDED` — 任务执行成功
- `FAILED` — 任务执行失败
- `CANCELED` — 任务已取消
- `UNKNOWN` — 任务不存在或状态未知

流转：`PENDING → RUNNING → SUCCEEDED / FAILED`。
（注意：查询任务接口文档的枚举**不含** `CANCELED`，但创建任务接口、批量查询接口的枚举含 `CANCELED`。批量 list 中写作 `CANCELED`：任务取消成功。）

### 5.8 成功时视频 URL 的确切字段路径

```
output.video_url        // 字符串；仅 task_status == "SUCCEEDED" 时返回
```
（无数组嵌套。MP4 / H.264；voice/video 帧率见各模型，如 24fps 或 30fps。链接有效期 24 小时。）

### 5.9 失败时的错误字段与错误码格式

**创建任务失败**（HTTP 非 200，`code`/`message` 在**顶层**）：

```json
{
  "code": "InvalidApiKey",
  "message": "No API-key provided.",
  "request_id": "7438d53d-6eb8-4596-8835-xxxxxx"
}
```

**任务执行失败**（HTTP 200，`task_status=FAILED`，`code`/`message` 在 **output 内**）：

```json
{
  "request_id": "e5d70b02-ebd3-98ce-9fe8-759d7d7b107d",
  "output": {
    "task_id": "86ecf553-d340-4e21-af6e-a0c6a421c010",
    "task_status": "FAILED",
    "code": "InvalidParameter",
    "message": "The parameter is invalid."
  }
}
```

**任务查询过期 / 不存在**（HTTP 200）：

```json
{
  "request_id": "a4de7c32-7057-9f82-8581-xxxxxx",
  "output": { "task_id": "502a00b1-19d9-4839-a82f-xxxxxx", "task_status": "UNKNOWN" }
}
```

即：`code` 与 `message` 是字符串，位置随「请求级失败」（顶层）与「任务级失败」（`output.code` / `output.message`）而不同 —— 集成时必须两处都判。

### 5.10 其它异步任务管理接口

| 操作 | Method + Path | 说明 |
| --- | --- | --- |
| 批量查询 | `GET {base_url}/api/v1/tasks?start_time&end_time&status&model_name&page_no&page_size` | 20 QPS |
| 取消任务 | `POST {base_url}/api/v1/tasks/{task_id}/cancel` | **仅 `PENDING` 可取消**；失败时 code=`UnsupportedOperation`，message=`Failed to cancel the task, please confirm if the task is in PENDING status.` |

---

## 6. 图片生成（文生图）

### 6.1 同步模式（**仅 wan2.6 模型**，新版协议）

```
POST {base_url}/api/v1/services/aigc/multimodal-generation/generation
Headers: Authorization + Content-Type: application/json
（不需要 X-DashScope-Async）
```

请求：

```json
{
  "model": "wan2.6-t2i",
  "input": {
    "messages": [
      { "role": "user", "content": [ { "text": "一间有着精致窗户的花店，漂亮的木质门，摆放着花朵" } ] }
    ]
  },
  "parameters": {
    "prompt_extend": true,
    "watermark": false,
    "n": 1,
    "negative_prompt": "",
    "size": "1280*1280"
  }
}
```

响应：

```json
{
  "output": {
    "choices": [
      { "finish_reason": "stop",
        "message": { "content": [ { "image": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxxx.png?Expires=xxx", "type": "image" } ],
                     "role": "assistant" } }
    ],
    "finished": true
  },
  "usage": { "image_count": 1, "input_tokens": 0, "output_tokens": 0, "size": "1280*1280", "total_tokens": 0 },
  "request_id": "815505c6-7c3d-49d7-b197-xxxxx"
}
```

**同步图片 URL 字段路径**：`output.choices[0].message.content[0].image`
（`messages` 仅支持单轮，必须 `role=user`；`content` 中**仅支持一个 `text`**，不传或多个会报错。）

失败（字段在顶层）：

```json
{ "request_id": "a4d78a5f-655f-9639-8437-xxxxxx", "code": "InvalidParameter", "message": "num_images_per_prompt must be 1" }
```

### 6.2 异步模式（**仅 wan2.6 模型**，新版协议）

```
POST {base_url}/api/v1/services/aigc/image-generation/generation
Headers: Authorization + Content-Type + X-DashScope-Async: enable
```

请求体与同步完全一致（同一个 JSON）。
创建响应：

```json
{ "output": { "task_status": "PENDING", "task_id": "0385dc79-5ff8-4d82-bcb6-xxxxxx" },
  "request_id": "4909100c-7b5a-9f92-bfe5-xxxxxx" }
```

查询：`GET {base_url}/api/v1/tasks/{task_id}`（仅需 Authorization）

```json
{
  "request_id": "7e57e7e8-00b0-4534-9aff-fe31e0xxxxxx",
  "output": {
    "choices": [
      { "finish_reason": "stop",
        "message": { "role": "assistant",
                     "content": [ { "image": "https://dashscope-result-bj.oss-cn-beijing.aliyuncs.com/xxxxxx.png?Expires=xxxxxx", "type": "image" } ] } }
    ],
    "task_id": "f470bbfd-d955-4165-935b-d35b8eexxxxxx",
    "task_status": "SUCCEEDED",
    "submit_time": "2026-01-09 17:18:17.901",
    "scheduled_time": "2026-01-09 17:18:17.941",
    "end_time": "2026-01-09 17:18:45.544",
    "finished": true
  },
  "usage": { "input_tokens": 0, "output_tokens": 0, "characters": 0, "size": "1280*1280", "total_tokens": 0, "image_count": 1 }
}
```

**异步图片 URL 字段路径**：同样是 `output.choices[0].message.content[0].image`。
图片链接有效期 **24 小时**。`task_status` 枚举与视频一致。

### 6.3 wan2.5 及以下版本

- HTTP 上的文档化 endpoint 只覆盖 wan2.6（同步 `multimodal-generation/generation`；异步 `image-generation/generation`）。**wan2.5 及更早版本的 HTTP 请求路径：未找到**（官方文档该处只给了 SDK 示例，并交叉链接到「HTTP异步调用」章节）。
- 旧版响应结构不同：图片 URL 在 **`output.results[].url`**（另有 `output.results[].orig_prompt`、`output.results[].actual_prompt`，以及 `output.task_metrics.{TOTAL,SUCCEEDED,FAILED}`、`usage.image_count`）。
- 旧版可用 DashScope Python SDK（`dashscope.ImageSynthesis.call` / `async_call`，SDK ≥ 1.25.2）/ Java SDK（≥ 2.22.2），异步任务统一走 `ImageSynthesis.fetch/list/cancel` → `/api/v1/tasks`。
- SDK 支持本地文件路径 `file://...`、Base64（`data:{MIME};base64,{data}`）；HTTP 只支持公网 URL 或 OSS 临时 URL。

---

## 7. 当前可用模型 ID 列表

### 7.1 视频（确切字符串）

**HappyHorse 1.1**
- `happyhorse-1.1-t2v` — 文生视频，有声，480P/720P/1080P，3-15s，24fps MP4
- `happyhorse-1.1-i2v` — 首帧生视频，有声，480P/720P/1080P，3-15s，24fps MP4
- `happyhorse-1.1-r2v` — 参考生视频，有声，480P/720P/1080P，3-15s，24fps MP4

**HappyHorse 1.0**
- `happyhorse-1.0-t2v` — 文生视频，有声，720P/1080P，3-15s，24fps MP4
- `happyhorse-1.0-i2v` — 首帧生视频，有声，720P/1080P，3-15s，24fps MP4
- `happyhorse-1.0-r2v` — 参考生视频，有声，720P/1080P，3-15s，24fps MP4
- `happyhorse-1.0-video-edit` — 视频编辑，有声，720P/1080P，3-15s，24fps MP4

**Wan 3.0（全能参考）**
- `wan3.0-video` — 文生视频/首帧/首尾帧/全能参考，有声，480P/720P/1080P，2-30s，30fps MP4
- `wan3.0-video-prime` — 同上，优速版

造境已将这两个型号加入视频工作台。当前接入覆盖文生、首帧/首尾帧和最多 10 张参考图；参考视频、音频、文件和网页等 `input.media` 类型暂未提供上传控件，因此不在工作台暴露。该系列官方仍标注为预览，实际可用性取决于百炼账号、地域与模型开通状态。

**Wan 2.7**
- `wan2.7-t2v`、`wan2.7-t2v-2026-06-12`、`wan2.7-t2v-2026-04-25` — 文生视频，720P/1080P，2-15s，30fps
- `wan2.7-i2v`、`wan2.7-i2v-2026-04-25` — 图生视频（首帧/首尾帧/视频续写/音频驱动），720P/1080P，2-15s
- `wan2.7-r2v-2026-06-12` — 视频引用，720P/1080P，2-10s
- `wan2.7-videoedit` — 视频编辑/特效复刻/运镜复刻，720P/1080P，最长 10s

**Wan 2.6**
- `wan2.6-t2v`、`wan2.6-i2v`、`wan2.6-i2v-flash`、`wan2.6-r2v`、`wan2.6-r2v-flash`（均 720P/1080P；t2v/i2v 2-15s，r2v 2-10s）

**Wan 2.5**
- `wan2.5-t2v-preview`、`wan2.5-i2v-preview`（480P/720P/1080P，5s 或 10s，30fps）

**Wan 2.2**
- `wan2.2-t2v-plus`、`wan2.2-i2v-plus`、`wan2.2-i2v-flash`、`wan2.2-kf2v-flash`、`wan2.2-animate-move`、`wan2.2-animate-mix`

**Wan 2.1 / 2.0 旧系列**
- `wan2.1-t2v-plus`、`wan2.1-t2v-turbo`、`wan2.1-i2v-plus`、`wan2.1-i2v-turbo`、`wan2.1-kf2v-plus`、`wan2.1-vace-plus`
- `wanx2.1-t2v-plus`、`wanx2.1-t2v-turbo`、`wanx2.1-i2v-plus`、`wanx2.1-i2v-turbo`、`wanx2.1-kf2v-plus`、`wanx2.1-vace-plus`
- `wan2.2-s2v`、`wan2.2-s2v-detect`（语音驱动）、`video-style-transform`、`videoretalk`

第三方视频模型（同列表内）：`kling/kling-v3-*`、`pixverse/pixverse-*`、`vidu/viduq2-*`、`vidu/viduq3-*`、`MiniMax/MiniMax-H3`。

### 7.2 图片（确切字符串）

- `qwen-image-3.0-pro`、`qwen-image-3.0`、`qwen-image-2.1-pro`、`qwen-image-2.1-turbo`、`qwen-image-2.0-pro`、`qwen-image-2.0`
- `qwen-mt-image`、`qwen-mt-image-2.0`
- `wan2.7-image-pro`、`wan2.7-image`
- `wan2.6-image`、`wan2.6-t2i`
- `wan2.5-i2i-preview`、`wan2.5-t2i-preview`
- `wan2.2-t2i-flash`、`wan2.2-t2i-plus`
- `wan2.1-t2i-plus`、`wanx2.1-t2i-plus`、`wan2.1-t2i-turbo`、`wanx2.1-t2i-turbo`、`wanx2.0-t2i-turbo`
- `wanx2.1-imageedit`、`wanx-v1`、`wanx-poster-generation-v1`、`wanx-sketch-to-image-lite`、`wanx-style-repaint-v1`、`wanx-virtualmodel`、`wanx-x-painting`
- `z-image-turbo`、`virtualmodel-v2`、`shoemodel-v1`、`facechain-facedetect`、`image-erase-completion`、`image-instance-segmentation`
- 第三方：`kling/kling-v3-image-generation`、`kling/kling-v3-omni-image-generation`、`vidu/vidu-*reference2image`

> 「万相（wan2.6 及以上）」走新版协议；「wanx2.x / wanx-v1」是旧命名，接口与参数不同。

---

## 8. 分辨率 / 时长 / 比例 可选值清单

### 8.1 视频 — resolution

| 模型 | resolution 可选值 | 默认 |
| --- | --- | --- |
| `happyhorse-1.1-*` / `happyhorse-1.0-*` | `480P`、`720P`、`1080P`（1.0 仅 `720P`、`1080P`） | `1080P` |
| `wan3.0-video` / `wan3.0-video-prime` | `480P`、`720P`、`1080P` | **未找到**（文档未列默认值） |
| `wan2.7-t2v` / `wan2.7-t2v-*` | `720P`、`1080P` | `1080P` |
| `wan2.7-i2v` / `wan2.7-i2v-2026-04-25` | `720P`、`1080P` | `1080P` |
| `wan2.6-i2v-flash` / `wan2.6-i2v` | `720P`、`1080P` | `1080P` |
| `wan2.5-i2v-preview` | `480P`、`720P`、`1080P` | `1080P` |
| `wan2.2-i2v-flash` | `480P`、`720P` | `720P` |
| `wan2.2-i2v-plus` | `480P`、`1080P` | `1080P` |
| `wan2.1-i2v-turbo` | `480P`、`720P` | `720P` |
| `wan2.1-i2v-plus` | `720P` | `720P` |
| `wan2.2-kf2v-flash` | `480P`、`720P`、`1080P` | `720P` |
| `wan2.1-kf2v-plus` | `720P` | `720P` |

### 8.2 视频 — duration（秒）

| 模型 | duration |
| --- | --- |
| `happyhorse-1.1-*` / `happyhorse-1.0-*` | 整数 [3, 15]，默认 `5` |
| `wan3.0-video(-prime)` | 2-30（「智能时长」） |
| `wan2.7-t2v*` | 整数 [2, 15]，默认 `5` |
| `wan2.7-i2v*` | 整数 [2, 15]，默认 `5` |
| `wan2.6-i2v` / `wan2.6-i2v-flash` | 整数 [2, 15]，默认 `5` |
| `wan2.5-i2v-preview` / `wan2.5-t2v-preview` | 只能 `5` 或 `10`，默认 `5` |
| `wan2.2-i2v-plus` / `wan2.2-i2v-flash` | **固定 5，不可改** |
| `wan2.1-i2v-plus` | **固定 5，不可改** |
| `wan2.1-i2v-turbo` | `3`、`4`、`5`，默认 `5` |
| `wan2.2-kf2v-flash` / `wan2.1-kf2v-plus` | **固定 5，不可改** |

### 8.3 视频 — ratio（仅文生视频与 HappyHorse 支持）

`happyhorse-1.1-t2v` / `happyhorse-1.0-t2v` 的 `parameters.ratio`：
`16:9`（默认）、`9:16`、`1:1`、`4:3`、`3:4`、`4:5`、`5:4`、`9:21`、`21:9`。

`wan2.7-t2v*` 的 `parameters.ratio`：
`16:9`（默认）、`9:16`、`1:1`、`4:3`、`3:4`。

wan2.7-t2v 分辨率档位 × 宽高比 → 实际像素（宽*高）：

| 档位 | 16:9 | 9:16 | 1:1 | 4:3 | 3:4 |
| --- | --- | --- | --- | --- | --- |
| 720P | 1280*720 | 720*1280 | 960*960 | 1104*832 | 832*1104 |
| 1080P | 1920*1080 | 1080*1920 | 1440*1440 | 1648*1248 | 1248*1648 |

**图生视频不支持 `ratio`**：输出宽高比自动跟随输入首帧（官方原话：「图生视频不支援 `ratio` 參數」）。且宽高比不保证精确（长宽必须是 16 的倍数，会微调；例：输入 750×1000 + 720P → 输出 816×1104）。

### 8.4 图片 — size

- 格式：字符串 `宽*高`（例如 `"1280*1280"`）。
- `wan2.6-t2i`：默认 `1280*1280`；总像素需在 `[1280*1280, 1440*1440]` 之间，宽高比范围 `[1:4, 4:1]`（例：`768*2700` 符合要求）。
- 常见比例推荐值：1:1 `1280*1280`；3:4 `1104*1472`；4:3 `1472*1104`；9:16 `960*1696`；16:9 `1696*960`。
- `n`：生成张数，取值 1~4，**默认 `4`**（按张计费，测试建议设为 1）。

### 8.5 视频其它 parameters

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `prompt_extend` | boolean | 是否智能改写提示词；`wan2.7`/HappyHorse/多数 wan：`true` 为默认；旧模型默认 `true` |
| `watermark` | boolean | 万相文案「AI生成」，默认 `false`（不加水印）；**HappyHorse 文案「Happy Horse」，默认 `true`（加水印）** |
| `seed` | integer | `[0, 2147483647]` |
| `negative_prompt` | string | 反提示词，≤500 字符 |
| `audio_url` | string | 仅 wan2.6/wan2.5 系列（`input.audio_url`）；wan2.7 用 `media[].type=driving_audio` |
| `shot_type` | string | `single`/`multi`，仅 wan2.6 系列且 `prompt_extend=true` |

---

## 9. 建议的轮询间隔与任务超时

- **官方建议轮询间隔**：视频生成「如 **15 秒**」；图片生成「如 **10 秒**」。
- **查询接口限流**：`/api/v1/tasks*` 默认 **20 QPS**（按账号，含子账号合并计算）；视频查询接口文档同样写「默认 RPS 为 20」。需更高频或事件通知，官方建议配置「异步任务回调」。
- **task_id 有效期 / 任务数据保留**：**24 小时**，超时后查询返回 `task_status = UNKNOWN`。
- **结果 URL 有效期**：视频 `video_url`、图片 URL 均为 **24 小时**，官方建议取到后立即下载转存（如 OSS）。
- **任务本身超时（执行超时上限）**：**未找到** —— 官方只给「通常 1-5 分钟」和 24 小时数据保留，未公布硬性任务超时值。建议集成侧自设超时（如视频 ≤10 分钟），并把 `UNKNOWN`/超时都当作「需重新提交」处理。
- 查询次数不影响任务执行，但过频会触发限流。

---

## 10. 其他注意事项

### 并发 / 限流
- 限流**按主账号维度**计算，账号下所有 RAM 子账号、业务空间、API Key 的调用量**合并计算**；不同模型限流额度相互独立；超出后请求被拒（HTTP 429），通常 1 分钟内恢复。
- `wan2.7-t2v`（含快照版）：RPM **300**。
- `happyhorse-1.0-t2v`（北京/新加坡/法兰克福/弗吉尼亚）：RPM **300**。
- 除 RPM/TPM 外，可能按秒级 RPS（RPM/60）与 TPS（TPM/60）执行；短时突发会触发 `Request rate increased too quickly`。
- 触发限流的错误文案：`Requests rate limit exceeded` / `You exceeded your current requests list`（RPM）；`Allocated quota exceeded` / `You exceeded your current quota`（TPM）。
- 充值不提升限流阈值；需更高额度联系商务经理。
- 「并发数」上限：**未找到**（官方只公布 RPM/TPM/RPS/QPS）。

### 内容审核
- 输入 prompt/图像 与输出视频/图片**都会过内容安全审核**。
- 命中后的错误码：`IPInfringementSuspect`（涉嫌知识产权侵权）、`DataInspectionFailed` / `data_inspection_failed`（输入或输出含不当内容）。
- 多子任务的异步任务可能**整体 `SUCCEEDED` 但部分子任务失败**，需看 `output.task_metrics.{TOTAL,SUCCEEDED,FAILED}` 与各 `results[]` 里的 `code`/`message`。
- 图像生成开启 `prompt_extend` 时，改写结果可能引入受版权保护内容从而触发审核；可将 `prompt_extend=false`，或修改 prompt 本身。
- 服务端下载 URL 时携带的 User-Agent 含 `DashScopeUserBot`，第三方服务器可能拦截 → 建议用同地域 OSS 公网链接或 Base64/本地文件。

### 计费单位
- **视频：按秒计费**。`usage.duration` = 计费时长；`wan2.6+`：`duration = input_video_duration + output_video_duration`；`wan2.1`：`usage.video_duration`；`wan2.2/2.5`：`usage.duration`。分辨率档位直接影响单价（如 `wan2.7-t2v` 北京：720P ¥0.6/秒，1080P ¥1/秒）。`resolution` 与 `duration` 都直接影响费用。
- 视频续写：例 `duration=15`、输入视频 3 秒 → 模型续写 12 秒，输出总时长 15 秒，**按 15 秒计费**。
- **图片：按张计费**，`费用 = 单价 × 图片张数`；`n` 默认 4，直接×4 费用。文生图的 `input_tokens`/`output_tokens`/`total_tokens` 固定为 0。
- 有声视频与无声视频价格不同（`audio` 影响费用）。
- 只对成功结果计数。

### 免费额度（国内站）
- **仅华北2（北京）地域**的模型享有免费额度，其他地域无免费额度。
- 有效期 **90 天**，自「开通百炼 / 模型发布 / 申请通过」较晚者起算；过期不补发、不延期。
- 每个模型（含同一模型的不同快照版本）**独立额度**（通常 100 万 Token），不互通；主账号与 RAM 子账号共享。
- 仅抵扣「实时推理」调用费用；Batch、模型调优、模型部署、PAI-DSW、OSS 存储与请求费用**不支持**抵扣。
- 用量耗尽且开启「免费额度用完即停」时返回 **HTTP 403，错误码 `AllocationQuota.FreeTierOnly`**。
- 消耗优先级：免费额度 > 资源包 > 节省计划 > 按量付费。
- Token Plan / Coding Plan 专属 API Key **不消耗**免费额度。
- 新人免费额度不支持抵扣视频/图片这类「按秒/按张」的多模态生成模型这一点：**未找到**明确说明（文档只说「仅抵扣模型实时推理产生的费用」，未逐模型列出是否含 wanx）。

### 其它工程注意点
- **一套凭据只能配一个地域**：模型、Endpoint URL、API Key 必须同地域，跨地域调用直接失败。
- API Key 不要放客户端代码；服务端使用，或用临时 API Key（≤1800 秒）。
- 视频/图片任务应为「创建 → 轮询 → 24h 内下载转存」三步，不要重复创建任务（官方明确「请勿重复创建任务，轮询获取即可」）。
- 查询接口返回的 `submit_time` / `scheduled_time` / `end_time` 格式 `YYYY-MM-DD HH:mm:ss.SSS`（时区 UTC+8）。
- 视频存储 OSS 域名会动态变更，**官方不提供固定白名单**；有防火墙需求需联系客户经理。

---

## 来源 URL

- Base URL 总览：https://help.aliyun.com/zh/model-studio/base-url
- 获取与配置 API Key：https://help.aliyun.com/zh/model-studio/get-api-key
- 错误码：https://www.alibabacloud.com/help/zh/model-studio/error-code
- 管理异步任务（查询/批量/取消）：https://help.aliyun.com/zh/model-studio/manage-asynchronous-tasks
- 限流：https://www.alibabacloud.com/help/zh/model-studio/rate-limit
- 新人免费额度：https://help.aliyun.com/zh/model-studio/new-free-quota
- 模型列表-视频生成：https://help.aliyun.com/zh/model-studio/model-list-video-generation
- 模型列表-图像生成：https://help.aliyun.com/zh/model-studio/model-list-image-generation
- 视频生成与编辑（推荐模型/规格表）：https://help.aliyun.com/zh/model-studio/video-generate-edit-model
- HappyHorse-文生视频API参考：https://help.aliyun.com/zh/model-studio/happyhorse-text-to-video-api-reference
- HappyHorse-图生视频-基于首帧API参考：https://www.alibabacloud.com/help/tc/model-studio/happyhorse-image-to-video-api-reference
- happyhorse-1.0-t2v 模型信息（价格/限流）：https://www.alibabacloud.com/help/zh/model-studio/happyhorse-1-0-t2v
- 万相2.7-文生视频API参考：https://help.aliyun.com/zh/model-studio/text-to-video-api-reference
- 万相2.7-图生视频API参考：https://help.aliyun.com/zh/model-studio/image-to-video-general-api-reference
- 万相-图生视频-基于首帧API参考（2.1-2.6）：https://www.alibabacloud.com/help/zh/model-studio/legacy-image-to-video-api-reference
- 万相-首尾帧生视频API参考（2.2）：https://www.alibabacloud.com/help/zh/model-studio/legacy-image-to-video-by-first-and-last-frame-api-reference
- 万相-文生图V2版API参考（同步/异步）：https://www.alibabacloud.com/help/zh/model-studio/text-to-image-v2-api-reference
- OpenAI Chat接口兼容：https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope
- wan2.7-t2v 模型信息（价格/限流）：https://help.aliyun.com/zh/model-studio/wan2-7-t2v
