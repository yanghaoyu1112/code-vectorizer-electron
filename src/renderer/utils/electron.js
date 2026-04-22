/**

 * @Description: Electron API 封装工具

 * @Author: code-vectorizer

 * @Date: 2026-04-08 16:30:00

 */



// ==================== 常量定义 ====================

const isElectron = typeof window !== 'undefined' && window.electronAPI !== undefined



// ==================== Mock API (非Electron环境) ====================

const mockAPI = {

  // 项目选择 - 使用原生文件选择器

  selectProject: async () => {

    console.warn('[Mock] selectProject: 请在 Electron 环境中使用')

    return { success: false, message: '请在 Electron 环境中使用文件选择功能' }

  },



  // 项目扫描

  scanProject: async () => {

    console.warn('[Mock] scanProject: 请在 Electron 环境中使用')

    return { success: false, message: '请在 Electron 环境中使用项目扫描功能' }

  },



  // 数据库连接测试

  testDbConnection: async (config) => {

    console.warn('[Mock] testDbConnection:', config)

    return { success: false, message: '请在 Electron 环境中使用数据库功能' }

  },



  // 获取项目列表

  getProjects: async (config) => {

    console.warn('[Mock] getProjects: 请在 Electron 环境中使用')

    return { success: true, data: [] }

  },



  // 删除项目

  deleteProject: async (params) => {

    console.warn('[Mock] deleteProject: 请在 Electron 环境中使用')

    return { success: false, message: '请在 Electron 环境中使用' }

  },



  // Ollama 连接测试

  testOllamaConnection: async (config) => {

    console.warn('[Mock] testOllamaConnection:', config)

    return { success: false, message: '请在 Electron 环境中使用 Ollama 功能' }

  },



  // 获取 Ollama 模型列表

  getOllamaModels: async (config) => {

    console.warn('[Mock] getOllamaModels: 请在 Electron 环境中使用')

    return { success: true, data: [] }

  },



  // 解析代码

  parseCode: async () => {

    console.warn('[Mock] parseCode: 请在 Electron 环境中使用')

    return { success: false, message: '请在 Electron 环境中使用代码解析功能' }

  },



  // 向量化

  vectorize: async () => {

    console.warn('[Mock] vectorize: 请在 Electron 环境中使用')

    return { success: false, message: '请在 Electron 环境中使用向量化功能' }

  },



  // 进度监听 - 空实现

  onVectorizeProgress: () => {

    // Mock 环境下不做任何操作

  },



  // 移除进度监听

  removeVectorizeProgress: () => {

    // Mock 环境下不做任何操作

  }

}



// ==================== 导出 API ====================

export const electronAPI = isElectron ? window.electronAPI : mockAPI



// ==================== 环境判断工具 ====================

export const isElectronEnv = () => isElectron

