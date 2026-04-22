# Code Vectorizer - 代码矢量化工具

基于 Electron + Vue3 的桌面应用，将 Vue 和 Spring Boot 项目代码转换为向量存储到 PostgreSQL，构建 AI 可检索的知识库。

## 功能特性

- 🔍 **自动识别项目**：Vue / Spring Boot / React
- 🤖 **本地 Ollama 嵌入**：使用 bge-m3 模型生成代码向量
- 💾 **PostgreSQL 存储**：使用 pgvector 扩展存储向量
- 🖥️ **图形化界面**：Element Plus 美观界面
- 📊 **项目管理**：查看、删除已索引项目

## 技术栈

- **前端**: Vue 3 + Element Plus + Vite
- **桌面**: Electron 28
- **后端**: Node.js (Electron Main Process)
- **数据库**: PostgreSQL + pgvector
- **嵌入**: Ollama (bge-m3)

## 快速开始

### 1. 安装依赖

```bash
cd code-vectorizer-electron
npm install
```

### 2. 配置环境

确保本地已安装：
- PostgreSQL + pgvector 扩展
- Ollama (且已下载 bge-m3 模型)

```bash
# 下载 bge-m3 模型
ollama pull bge-m3

# 启动 Ollama 服务
ollama serve
```

### 3. 开发运行

```bash
# 启动开发服务器
npm run dev

# 另开终端，启动 Electron
npm run electron:dev
```

### 4. 构建应用

```bash
# 构建生产版本
npm run electron:build
```

## 使用流程

1. **设置**: 配置数据库连接和 Ollama 地址
2. **扫描**: 选择项目文件夹，自动分析项目信息
3. **确认**: 编辑自动检测的项目信息
4. **解析**: 提取代码块（类、方法、函数等）
5. **向量化**: 调用 Ollama bge-m3 生成向量
6. **完成**: 存储到 PostgreSQL 知识库

## 数据库表结构

### code_projects（项目表）
- project_name: 项目名称（主键）
- project_path: 本地路径
- project_type: 项目类型（vue/springboot）
- git_url: Git 地址
- language_stats: 语言统计 JSON

### code_embeddings（代码向量表）
- id: 自增 ID
- project_name: 所属项目
- file_path: 文件路径
- code_content: 代码内容
- embedding: 向量（1024维 for bge-m3）
- signature: 代码签名
- entity_type: 实体类型（class/method/function等）

## 配置说明

### 数据库配置
- Host: localhost (或远程地址)
- Port: 5432
- Database: postgres
- User: postgres
- Password: 你的密码

### Ollama 配置
- Base URL: http://localhost:11434
- Model: bge-m3:latest (默认)

## 开发说明

### 项目结构
```
code-vectorizer-electron/
├── src/
│   ├── main/              # Electron 主进程
│   │   ├── scanner/       # 项目扫描器
│   │   ├── parser/        # 代码解析器
│   │   ├── embedder/      # Ollama 嵌入
│   │   ├── database/      # PostgreSQL 操作
│   │   ├── main.js        # 主入口
│   │   └── preload.js     # 预加载脚本
│   └── renderer/          # Vue3 渲染进程
│       ├── views/         # 页面组件
│       ├── router/        # 路由
│       ├── App.vue
│       └── main.js
├── package.json
├── vite.config.js
└── index.html
```

### IPC 通信

主进程和渲染进程通过预定义的 IPC 通道通信：
- `select-project`: 选择文件夹
- `scan-project`: 扫描项目
- `parse-code`: 解析代码
- `vectorize`: 生成向量
- `test-db-connection`: 测试数据库
- `test-ollama-connection`: 测试 Ollama

## 常见问题

### Q: Ollama 连接失败？
确保 Ollama 服务已启动：
```bash
ollama serve
```

### Q: 数据库连接失败？
1. 确保 PostgreSQL 运行
2. 确保已安装 pgvector: `CREATE EXTENSION vector;`
3. 检查连接信息

### Q: bge-m3 模型未找到？
```bash
ollama pull bge-m3
```

## License

GPL-3.0
