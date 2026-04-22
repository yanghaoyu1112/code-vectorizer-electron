<!--
 * @Description: 应用主布局组件
 * @Author: code-vectorizer
 * @Date: 2026-04-08 16:30:00
-->
<template>
  <div class="app-container">
    <el-container>
      <!-- 侧边栏 -->
      <el-aside width="200px" class="sidebar">
        <div class="logo">
          <el-icon :size="32">
            <Document />
          </el-icon>
          <span>Code Vectorizer</span>
        </div>
        <el-menu
          :default-active="$route.path"
          router
          class="nav-menu"
          background-color="#1a1a2e"
          text-color="#a0a0a0"
          active-text-color="#fff"
        >
          <el-menu-item index="/">
            <el-icon>
              <HomeFilled />
            </el-icon>
            <span>首页</span>
          </el-menu-item>
          <el-menu-item index="/scan">
            <el-icon>
              <Search />
            </el-icon>
            <span>项目扫描</span>
          </el-menu-item>
          <el-menu-item index="/projects">
            <el-icon>
              <Folder />
            </el-icon>
            <span>项目管理</span>
          </el-menu-item>
          <el-menu-item index="/search">
            <el-icon>
              <Search />
            </el-icon>
            <span>语义搜索</span>
          </el-menu-item>
          <el-menu-item index="/settings">
            <el-icon>
              <Setting />
            </el-icon>
            <span>设置</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <!-- 主内容区 -->
      <el-container>
        <el-header class="header">
          <div class="header-title">{{ $route.meta.title }}</div>
          <div class="header-actions">
            <el-tag v-if="connectionStatus.db" type="success" effect="dark">
              <el-icon>
                <Connection />
              </el-icon>
              数据库已连接
            </el-tag>
            <el-tag v-else type="danger" effect="dark">
              <el-icon>
                <Warning />
              </el-icon>
              数据库未连接
            </el-tag>
            <el-tag v-if="connectionStatus.ollama" type="success" effect="dark" class="ml8">
              <el-icon>
                <Cpu />
              </el-icon>
              Ollama已连接
            </el-tag>
            <el-tag v-else type="danger" effect="dark" class="ml8">
              <el-icon>
                <Warning />
              </el-icon>
              Ollama未连接
            </el-tag>
          </div>
        </el-header>
        <el-main class="main-content">
          <router-view />
        </el-main>
      </el-container>
    </el-container>
  </div>
</template>

<script setup name="App">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { electronAPI, isElectronEnv } from '@/utils/electron'

// ==================== 获取全局实例 ====================
const $route = useRoute()

// ==================== 响应式数据 ====================
const connectionStatus = ref({
  db: false,
  ollama: false
})

// 轮询定时器
let pollTimer = null

// ==================== 生命周期钩子 ====================
onMounted(async () => {
  if (isElectronEnv()) {
    await checkConnections()
    // 每 5 秒刷新一次连接状态
    pollTimer = setInterval(checkConnections, 5000)
  }
})

onUnmounted(() => {
  if (pollTimer) {
    clearInterval(pollTimer)
  }
})

// ==================== 方法定义 ====================
/**
 * 检查数据库和 Ollama 连接状态
 */
const checkConnections = async () => {
  try {
    // 默认配置（与 Settings.vue 保持一致）
    const defaultDbConfig = {
      host: '127.0.0.1',
      port: 5432,
      database: 'postgres',
      user: 'postgres',
      password: ''
    }
    const defaultOllamaConfig = {
      baseUrl: 'http://127.0.0.1:11434',
      model: 'bge-m3:latest'
    }

    // 从 localStorage 获取配置，未保存时使用默认配置
    const savedDb = JSON.parse(localStorage.getItem('dbConfig') || '{}')
    const savedOllama = JSON.parse(localStorage.getItem('ollamaConfig') || '{}')

    // 合并默认配置和保存的配置
    const dbConfig = { ...defaultDbConfig, ...savedDb }
    const ollamaConfig = { ...defaultOllamaConfig, ...savedOllama }

    // 检查数据库连接
    if (dbConfig.host) {
      try {
        const dbResult = await electronAPI.testDbConnection(dbConfig)
        connectionStatus.value.db = dbResult.success
      } catch (e) {
        connectionStatus.value.db = false
        console.error('DB connection check failed:', e)
      }
    }

    // 检查 Ollama 连接
    if (ollamaConfig.baseUrl) {
      try {
        const ollamaResult = await electronAPI.testOllamaConnection(ollamaConfig)
        connectionStatus.value.ollama = ollamaResult.success
      } catch (e) {
        connectionStatus.value.ollama = false
        console.error('Ollama connection check failed:', e)
      }
    }
  } catch (error) {
    console.error('Connection check error:', error)
  }
}
</script>

<style lang="scss" scoped>
.app-container {
  height: 100vh;
  overflow: hidden;
}

.sidebar {
  background: #1a1a2e;
  color: #fff;
  display: flex;
  flex-direction: column;

  .logo {
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    font-size: 16px;
    font-weight: bold;
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  }

  .nav-menu {
    border-right: none;
    flex: 1;
  }
}

.header {
  background: #fff;
  border-bottom: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  justify-content: space-between;

  .header-title {
    font-size: 18px;
    font-weight: 600;
  }

  .header-actions {
    display: flex;
    align-items: center;
  }
}

.main-content {
  background: #f5f7fa;
  padding: 20px;
  overflow-y: auto;
}

.ml8 {
  margin-left: 8px;
}
</style>
