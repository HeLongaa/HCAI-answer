# HCAI Answer

HCAI Answer 是基于 Apache Answer 二次开发的社区问答与 AI 工具平台。项目在原有问答、标签、用户、徽章、后台管理能力之上，扩展了 AI 对话、图片生成、订阅套餐、积分体系、任务广场、精选帖子和实时刷新等功能。

## 功能概览

- 问答社区：发帖、回答、评论、标签、收藏、徽章、用户主页。
- AI 对话：多模型配置、模型映射、消耗点数、订阅套餐、兑换码。
- 图片生成：文生图、参考图、图片编辑、生成历史、刷新后恢复生成任务。
- 积分体系：用户积分账户、积分流水、用户菜单积分展示、后台用户积分展示。
- 任务广场：任务发布、任务领取、任务提交、后台任务审核和奖励发放。
- 精选帖子：帖子精选、积分奖励、取消精选、自动加入保留标签。
- 实时更新：发帖、精选、标签、任务、积分等状态通过实时事件刷新前端列表。
- 后台管理：AI 配置、任务管理、精选帖子、用户管理、站点设置等。

## 技术栈

- 后端：Go、Gin、Xorm、SQLite/MySQL/PostgreSQL
- 前端：React、TypeScript、Bootstrap、SWR
- 构建：Makefile、pnpm、Wire、Swag

## 环境要求

- Go >= 1.24
- Node.js >= 20
- pnpm >= 9
- mockgen >= 0.6.0
- wire >= 0.5.0

可以用下面命令启用 pnpm：

```bash
corepack enable
corepack prepare pnpm@9.7.0 --activate
```

## 本地开发

安装依赖并构建前端：

```bash
make install-ui-packages
make ui
```

生成代码并构建后端：

```bash
make generate
make build
```

初始化本地数据目录：

```bash
./answer init -C ./data
```

启动后端：

```bash
./answer run -C ./data
```

默认配置文件会生成在：

```text
./data/conf/config.yaml
```

如果需要前端开发服务器，可以进入 `ui` 目录按项目脚本启动：

```bash
cd ui
pnpm pre-install
pnpm start
```

## 常用命令

```bash
# 构建前端静态资源
make ui

# 构建后端二进制
make build

# 清理构建产物
make clean

# 运行 Go 测试
go test ./...

# 前端类型检查
cd ui && pnpm exec tsc --noEmit

# 前端 lint
cd ui && pnpm lint
```

## 直接部署到服务器

推荐使用 systemd 托管应用，并用 Nginx 反向代理。

### 1. 准备目录

```bash
sudo mkdir -p /opt/hcai-answer /var/lib/hcai-answer
sudo chown -R $USER:$USER /opt/hcai-answer /var/lib/hcai-answer
```

把代码放到 `/opt/hcai-answer` 后构建：

```bash
cd /opt/hcai-answer
make ui
make build
```

### 2. 初始化配置

```bash
/opt/hcai-answer/answer init -C /var/lib/hcai-answer
```

配置文件位置：

```text
/var/lib/hcai-answer/conf/config.yaml
```

建议将服务监听改为本机端口，由 Nginx 对外暴露：

```yaml
server:
  http:
    addr: 127.0.0.1:9080
```

如果使用 SQLite，可以把数据、缓存、上传路径统一放在 `/var/lib/hcai-answer`：

```yaml
data:
  database:
    driver: "sqlite3"
    connection: "/var/lib/hcai-answer/sqlite3/answer.db"
  cache:
    file_path: "/var/lib/hcai-answer/cache/cache.db"
i18n:
  bundle_dir: "/var/lib/hcai-answer/i18n"
service_config:
  upload_path: "/var/lib/hcai-answer/uploads"
```

正式环境也可以在安装流程中选择 MySQL 或 PostgreSQL。

### 3. 配置 systemd

创建 `/etc/systemd/system/hcai-answer.service`：

```ini
[Unit]
Description=HCAI Answer
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/hcai-answer
ExecStart=/opt/hcai-answer/answer run -C /var/lib/hcai-answer
Restart=always
RestartSec=5
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

授权并启动：

```bash
sudo chown -R www-data:www-data /opt/hcai-answer /var/lib/hcai-answer
sudo systemctl daemon-reload
sudo systemctl enable hcai-answer
sudo systemctl start hcai-answer
sudo systemctl status hcai-answer
```

### 4. 配置 Nginx

创建 `/etc/nginx/sites-available/hcai-answer`：

```nginx
server {
  listen 80;
  server_name your-domain.com;

  location / {
    proxy_pass http://127.0.0.1:9080;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/hcai-answer /etc/nginx/sites-enabled/hcai-answer
sudo nginx -t
sudo systemctl reload nginx
```

HTTPS 可以使用 certbot 配置：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

## 更新发布

直接部署方式：

```bash
cd /opt/hcai-answer
git pull
make ui
make build
sudo systemctl restart hcai-answer
```

更新前建议备份数据目录：

```bash
sudo tar czf hcai-answer-data-$(date +%F).tar.gz /var/lib/hcai-answer
```

## 重要配置入口

- 站点配置：后台管理 > 站点设置
- AI 对话配置：后台管理 > AI-CHAT 配置
- 图片模型配置：后台管理 > AI-CHAT 配置 > 图片生成相关配置
- 任务管理：后台管理 > 内容管理 > 任务管理
- 精选帖子：后台管理 > 内容管理 > 精选帖子
- 用户积分：用户菜单 > 我的积分

## 数据目录

直接部署推荐使用 `/var/lib/hcai-answer` 作为数据目录。其中通常包含：

- `conf/config.yaml`：应用配置
- `sqlite3/answer.db`：SQLite 数据库
- `uploads/`：上传文件与生成图片
- `cache/`：缓存文件
- `i18n/`：语言包

生产环境请定期备份数据目录和外部数据库。

## 上游项目

本项目基于 Apache Answer 开发。上游项目地址：

- 官网：https://answer.apache.org
- 仓库：https://github.com/apache/answer

## License

Apache License 2.0
