# Code Vectorizer 落地实施计划（AI 可读版）

> 目标：将已录入的代码向量知识库从"静态存储"升级为"可被 Kimi Code 直接调用"的生产级工具。
> 按优先级分为三个阶段：前端验证 → 后端修复 → MCP 对外服务。

---

## 前置信息

### 项目关键技术栈
- **前端**：Vue 3 + Element Plus + Vite + Electron 30
- **后端 IPC**：Electron Main Process (`electron/main.js`)
- **数据库**：PostgreSQL + pgvector (`electron/services/DatabaseManager.js`)
- **向量化**：Ollama `bge-m3:latest` (`electron/services/OllamaEmbedder.js`)
- **预加载**：`electron/preload.mjs`

### 当前状态
- ✅ 项目扫描、代码解析、向量化、存储均已实现
- ❌ 没有语义搜索页面
- ❌ `DatabaseManager.searchSimilar()` 直接把文本当向量传入 SQL，存在 Bug
- ❌ 没有对外 API / MCP 接口，Kimi Code 无法调用

---

## 阶段一：最小可用查询验证（前端搜索页面）

### 目标
在 Electron 应用内新增一个"语义搜索"页面，支持输入自然语言问题，调用后端做向量相似度搜索，直观展示检索结果，用于验证向量质量。

### 修改清单

| 序号 | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1 | `electron/main.js` | 修改 | 新增 IPC Handler `search-similar`（阶段一可先 mock 返回，或直接用阶段二实现） |
| 2 | `electron/preload.mjs` | 修改 | 暴露 `searchSimilar(params)` 给渲染进程 |
| 3 | `src/renderer/router/index.js` | 修改 | 注册 `/search` 路由 |
| 4 | `src/renderer/App.vue` | 修改 | 侧边栏增加"语义搜索"菜单项 |
| 5 | `src/renderer/views/Search.vue` | 新建 | 搜索页面组件 |

### 详细实现

#### 1. `electron/preload.mjs` — 暴露 API

在 `const electronAPI = { ... }` 对象中新增一行：

```js
  // 语义搜索
  searchSimilar: (params) => ipcRenderer.invoke('search-similar', params),
```

#### 2. `src/renderer/router/index.js` — 注册路由

在 `routes` 数组中新增：

```js
import Search from '../views/Search.vue';

// 在 routes 数组内添加
{
  path: '/search',
  name: 'Search',
  component: Search,
  meta: { title: '语义搜索' }
}
```

#### 3. `src/renderer/App.vue` — 增加导航

在 `<el-menu>` 中 `ProjectList` 项之后（或任意合适位置）插入：

```vue
<el-menu-item index="/search">
  <el-icon>
    <Search />
  </el-icon>
  <span>语义搜索</span>
</el-menu-item>
```

**注意**：检查 `script` 中是否已引入 `Search` icon，Element Plus 的 `Search` icon 通常在 `@element-plus/icons-vue` 中全局注册，若 `App.vue` 中未显式引入，确保运行时可用即可（项目使用了自动导入或已在某处注册）。如果报缺少 import，请在 `script setup` 中增加：

```js
import { Search } from '@element-plus/icons-vue'
```

#### 4. `src/renderer/views/Search.vue` — 新建搜索页面

创建文件，内容如下：

