# 造境

团队内部使用的 AI 图片 / 视频生成工作台。支持多家模型平台切换、作品自动归档、提示词复用与团队协作。

部署在一台内网机器上，同事通过浏览器访问；可收藏和下载作品，也可分享创作灵感。

- **开箱即用**：Docker 三容器（应用 / 任务队列 / 数据库），一条命令起服务
- **多供应商**：MiniMax、即梦 Seedance、可灵、PixVerse、Vidu、通义万相 / HappyHorse
- **Key 可视化配置**：管理员在界面上填写，加密入库、只显示掩码、免重启生效
- **不限制用量**：只做账号登录，不设配额（费用由 API 账户余额控制）

---

## 功能一览

| 模块 | 能力 |
| --- | --- |
| **视频** | 文生视频、图生视频（首帧）、首尾帧过渡、多张参考图；可拖拽时长、按模型规格批量生成、音频开关、提示词优化 |
| **图片** | 文生图、多张批量（最多 4 张）、多种比例与尺寸、提示词优化 |
| **作品库** | 历史记录、关键词搜索、我的 / 团队切换、收藏、下载、公开分享链接 |
| **余额与积分** | DeepSeek 共享账户余额、PixVerse 个人积分可在站内查询；其他供应商提供控制台快捷入口 |
| **提示词库** | 个人收藏 + 共享大厅，标签分类、一键填入、使用次数统计 |
| **账号** | 管理员开号 / 重置密码 / 停用；普通成员看不到管理入口 |
| **模型设置** | 9 家供应商凭据管理、免费连通性测试、启用 / 停用 |

管理员可在「我的模型 Key」页面配置**团队共享的提示词优化服务**。默认使用 DeepSeek API（`https://api.deepseek.com`，模型 `deepseek-flash`）；填入一次 API Key 后，全体成员均可使用，密钥加密存储且界面只显示掩码。

**模型目录**（33 个可用模型，另有 1 个暂未开放型号仅供查看；目录在 `src/lib/models.ts` 中声明）

| 供应商 | 视频模型 | 图片模型 |
| --- | --- | --- |
| MiniMax 海螺 | H3 Max、H3 | image-01 |
| 即梦 / 豆包（火山方舟） | Seedance 2.5、Seedance 2.0 Fast | Seedream 5.0 Pro、Seedream 5.0 Flash |
| 可灵 Kling | 3.0、2.6、3.0 Turbo | — |
| 爱诗科技 PixVerse | C1、V6 Max、V6、V5.6 | — |
| 生数科技 Vidu | Q3 Pro、Q3 Turbo | — |
| 通义万相 / 千问 / HappyHorse | 万相 3.0 / 3.0 Prime（预览）、HappyHorse 1.1、万相 2.7 | 万相 2.7 / 2.7 Pro、千问图像 3.0 / 3.0 Pro、万相 2.6 |
| OpenAI | — | GPT Image 2.5 Sunburst、Flare |
| Google Gemini | Omni Flash | Nano Banana 2、2 Lite、Pro、2.1 |

> OpenAI Sora 视频 API 已于 2026-09-24 下线；Google Imagen 已停用，Veo 3.1 预览 API 的退役日期为 2026-10-22。因此当前接入使用 Google Gemini Omni Flash 视频生成与 Nano Banana 图片模型。

> 可灵 4.0 已加入目录并以灰色显示“暂未开放”，不会提交生成请求。官方 API 页面目前标注为抢先体验，需获得开放资格并完成正式适配后才能启用。万相 3.0 / 3.0 Prime 当前按官方预览 API 接入；PixVerse C1 已接入现有文生、图生和首尾帧流程。

> 各家的 Base URL、鉴权方式、请求参数差异都封装在 `src/lib/adapters/` 里，工作台只按「供应商 + 模型」下发任务。

---

## 工作台怎么用

### 布局：整屏不滚动

工作台是**工具型布局**，页面本身不滚动：

