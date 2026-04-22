const axios = require('axios')

class OllamaEmbedder {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || 'http://127.0.0.1:11434'
    this.model = config.model || 'bge-m3:latest'
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 60000, // 60秒超时
    })
  }

  async checkConnection() {
    try {
      const response = await this.client.get('/api/tags')
      const models = response.data.models || []

      // 检查指定模型是否存在
      const modelExists = models.some(m => m.name === this.model)

      if (!modelExists) {
        const availableModels = models.map(m => m.name).join(', ')
        throw new Error(
          `模型 '${this.model}' 未找到。\n` +
          `可用模型: ${availableModels || '无'}\n` +
          `请运行: ollama pull ${this.model}`
        )
      }

      return {
        connected: true,
        model: this.model,
        availableModels: models.map(m => m.name)
      }
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error(
          '无法连接到 Ollama 服务 (localhost:11434)\n' +
          '请确保 Ollama 已安装并运行:\n' +
          '  1. 安装: https://ollama.com/download\n' +
          '  2. 启动服务: ollama serve\n' +
          '  3. 下载模型: ollama pull bge-m3'
        )
      }
      throw error
    }
  }

  async listModels() {
    try {
      const response = await this.client.get('/api/tags')
      return response.data.models || []
    } catch (error) {
      throw new Error('获取模型列表失败: ' + error.message)
    }
  }

  async embed(text) {
    // 生成单个文本的嵌入向量
    try {
      // 限制文本长度，避免超出模型上下文
      // bge-m3 支持 8192 tokens，这里保守一点
      const truncatedText = text.length > 6000 ? text.substring(0, 6000) + '...' : text

      const response = await this.client.post('/api/embeddings', {
        model: this.model,
        prompt: truncatedText
      })

      if (!response.data.embedding) {
        throw new Error('返回数据中没有 embedding 字段')
      }

      return response.data.embedding
    } catch (error) {
      console.error('Embed error:', error.message)
      return null
    }
  }

  async embedBatch(texts, onProgress) {
    // 批量生成嵌入向量
    const results = []

    for (let i = 0; i < texts.length; i++) {
      const embedding = await this.embed(texts[i])
      results.push(embedding)

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: texts.length,
          success: embedding !== null
        })
      }
    }

    return results
  }

  // 获取模型信息
  async getModelInfo() {
    try {
      const response = await this.client.post('/api/show', {
        name: this.model
      })
      return response.data
    } catch (error) {
      console.error('Get model info error:', error.message)
      return null
    }
  }
}

module.exports = { OllamaEmbedder }