```vue
<!--
 * @Description: 语义搜索页面
 * @Author: code-vectorizer
-->
<template>
  <div class="search-page">
    <el-card>
      <template #header>
        <div class="card-header">
          <el-icon><Search /></el-icon>
          <span>语义搜索</span>
        </div>
      </template>

      <el-form :model="form" label-position="top">
        <el-form-item label="搜索问题">
          <el-input
            v-model="form.query"
            type="textarea"
            :rows="2"
            placeholder="例如：用户登录接口是怎么实现的？"
            clearable
          />
        </el-form-item>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="限定项目（可选）">
              <el-select v-model="form.projectName" placeholder="全部项目" clearable style="width: 100%">
                <el-option
                  v-for="p in projects"
                  :key="p.project_name"
                  :label="p.project_name"
                  :value="p.project_name"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="结果数量">
              <el-slider v-model="form.limit" :min="1" :max="20" show-stops />
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item>
          <el-button type="primary" :loading="loading" @click="handleSearch">
            <el-icon><Search /></el-icon>
            开始搜索
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card v-if="results.length > 0" class="mt20">
      <template #header>
        <div class="card-header">
          <span>搜索结果（共 {{ results.length }} 条）</span>
        </div>
      </template>

      <div v-for="(item, index) in results" :key="item.id" class="result-item">
        <div class="result-header">
          <div class="result-title">
            <span class="result-index">#{{ index + 1 }}</span>
            <el-tag size="small" :type="getEntityTypeTag(item.entity_type)">
              {{ item.entity_type || 'unknown' }}
            </el-tag>
            <el-text class="ml8" truncated>{{ item.signature }}</el-text>
          </div>
          <div class="result-meta">
            <el-tag type="info" effect="plain" size="small">
              distance: {{ Number(item.distance).toFixed(4) }}
            </el-tag>
          </div>
        </div>
        <div class="result-path">
          <el-text type="info" size="small">
            {{ item.project_name }} / {{ item.file_path }}
          </el-text>
        </div>
        <pre class="code-block"><code>{{ item.code_content }}</code></pre>
      </div>
    </el-card>

    <el-empty v-if="!loading && searched && results.length === 0" description="未找到相关结果" />
  </div>
</template>

<script setup name="Search">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 响应式数据 ====================
const form = ref({
  query: '',
  projectName: '',
  limit: 10
})
const projects = ref([])
const results = ref([])
const loading = ref(false)
const searched = ref(false)

// ==================== 生命周期钩子 ====================
onMounted(async () => {
  if (isElectronEnv()) {
    await loadProjects()
  }
})

// ==================== 方法定义 ====================
const loadProjects = async () => {
  try {
    const dbConfig = JSON.parse(localStorage.getItem('dbConfig') || '{}')
    if (!dbConfig.host) return
    const result = await electronAPI.getProjects(dbConfig)
    if (result.success) {
      projects.value = result.data || []
    }
  } catch (error) {
    console.error('Load projects error:', error)
  }
}

const handleSearch = async () => {
  if (!form.value.query.trim()) {
    ElMessage.warning('请输入搜索问题')
    return
  }

  const dbConfig = JSON.parse(localStorage.getItem('dbConfig') || '{}')
  const ollamaConfig = JSON.parse(localStorage.getItem('ollamaConfig') || '{}')

  if (!dbConfig.host) {
    ElMessage.warning('请先配置数据库连接')
    return
  }

  loading.value = true
  searched.value = false
  results.value = []

  try {
    const result = await electronAPI.searchSimilar({
      query: form.value.query.trim(),
      projectName: form.value.projectName || null,
      limit: form.value.limit,
      dbConfig,
      ollamaConfig
    })

    searched.value = true

    if (!result.success) {
      ElMessage.error(result.message || '搜索失败')
      return
    }

    results.value = result.data || []
    if (results.value.length === 0) {
      ElMessage.info('未找到相关结果')
    }
  } catch (error) {
    ElMessage.error('搜索出错: ' + error.message)
  } finally {
    loading.value = false
  }
}

const getEntityTypeTag = (type) => {
  const map = {
    class: 'primary',
    method: 'success',
    function: 'success',
    template: 'warning',
    style: 'info',
    script: 'info',
    export: 'success',
    config: 'info',
    file: ''
  }
  return map[type] || ''
}
</script>

<style lang="scss" scoped>
.search-page {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.mt20 {
  margin-top: 20px;
}

.ml8 {
  margin-left: 8px;
}

.result-item {
  margin-bottom: 24px;
  padding-bottom: 24px;
  border-bottom: 1px solid #e4e7ed;

  &:last-child {
    margin-bottom: 0;
    padding-bottom: 0;
    border-bottom: none;
  }
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-index {
  font-weight: bold;
  color: #409eff;
}

.result-path {
  margin-bottom: 12px;
}

.code-block {
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 16px;
  overflow-x: auto;
  font-family: 'Consolas', 'Monaco', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #303133;
  max-height: 400px;
  overflow-y: auto;
  margin: 0;
}
</style>
```