```
┌─────────────────────────────────────────────────────────┐
│ 嗨，XX，想做点什么？   作品 12 · 供应商 2 · 模型 17   [提示词模板] [作品库] │
├───────────────────┬─────────────────────────────────────┤
│                   │                                     │
│  参数表单          │   最近生成（独立滚动）                │
│  （独立滚动）      │   ┌────┐ ┌────┐ ┌────┐               │
│                   │   └────┘ └────┘ └────┘               │
│                   │                                     │
├───────────────────┤                                     │
│ H3 Max·768P·8秒·2条│                                    │
│ [    生成视频     ]│  ← 提交按钮常驻，不用滚动去找          │
└───────────────────┴─────────────────────────────────────┘
```

- 左侧填参数、右侧看结果，两边各自滚动，互不影响
- 提交按钮固定在左下角，上方一行实时显示当前配置摘要
- 窗口窄于 1024px 时提交按钮浮动在屏幕底部

### 生成方式

视频支持四种生成方式，切换标签只展示对应的上传区：

| 方式 | 说明 |
| --- | --- |
| **文生视频** | 只给提示词，画面比例可选（16:9 / 9:16 / 1:1 等） |
| **首帧** | 上传一张图作为起始画面，比例跟随图片 |
| **首尾帧** | 首帧 + 尾帧，生成从起点到终点的过渡动画 |
| **参考图** | 上传主体 / 风格参考图（最多 9 张），保持角色或风格一致 |

> 首尾帧与参考图是两种互斥机制，界面已按供应商能力自动控制可选项，服务端也会二次校验。

### 控件按模型能力动态显示

各家能力差异很大，所以不支持的控件**不会出现**（服务端会再次校验并返回中文原因）：

| 模型 | 时长区间 | 生成音频 | 参考图 | 提示词优化 |
| --- | --- | --- | --- | --- |
| MiniMax H3 Max | 5–15 秒 | ✗ | ✓ 最多 9 张 | 关闭 / 均衡 / 高质量 |
| MiniMax H3 | 4–15 秒 | ✗ | ✓ 最多 9 张 | ✗ |
| Seedance 2.5 | 4–30 秒 | ✓ | ✓ 最多 4 张 | ✗ |
| Seedance 2.0 Fast | 4–15 秒 | ✓ | ✗ | ✗ |
| 可灵 3.0 / 3.0 Turbo | 3–15 秒 | ✓ | ✗ | ✗ |
| 可灵 2.6 | 5 或 10 秒 | ✓ | ✗ | ✗ |
| PixVerse V6 Max / V6 | 1–15 秒 | ✓ | ✗ | ✗ |
| PixVerse V5.6 | 5 / 8 / 10 秒 | ✓ | ✗ | ✗ |
| Vidu Q3 Pro / Turbo | 1–16 秒 | ✓ | ✗ | ✗ |
| HappyHorse 1.1 | 3–15 秒 | ✗ | ✗ | ✓ |
| 通义万相 2.7 | 2–15 秒 | ✗ | ✗ | ✓ |

### 关于生成数量与费用

「生成数量」是**同一提示词提交多条独立任务**——每条单独排队、单独计费、失败互不影响。选 3 条就是 3 倍费用，建议先用 1 条调好提示词。

---

## 一、内网部署（给同事用）

### 0. 准备

- 一台**常开**的 Windows 机器或内网服务器
- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows 需要 WSL2）

### 1. 配置

```powershell
cd D:\code\Github\AIGC
Copy-Item .env.example .env
notepad .env
```

只需要改这一项（**必须改**）：

```ini
ADMIN_PASSWORD=换成一个强密码
```

API Key **不用写在这里**：启动后登录管理员账号，进「模型设置」页面可视化填写即可（支持多家供应商，加密存储、免重启生效）。

如果想第一次启动就能用，也可以顺手填：

```ini
MINIMAX_API_KEY=你的Key
```

