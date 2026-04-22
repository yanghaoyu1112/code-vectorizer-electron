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
        "C:/office/learn/Demo/code-vectorizer-electron/mcp-server/index.js"
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
