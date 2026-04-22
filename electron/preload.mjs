/**
 * Electron 预加载脚本
 * 在渲染进程上下文中安全地暴露主进程 API
 */

import { contextBridge, ipcRenderer } from 'electron';

/**
 * 暴露给渲染进程的 API
 */
const electronAPI = {
  // 项目选择
  selectProject: () => ipcRenderer.invoke('select-project'),

  // 数据库连接测试
  testDbConnection: (config) => ipcRenderer.invoke('test-db-connection', config),

  // 获取项目列表
  getProjects: (config) => ipcRenderer.invoke('get-projects', config),

  // 删除项目
  deleteProject: (params) => ipcRenderer.invoke('delete-project', params),

  // 扫描项目
  scanProject: (path) => ipcRenderer.invoke('scan-project', path),

  // 解析代码
  parseCode: (params) => ipcRenderer.invoke('parse-code', params),

  // 向量化
  vectorize: (params) => ipcRenderer.invoke('vectorize', params),

  // Ollama 连接测试
  testOllamaConnection: (config) => ipcRenderer.invoke('test-ollama-connection', config),

  // 获取 Ollama 模型列表
  getOllamaModels: (config) => ipcRenderer.invoke('get-ollama-models', config),

  // 语义搜索
  searchSimilar: (params) => ipcRenderer.invoke('search-similar', params),

  // ==================== 事件监听 ====================

  /**
   * 监听向量化进度
   */
  onVectorizeProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('vectorize-progress', handler);
    return () => ipcRenderer.removeListener('vectorize-progress', handler);
  },

  /**
   * 移除所有进度监听
   */
  removeVectorizeProgress: () => {
    ipcRenderer.removeAllListeners('vectorize-progress');
  }
};

// 暴露 API 到渲染进程
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

console.log('[Preload] IPC API 已暴露');
