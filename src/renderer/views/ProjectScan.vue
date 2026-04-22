<!--
 * @Description: 项目扫描页面
 * @Author: code-vectorizer
 * @Date: 2026-04-08 16:30:00
-->
<template>
  <div class="project-scan">
    <!-- 步骤条 -->
    <el-steps :active="currentStep" finish-status="success" simple>
      <el-step title="选择项目" />
      <el-step title="自动分析" />
      <el-step title="确认信息" />
      <el-step title="解析代码" />
      <el-step title="生成向量" />
    </el-steps>

    <!-- 步骤 1: 选择项目 -->
    <div v-if="currentStep === 0" class="step-content">
      <el-card class="select-card">
        <div class="select-area">
          <el-icon :size="64" color="#909399">
            <FolderOpened />
          </el-icon>
          <h2>选择项目文件夹</h2>
          <p>选择 Vue 或 Spring Boot 项目的根目录</p>
          <el-button type="primary" size="large" @click="handleSelectProject">
            <el-icon>
              <Folder />
            </el-icon>
            浏览文件夹
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 步骤 2: 自动分析中 -->
    <div v-if="currentStep === 1" class="step-content">
      <el-card class="loading-card">
        <el-skeleton :rows="5" animated />
        <div class="loading-text">
          <el-icon class="is-loading">
            <Loading />
          </el-icon>
          正在分析项目结构...
        </div>
      </el-card>
    </div>

    <!-- 步骤 3: 确认项目信息 -->
    <div v-if="currentStep === 2" class="step-content">
      <el-card class="confirm-card">
        <template #header>
          <div class="card-header">
            <span>📋 项目信息确认</span>
            <el-tag :type="projectInfo.projectType === 'vue' ? 'success' : 'primary'">
              {{ projectInfo.projectType }}
            </el-tag>
          </div>
        </template>

        <el-form :model="projectInfo" label-width="120px" class="project-form">
          <el-divider content-position="left">基本信息</el-divider>

          <el-form-item label="项目名称">
            <el-input v-model="projectInfo.name" placeholder="项目名称" />
          </el-form-item>

          <el-form-item label="项目路径">
            <el-input v-model="projectInfo.path" disabled />
          </el-form-item>

          <el-form-item label="项目类型">
            <el-select v-model="projectInfo.projectType" style="width: 100%;">
              <el-option label="Vue" value="vue" />
              <el-option label="Spring Boot" value="springboot" />
              <el-option label="React" value="react" />
              <el-option label="其他" value="unknown" />
            </el-select>
          </el-form-item>

          <el-form-item label="框架版本">
            <el-input v-model="projectInfo.frameworkVersion" placeholder="自动检测或手动输入" />
          </el-form-item>

          <el-divider content-position="left">Git 信息</el-divider>

          <el-form-item label="Git 地址">
            <el-input v-model="projectInfo.gitUrl" placeholder="https://github.com/...">
              <template #prefix>
                <el-icon>
                  <Link />
                </el-icon>
              </template>
            </el-input>
          </el-form-item>

          <el-form-item label="默认分支">
            <el-input v-model="projectInfo.defaultBranch" placeholder="main" />
          </el-form-item>

          <el-divider content-position="left">语言统计</el-divider>

          <el-form-item label="文件统计">
            <div class="language-stats">
              <el-tag v-for="(count, lang) in projectInfo.languageStats" :key="lang" class="lang-tag">
                {{ lang }}: {{ count }}
              </el-tag>
            </div>
          </el-form-item>

          <!-- 嵌套子项目检测 -->
          <template v-if="projectInfo.nestedProjects && projectInfo.nestedProjects.length > 0">
            <el-divider content-position="left">
              <el-icon><Warning /></el-icon>
              检测到嵌套子项目
            </el-divider>

            <el-form-item>
              <template #label>
                <span style="color: #e6a23c;">子项目</span>
              </template>
              <div class="nested-projects-container">
                <div class="nested-projects-desc">
                  <el-icon><WarningFilled /></el-icon>
                  <span>检测到以下嵌套子项目，勾选可从解析中排除</span>
                </div>
                <el-checkbox-group v-model="selectedNestedProjects" class="nested-projects-group">
                  <el-checkbox 
                    v-for="proj in projectInfo.nestedProjects" 
                    :key="proj.path" 
                    :value="proj.path"
                    class="nested-project-checkbox"
                  >
                    <div class="nested-project-item">
                      <div class="project-header">
                        <el-tag size="small" :type="proj.type === 'vue' ? 'success' : 'primary'" effect="dark">
                          {{ proj.type }}
                        </el-tag>
                        <span class="project-name">{{ proj.name }}</span>
                      </div>
                      <span class="project-path">{{ proj.path }}</span>
                      <div class="project-meta">
                        <el-tag size="small" type="info">{{ proj.fileCount }}+ 文件</el-tag>
                        <el-tag v-if="proj.frameworkVersion" size="small" type="success">{{ proj.frameworkVersion }}</el-tag>
                      </div>
                    </div>
                  </el-checkbox>
                </el-checkbox-group>
              </div>
            </el-form-item>
          </template>

          <el-divider content-position="left">高级设置</el-divider>

          <!-- 可排除目录选择 -->
          <el-form-item v-if="projectInfo.detectableExcludeDirs && projectInfo.detectableExcludeDirs.length > 0" label="可排除目录">
            <div class="exclude-dirs-container">
              <div class="exclude-dirs-desc">
                <el-icon><InfoFilled /></el-icon>
                <span>检测到以下可能包含第三方库或资源的目录，勾选可从解析中排除</span>
              </div>
              <el-checkbox-group v-model="selectedExcludeDirs" class="exclude-dirs-group">
                <el-checkbox 
                  v-for="dir in projectInfo.detectableExcludeDirs" 
                  :key="dir.path" 
                  :value="dir.path"
                  class="exclude-dir-checkbox"
                >
                  <div class="exclude-dir-item">
                    <span class="dir-path">{{ dir.path }}</span>
                    <div class="dir-meta">
                      <el-tag size="small" type="info">{{ dir.fileCount }} 个文件</el-tag>
                      <el-tag size="small" type="warning">{{ dir.reason }}</el-tag>
                    </div>
                  </div>
                </el-checkbox>
              </el-checkbox-group>
            </div>
          </el-form-item>

          <el-form-item label="排除模式">
            <el-select v-model="projectInfo.excludePatterns" multiple filterable allow-create
              default-first-option placeholder="选择或输入要排除的文件/目录" style="width: 100%;">
              <el-option label="node_modules" value="node_modules" />
              <el-option label="dist" value="dist" />
              <el-option label="build" value="build" />
              <el-option label="target" value="target" />
              <el-option label=".git" value=".git" />
              <el-option label=".idea" value=".idea" />
              <el-option label=".vscode" value=".vscode" />
            </el-select>
          </el-form-item>

          <el-form-item label="优先级">
            <el-slider v-model="projectInfo.priority" :min="1" :max="10" show-stops />
          </el-form-item>
        </el-form>

        <div class="form-actions">
          <el-button @click="handlePrevStep">上一步</el-button>
          <el-button type="primary" @click="handleConfirmProject">
            下一步：解析代码
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 步骤 4: 解析代码中 -->
    <div v-if="currentStep === 3" class="step-content">
      <el-card class="loading-card">
        <div class="parse-status">
          <el-progress :percentage="parseProgress" :status="parseProgress === 100 ? 'success' : ''"
            :stroke-width="20" striped striped-flow />
          <div class="loading-text">
            <el-icon v-if="parseProgress < 100" class="is-loading">
              <Loading />
            </el-icon>
            <span v-if="parseProgress < 100">正在解析代码文件...</span>
            <span v-else>代码解析完成！</span>
          </div>
          <div v-if="codeChunks.length > 0" class="parse-stats">
            <el-statistic title="提取代码块" :value="codeChunks.length" />
          </div>
        </div>
      </el-card>
    </div>

    <!-- 步骤 5: 生成向量 -->
    <div v-if="currentStep === 4" class="step-content">
      <el-card>
        <template #header>
          <div class="card-header">
            <span>🔢 生成嵌入向量</span>
            <el-tag type="info">{{ ollamaConfig.model }}</el-tag>
          </div>
        </template>

        <div class="vectorize-status">
          <el-progress :percentage="vectorizeProgress" :status="vectorizeStatus" :stroke-width="24" striped
            striped-flow />

          <div class="progress-info">
            <p>{{ vectorizeMessage }}</p>
            <p v-if="vectorizeStats.current > 0">
              进度: {{ vectorizeStats.current }} / {{ vectorizeStats.total }}
            </p>
          </div>

          <el-result v-if="vectorizeStatus === 'success'" icon="success" title="向量化完成！"
            :sub-title="`成功处理 ${vectorizeStats.success} 个代码块`">
            <template #extra>
              <el-button type="primary" @click="handleViewProjects">
                查看项目管理
              </el-button>
              <el-button @click="handleReset">扫描新项目</el-button>
            </template>
          </el-result>

          <el-result v-if="vectorizeStatus === 'exception'" icon="error" title="处理失败" :sub-title="vectorizeMessage">
            <template #extra>
              <el-button @click="handleRetry">重试</el-button>
            </template>
          </el-result>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup name="ProjectScan">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 获取全局实例 ====================
