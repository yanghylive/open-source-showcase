# Jellyfish 部署方案（待大王拍板）

## 项目基本面
- **GitHub**: `Forget-C/Jellyfish`（6.13k stars, 1.06k forks）
- **License**: **纯 Apache-2.0**（无商业补充条款，合规可上公开子域）
- **栈**: FastAPI + React/Vite + pnpm + MySQL 9.0 + Redis 7 + RustFS（S3 兼容）+ Celery
- **i18n**: ✅ 内置 zh-CN（fallbackLng = 'zh-CN'，4 个完整翻译文件 + docs/README.zh.md）
- **官方 compose**：`deploy/compose/docker-compose.yml`（7 服务，端口 3306/6379/7788/8000/9000/9001）
- **业务**：端到端 AI 短剧工作台（剧本→分镜→角色一致性→镜头→视频→导出），含异步任务中心

## prod 侦察结果

- **磁盘**：`/opt` 58G 可用（够）
- **3306 端口已占用**（1Panel MariaDB）—— Jellyfish MySQL 需改 host 端口
- **Redis 容器 Exited**：可重起或 Jellyfish 自带
- **没有 jellyfish 目录**：全新 clone 到 `/opt/jellyfish`
- **docker compose v2.27.0** ✅

## 部署方案（path② 路径）

### 目录布局
```
/opt/jellyfish/                 # git clone 仓库
  deploy/compose/
    .env                        # 我从 .env.example 改
    docker-compose.yml          # 微调端口/反代
deploy/
  jellyfish.opensource.kaypal.cn.conf  # nginx 反代（80→301 https；443→前端 7788；/api→后端 8000）
  jellyfish-mysql.conf         # （可选）如走 host mariadb；这里走自带 MySQL
```

### 容器/端口分配
| 容器名 | 镜像 | 容器内端口 | host 端口 | 用途 |
|---|---|---|---|---|
| jellyfish-mysql | mysql:9.0 | 3306 | **33060**（避开 mariadb） | 主库 |
| jellyfish-redis | redis:7 | 6379 | 63790 | Celery broker |
| jellyfish-rustfs | rustfs/rustfs:latest | 9000/9001 | 9000/9001 | S3 对象存储 |
| jellyfish-backend | 自建（FastAPI） | 8000 | 8000 | API |
| jellyfish-celery | 自建（Celery worker） | — | — | 异步任务 |
| jellyfish-front | 自建（nginx + vite dist） | 80 | 7788 | Web UI |
| jellyfish-backend-init-db | 自建 | — | — | DB schema 初始化 |
| jellyfish-mysql-init-sql | mysql:9.0 | — | — | 跑 SQL 文件 |

### 镜像拉取坑（复用经验）
- 大镜像（mysql/rustfs）走 **ghcr.nju.edu.cn** 或 docker.m.daocloud.io 镜像
- daemon.json registry-mirrors 已配（见 prod 配置）

### nginx 反代 conf
```nginx
server {
    listen 80;
    server_name jellyfish.opensource.kaypal.cn;
    return 301 https://$host$request_uri;
}
server {
    listen 443 ssl http2;
    server_name jellyfish.opensource.kaypal.cn;
    ssl_certificate     /etc/nginx/ssl/opensource-wildcard/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/opensource-wildcard/privkey.pem;
    
    # 前端
    location / {
        proxy_pass http://127.0.0.1:7788;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    # 后端 API + WebSocket
    location /api/ {
        proxy_pass http://127.0.0.1:8000/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    location /ws {
        proxy_pass http://127.0.0.1:8000/ws;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 600s;
    }
    client_max_body_size 200m;
}
```

### 域名选择
- **`jellyfish.opensource.kaypal.cn`**（用户友好、英文标识清晰）
- **`drama.opensource.kaypal.cn`**（中文受众更直观）

→ 你定一下，我用你给的。

### LLM 接入
- Jellyfish 后端 env `OPENAI_API_KEY` 决定 LLM 调用
- **空 OPENAI_API_KEY**：UI 可进、能创建项目/章节，但脚本生成/分镜拆解/对话生成会失败
- **接 kaypal 网关**：需要看 Jellyfish backend 是否支持 OpenAI 兼容自定义 base URL（默认只读 OPENAI_API_KEY 走 OpenAI）
- **可选**：`OPENAI_API_BASE=http://kaypal.cn/api/v1` + `OPENAI_API_KEY=<key>`

**等大王提供**：kaypal 模型网关的一个 key（或确认走其他 OpenAI 兼容端点）

### 风险点
1. **前端 BACKEND_URL**：默认 `http://localhost:8000`，要走我们 nginx 反代必须改成 `https://jellyfish.opensource.kaypal.cn/api`（不然浏览器跨域）
2. **CORS_ORIGINS**：compose 默认只允许 localhost:7788/127.0.0.1:7788，要加 `https://jellyfish.opensource.kaypal.cn`
3. **LLM 调用**：没 key 也部署，但生成功能不可用——**这是已知 blocker，不卡部署**
4. **首次 build 大**：backend 是 Python（uv）+ 依赖编译，可能 5-10 分钟；front 是 npm/pnpm build，2-5 分钟
5. **磁盘**：MySQL 数据 ~500MB、RustFS 视频资产可增长；预留 10G 给 `/opt/jellyfish`

### 时间预估
- clone 仓库：2 分钟
- 改 .env + compose 微调：5 分钟
- 拉镜像 + build：10-15 分钟（首次）
- 启动 + 健康检查 + init DB：5 分钟
- nginx conf + reload：2 分钟
- catalog 加条目 + store 重建：5 分钟
- **总计**：30-40 分钟

### 回滚方案
- `docker compose down -v` 删除所有容器和卷
- `/opt/jellyfish` 直接 `rm -rf`
- nginx conf 备份 + reload 旧版本
- catalog.json 备份 `catalog.json.bak.<时间戳>`

## 待大王确认 4 件事
1. **子域名**：`jellyfish.opensource.kaypal.cn` 还是 `drama.opensource.kaypal.cn`？
2. **LLM key**：能立即提供 kaypal 网关 key，还是先空着部署（用户能进 UI 但生成任务失败）？
3. **重启 1Panel MariaDB 还是 Jellyfish 自带 MySQL**？—— 我建议 Jellyfish 自带（33060 host 端口），数据干净
4. **all-clear 干**？

---

## 我打算执行的步骤（你 "干" 之后）
1. `git clone https://github.com/Forget-C/Jellyfish.git /opt/jellyfish`（prod 上）
2. 改 `/opt/jellyfish/deploy/compose/.env`：
   - MYSQL_PORT=33060（避 3306）
   - MYSQL_ROOT_PASSWORD/JELLYFISH_PASSWORD 强密码（用 openssl rand）
   - CORS_ORIGINS 加 `https://jellyfish.opensource.kaypal.cn`
   - BACKEND_URL=`https://jellyfish.opensource.kaypal.cn/api`
   - OPENAI_API_KEY=（空，等大王提供）
3. 改 compose 加 host 端口映射：`33060:3306` for mysql，`63790:6379` for redis
4. `docker compose up -d --build`（带镜像镜像 registry）
5. 等 7 容器健康 + init DB 完成（看 logs）
6. 写 nginx conf + `nginx -t` + `nginx -s reload`
7. 验证：公网 `https://jellyfish.opensource.kaypal.cn` → 200 + 中文 UI
8. catalog.json 加 jellyfish 条目（status=已部署，license=Apache-2.0），store 0.3.3 重建
9. 记日志