#### 5. `electron/main.js` — 新增 IPC Handler

在 `registerIpcHandlers()` 函数末尾，向量化 handler 之后，新增：

```js
  // 语义搜索
  ipcMain.handle('search-similar', async (event, params) => {
    const { query, projectName, limit, dbConfig, ollamaConfig } = params;
    const dbManager = new DatabaseManager(dbConfig);
    const embedder = new OllamaEmbedder(ollamaConfig);

    try {
      // 1. 将查询文本转为向量
      const embedding = await embedder.embed(query);
      if (!embedding) {
        throw new Error('查询向量化失败，请检查 Ollama 连接和 bge-m3 模型');
      }

      // 2. 连接数据库并执行相似度搜索
      await dbManager.connect();
      const results = await dbManager.searchSimilar(embedding, projectName, limit || 10);
      await dbManager.close();

      return { success: true, data: results };
    } catch (error) {
      await dbManager.close().catch(() => {});
      const errorMessage = error && typeof error === 'object'
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });
```

**注意**：由于阶段二会修复 `DatabaseManager.searchSimilar()`，阶段一如果要先跑起来，可以先在 `electron/main.js` 里用下面这段临时代码绕过 Bug（直接把 `query` 文本当向量传进去，SQL 会报错，但页面可以验证 UI）：

```js
// 阶段一临时 mock（可选）
ipcMain.handle('search-similar', async (event, params) => {
  return { 
    success: true, 
    data: [] 
  };
});
```

**推荐做法**：阶段一和阶段二可以合并执行，直接按阶段二的代码写 IPC handler，然后同步修改 `DatabaseManager.js`。

### 验证方式
1. 启动应用（`npm run dev` + `npm run electron:dev`）
2. 点击左侧"语义搜索"
3. 输入一个问题（如"用户登录"），选择项目或不选，点击搜索
4. 如果能正常展示结果列表（带 distance、signature、code_content），说明前端链路通。

---

## 阶段二：修复 searchSimilar（后端向量化 Bug）

### 目标
修复 `DatabaseManager.searchSimilar()` 把查询文本直接当向量传入 SQL 的 Bug；确保 IPC 链路能正确完成 "query → Ollama 向量化 → pgvector 搜索 → 返回结果"。

### 修改清单

| 序号 | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1 | `electron/services/DatabaseManager.js` | 修改 | 修复 `searchSimilar` 方法签名和参数处理 |
| 2 | `electron/main.js` | 修改 | 完善 `search-similar` IPC handler，调用 OllamaEmbedder 做 query 向量化 |

### 详细实现

#### 1. `electron/services/DatabaseManager.js` — 修复 searchSimilar

找到 `searchSimilar` 方法，替换为以下内容：

```js
  async searchSimilar(embedding, projectName = null, limit = 10) {
    // embedding 是 OllamaEmbedder.embed() 返回的 number[] 数组
    const whereClause = projectName ? 'WHERE project_name = $2' : ''
    const params = projectName 
      ? [JSON.stringify(embedding), projectName] 
      : [JSON.stringify(embedding)]

    const result = await this.client.query(`
      SELECT 
        id, project_name, file_path, file_name, 
        code_content, signature, entity_type,
        embedding <=> $1::vector as distance
      FROM code_embeddings
      ${whereClause}
      ORDER BY embedding <=> $1::vector
      LIMIT ${limit}
    `, params)

    return result.rows
  }
```