const router = useRouter()

// ==================== 响应式数据 ====================
const currentStep = ref(0)
const parseProgress = ref(0)
const vectorizeProgress = ref(0)
const vectorizeStatus = ref('') // '', 'success', 'exception'
const vectorizeMessage = ref('准备生成向量...')
const vectorizeStats = ref({ current: 0, total: 0, success: 0 })

const projectInfo = ref({
  name: '',
  path: '',
  projectType: 'unknown',
  gitUrl: '',
  defaultBranch: 'main',
  languageStats: {},
  frameworkVersion: '',
  excludePatterns: ['node_modules', 'dist', 'build', 'target', '.git', '.idea', '.vscode'],
  detectableExcludeDirs: [],
  priority: 5
})

// 用户选择的可排除目录（默认全选）
const selectedExcludeDirs = ref([])
// 用户选择的要排除的嵌套子项目
const selectedNestedProjects = ref([])

const codeChunks = ref([])
const dbConfig = ref({})
const ollamaConfig = ref({})

// ==================== 生命周期钩子 ====================
onMounted(() => {
  // 加载配置
  dbConfig.value = JSON.parse(localStorage.getItem('dbConfig') || '{}')
  ollamaConfig.value = JSON.parse(localStorage.getItem('ollamaConfig') || '{}')

  // 注册进度监听
  if (isElectronEnv()) {
    electronAPI.onVectorizeProgress(handleVectorizeProgress)
  }
})

