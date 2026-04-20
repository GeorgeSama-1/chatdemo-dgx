# chatdemo-dgx

一个从零搭建的“公司品牌化 AI 对话 demo”，采用前后端分离结构：

- `frontend/`: Next.js 企业风格聊天界面
- `backend/`: FastAPI 模型代理服务
- `docs/`: 本次实现的设计与计划文档
- `.env.example`: 统一环境变量示例

## 功能概览

- 企业风格单页聊天界面
- 左上角品牌区域、产品名称、模型名称、服务状态
- 会话历史、新建会话、清空会话
- 欢迎语与推荐问题卡片
- 参数面板：`temperature`、`max_tokens`、`system prompt`
- Markdown 渲染与代码块显示
- 多模态图文问答，支持每条消息最多上传 4 张图片
- 流式输出与停止生成
- FastAPI 后端安全中转 OpenAI-compatible `chat/completions`

## 目录结构

```text
chatdemo-dgx/
├── frontend/
├── backend/
├── docs/
├── .env.example
└── README.md
```

## 环境要求

- Node.js 18+
- npm 9+
- Python 3.10+

## 环境变量

将根目录的 `.env.example` 作为参考，分别配置：

- `backend/.env`
- `frontend/.env.local`

常用变量如下：

### 后端

- `MODEL_BASE_URL`
  你的 DGX OpenAI-compatible 服务地址，例如 `http://your-dgx-host:8688/v1`
- `MODEL_API_KEY`
  模型服务 API key
- `MODEL_NAME`
  默认模型名
- `MODEL_ENABLE_THINKING`
  是否让模型输出 thinking / reasoning，聊天 demo 推荐设为 `false`
- `BACKEND_HOST`
  FastAPI 监听地址，默认 `0.0.0.0`
- `BACKEND_PORT`
  FastAPI 端口，默认 `22331`
- `REQUEST_TIMEOUT`
  上游请求超时时间，单位秒
- `UPLOADS_DIR`
  临时上传图片目录，默认 `.uploads`
- `MODEL_START_ENABLED`
  是否在一键启动/桌面启动时自动拉起模型服务
- `MODEL_CONDA_SH`
  `conda.sh` 路径，例如 `/home/your-user/miniforge3/etc/profile.d/conda.sh`
- `MODEL_CONDA_ENV`
  模型服务所在 conda 环境，例如 `vllm`
- `MODEL_START_COMMAND`
  真正的模型启动命令
- `MODEL_HEALTH_URL`
  启动脚本用于判断模型是否 ready 的健康检查地址

### 前端

- `NEXT_PUBLIC_API_BASE_URL`
  前端访问后端的地址，例如 `http://172.20.0.160:22331`
- `NEXT_PUBLIC_PRODUCT_NAME`
  产品名称
- `NEXT_PUBLIC_BRAND_NAME`
  品牌名称
- `NEXT_PUBLIC_BRAND_ACCENT`
  品牌主色
- `NEXT_PUBLIC_MODEL_LABEL`
  前端默认展示的模型名

## 启动后端

```bash
cd backend
python3 -m pip install --break-system-packages -r requirements-dev.txt
uvicorn app.main:app --host 0.0.0.0 --port 22331
```

启动后可访问：

- `http://localhost:22331/api/health`

本地多模态开发推荐拓扑：

- 前端：`http://127.0.0.1:12322`
- 后端：`http://127.0.0.1:22331`
- 多模态模型：另一台可访问服务器上的 `vLLM/OpenAI-compatible` 接口
- 图片先上传到本项目后端，再由后端转发给多模态模型

## 启动前端

```bash
cd frontend
npm install
npm run dev
```

启动后可访问：

- `http://localhost:12322`

## 一键启动

在仓库根目录直接运行：

```bash
make dev
```

如果你的环境里没有 `make`，也可以直接运行：

```bash
bash ./scripts/dev.sh
```

脚本会自动做这些事：

- 如果缺少 `backend/.env`，从根目录 `.env.example` 复制一份
- 如果缺少 `frontend/.env.local`，从根目录 `.env.example` 复制一份
- 如果缺少前端依赖，自动执行 `npm install`
- 如果缺少后端依赖，自动尝试安装
- 启动后端和前端

首次运行前，建议先把以下真实配置写入：

- `backend/.env` 中的 `MODEL_BASE_URL`、`MODEL_API_KEY`、`MODEL_NAME`
- `frontend/.env.local` 中的品牌和接口地址配置

只想让脚本做初始化、不真正启动服务时，可以运行：

```bash
make install-only
```

## GPU 服务器一键启动

如果你已经把项目部署到 GPU 服务器，并且当前配置如下：

- 后端：`172.20.0.160:22331`
- 前端：`172.20.0.160:12322`
- 模型服务：`http://172.20.0.160:8688/v1`

那么在 GPU 服务器上执行：

```bash
cd /home/hujing/chatdemo-dgx
make server-start
```

或：

```bash
bash ./scripts/server-start.sh
```

脚本会自动：

