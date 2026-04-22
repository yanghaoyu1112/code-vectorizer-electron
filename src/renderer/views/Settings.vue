<!--
 * @Description: 系统设置页面
 * @Author: code-vectorizer
 * @Date: 2026-04-08 16:30:00
-->
<template>
  <div class="settings">
    <el-row :gutter="20">
      <!-- 数据库设置 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon>
                <DataLine />
              </el-icon>
              <span>数据库连接</span>
              <el-tag v-if="dbStatus.connected" type="success" size="small">已连接</el-tag>
              <el-tag v-else type="danger" size="small">未连接</el-tag>
            </div>
          </template>

          <el-form :model="dbConfig" label-width="100px">
            <el-form-item label="主机">
              <el-input v-model="dbConfig.host" placeholder="127.0.0.1" />
            </el-form-item>

            <el-form-item label="端口">
              <el-input-number v-model="dbConfig.port" :min="1" :max="65535" style="width: 100%;" />
            </el-form-item>

            <el-form-item label="数据库">
              <el-input v-model="dbConfig.database" placeholder="postgres" />
            </el-form-item>

            <el-form-item label="用户名">
              <el-input v-model="dbConfig.user" placeholder="postgres" />
            </el-form-item>

            <el-form-item label="密码">
              <el-input v-model="dbConfig.password" type="password" show-password />
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="dbStatus.testing" @click="handleTestDb">
                <el-icon>
                  <Connection />
                </el-icon>
                测试连接
              </el-button>
              <el-button @click="handleSaveDb">保存配置</el-button>
            </el-form-item>
          </el-form>

          <el-alert v-if="dbStatus.message" :title="dbStatus.message"
            :type="dbStatus.connected ? 'success' : 'error'" show-icon :closable="false" class="mt10" />
        </el-card>
      </el-col>

      <!-- Ollama 设置 -->
      <el-col :span="12">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon>
                <Cpu />
              </el-icon>
              <span>Ollama 配置</span>
              <el-tag v-if="ollamaStatus.connected" type="success" size="small">已连接</el-tag>
              <el-tag v-else type="danger" size="small">未连接</el-tag>
            </div>
          </template>

          <el-form :model="ollamaConfig" label-width="100px">
            <el-form-item label="服务地址">
              <el-input v-model="ollamaConfig.baseUrl" placeholder="http://127.0.0.1:11434" />
            </el-form-item>

            <el-form-item label="嵌入模型">
              <el-select v-model="ollamaConfig.model" style="width: 100%;" filterable allow-create>
                <el-option v-for="model in availableModels" :key="model.name" :label="model.name"
                  :value="model.name" />
              </el-select>
              <div class="form-tip">
                推荐: bge-m3:latest (支持中英双语，1024维)
              </div>
            </el-form-item>

            <el-form-item>
              <el-button type="primary" :loading="ollamaStatus.testing" @click="handleTestOllama">
                <el-icon>
                  <Connection />
                </el-icon>
                测试连接
              </el-button>
              <el-button :loading="ollamaStatus.loadingModels" @click="handleRefreshModels">
                <el-icon>
                  <Refresh />
                </el-icon>
                刷新模型列表
              </el-button>
              <el-button @click="handleSaveOllama">保存配置</el-button>
            </el-form-item>
          </el-form>

          <el-alert v-if="ollamaStatus.message" :title="ollamaStatus.message"
            :type="ollamaStatus.connected ? 'success' : 'error'" show-icon :closable="false" class="mt10" />

          <el-divider />

          <div class="help-section">
            <h4>📖 使用帮助</h4>
            <ol>
              <li>安装 Ollama: <el-link type="primary" href="https://ollama.com/download" target="_blank">https://ollama.com/download</el-link></li>
              <li>启动服务: <code>ollama serve</code></li>
              <li>下载模型: <code>ollama pull bge-m3</code></li>
            </ol>

            <h4 class="mt16">🎯 推荐模型</h4>
            <el-table :data="recommendModels" size="small">
              <el-table-column prop="name" label="模型" width="150" />
              <el-table-column prop="dim" label="维度" width="80" />
              <el-table-column prop="desc" label="说明" />
            </el-table>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon>
                <InfoFilled />
              </el-icon>
              <span>关于</span>
            </div>
          </template>
          <div class="about-content">
            <h3>Code Vectorizer v1.0.0</h3>
            <p>代码项目矢量化工具 - 将 Vue 和 Spring Boot 项目代码转换为向量存储</p>
            <p>
              <el-tag>Vue 3</el-tag>
              <el-tag class="ml8">Electron</el-tag>
              <el-tag class="ml8">Element Plus</el-tag>
            </p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Settings">
import { ref, onMounted, toRaw } from 'vue'
import { ElMessage } from 'element-plus'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 响应式数据 ====================
const dbConfig = ref({
  host: '127.0.0.1',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: ''
})

const ollamaConfig = ref({
  baseUrl: 'http://127.0.0.1:11434',
  model: 'bge-m3:latest'
})

const dbStatus = ref({
  connected: false,
  testing: false,
  message: ''
})

const ollamaStatus = ref({
  connected: false,
  testing: false,
  loadingModels: false,
  message: ''
})

const availableModels = ref([])

