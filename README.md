# open-source-showcase

Kaypal / JIUZHANG AI 开源精选平台（opensource.kaypal.cn）的两个核心组成部分之一：

- **目录商店**（`platform/oss-demo-storefront/`）— `store.opensource.kaypal.cn`，单页应用渲染 catalog.json 中收录的开源项目卡片并提供子域直链发车。

## 仓库结构

```
.
├── platform/
│   └── oss-demo-storefront/      # nginx 静态 SPA + Dockerfile + docker-compose
│       ├── index.html            # 入口 HTML
│       ├── app.js                # 加载 catalog.json、渲染卡片
│       ├── styles.css
│       ├── catalog.json          # 收录的开源项目（21 项，已部署 6 项候选）
│       ├── Dockerfile            # nginx:1.27-alpine + COPY 5 个文件
│       ├── docker-compose.yml
│       └── nginx-store.conf      # 反代 conf 模板（store.opensource.kaypal.cn → 127.0.0.1:8099）
└── README.md
```

## 部署

```bash
cd platform/oss-demo-storefront
docker compose up -d --build
# 镜像是 open-source-showcase-web:<version>
# 容器 open-source-showcase-web 暴露 127.0.0.1:8099:80
```

部署机需要 `nginx` 1.20+ 提供 `store.opensource.kaypal.cn` SSL 反代，参见 `nginx-store.conf`。

## 升级

- 修改 `catalog.json`（项目元数据放仓库；prod 通过 `scp` 覆盖）→ 升 image 版本号 → `docker compose up -d --build`。
- 当前 latest = `open-source-showcase-web:0.3.2`（21 项，6 个已部署 + 1 个 SaaS + 14 个候选）。

## 关于 catalog.json

- 顶层结构：`{meta: ..., items: [...]}`（**不是** `projects`）。
- `items` 元素必含字段：`id, name, license, launch_url, status, category, rating, score, repo_url, avatar, sub, deploy, risk, language`。
- `status` 取值：`已部署/已部署·UI 待修/部署筹备中/评审中/...`。
- 每加一个项目前：确认上层路由（`*.<domain>` 通配子域 + TLS）就绪；catalog 切「部署筹备中」→ 容器起好后改「已部署」+ 绑真实子域。

## 已知事项

- `nextchat` / `surveyking` / `openmaic` 容器 + `jninty` / `ballast` / `brit-ready` 静态 dist 在 prod 主机 `/opt/oss-demos/`，对应反向 nginx conf 在 `/etc/nginx/conf.d/*.opensource.kaypal.cn.conf`。
- prod 备份策略：`/opt/open-source-showcase/catalog.json.bak.<YYYYMMDDHHMMSS>` 每次推送前留底。
- 镜像版本号策略：每改 1 次 catalog.json 升 1 个 minor（0.3.0 → 0.3.1 → 0.3.2）。
