<!--
 * @Description: 首页组件
 * @Author: code-vectorizer
 * @Date: 2026-04-08 16:30:00
-->
<template>
  <div class="home">
    <el-row :gutter="20">
      <el-col :span="24">
        <div class="welcome-card">
          <h1>🚀 Code Vectorizer</h1>
          <p>将 Vue 和 Spring Boot 项目代码转换为向量存储，构建 AI 可检索的知识库</p>
          <el-button type="primary" size="large" @click="handleStartScan">
            <el-icon>
              <Plus />
            </el-icon>
            开始扫描项目
          </el-button>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :span="8">
        <el-card class="feature-card">
          <template #header>
            <div class="card-header">
              <el-icon>
                <Search />
              </el-icon>
              <span>自动识别</span>
            </div>
          </template>
          <div class="feature-content">
            <p>自动检测项目类型、框架版本、Git 信息和语言统计</p>
            <el-tag size="small" type="info">Vue</el-tag>
            <el-tag size="small" type="info" class="ml5">Spring Boot</el-tag>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="feature-card">
          <template #header>
            <div class="card-header">
              <el-icon>
                <Cpu />
              </el-icon>
              <span>本地嵌入</span>
            </div>
          </template>
          <div class="feature-content">
            <p>使用本地 Ollama 部署的 bge-m3 模型生成代码向量</p>
            <el-tag size="small" type="success">bge-m3</el-tag>
            <el-tag size="small" type="success" class="ml5">隐私安全</el-tag>
          </div>
        </el-card>
      </el-col>

      <el-col :span="8">
        <el-card class="feature-card">
          <template #header>
            <div class="card-header">
              <el-icon>
                <Folder />
              </el-icon>
              <span>知识库存储</span>
            </div>
          </template>
          <div class="feature-content">
            <p>将代码向量存储到 PostgreSQL + pgvector，支持语义搜索</p>
            <el-tag size="small" type="warning">PostgreSQL</el-tag>
            <el-tag size="small" type="warning" class="ml5">pgvector</el-tag>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20" v-if="stats.projects > 0">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon>
                <DataAnalysis />
              </el-icon>
              <span>统计信息</span>
            </div>
          </template>
          <el-row :gutter="40">
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-value">{{ stats.projects }}</div>
                <div class="stat-label">已索引项目</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-value">{{ stats.embeddings }}</div>
                <div class="stat-label">代码块数量</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-value">{{ stats.vueProjects }}</div>
                <div class="stat-label">Vue 项目</div>
              </div>
            </el-col>
            <el-col :span="6">
              <div class="stat-item">
                <div class="stat-value">{{ stats.javaProjects }}</div>
                <div class="stat-label">Java 项目</div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>

    <el-row :gutter="20" class="mt20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <el-icon>
                <List />
              </el-icon>
              <span>快速开始</span>
            </div>
          </template>
          <el-steps :active="1" simple>
            <el-step title="配置" description="设置数据库和Ollama" icon="Setting" />
            <el-step title="扫描" description="选择并扫描项目" icon="Search" />
            <el-step title="确认" description="编辑项目信息" icon="Edit" />
            <el-step title="向量化" description="生成代码向量" icon="Cpu" />
            <el-step title="完成" description="存储到知识库" icon="Check" />
          </el-steps>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup name="Home">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 获取全局实例 ====================
const router = useRouter()

// ==================== 响应式数据 ====================
const stats = ref({
  projects: 0,
  embeddings: 0,
  vueProjects: 0,
  javaProjects: 0
})

// ==================== 生命周期钩子 ====================
onMounted(async () => {
  if (isElectronEnv()) {
    await loadStats()
  }
})

// ==================== 方法定义 ====================
/**
 * 加载统计数据
 */
const loadStats = async () => {
  try {
    const dbConfig = JSON.parse(localStorage.getItem('dbConfig') || '{}')
    if (!dbConfig.host) {
      return
    }

    const result = await electronAPI.getProjects(dbConfig)
    if (!result.success) {
      return
    }

    const projects = result.data
    stats.value.projects = projects.length
    stats.value.embeddings = projects.reduce((sum, p) => sum + (parseInt(p.embedding_count) || 0), 0)
  } catch (error) {
    console.error('Load stats error:', error)
  }
}

/**
 * 跳转到项目扫描页面
 */
const handleStartScan = () => {
  router.push('/scan')
}
</script>

<style lang="scss" scoped>
.welcome-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  padding: 40px;
  border-radius: 12px;
  text-align: center;

  h1 {
    font-size: 32px;
    margin-bottom: 16px;
  }

  p {
    font-size: 16px;
    opacity: 0.9;
    margin-bottom: 24px;
  }
}

.feature-card {
  height: 100%;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
}

.feature-content {
  color: #606266;
  line-height: 1.6;

  p {
    margin-bottom: 12px;
  }
}

.stat-item {
  text-align: center;
  padding: 20px;
}

.stat-value {
  font-size: 36px;
  font-weight: bold;
  color: #409eff;
  line-height: 1;
}

.stat-label {
  margin-top: 8px;
  color: #909399;
  font-size: 14px;
}

.mt20 {
  margin-top: 20px;
}

.ml5 {
  margin-left: 5px;
}
</style>
