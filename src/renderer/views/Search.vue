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

    <el-card v-if="results.length > 0" class="mt20 results-card">
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
    file: 'info'
  }
  return map[type] || 'info'
}
</script>

<style lang="scss" scoped>
.search-page {
  max-width: 1200px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  height: 100%;
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

.results-card {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(.el-card__body) {
    flex: 1;
    overflow-y: auto;
    max-height: calc(100vh - 340px);
  }
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