- 检查前后端依赖
- 后台启动 FastAPI 后端 `22331`
- 如有需要先构建前端
- 后台启动 Next.js 前端 `12322`
- 将日志写入 `.runtime/backend.log` 和 `.runtime/frontend.log`

停止服务：

```bash
cd /home/hujing/chatdemo-dgx
make server-stop
```

或：

```bash
bash ./scripts/server-stop.sh
```

### 在本机是否可以使用

可以，但要满足这些条件：

- GPU 服务器上的 `make server-start` 已执行成功
- 你的本机可以访问 `172.20.0.160`
- 公司内网或服务器防火墙没有拦住 `12322` 和 `22331`

满足以上条件后，你在本机浏览器里直接打开：

```text
http://172.20.0.160:12322
```

就可以使用页面。

如果页面能打开但发送消息时报 `Failed to fetch`，优先检查：

- GPU 服务器上的后端是否正常监听 `22331`
- `frontend/.env.local` 中的 `NEXT_PUBLIC_API_BASE_URL` 是否为 `http://172.20.0.160:22331`
- 本机能否访问：

```bash
curl http://172.20.0.160:22331/api/health
```

## 端口约定

当前推荐固定使用以下端口：

- 模型服务：`8688`
- 项目后端：`22331`
- 项目前端：`12322`

说明：

- 不建议使用通用的 `8000-9000` 端口范围作为本项目后端端口
- 这类端口在 GPU 服务器、Jupyter、推理服务、旧版 FastAPI 服务中很容易被占用
- 当前选择 `22331` 和 `12322`，目的就是尽量避开常见冲突端口

## DGX 桌面图标启动

如果你的 DGX 有 Ubuntu / GNOME / KDE 这类桌面环境，可以安装桌面图标：

```bash
cd /home/hujing/chatdemo-dgx
make desktop-install
```

安装后会生成两个桌面入口：

- `博微 智能助手`: 后台启动前后端并自动打开浏览器
- `停止 博微 智能助手`: 停止已启动的前后端服务

它们也会被安装到：

- `~/.local/share/applications/chatdemo-dgx.desktop`
- `~/.local/share/applications/chatdemo-dgx-stop.desktop`

对应脚本命令也可以直接运行：

```bash
make desktop-start
make desktop-stop
```

后台启动模式会：

- 自动检查并补齐环境文件
- 自动检查并安装依赖
- 在屏幕中间显示启动提示窗口，展示当前启动阶段
- 在仓库根目录 `.runtime/` 下写入日志和 PID 文件
- 自动打开 `http://127.0.0.1:12322`

常见运行文件：

- `.runtime/backend.log`
- `.runtime/frontend.log`
- `.runtime/backend.pid`
- `.runtime/frontend.pid`

## 验证命令

### 后端测试

```bash
cd backend
pytest
```

### 前端测试

```bash
cd frontend
npm test
```

### 前端生产构建

```bash
cd frontend
npm run build
```

## 接口说明

### `GET /api/health`

返回后端服务状态与当前模型名。

### `POST /api/chat`

请求体示例：

```json
{
  "messages": [
    { "role": "user", "content": "请总结这段内容" }
  ],
  "temperature": 0.3,
  "max_tokens": 1024,
  "system_prompt": "你是一名专业企业 AI 助手。"
}
```

返回：

- 成功时为 `application/x-ndjson` 流式响应
- 每行一个事件，例如 `delta`、`error`、`done`

### `POST /api/uploads`

使用 `multipart/form-data` 上传图片，返回：

- `upload_id`
- `name`
- `mime_type`
- `size`
- `preview_url`

限制：

- 单次最多 4 张图
- 支持 `PNG/JPG/JPEG/WEBP`
- 单张最大 10 MB

### `GET /api/uploads/{upload_id}/preview`

返回临时上传图片内容，用于前端缩略图和历史预览。

## 多模态说明

- 当前版本支持每条用户消息最多携带 4 张图片
- 图片先上传到本项目后端的临时目录，再由后端转换成 OpenAI-compatible 多模态消息
- 临时图片默认不做长期持久化，服务重启后旧图片可能失效
- 适合本机开发调试，后续可以迁移到公司内网服务器

## 品牌化改造入口

以下内容已做成便于替换的配置入口：

- 前端环境变量中的品牌名、产品名、模型名、品牌色
- [frontend/src/app/globals.css](/home/hujing/chatdemo-dgx/frontend/src/app/globals.css)
  中的颜色、圆角、边框、阴影 CSS 变量
- [frontend/src/lib/chat-store.ts](/home/hujing/chatdemo-dgx/frontend/src/lib/chat-store.ts)
  中的默认欢迎语、推荐问题、默认 system prompt

## 当前已知可继续优化项

- 将品牌配置抽成独立 JSON 或后端配置接口
- 增加会话重命名、删除会话、导出会话
- 增加流式状态指示和 token 统计
- 增加更完整的前端交互测试与端到端测试
- 为后端补充更细的上游异常测试与日志
- 将 CORS 白名单改成环境变量配置