const recommendModels = [
  { name: 'bge-m3:latest', dim: 1024, desc: 'BGE-M3，支持中英双语，效果好' },
  { name: 'nomic-embed-text', dim: 768, desc: 'Nomic Embed，英文场景表现好' },
  { name: 'mxbai-embed-large', dim: 1024, desc: 'MixedBread AI，高质量英文嵌入' },
  { name: 'all-minilm', dim: 384, desc: 'MiniLM，速度快，体积小' }
]

// ==================== 生命周期钩子 ====================
onMounted(() => {
  // 加载保存的配置
  const savedDbConfig = localStorage.getItem('dbConfig')
  if (savedDbConfig) {
    dbConfig.value = JSON.parse(savedDbConfig)
    // 修复 localhost -> 127.0.0.1 的兼容性问题
    if (dbConfig.value.host === 'localhost') {
      dbConfig.value.host = '127.0.0.1'
    }
  }

  const savedOllamaConfig = localStorage.getItem('ollamaConfig')
  if (savedOllamaConfig) {
    ollamaConfig.value = JSON.parse(savedOllamaConfig)
    // 修复 localhost -> 127.0.0.1 的兼容性问题
    if (ollamaConfig.value.baseUrl?.includes('localhost')) {
      ollamaConfig.value.baseUrl = ollamaConfig.value.baseUrl.replace('localhost', '127.0.0.1')
    }
  }

  // 自动测试连接（仅在 Electron 环境中）
  if (isElectronEnv()) {
    handleTestDb()
    handleTestOllama()
  }
})

// ==================== 方法定义 ====================
/**
 * 测试数据库连接
 */
const handleTestDb = async () => {
  dbStatus.value.testing = true
  dbStatus.value.message = ''

  try {
    const result = await electronAPI.testDbConnection(toRaw(dbConfig.value))
    dbStatus.value.connected = result.success
    dbStatus.value.message = result.message

    if (result.success) {
      ElMessage.success('数据库连接成功')
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    dbStatus.value.connected = false
    dbStatus.value.message = error.message
    ElMessage.error('连接失败: ' + error.message)
  } finally {
    dbStatus.value.testing = false
  }
}

/**
 * 保存数据库配置
 */
const handleSaveDb = () => {
  localStorage.setItem('dbConfig', JSON.stringify(dbConfig.value))
  ElMessage.success('数据库配置已保存')
}

/**
 * 测试 Ollama 连接
 */
const handleTestOllama = async () => {
  ollamaStatus.value.testing = true
  ollamaStatus.value.message = ''

  try {
    const result = await electronAPI.testOllamaConnection(toRaw(ollamaConfig.value))
    ollamaStatus.value.connected = result.success
    ollamaStatus.value.message = result.success
      ? `连接成功 - 模型: ${result.data.model}`
      : result.message

    if (result.success) {
      ElMessage.success('Ollama 连接成功')
      await handleRefreshModels()
    } else {
      ElMessage.error(result.message)
    }
  } catch (error) {
    ollamaStatus.value.connected = false
    ollamaStatus.value.message = error.message
    ElMessage.error('连接失败: ' + error.message)
  } finally {
    ollamaStatus.value.testing = false
  }
}

/**
 * 刷新模型列表
 */
const handleRefreshModels = async () => {
  ollamaStatus.value.loadingModels = true

  try {
    const result = await electronAPI.getOllamaModels(toRaw(ollamaConfig.value))
    if (!result.success) {
      console.error('获取模型列表失败:', result.message)
      ElMessage.error('获取模型列表失败: ' + result.message)
      return
    }

    availableModels.value = result.data

    // 如果当前选择的模型不在列表中，但有bge-m3，则选择它
    const hasSelected = result.data.some(m => m.name === ollamaConfig.value.model)
    const hasBgeM3 = result.data.some(m => m.name.includes('bge-m3'))

    if (!hasSelected && hasBgeM3) {
      const bgeModel = result.data.find(m => m.name.includes('bge-m3'))
      ollamaConfig.value.model = bgeModel.name
    }
  } catch (error) {
    console.error('Refresh models error:', error)
    ElMessage.error('刷新模型列表出错: ' + (error.message || error))
  } finally {
    ollamaStatus.value.loadingModels = false
  }
}

/**
 * 保存 Ollama 配置
 */
const handleSaveOllama = () => {
  localStorage.setItem('ollamaConfig', JSON.stringify(ollamaConfig.value))
  ElMessage.success('Ollama 配置已保存')
}
</script>

<style lang="scss" scoped>
.settings {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;

  span {
    flex: 1;
  }
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.help-section {
  font-size: 14px;

  h4 {
    margin: 0 0 12px 0;
    color: #303133;
  }

  ol {
    padding-left: 20px;
    color: #606266;
    line-height: 2;
  }

  code {
    background: #f5f7fa;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
  }
}

.about-content {
  text-align: center;
  padding: 20px;

  h3 {
    margin: 0 0 16px 0;
  }

  p {
    color: #606266;
    margin-bottom: 16px;
  }
}

.mt10 {
  margin-top: 10px;
}

.mt16 {
  margin-top: 16px;
}

.mt20 {
  margin-top: 20px;
}

.ml8 {
  margin-left: 8px;
}
</style>