### 2. 启动

```powershell
docker compose up -d --build
```

首次构建大约几分钟。启动后检查：

```powershell
docker compose ps
docker compose logs -f app
```

看到 `Ready` 即可。访问 <http://127.0.0.1:3000> 用 `admin` + 你设置的密码登录。

### 3. 让同事访问

1. 查本机内网 IP：

   ```powershell
   ipconfig
   ```

   找到「IPv4 地址」，例如 `192.168.0.80`。

2. **放行防火墙**（Windows 默认会拦截，必须做一次，**用管理员身份打开 PowerShell**）：

   ```powershell
   New-NetFirewallRule -DisplayName "造境 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

   > 非管理员执行会报「Access is denied」，右键开始菜单 → 「终端(管理员)」再运行。

3. 同事浏览器打开 `http://<本机内网IP>:3000`。

> 建议在路由器里给这台机器绑定固定 IP（DHCP 静态分配），否则重启后 IP 可能变化。
>
> 如果公司网络有 AP 隔离 / 访客网络，需要让设备处于同一内网。

### 4. 建账号

登录后左侧「用户管理」→ 新建账号 → 把用户名和密码发给同事。普通成员看不到用户管理入口。

### 5. 日常运维

```powershell
docker compose logs -f app       # 看应用日志
docker compose logs -f worker    # 看任务队列日志
docker compose restart app       # 重启应用
docker compose down              # 停止（数据保留）
docker compose up -d             # 再启动
docker compose up -d --build     # 升级代码后重建
```

数据都在 Docker volume 里：`pgdata`（数据库）、`media`（图片 / 视频文件），`docker compose down` 不会删除。

备份：

```powershell
docker run --rm -v aigc_pgdata:/data -v ${PWD}:/backup alpine tar czf /backup/pgdata-backup.tar.gz -C /data .
docker run --rm -v aigc_media:/data -v ${PWD}:/backup alpine tar czf /backup/media-backup.tar.gz -C /data .
```

健康检查（无需登录）：

```powershell
curl http://127.0.0.1:3000/api/health
```

返回 `db`、`worker.alive` 与各供应商是否已配置。

### 6. 配置各家模型 Key（模型设置）

登录管理员账号 → 左侧「模型设置」。可视化填写各家的凭据，**保存后立即生效，不需要改文件、不需要重启容器**。

| 供应商 | 鉴权方式 | 控制台 |
| --- | --- | --- |
| MiniMax 海螺 | `Authorization: Bearer` | <https://platform.minimax.cn/user-center/basic-information/interface-key> |
| 即梦 / 豆包（火山方舟） | `Authorization: Bearer` | <https://console.volcengine.com/ark> |
| 可灵 Kling | `Authorization: Bearer`（**新版 API Key，不是 AK/SK**） | <https://klingai.com/dev/api-key> |
| 爱诗科技 PixVerse | `API-KEY` 请求头 | <https://platform.pixverse.ai> |
| 生数科技 Vidu | `Authorization: Token` | <https://platform.vidu.cn> |
| 通义万相 / HappyHorse | `Authorization: Bearer`（阿里云百炼） | <https://bailian.console.aliyun.com> |
| OpenAI | `Authorization: Bearer` | <https://platform.openai.com/api-keys> |
| Google Gemini | `x-goog-api-key` | <https://aistudio.google.com/apikey> |

页面上每家供应商都有：

- **API Key**：粘贴后点「保存」；界面上永远只显示掩码（`sk-cp-••••••••dpOM`），无法回显完整内容
- **Base URL**：国内站 / 国际站切换（例如 MiniMax 国际站填 `https://api.minimax.io`）
- **启用开关**：临时停用某家供应商，不用删 Key
- **测试连接**：**用的是输入框里当前的内容**，所以填完可以直接测，不用先保存；调用的是各家免费接口，不产生生成费用

**推荐操作顺序**：粘贴 Key → 点「测试连接」确认有效 → 点「保存」正式启用。

