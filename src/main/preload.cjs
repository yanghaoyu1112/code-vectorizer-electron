const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 项目选择
  selectProject: () => ipcRenderer.invoke('select-project'),
  
  // 项目扫描
  scanProject: (path) => ipcRenderer.invoke('scan-project', path),
  
  // 数据库
  testDbConnection: (config) => ipcRenderer.invoke('test-db-connection', config),
  getProjects: (config) => ipcRenderer.invoke('get-projects', config),
  deleteProject: (params) => ipcRenderer.invoke('delete-project', params),
  
  // Ollama
  testOllamaConnection: (config) => ipcRenderer.invoke('test-ollama-connection', config),
  getOllamaModels: (config) => ipcRenderer.invoke('get-ollama-models', config),
  
  // 代码解析
  parseCode: (params) => ipcRenderer.invoke('parse-code', params),
  
  // 向量化
  vectorize: (params) => ipcRenderer.invoke('vectorize', params),
  
  // 进度监听
  onVectorizeProgress: (callback) => {
    ipcRenderer.on('vectorize-progress', (event, data) => callback(data));
  },
  removeVectorizeProgress: () => {
    ipcRenderer.removeAllListeners('vectorize-progress');
  }
});
