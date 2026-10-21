# AIGC 工坊

团队内部使用的 AI 图片 / 视频生成工作台。部署在一台内网机器上，同事用浏览器访问，作品自动归档、可收藏、可分享、提示词可复用。

- **视频**：MiniMax H3 Max（极速）、MiniMax H3（2K 高质量）；支持文生视频、图生视频（首帧 / 首尾帧）
- **图片**：MiniMax image-01，支持文生图、多张批量、多种比例
- **账号**：管理员开号，登录使用；不限制用量
- **作品库**：历史、搜索、收藏、下载、公开分享链接
- **提示词库**：个人 / 共享大厅，一键复用

---

## 一、内网部署（给同事用）

### 0. 准备

- 一台**常开**的 Windows 机器或内网服务器
- 安装 [Docker Desktop](https://www.docker.com/products/docker-desktop/)（Windows 需要 WSL2）
- MiniMax API Key：<https://platform.minimax.cn/user-center/basic-information/interface-key>

### 1. 配置

```powershell
cd D:\code\Github\AIGC
Copy-Item .env.example .env
notepad .env
```

至少改这两项：

```ini
MINIMAX_API_KEY=你的Key
ADMIN_PASSWORD=换成一个强密码
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
| `src/app/(app)` | 登录后的主界面（工作台 / 作品库 / 提示词 / 用户管理） |
| `src/components/studio` | 生成表单与上传组件 |
| `src/lib/minimax.ts` | MiniMax API 适配层（视频、图片、下载、错误码） |
| `src/lib/models.ts` | 模型目录，加新模型改这里 |
| `src/worker` | 异步任务 Worker |
| `src/lib/schema.sql` | 表结构（幂等，启动自动执行） |

### 加一个新模型

1. 在 `src/lib/models.ts` 里加一条 `ModelSpec`（`provider` 标记供应商）。
2. 在 `src/lib/minimax.ts`（或其他 provider 文件）实现提交 / 查询。
3. Worker 的 `submitJob` 按 `job.provider` 分发。

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
| `GET /api/health` | 健康检查（DB / Worker / Key） |

---

## 五、常见问题

**任务一直「排队中」**
Worker 没起来。`docker compose logs worker` 看日志；本地开发时确认 `pnpm worker` 在跑。

**提交时报「还没有配置 MINIMAX_API_KEY」**
改 `.env` 后必须 `docker compose up -d`（或 `docker compose restart app worker`）才会生效。

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