**关键变更**：
- 第一个参数从 `query`（字符串）改为 `embedding`（number[] 向量数组）
- 用 `JSON.stringify(embedding)` 把向量数组转成 JSON 字符串，再 cast 成 `::vector`，pgvector 可以正确解析
- 保持 `WHERE` 子句和参数绑定逻辑不变

#### 2. `electron/main.js` — 完善 IPC Handler

如阶段一所示，确保 `search-similar` handler 的完整实现如下：

```js
  // 语义搜索
  ipcMain.handle('search-similar', async (event, params) => {
    const { query, projectName, limit, dbConfig, ollamaConfig } = params;
    const dbManager = new DatabaseManager(dbConfig);
    const embedder = new OllamaEmbedder(ollamaConfig);

    try {
      const embedding = await embedder.embed(query);
      if (!embedding) {
        throw new Error('查询向量化失败，请检查 Ollama 连接和 bge-m3 模型');
      }

      await dbManager.connect();
      const results = await dbManager.searchSimilar(embedding, projectName, limit || 10);
      await dbManager.close();

      return { success: true, data: results };
    } catch (error) {
      await dbManager.close().catch(() => {});
      const errorMessage = error && typeof error === 'object'
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });
```

### 验证方式
1. 在"语义搜索"页面输入：`用户登录接口怎么实现的`
2. 等待 Ollama 生成向量（首次可能较慢，约 1-3 秒）
3. 检查返回结果：
   - **Top 结果** 应该包含 `UserController`、`LoginService`、`AuthMapper` 等和用户登录相关的类或方法
   - **distance 值** 应该相对较小（通常 0.1 - 0.6 之间，具体取决于向量维度和归一化）
4. 如果返回的是完全不相关的内容（比如工具类、静态资源配置），说明向量质量或数据有问题，需要检查：
   - Ollama 是否确实使用的是 `bge-m3` 模型
   - `code_embeddings` 表中是否有足够的数据量

---

## 阶段三：MCP Server 开发（供 Kimi Code 调用）

### 目标
开发一个独立的 MCP Server，让 Kimi Code 能够通过 MCP 协议直接查询你的代码向量库。Kimi Code 在对话中会自动调用该工具的 `search_code` function。

### 架构说明

```
Kimi Code 对话
    ↓ MCP Stdio
Code Vector MCP Server (Node.js)
    ├── 读取 ~/.code-vectorizer/config.json（数据库/Ollama配置）
    ├── 收到 query → Ollama bge-m3 生成向量
    ├── PostgreSQL pgvector 相似度搜索
    └── 返回代码块列表给 Kimi
```

### 修改/新增清单

| 序号 | 文件 | 操作 | 说明 |
|------|------|------|------|
| 1 | `mcp-server/index.js` | 新建 | MCP Server 主入口，基于 `@modelcontextprotocol/sdk` |
| 2 | `mcp-server/package.json` | 新建 | MCP Server 独立包配置 |
| 3 | `mcp-server/README.md` | 新建 | MCP 配置说明文档 |
| 4 | Kimi Code MCP 配置 | 手动配置 | 在 Kimi Code 设置中添加 stdio 类型 MCP server |

### 详细实现

#### 1. `mcp-server/package.json`

```json
{
  "name": "code-vectorizer-mcp-server",
  "version": "1.0.0",
  "description": "Code Vectorizer MCP Server for Kimi Code",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.6.0",
    "pg": "^8.11.0"
  }
}
```

安装依赖：

```bash
cd mcp-server
npm install
```

#### 2. `mcp-server/index.js`

