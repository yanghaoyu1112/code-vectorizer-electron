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