> 未保存时输入框上方会显示「有未保存的改动」提示。

**⚠️ 关于 `APP_SECRET`**：数据库里的凭据用 AES-256-GCM 加密保存，加密凭据是 `.env` 里的 `APP_SECRET`。
请把它当成密码保管，并且**不要随意更换**——换了之后之前保存的 Key 会无法解密，需要重新填写一遍。

---

## 二、本地开发

```powershell
# 1. 起一个本地 Postgres（端口避开已占用的 5432）
docker run -d --name aigc-dev-db -e POSTGRES_USER=aigc -e POSTGRES_PASSWORD=aigc -e POSTGRES_DB=aigc -p 55432:5432 postgres:17-alpine

# 2. 配置环境变量
Copy-Item .env.example .env
# 把 DATABASE_URL 改成 postgres://aigc:aigc@127.0.0.1:55432/aigc
# 没有 Key 时设 MINIMAX_MOCK=1 可以先看界面

# 3. 安装依赖 + 建表
pnpm install
pnpm db:migrate

# 4. 启动（两个终端）
pnpm dev       # Web: http://localhost:3000
pnpm worker    # 任务队列
```

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发服务器（0.0.0.0:3000） |
| `pnpm worker` | 任务队列进程 |
| `pnpm build` / `pnpm start` | 生产构建 / 启动 |
| `pnpm db:migrate` | 建表（幂等，启动时也会自动执行） |
| `pnpm reset-password <用户名> <新密码>` | 重置密码并解除停用 |
| `pnpm typecheck` | TypeScript 检查 |
| `pnpm check:utf8` | 源码 UTF-8 校验（改中文文案后建议跑一次） |

`MINIMAX_MOCK=1` 时：视频返回一个公开示例 MP4、图片返回带提示词的占位图，用于验证「提交 → 排队 → 生成 → 落盘 → 展示」整条链路，**不花钱**。

---

## 三、技术架构

```
浏览器（Next.js App Router · React 19 · Tailwind 4）
        │  fetch /api/*
        ▼
Next.js Route Handlers ── 鉴权（DB Session + scrypt）── Postgres
        │                                                 │
        │ ① 写入 assets(status=pending)                    │ 凭据加密存取
        ▼                                                 ▼
Worker（独立进程，SELECT … FOR UPDATE SKIP LOCKED 抢任务）
        │ ② 通过适配器调用对应供应商
        ▼
   适配器层 src/lib/adapters/
   ├─ minimax   (H3 / H3 Max / image-01)
   ├─ ark       (Seedance / Seedream)
   ├─ kling     (可灵 3.0 / 2.6)
   ├─ pixverse  (V6 / V5.6，含图片上传换取 img_id)
   ├─ vidu      (Q3 Pro / Turbo)
   └─ dashscope (HappyHorse / 万相)
        │ ③ 轮询任务状态
        ▼
   ④ 下载结果 → /data/media ── /api/media/[...] 支持 Range 播放
```

**任务生命周期**：`pending`（已创建）→ `running`（已提交 / 查询中）→ `succeeded` 或 `failed`。
轮询失败按指数退避重试，最多 6 次；超过 30 分钟无响应的任务会被判定超时失败，可在作品上点「重试」。

| 目录 | 说明 |
| --- | --- |
| `src/app/(app)/` | 登录后的主界面（工作台 / 作品库 / 提示词库 / 模型设置 / 用户管理） |
| `src/components/studio/` | 生成表单、图片上传组件 |
| `src/components/ui.tsx` | 基础组件（按钮 / 输入 / 分段控件 / 开关 / 滑块 / Toast / Modal） |
| `src/lib/adapters/` | 各供应商适配器与注册表 |
| `src/lib/providers.ts` | 供应商目录、凭据运行时读取（DB 优先，env 回退） |
| `src/lib/secrets.ts` | 凭据加解密（AES-256-GCM）与掩码 |
| `src/lib/models.ts` | 模型目录与能力声明 |
| `src/worker/` | 异步任务 Worker |
| `src/lib/schema.sql` | 表结构（幂等） |

