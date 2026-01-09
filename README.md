# To-Reads RSS 阅读器

一个轻量级 RSS 阅读器，支持 RSS / Atom / JSON Feed，支持分类管理与缓存抓取。前端提供站点与文章摘要浏览，点击标题即可跳转原文。

## 功能特性

- 支持 RSS、Atom、JSON Feed 三种格式解析
- 每隔 1 小时自动抓取，记录抓取时间与状态
- 添加站点时可选择分类
- 按分类展示站点名、标题、时间、摘要，并按发布时间倒序排序
- 技术栈：Golang + PostgreSQL + React + TailwindCSS + shadcn-ui 风格组件

## 项目结构

```
.
├── backend         # Go API 服务
├── frontend        # React 前端
└── docker-compose.yml
```

## 快速开始（Docker Compose）

确保已安装 Docker 与 Docker Compose，然后执行：

```bash
docker compose up --build
```

服务说明：

- 前端：<http://localhost:3002>
- 后端：<http://localhost:8080>
- PostgreSQL：localhost:5432（数据库名 rss）

> 前端容器会通过 Nginx 代理 `/api` 到后端，因此浏览器侧无需配置跨域。

## 使用说明

1. 打开 <http://localhost:3002>
2. 在「分类」区域添加分类
3. 在「添加站点」区域填写站点名称与 Feed URL（RSS / Atom / JSON）并选择分类
4. 系统会立即抓取并每隔 1 小时自动刷新
5. 在「最新摘要」查看标题、摘要和发布时间，点击标题跳转原文

## API 概览

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | 健康检查 |
| GET | `/api/categories` | 获取分类列表 |
| POST | `/api/categories` | 新增分类 |
| GET | `/api/feeds` | 获取站点列表 |
| POST | `/api/feeds` | 新增站点 |
| GET | `/api/items` | 获取文章列表（按发布时间倒序） |

## 数据库表设计

- `categories`：分类信息
- `feeds`：站点信息，包含 `last_fetched_at` / `last_status` / `last_error`
- `items`：文章条目，按 `feed_id + guid` 去重

## 运行参数

后端支持以下环境变量：

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `postgres://postgres:postgres@localhost:5432/rss?sslmode=disable` | 数据库连接字符串 |
| `PORT` | `8080` | 后端端口 |
| `FETCH_INTERVAL_MINUTES` | `60` | 自动抓取间隔（分钟） |

## 本地开发（可选）

### 后端

```bash
cd backend
go run ./
```

### 前端

```bash
cd frontend
npm install
npm run dev
```

确保本地 PostgreSQL 已启动，且 `DATABASE_URL` 指向正确的数据库地址。