onUnmounted(() => {
  if (isElectronEnv()) {
    electronAPI.removeVectorizeProgress()
  }
})

// ==================== 方法定义 ====================
/**
 * 选择项目文件夹
 */
const handleSelectProject = async () => {
  const result = await electronAPI.selectProject()
  if (!result.success) {
    ElMessage.warning(result.message || '未选择文件夹')
    return
  }

  projectInfo.value.path = result.path
  projectInfo.value.name = result.path.split(/[/\\]/).pop()
  currentStep.value = 1

  // 自动分析
  setTimeout(() => analyzeProject(), 500)
}

/**
 * 分析项目
 */
const analyzeProject = async () => {
  try {
    const result = await electronAPI.scanProject(projectInfo.value.path)
    if (!result.success) {
      ElMessage.error(result.message)
      currentStep.value = 0
      return
    }

    // 合并自动检测的信息
    Object.assign(projectInfo.value, result.data)
    
    // 默认全选所有可排除目录
    if (result.data.detectableExcludeDirs && result.data.detectableExcludeDirs.length > 0) {
      selectedExcludeDirs.value = result.data.detectableExcludeDirs.map(dir => dir.path)
    }
    
    // 默认全选所有嵌套子项目（通常需要排除）
    if (result.data.nestedProjects && result.data.nestedProjects.length > 0) {
      selectedNestedProjects.value = result.data.nestedProjects.map(proj => proj.path)
    }
    
    currentStep.value = 2
  } catch (error) {
    ElMessage.error('项目分析失败: ' + error.message)
    currentStep.value = 0
  }
}

