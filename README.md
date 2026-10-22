# AIGC 工坊

团队内部使用的 AI 图片 / 视频生成工作台。部署在一台内网机器上，同事用浏览器访问，作品自动归档、可收藏、可分享、提示词可复用。

界面参考 [Uiverse](https://uiverse.io/) 的组件风格做了统一升级：玻璃拟态面板、渐变描边、按钮扫光、卡片悬浮放大、滑动的分段控件与开关、环形渐变加载器，并遵循 `prefers-reduced-motion` 在系统设置「减少动态效果」时自动降级。

- **视频**：MiniMax H3 Max / H3、即梦 Seedance 2.5 / 2.0、可灵 3.0 / 2.6、PixVerse V6 Max、Vidu Q3 Pro、通义万相 2.7 / HappyHorse 1.1；全部支持文生视频与图生视频（首帧 / 首尾帧按各家能力）
- **图片**：MiniMax image-01、豆包 Seedream 5.0、通义万相 2.6，支持多张批量与多种比例
- **模型设置**：各家 API Key / 凭据可视化填写（加密入库、界面只显示掩码、免重启生效、免费连通性测试）
- **账号**：管理员开号，登录使用；不限制用量
- **作品库**：历史、搜索、收藏、下载、公开分享链接
- **提示词库**：个人 / 共享大厅，一键复用

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

   找到「IPv4 地址」，例如 `192.168.1.23`。

2. **放行防火墙**（Windows 默认会拦截，必须做一次，**用管理员身份打开 PowerShell**）：

   ```powershell
   New-NetFirewallRule -DisplayName "AIGC Studio 3000" -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow
   ```

   > 非管理员执行会报「Access is denied」，右键开始菜单 → 「终端(管理员)」再运行。

3. 同事浏览器打开 `http://<本机内网IP>:3000`（本机 IP 用 `ipconfig` 查看，例如 `http://192.168.0.80:3000`）。

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
```

数据都在 Docker volume 里：`pgdata`（数据库）、`media`（图片/视频文件），`docker compose down` 不会删除。

备份：

```powershell
docker run --rm -v aigc_pgdata:/data -v ${PWD}:/backup alpine tar czf /backup/pgdata-backup.tar.gz -C /data .
docker run --rm -v aigc_media:/data -v ${PWD}:/backup alpine tar czf /backup/media-backup.tar.gz -C /data .
```

升级代码后：

```powershell
docker compose up -d --build
```

### 6. 配置各家模型 Key（模型设置）

登录管理员账号 → 左侧「模型设置」。这里可以可视化填写多家供应商的 API Key，**保存后立即生效，不需要改文件、不需要重启容器**。

| 供应商 | 状态 | 能生成什么 | 鉴权方式 |
| --- | --- | --- | --- |
| MiniMax 海螺 | ✅ 已接入 | 视频（H3 / H3 Max）+ 图片（image-01） | `Bearer` API Key |
| 即梦 / 豆包（火山方舟） | ✅ 已接入 | 视频（Seedance 2.5 / 2.0）+ 图片（Seedream 5.0） | `Bearer` API Key |
| 可灵 Kling | ✅ 已接入 | 视频（3.0 / 2.6 / 3.0 Turbo） | `Bearer` API Key |
| 爱诗科技 PixVerse | ✅ 已接入 | 视频（V6 Max / V6 / V5.6） | `API-KEY` 头 |
| 生数科技 Vidu | ✅ 已接入 | 视频（Q3 Pro / Q3 Turbo） | `Token` 前缀 |
| 通义万相 / HappyHorse | ✅ 已接入 | 视频（万相 2.7 / HappyHorse 1.1）+ 图片（万相 2.6） | `Bearer` API Key |
| OpenAI / Google / Runway | 待接入 | — | 可先存 Key 备用 |

各家 Base URL 默认值已填好（国内站点）。如果账号在海外站点，把 Base URL 改成对应域名即可（例如 MiniMax 国际站 `https://api.minimax.io`）。

**图生视频说明**：参考图默认以内联 base64 方式提交，因此内网部署（没有公网图片地址）也能用。
唯一例外是 PixVerse——它要求先调用官方上传接口换取 `img_id`，程序已自动处理。
如果某家反馈「无法下载参考图」，通常说明该供应商只接受公网可访问的图片 URL，这时需要额外配置公网图床。

页面上每家供应商都有：

- **API Key**：粘贴后保存；界面上永远只显示掩码（`sk-cp-••••••••dpOM`），无法回显完整 Key
- **Base URL**：国内站 / 国际站切换（例如 MiniMax 国际站填 `https://api.minimax.io`）
- **启用开关**：临时停用某家供应商，不用删除 Key
- **测试连接**：不发真实生成请求、不花钱，只校验 Key 是否有效（会记录上次测试结果）

> 「待接入」的供应商可以先存 Key，等适配器写好会自动生效，不用再改配置。

**⚠️ 关于 `APP_SECRET`**：数据库里的 Key 用 AES-256-GCM 加密保存，加密凭据是 `.env` 里的 `APP_SECRET`。
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

`MINIMAX_MOCK=1` 时：视频会返回一个公开示例 MP4，图片返回带提示词的占位图，用于验证完整链路。

---

## 三、技术架构

```
浏览器 (Next.js App Router / React 19 / Tailwind 4)
        │  fetch /api/*
        ▼
Next.js Route Handlers ── 鉴权（DB Session + scrypt）── Postgres
        │                                   │
        │ 写入 assets(status=pending)        │
        ▼                                   ▼
Worker（独立进程，SKIP LOCKED 抢任务）
        │  MiniMax H3 / H3-Max / image-01
        ▼
下载结果 → /data/media ── /api/media/[...] 支持 Range 播放
```

| 目录 | 说明 |
| --- | --- |
| `src/app` | 页面与 API 路由 |
| `src/app/(app)` | 登录后的主界面（工作台 / 作品库 / 提示词 / 模型设置 / 用户管理） |
| `src/components/studio` | 生成表单与上传组件 |
| `src/lib/adapters/` | 各供应商适配器（minimax / ark / kling / pixverse / vidu / dashscope） |
| `src/lib/adapters/index.ts` | 适配器注册表，按 `provider` 分发 |
| `src/lib/providers.ts` | 供应商目录 + 凭据运行时读取（DB 优先，env 回退） |
| `src/lib/secrets.ts` | 凭据加解密（AES-256-GCM）与掩码 |
| `src/lib/models.ts` | 模型目录（供应商 × 模型），加新模型改这里 |
| `src/worker` | 异步任务 Worker（按 provider 分发提交与轮询） |
| `src/lib/schema.sql` | 表结构（幂等，启动自动执行） |
| `scripts/e2e-smoke.mjs` | 端到端冒烟测试（20 项） |
| `scripts/provider-e2e.mjs` | 模型设置页测试（17 项） |
| `scripts/check-utf8.mjs` | 源码 UTF-8 校验（`pnpm check:utf8`，改文案后建议跑一次） |

### 加一个新模型 / 新供应商

**加模型**（供应商已接入）：在 `src/lib/models.ts` 里加一条 `ModelSpec` 即可，工作台会自动出现该模型。

**加供应商**：

1. 在 `src/lib/adapters/` 新建适配器，实现 `ProviderAdapter`（`submitVideo` + `pollVideo`，图片则实现 `submitImage` + `pollImage`，以及免费的 `verify`）。
2. 在 `src/lib/adapters/index.ts` 注册。
3. 在 `src/lib/providers.ts` 的 `PROVIDERS` 里加供应商目录（含 `credentialFields`，多凭据供应商可声明多个字段）。
4. 在 `src/lib/models.ts` 里加该供应商的模型。

「模型设置」页面会自动出现新供应商，凭据加密存储与掩码展示都由框架处理。

---

## 四、接口速查

| 接口 | 说明 |
| --- | --- |
| `POST /api/generate` | 提交生成任务（视频/图片） |
| `GET /api/assets` | 作品列表（`scope=mine/team`、`kind`、`favorite`、`q`） |
| `PATCH /api/assets/:id` | 收藏 / 标题 / 公开 |
| `POST /api/assets/:id/retry` | 失败重试 |
| `POST /api/assets/:id/share` | 生成分享链接 |
| `POST /api/uploads` | 上传参考图 |
| `GET /api/media/*` | 读取媒体文件（支持 Range） |
| `GET /api/health` | 健康检查（DB / Worker / 各供应商配置） |
| `GET /api/admin/providers` | 供应商列表（Key 只返回掩码） |
| `PUT /api/admin/providers/:id` | 保存 Key / Base URL / 启用状态 |
| `POST /api/admin/providers/:id/test` | 连通性测试（不消耗额度） |

---

## 五、常见问题

**任务一直「排队中」**
Worker 没起来。`docker compose logs worker` 看日志；本地开发时确认 `pnpm worker` 在跑。
（另：如果 MiniMax 已经在生成但界面长期不动，检查 worker 日志里有没有 `retry in ...` 的循环。）

**提示「还没有配置 API Key」/ 生成报 1004**
到「模型设置」页面填写 Key 并点「测试连接」确认有效。保存即时生效，不需要重启。
如果 Key 是刚在 `.env` 里改的，则需要 `docker compose up -d` 才会被读入。

**「账户余额不足」（错误码 1008）**
MiniMax 账户需要充值：<https://platform.minimax.cn/user-center/finance/recharge>。
充值后不用重启，对失败作品点「重试」即可。

**换了 `APP_SECRET` 之后，已保存的 Key 全部失效**
`APP_SECRET` 是解密凭据，更换后旧密文无法解开。重新在「模型设置」里填一遍 Key 即可。

**同事打不开页面**
- 确认同一 WiFi / 内网，且没有开访客网络隔离
- 检查 Windows 防火墙 3000 端口
- 用 `http://IP:3000`，不要用 https
- 手机热点 / 公司 VPN 可能导致跨网段

**视频在 iPhone 上不播放**
本服务返回的标准 MP4（H.264）。若个别浏览器仍异常，点作品详情里的「新窗口打开」验证源文件。

**磁盘越来越大**
视频文件较大，定期清理不需要的作品；或给 `media` volume 所在磁盘留足空间（建议 ≥ 100GB）。

**忘记管理员密码**

```powershell
docker compose exec app pnpm reset-password admin 新密码
```

如果所有管理员都进不去了，用上述命令重置 `admin` 即可（会同时解除停用状态）。