### 加一个新模型 / 新供应商

**加模型**（供应商已接入）：在 `src/lib/models.ts` 加一条 `ModelSpec` 即可，工作台自动出现该模型，并按声明的 `durationRange` / `supportsAudio` / `supportsReferenceImages` 等决定显示哪些控件。

**加供应商**：

1. 在 `src/lib/adapters/` 新建适配器，实现 `ProviderAdapter`：
   - `submitVideo` + `pollVideo`（异步任务），`submitImage` + `pollImage`（同步返回 `urls` 或异步返回 `taskId`）
   - `verify`：免费鉴权检查，**不能消耗生成额度**（一般查余额或查询一个不存在的任务 ID）
2. 在 `src/lib/adapters/index.ts` 注册。
3. 在 `src/lib/providers.ts` 的 `PROVIDERS` 里加目录项（`credentialFields` 可声明多个凭据字段，例如 AK/SK）。
4. 在 `src/lib/models.ts` 加该供应商的模型。

凭据加密存储、掩码展示、测试连接入口都由框架自动处理。

---

## 四、接口速查

| 接口 | 说明 |
| --- | --- |
| `POST /api/generate` | 提交生成任务；视频的 `n>1` 会扇出多条，返回 `{ asset, assets[] }` |
| `GET /api/assets` | 作品列表（`scope=mine/team`、`kind`、`favorite`、`q`、`limit`、`offset`） |
| `PATCH /api/assets/:id` | 收藏 / 标题 / 公开 |
| `DELETE /api/assets/:id` | 删除作品（含本地文件） |
| `POST /api/assets/:id/retry` | 失败重试 |
| `POST /api/assets/:id/share` | 生成分享链接 |
| `POST /api/uploads` | 上传参考图（图片会先在前端压缩到 2048px 内） |
| `GET /api/media/*` | 读取媒体文件，支持 Range 拖动播放；未登录时需带 `?share=<token>` |
| `GET /api/health` | 健康检查（DB / Worker / 各供应商配置状态） |
| `GET /api/prompts` · `POST` · `PATCH/:id` · `DELETE/:id` | 提示词模板增删改查 |
| `GET /api/admin/providers` | 供应商列表（凭据只返回掩码） |
| `PUT /api/admin/providers/:id` | 保存凭据 / Base URL / 启用状态 |
| `POST /api/admin/providers/:id/test` | 连通性测试（可带未保存的凭据，不消耗额度） |
| `GET /api/admin/users` · `POST` · `PATCH/:id` | 用户管理（仅管理员） |

---

## 五、费用参考

以下为**调研时各家官方文档 / 定价页的公开单价**，仅用于估算，实际以你账号控制台为准：

| 供应商 | 计费单位 | 参考单价 |
| --- | --- | --- |
| MiniMax（国际站，USD） | 按秒 / 按张 | H3-Max：480P $0.05/秒、768P $0.08/秒；H3：768P $0.08/秒、2K $0.13/秒；image-01：$0.0035/张 |
| 可灵 Kling | 积分（1 积分 ≈ 1 元） | 3.0 Turbo：720P 0.8/秒、1080P 1.0/秒；2.6 无声：720P 0.3/秒、1080P 0.5/秒 |
| PixVerse | Credits（225 Credits ≈ 1 USD） | V6：720P 静音约 9 Credits/秒 |
| Vidu | 积分（1 积分 ≈ 0.031 元） | Q3 Pro：1080p 24 积分/秒、720p 20、540p 9；错峰（off_peak）半价 |
| 通义万相 | 按秒 | 万相 2.7 文生视频：720P ¥0.6/秒、1080P ¥1/秒 |
| 火山方舟 Seedance | — | 未核到公开单价，请在火山控制台查看 |