/**
 * 确认项目信息，开始解析代码
 */
const handleConfirmProject = async () => {
  if (!projectInfo.value.name) {
    ElMessage.warning('请输入项目名称')
    return
  }

  currentStep.value = 3
  parseProgress.value = 0

  // 合并用户选择的排除目录和嵌套子项目到 excludePatterns
  const allExcludePatterns = [
    ...projectInfo.value.excludePatterns,
    ...selectedExcludeDirs.value,
    ...selectedNestedProjects.value
  ]

  // 模拟进度
  const progressInterval = setInterval(() => {
    if (parseProgress.value < 90) {
      parseProgress.value += Math.random() * 10
    }
  }, 200)

  try {
    const result = await electronAPI.parseCode({
      projectPath: projectInfo.value.path,
      projectType: projectInfo.value.projectType,
      projectName: projectInfo.value.name,
      excludePatterns: allExcludePatterns
    })

    clearInterval(progressInterval)
    parseProgress.value = 100

    if (!result.success) {
      ElMessage.error(result.message)
      return
    }

    codeChunks.value = result.data
    setTimeout(() => {
      currentStep.value = 4
      startVectorize()
    }, 500)
  } catch (error) {
    clearInterval(progressInterval)
    ElMessage.error('代码解析失败: ' + error.message)
  }
}

/**
 * 开始生成向量
 */
const startVectorize = async () => {
  vectorizeProgress.value = 0
  vectorizeStatus.value = ''
  vectorizeMessage.value = '正在初始化...'

  try {
    const result = await electronAPI.vectorize({
      projectInfo: JSON.parse(JSON.stringify(projectInfo.value)),
      codeChunks: JSON.parse(JSON.stringify(codeChunks.value)),
      dbConfig: JSON.parse(JSON.stringify(dbConfig.value)),
      ollamaConfig: JSON.parse(JSON.stringify(ollamaConfig.value))
    })

    if (!result.success) {
      vectorizeStatus.value = 'exception'
      vectorizeMessage.value = result.message
    }
  } catch (error) {
    vectorizeStatus.value = 'exception'
    vectorizeMessage.value = error.message
  }
}

/**
 * 处理向量化进度
 */
const handleVectorizeProgress = (data) => {
  vectorizeMessage.value = data.message

  if (data.progress !== undefined) {
    vectorizeProgress.value = data.progress
  }

  if (data.current !== undefined) {
    vectorizeStats.value.current = data.current
    vectorizeStats.value.total = data.total
  }

  if (data.stage === 'completed') {
    vectorizeStatus.value = 'success'
    vectorizeStats.value.success = data.result?.success || 0
  } else if (data.stage === 'error') {
    vectorizeStatus.value = 'exception'
  }
}

/**
 * 返回上一步
 */
const handlePrevStep = () => {
  currentStep.value = 0
}

/**
 * 跳转到项目管理页面
 */
const handleViewProjects = () => {
  router.push('/projects')
}

/**
 * 重置扫描流程
 */
const handleReset = () => {
  currentStep.value = 0
  parseProgress.value = 0
  vectorizeProgress.value = 0
  vectorizeStatus.value = ''
  vectorizeMessage.value = ''
  vectorizeStats.value = { current: 0, total: 0, success: 0 }
  codeChunks.value = []
  projectInfo.value = {
    name: '',
    path: '',
    projectType: 'unknown',
    gitUrl: '',
    defaultBranch: 'main',
    languageStats: {},
    frameworkVersion: '',
    excludePatterns: ['node_modules', 'dist', 'build', 'target', '.git', '.idea', '.vscode'],
    detectableExcludeDirs: [],
    priority: 5
  }
  selectedExcludeDirs.value = []
  selectedNestedProjects.value = []
}

/**
 * 重试向量化
 */
