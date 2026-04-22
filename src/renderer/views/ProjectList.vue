<!--
 * @Description: 项目管理列表页面
 * @Author: code-vectorizer
 * @Date: 2026-04-08 16:30:00
-->
<template>
  <div class="project-list">
    <el-card>
      <template #header>
        <div class="card-header">
          <div class="header-left">
            <el-icon>
              <Folder />
            </el-icon>
            <span>已索引项目</span>
            <el-tag type="info" size="small">{{ projects.length }} 个</el-tag>
          </div>
          <div class="header-right">
            <el-button type="primary" size="small" @click="handleAddProject">
              <el-icon>
                <Plus />
              </el-icon>
              添加项目
            </el-button>
            <el-button size="small" :loading="loading" @click="loadProjects">
              <el-icon>
                <Refresh />
              </el-icon>
              刷新
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="projects" v-loading="loading" style="width: 100%" stripe>
        <el-table-column type="index" width="50" />

        <el-table-column label="项目名称" min-width="150">
          <template #default="{ row }">
            <div class="project-name">
              <el-icon :size="18" :color="getProjectTypeColor(row.project_name)">
                <component :is="getProjectTypeIcon(row.project_name)" />
              </el-icon>
              <span>{{ row.project_name }}</span>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getProjectTypeTag(row.project_name)" size="small">
              {{ getProjectType(row.project_name) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="代码块" width="100" align="center">
          <template #default="{ row }">
            <el-tag type="info" effect="plain" size="small">
              {{ row.embedding_count || 0 }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="路径" min-width="200" show-overflow-tooltip>
          <template #default="{ row }">
            <el-text truncated>{{ row.project_path }}</el-text>
          </template>
        </el-table-column>

        <el-table-column label="Git" width="80" align="center">
          <template #default="{ row }">
            <el-icon v-if="row.git_url" color="#67c23a">
              <Link />
            </el-icon>
            <el-icon v-else color="#c0c4cc">
              <Link />
            </el-icon>
          </template>
        </el-table-column>

        <el-table-column label="最后索引" width="160">
          <template #default="{ row }">
            {{ formatDate(row.last_indexed_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button-group>
              <el-button size="small" @click="handleViewDetails(row)">
                <el-icon>
                  <View />
                </el-icon>
                详情
              </el-button>
              <el-button size="small" type="danger" @click="handleDelete(row)">
                <el-icon>
                  <Delete />
                </el-icon>
                删除
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && projects.length === 0" description="暂无项目">
        <el-button type="primary" @click="handleAddProject">
          去添加项目
        </el-button>
      </el-empty>
    </el-card>

    <!-- 项目详情对话框 -->
    <el-dialog v-model="detailsVisible" title="项目详情" width="700px">
      <div v-if="selectedProject" class="project-details">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="项目名称" :span="2">
            {{ selectedProject.project_name }}
          </el-descriptions-item>
          <el-descriptions-item label="项目路径" :span="2">
            <el-text truncated style="max-width: 500px;">
              {{ selectedProject.project_path }}
            </el-text>
          </el-descriptions-item>
          <el-descriptions-item label="项目类型">
            {{ selectedProject.project_type || 'unknown' }}
          </el-descriptions-item>
          <el-descriptions-item label="默认分支">
            {{ selectedProject.default_branch }}
          </el-descriptions-item>
          <el-descriptions-item label="Git 地址" :span="2">
            {{ selectedProject.git_url || '无' }}
          </el-descriptions-item>
          <el-descriptions-item label="代码块数量">
            {{ selectedProject.embedding_count || 0 }}
          </el-descriptions-item>
          <el-descriptions-item label="优先级">
            <el-rate v-model="selectedProject.priority" disabled />
          </el-descriptions-item>
          <el-descriptions-item label="语言统计" :span="2">
            <div class="language-tags">
              <el-tag v-for="(count, lang) in parseLanguageStats(selectedProject.language_stats)" :key="lang"
                class="lang-tag">
                {{ lang }}: {{ count }}
              </el-tag>
            </div>
          </el-descriptions-item>
          <el-descriptions-item label="创建时间">
            {{ formatDate(selectedProject.created_at) }}
          </el-descriptions-item>
          <el-descriptions-item label="最后索引">
            {{ formatDate(selectedProject.last_indexed_at) }}
          </el-descriptions-item>
        </el-descriptions>
      </div>
    </el-dialog>
  </div>
</template>

<script setup name="ProjectList">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 获取全局实例 ====================
const router = useRouter()

// ==================== 响应式数据 ====================
const projects = ref([])
const loading = ref(false)
const detailsVisible = ref(false)
const selectedProject = ref(null)

// ==================== 生命周期钩子 ====================
onMounted(() => {
  if (isElectronEnv()) {
    loadProjects()
  }
})

// ==================== 方法定义 ====================
/**
 * 加载项目列表
 */
const loadProjects = async () => {
  loading.value = true

  try {
    const dbConfig = JSON.parse(localStorage.getItem('dbConfig') || '{}')
    if (!dbConfig.host) {
      ElMessage.warning('请先配置数据库连接')
      return
    }

    const result = await electronAPI.getProjects(dbConfig)
    if (!result.success) {
      ElMessage.error(result.message)
      return
    }

    projects.value = result.data
  } catch (error) {
    ElMessage.error('加载项目列表失败: ' + error.message)
  } finally {
    loading.value = false
  }
}

/**
 * 删除项目
 */
const handleDelete = async (project) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除项目 "${project.project_name}" 吗？\n这将删除该项目的所有代码向量。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const dbConfig = JSON.parse(localStorage.getItem('dbConfig') || '{}')
    const result = await electronAPI.deleteProject({
      projectName: project.project_name,
      dbConfig
    })

    if (!result.success) {
      ElMessage.error(result.message)
      return
    }

    ElMessage.success('项目已删除')
    await loadProjects()
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('删除失败: ' + error.message)
    }
  }
}

/**
 * 查看项目详情
 */
const handleViewDetails = (project) => {
  selectedProject.value = project
  detailsVisible.value = true
}

/**
 * 跳转到添加项目页面
 */
const handleAddProject = () => {
  router.push('/scan')
}

/**
 * 解析语言统计数据
 */
const parseLanguageStats = (stats) => {
  if (!stats) return {}
  try {
    return typeof stats === 'string' ? JSON.parse(stats) : stats
  } catch {
    return {}
  }
}

/**
 * 格式化日期
 */
const formatDate = (dateStr) => {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleString('zh-CN')
}

/**
 * 根据项目名称推断项目类型
 */
const getProjectType = (name) => {
  const lower = name.toLowerCase()
  if (lower.includes('vue') || lower.includes('front')) return 'Vue'
  if (lower.includes('boot') || lower.includes('java') || lower.includes('back')) return 'Spring Boot'
  return 'Unknown'
}

/**
 * 获取项目类型对应的标签样式
 */
const getProjectTypeTag = (name) => {
  const type = getProjectType(name)
  if (type === 'Vue') return 'success'
  if (type === 'Spring Boot') return 'primary'
  return 'info'
}

/**
 * 获取项目类型对应的颜色
 */
const getProjectTypeColor = (name) => {
  const type = getProjectType(name)
  if (type === 'Vue') return '#67c23a'
  if (type === 'Spring Boot') return '#409eff'
  return '#909399'
}

/**
 * 获取项目类型对应的图标
 */
const getProjectTypeIcon = (name) => {
  const type = getProjectType(name)
  if (type === 'Vue') return 'Monitor'
  if (type === 'Spring Boot') return 'Coffee'
  return 'Folder'
}
</script>

<style lang="scss" scoped>
.project-list {
  max-width: 1400px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-right {
    display: flex;
    gap: 8px;
  }
}

.project-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.language-tags {
  display: flex;
  flex-wrap: wrap;

  .lang-tag {
    margin: 0 8px 8px 0;
  }
}

.project-details {
  padding: 10px;
}
</style>