**几点省钱的常识**：

- 分辨率越高越贵（480P 通常只有 1080P 的一半左右）
- 时长直接乘倍数；「生成数量 N 条」就是 N 倍费用
- 各家的**生成失败 / 审核不通过一般不计费**（MiniMax、Vidu 文档均明确）
- 输入参考图超过免费张数会后加收费（MiniMax：H3-Max 前 2 张免费，之后 $0.074/张）
- 先用 1 条 + 低分辨率调好提示词，再用高配置出片

---

## 六、常见问题

**任务一直「排队中」**
Worker 没起来。`docker compose logs worker` 看日志；本地开发时确认 `pnpm worker` 在跑。

**填写了 Key 却提示「还缺少：API Key」**
「测试连接」用的是输入框里的实时内容，正常不会出现这个提示。如果出现，说明该字段确实为空——请确认粘贴完整后重试。

**提示「还没有配置凭据」/ 生成报 1004、401**
到「模型设置」页面填写并点「测试连接」确认有效。保存即时生效，不需要重启。若 Key 是刚写进 `.env` 的，则需要 `docker compose up -d` 才会被读入。

**「账户余额不足」（错误码 1008）**
去对应平台控制台充值，例如 MiniMax：<https://platform.minimax.cn/user-center/finance/recharge>。
充值后不用重启，对失败作品点「重试」即可。

**提示「不支持参考图 / 不支持音频开关 / 时长需要在 x–y 秒之间」**
这是按模型能力做的校验，看上面「控件按模型能力动态显示」表换一个模型，或改用首帧方式。

**换了 `APP_SECRET` 之后，已保存的 Key 全部失效**
`APP_SECRET` 是解密凭据，更换后旧密文无法解开。重新在「模型设置」里填一遍即可。

**图生视频报「无法下载参考图」**
程序默认把参考图以内联 base64 提交，内网部署也能用。若某家仍报此错，说明它只接受公网可访问的图片 URL，需要额外配置图床。

**同事打不开页面**
- 确认同一 WiFi / 内网，且没有开访客网络隔离
- 检查 Windows 防火墙 3000 端口（见部署第 3 步）
- 用 `http://IP:3000`，不要用 https
- 手机热点 / 公司 VPN 可能导致跨网段

**视频在 iPhone 上不播放**
本服务返回标准 MP4（H.264）。若个别浏览器仍异常，点作品详情里的「新窗口打开」验证源文件。

**磁盘越来越大**
视频文件较大，定期清理不需要的作品；建议给 `media` volume 所在磁盘留足空间（≥ 100GB）。

**忘记管理员密码**

```powershell
docker compose exec app pnpm reset-password admin 新密码
```

会同时解除停用状态。

---

## 七、自测脚本

改完代码后可以跑这些脚本自检（都需要服务已启动）：

| 脚本 | 覆盖范围 | 费用 |
| --- | --- | --- |
| `node scripts/e2e-smoke.mjs` | 登录、上传、图生视频、批量生图、Range 播放、分享、权限隔离等 20 项 | 需 `MINIMAX_MOCK=1` |
| `node scripts/video-features-e2e.mjs` | 生成数量扇出、时长校验、音频 / 优化 / 参考图能力校验等 13 项 | 需 `MINIMAX_MOCK=1` |
| `node scripts/provider-e2e.mjs` | 模型设置页 17 项（掩码不泄露、保存生效、权限） | 免费 |
| `node scripts/test-draft-credentials.mjs` | 「填了未保存也能测」（已有凭据时自动跳过写入型断言） | 免费 |
| `node scripts/real-video-check.mjs` | 真实视频回归（480P 5 秒，自动清理测试作品） | 会产生少量费用 |
| `node scripts/real-image-check.mjs` | 真实图片回归（1 张） | 会产生少量费用 |
| `pnpm check:utf8` | 源码 UTF-8 校验 | 免费 |