const handleRetry = () => {
  currentStep.value = 3
}
</script>

<style lang="scss" scoped>
.project-scan {
  max-width: 900px;
  margin: 0 auto;
}

.step-content {
  margin-top: 30px;
}

.select-card {
  text-align: center;
  padding: 60px 20px;
}

.select-area {
  h2 {
    margin: 20px 0 10px;
  }

  p {
    color: #909399;
    margin-bottom: 24px;
  }
}

.loading-card {
  padding: 40px;
}

.loading-text {
  text-align: center;
  margin-top: 20px;
  color: #606266;
  font-size: 16px;

  .el-icon {
    margin-right: 8px;
  }
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-weight: 600;
}

.project-form {
  max-width: 600px;
  margin: 0 auto;
}

.language-stats {
  display: flex;
  flex-wrap: wrap;

  .lang-tag {
    margin: 0 8px 8px 0;
  }
}

.form-actions {
  display: flex;
  justify-content: center;
  gap: 16px;
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e4e7ed;
}

.parse-status {
  padding: 40px;
}

.parse-stats {
  margin-top: 30px;
  text-align: center;
}

.vectorize-status {
  padding: 20px;
}

.progress-info {
  text-align: center;
  margin-top: 20px;
  color: #606266;
}

.exclude-dirs-container {
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px;
  background-color: #f5f7fa;
}

.exclude-dirs-desc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #606266;
  font-size: 13px;
}

.exclude-dirs-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.exclude-dir-checkbox {
  margin-right: 0;
  padding: 8px 12px;
  border-radius: 4px;
  background-color: #fff;
  border: 1px solid #ebeef5;
  transition: all 0.2s;
  height: auto;
  min-height: 32px;
}

.exclude-dir-checkbox:hover {
  border-color: #409eff;
}

.exclude-dir-checkbox.is-checked {
  background-color: #ecf5ff;
  border-color: #409eff;
}

/* 修复 checkbox label 高度问题 */
.exclude-dir-checkbox :deep(.el-checkbox__label) {
  height: auto;
  line-height: normal;
  white-space: normal;
  padding: 0;
  display: flex;
  align-items: flex-start;
}

.exclude-dir-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 4px;
  overflow: hidden;
}

.dir-path {
  font-family: monospace;
  font-size: 13px;
  color: #303133;
  font-weight: 500;
  word-break: break-all;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.dir-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

/* 确认信息卡片样式 */
.confirm-card {
  max-height: calc(100vh - 200px);
  display: flex;
  flex-direction: column;
}

.confirm-card :deep(.el-card__body) {
  overflow-y: auto;
  max-height: calc(100vh - 260px);
  padding-right: 16px;
}

/* 可排除目录容器滚动 */
.exclude-dirs-container {
  max-height: 300px;
  overflow-y: auto;
}

/* 嵌套子项目样式 */
.nested-projects-container {
  border: 1px solid #e6a23c;
  border-radius: 4px;
  padding: 12px;
  background-color: #fdf6ec;
}

.nested-projects-desc {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  color: #e6a23c;
  font-size: 13px;
  font-weight: 500;
}

.nested-projects-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.nested-project-checkbox {
  margin-right: 0;
  padding: 10px 12px;
  border-radius: 4px;
  background-color: #fff;
  border: 1px solid #e6a23c;
  transition: all 0.2s;
  height: auto;
  min-height: 32px;
}

.nested-project-checkbox:hover {
  border-color: #f56c6c;
  background-color: #fef0f0;
}

.nested-project-checkbox.is-checked {
  background-color: #fef0f0;
  border-color: #f56c6c;
}

.nested-project-checkbox :deep(.el-checkbox__label) {
  height: auto;
  line-height: normal;
  white-space: normal;
  padding: 0;
  display: flex;
  align-items: flex-start;
}

.nested-project-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-left: 4px;
  overflow: hidden;
}

.project-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
}

.project-path {
  font-family: monospace;
  font-size: 12px;
  color: #606266;
  word-break: break-all;
  overflow-wrap: break-word;
  line-height: 1.4;
}

.project-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