```js
#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { Client } from 'pg';
import axios from 'axios';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ==================== 配置加载 ====================
const CONFIG_PATH = join(homedir(), '.code-vectorizer', 'config.json');

function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    throw new Error(`配置文件不存在: ${CONFIG_PATH}\n请先创建该文件，内容示例见 README.md`);
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  return JSON.parse(raw);
}

const config = loadConfig();

// ==================== Ollama 嵌入 ====================
async function embedText(text) {
  const baseUrl = config.ollama?.baseUrl || 'http://127.0.0.1:11434';
  const model = config.ollama?.model || 'bge-m3:latest';
  const truncatedText = text.length > 6000 ? text.substring(0, 6000) + '...' : text;

  const response = await axios.post(`${baseUrl}/api/embeddings`, {
    model,
    prompt: truncatedText
  });

  if (!response.data.embedding) {
    throw new Error('Ollama 返回数据中没有 embedding 字段');
  }
  return response.data.embedding;
}

// ==================== PostgreSQL 搜索 ====================
async function searchSimilar(embedding, projectName = null, limit = 10) {
  const client = new Client({
    host: config.db?.host || '127.0.0.1',
    port: config.db?.port || 5432,
    database: config.db?.database || 'postgres',
    user: config.db?.user || 'postgres',
    password: config.db?.password || ''
  });

  await client.connect();

  const whereClause = projectName ? 'WHERE project_name = $2' : '';
  const params = projectName
    ? [JSON.stringify(embedding), projectName]
    : [JSON.stringify(embedding)];

  const result = await client.query(`
    SELECT 
      id, project_name, file_path, file_name, 
      code_content, signature, entity_type,
      embedding <=> $1::vector as distance
    FROM code_embeddings
    ${whereClause}
    ORDER BY embedding <=> $1::vector
    LIMIT ${limit}
  `, params);

  await client.end();
  return result.rows;
}

// ==================== MCP Server ====================
const server = new Server(
  {
    name: 'code-vectorizer-server',
    version: '1.0.0'
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

// 注册工具列表
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'search_code',
        description: '在代码向量知识库中搜索与用户问题语义最相似的代码块。当用户询问项目中的具体实现、类、方法、接口定义时使用此工具。',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: '用户的自然语言查询问题，例如：用户登录接口怎么实现的？'
            },
            project_name: {
              type: 'string',
              description: '可选，限定搜索的项目名称。不填则搜索所有项目。'
            },
            limit: {
              type: 'number',
              description: '返回结果数量，默认 10，最大 20。'
            }
          },
          required: ['query']
        }
      }
    ]
  };
});

// 注册工具调用处理
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== 'search_code') {
    throw new Error(`未知工具: ${request.params.name}`);
  }

  const { query, project_name, limit = 10 } = request.params.arguments || {};

  if (!query || typeof query !== 'string') {
    return {
      content: [
        { type: 'text', text: '错误: query 参数不能为空' }
      ]
    };
  }

  try {
    const embedding = await embedText(query);
    const results = await searchSimilar(embedding, project_name || null, Math.min(limit, 20));

    if (results.length === 0) {
      return {
        content: [
          { type: 'text', text: '未在代码向量库中找到相关内容。' }
        ]
      };
    }

    // 格式化为 Kimi 易读的文本
    const formatted = results.map((item, index) => {
      return `[${index + 1}] ${item.signature} (${item.entity_type})
项目: ${item.project_name}
文件: ${item.file_path}
相似度距离: ${Number(item.distance).toFixed(4)}
\`\`\`${item.language || 'code'}
${item.code_content}
\`\`\``;
    }).join('\n\n---\n\n');

    return {
      content: [
        { type: 'text', text: formatted }
      ]
    };
  } catch (error) {
    return {
      content: [
        { type: 'text', text: `搜索失败: ${error.message}` }
      ]
    };
  }
});

// ==================== 启动 ====================
const transport = new StdioServerTransport();
await server.connect(transport);
console.error('[MCP] Code Vectorizer Server running on stdio');
```

#### 3. `mcp-server/README.md`

```markdown
# Code Vectorizer MCP Server

## 1. 创建配置文件

在用户目录下创建配置文件：

