import { Client } from 'pg'

class DatabaseManager {
  constructor(config = {}) {
    this.config = {
      host: config.host || '127.0.0.1',
      port: config.port || 5432,
      database: config.database || 'postgres',
      user: config.user || 'postgres',
      password: config.password || '',
      ...config
    }
    this.client = null
  }

  async connect() {
    this.client = new Client(this.config)
    await this.client.connect()

    // 检查 pgvector 扩展
    const result = await this.client.query("SELECT * FROM pg_extension WHERE extname = 'vector'")
    // 使用 JSON 序列化/反序列化确保数据是纯对象
    const rows = JSON.parse(JSON.stringify(result.rows))
    if (rows.length === 0) {
      throw new Error('数据库未安装 pgvector 扩展。请先运行: CREATE EXTENSION vector;')
    }

    // 返回纯对象而非 this，以便 IPC 序列化
    return { success: true, message: '连接成功' }
  }

  async close() {
    if (this.client) {
      await this.client.end()
      this.client = null
    }
  }

  async upsertProject(info) {
    const query = `
      INSERT INTO code_projects (
        project_name, project_path, git_url, default_branch,
        language_stats, exclude_patterns, include_patterns,
        indexing_enabled, priority, last_indexed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CURRENT_TIMESTAMP)
      ON CONFLICT (project_name) DO UPDATE SET
        project_path = EXCLUDED.project_path,
        git_url = EXCLUDED.git_url,
        default_branch = EXCLUDED.default_branch,
        language_stats = EXCLUDED.language_stats,
        exclude_patterns = EXCLUDED.exclude_patterns,
        include_patterns = EXCLUDED.include_patterns,
        indexing_enabled = EXCLUDED.indexing_enabled,
        priority = EXCLUDED.priority,
        last_indexed_at = CURRENT_TIMESTAMP
    `

    const values = [
      info.name,
      info.path,
      info.gitUrl || null,
      info.defaultBranch || 'main',
      info.languageStats ? JSON.stringify(info.languageStats) : null,
      info.excludePatterns || [],
      info.includePatterns || [],
      true,
      info.priority || 5
    ]

    await this.client.query(query, values)
  }

  async deleteProjectEmbeddings(projectName) {
    await this.client.query(
      'DELETE FROM code_embeddings WHERE project_name = $1',
      [projectName]
    )
  }

  async deleteProject(projectName) {
    await this.client.query('BEGIN')
    try {
      await this.client.query(
        'DELETE FROM code_relationships WHERE source_id IN (SELECT id FROM code_embeddings WHERE project_name = $1)',
        [projectName]
      )
      await this.client.query(
        'DELETE FROM code_embeddings WHERE project_name = $1',
        [projectName]
      )
      await this.client.query(
        'DELETE FROM code_projects WHERE project_name = $1',
        [projectName]
      )
      await this.client.query('COMMIT')
    } catch (error) {
      await this.client.query('ROLLBACK')
      throw error
    }
  }

  async insertEmbeddings(projectName, chunks, embeddings) {
    let inserted = 0

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      const embedding = embeddings[i]

      if (!embedding) continue

      const query = `
        INSERT INTO code_embeddings (
          project_name, project_type, file_path, file_name,
          language, entity_type, module_name, start_line, end_line,
          chunk_index, total_chunks, code_content, code_tokens,
          signature, embedding, tags, dependencies
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::vector, $16, $17)
        ON CONFLICT DO NOTHING
      `

      const values = [
        projectName,
        chunk.projectType,
        chunk.filePath,
        chunk.fileName,
        chunk.language,
        chunk.entityType,
        chunk.moduleName,
        chunk.startLine,
        chunk.endLine,
        chunk.chunkIndex,
        chunk.totalChunks,
        chunk.codeContent,
        chunk.codeContent.split(/\s+/).length, // 简单 token 估算
        chunk.signature,
        JSON.stringify(embedding),
        chunk.tags || [],
        chunk.dependencies || []
      ]

      try {
        await this.client.query(query, values)
        inserted++
      } catch (error) {
        console.error(`Insert error for ${chunk.signature}:`, error.message)
      }
    }

    return inserted
  }

  async getAllProjects() {
    const result = await this.client.query(`
      SELECT 
        p.*,
        COUNT(e.id) as embedding_count
      FROM code_projects p
      LEFT JOIN code_embeddings e ON p.project_name = e.project_name
      GROUP BY p.project_name
      ORDER BY p.last_indexed_at DESC NULLS LAST
    `)

    return result.rows
  }

  async getEmbeddingDim() {
    try {
      const result = await this.client.query(`
        SELECT pg_typeof(embedding)::varchar as type
        FROM code_embeddings 
        WHERE embedding IS NOT NULL 
        LIMIT 1
      `)

      if (result.rows.length > 0) {
        const match = result.rows[0].type.match(/\((\d+)\)/)
        if (match) {
          return parseInt(match[1])
        }
      }

      return 768 // 默认值
    } catch {
      return 768
    }
  }

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
}

export { DatabaseManager }