```bash
mkdir -p ~/.code-vectorizer
cat > ~/.code-vectorizer/config.json << 'EOF'
{
  "db": {
    "host": "127.0.0.1",
    "port": 5432,
    "database": "postgres",
    "user": "postgres",
    "password": "你的密码"
  },
  "ollama": {
    "baseUrl": "http://127.0.0.1:11434",
    "model": "bge-m3:latest"
  }
}
EOF
```

## 2. Kimi Code 配置

在 Kimi Code 的 MCP 配置中添加：

```json
{
  "mcpServers": {
    "code-vectorizer": {
      "command": "node",
      "args": [
        "C:/Users/你的用户名/Desktop/project_code_vector/code-vectorizer-electron/mcp-server/index.js"
      ]
    }
  }
}
```

注意替换为你的实际路径。

## 3. 验证

在 Kimi Code 中提问：
> "查询我的代码库，用户登录是怎么实现的？"

Kimi 会自动调用 `search_code` 工具，返回相关代码块。
```

#### 4. Kimi Code 中实际配置 MCP

Kimi Code CLI/VS Code 插件的 MCP 配置位置取决于具体版本：

- **如果是 Kimi Code CLI**：通常在配置文件中可以设置 MCP servers，参考其官方文档的 MCP 集成章节。
- **如果是 VS Code 插件**：在 Kimi Code 插件设置面板中，找到 MCP / Tools 配置，添加一个 `stdio` 类型的 server，Command 填 `node`，Args 填你的 `mcp-server/index.js` 绝对路径。

### 验证方式

1. 确保 Ollama 和 PostgreSQL 都在运行
2. 在 Kimi Code 中发送问题：
   > "使用 search_code 工具查询：项目中用户认证的逻辑在哪里？"
3. 观察 Kimi 是否自动调用了工具
4. 检查返回结果中是否包含真实的代码片段（如 `AuthController.java`、登录方法等）

---

## 附录：端到端测试 SQL（手动验证向量有效性）

如果你不想等前端/MCP 开发完，可以直接在 PostgreSQL 里手动验证向量质量：

```sql
-- 1. 查看项目数据量
SELECT project_name, COUNT(*) as chunks 
FROM code_embeddings 
GROUP BY project_name;

-- 2. 查看某项目的随机样本
SELECT signature, entity_type, LENGTH(code_content) 
FROM code_embeddings 
WHERE project_name = '你的项目名'
LIMIT 5;
```

通过 curl 手动获取查询向量并执行搜索（需要替换向量值）：

```bash
curl http://localhost:11434/api/embeddings -d '{
  "model": "bge-m3",
  "prompt": "用户登录接口怎么实现的"
}'
```

将返回的数组填入 SQL：

```sql
SELECT 
  signature, entity_type, code_content,
  embedding <=> '[0.0123, ...]'::vector as distance
FROM code_embeddings
ORDER BY embedding <=> '[0.0123, ...]'::vector
LIMIT 5;
```

---

## 快速检查清单（Checklist）

- [ ] 阶段一：`Search.vue` 创建完成，侧边栏能看到"语义搜索"
- [ ] 阶段一：`electron/preload.mjs` 已暴露 `searchSimilar`
- [ ] 阶段一：`electron/main.js` 已注册 `search-similar` IPC handler
- [ ] 阶段二：`DatabaseManager.searchSimilar()` 第一个参数改为 `embedding` 数组
- [ ] 阶段二：IPC handler 中先调用 `embedder.embed(query)` 再传向 `searchSimilar`
- [ ] 阶段二：在搜索页面输入"登录/认证"相关词汇，能返回合理代码块
- [ ] 阶段三：`mcp-server/` 目录创建，依赖安装完成
- [ ] 阶段三：`~/.code-vectorizer/config.json` 配置正确
- [ ] 阶段三：Kimi Code MCP 配置已添加并启用
- [ ] 阶段三：在 Kimi Code 中问项目相关问题，Kimi 自动调用 `search_code` 并返回代码
