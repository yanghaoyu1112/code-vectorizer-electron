/**
 * Electron 主进程入口
 * 代码矢量化工具 - 主进程
 */

import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { DatabaseManager } from './services/DatabaseManager.js';
import { OllamaEmbedder } from './services/OllamaEmbedder.js';
import { ProjectScanner } from './services/ProjectScanner.js';
import { CodeParser } from './services/CodeParser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 禁用自动填充和密码保存相关功能
app.commandLine.appendSwitch('disable-features', 'AutofillServerCommunication,PasswordManager');
app.commandLine.appendSwitch('disable-autofill');

// 保持窗口全局引用
let mainWindow = null;

/**
 * 创建主窗口
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    title: 'Code Vectorizer - 代码矢量化工具',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      // 禁用自动填充相关功能
      enableWebSQL: false
    },
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    show: false
  });

  // 加载应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL);
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // 等窗口加载完成后再显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // 窗口关闭处理
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

/**
 * 注册 IPC 处理程序
 */
function registerIpcHandlers() {
  console.log('[Main] 注册 IPC 处理程序...');

  // 选择项目文件夹
  ipcMain.handle('select-project', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: '选择项目文件夹'
    });

    if (result.canceled || result.filePaths.length === 0) {
      return { success: false, message: '未选择文件夹' };
    }

    return { success: true, path: result.filePaths[0] };
  });

  // 测试数据库连接
  ipcMain.handle('test-db-connection', async (event, config) => {
    const dbManager = new DatabaseManager(config);
    try {
      await dbManager.connect();
      await dbManager.close();
      return { success: true, message: '数据库连接成功' };
    } catch (error) {
      // 提取纯文本错误信息，避免返回不可克隆的错误对象
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 测试 Ollama 连接
  ipcMain.handle('test-ollama-connection', async (event, config) => {
    const embedder = new OllamaEmbedder(config);
    try {
      const result = await embedder.checkConnection();
      // 再次序列化确保数据可克隆
      const safeResult = JSON.parse(JSON.stringify(result));
      return { success: true, data: safeResult };
    } catch (error) {
      // 提取纯文本错误信息，避免返回不可克隆的错误对象
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 获取 Ollama 模型列表
  ipcMain.handle('get-ollama-models', async (event, config) => {
    const embedder = new OllamaEmbedder(config);
    try {
      const models = await embedder.listModels();
      // 再次序列化确保数据可克隆
      const safeModels = JSON.parse(JSON.stringify(models));
      return { success: true, data: safeModels };
    } catch (error) {
      // 提取纯文本错误信息，避免返回不可克隆的错误对象
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 获取项目列表
  ipcMain.handle('get-projects', async (event, config) => {
    const dbManager = new DatabaseManager(config);
    try {
      await dbManager.connect();
      const projects = await dbManager.getAllProjects();
      await dbManager.close();
      return { success: true, data: projects };
    } catch (error) {
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 删除项目
  ipcMain.handle('delete-project', async (event, params) => {
    const { projectName, dbConfig } = params;
    const dbManager = new DatabaseManager(dbConfig);
    try {
      await dbManager.connect();
      await dbManager.deleteProject(projectName);
      await dbManager.close();
      return { success: true, message: '项目已删除' };
    } catch (error) {
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 扫描项目
  ipcMain.handle('scan-project', async (event, projectPath) => {
    try {
      const scanner = new ProjectScanner(projectPath);
      const info = await scanner.analyze();
      return { success: true, data: info };
    } catch (error) {
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 解析代码
  ipcMain.handle('parse-code', async (event, params) => {
    const { projectPath, projectType, projectName, excludePatterns } = params;
    try {
      const parser = new CodeParser(projectPath, projectType, projectName, excludePatterns);
      const chunks = await parser.parseAll();
      // 使用 JSON 序列化确保数据可克隆
      const safeChunks = JSON.parse(JSON.stringify(chunks));
      return { success: true, data: safeChunks };
    } catch (error) {
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 向量化（这里需要发送进度事件）
  ipcMain.handle('vectorize', async (event, params) => {
    const { projectInfo, codeChunks, dbConfig, ollamaConfig } = params;
    const dbManager = new DatabaseManager(dbConfig);
    const embedder = new OllamaEmbedder(ollamaConfig);
    
    try {
      // 通知开始
      event.sender.send('vectorize-progress', { 
        stage: 'started', 
        message: '开始生成向量...',
        total: codeChunks.length 
      });

      await dbManager.connect();
      
      // 保存项目信息
      await dbManager.upsertProject(projectInfo);
      
      // 删除旧的嵌入
      await dbManager.deleteProjectEmbeddings(projectInfo.name);

      // 生成向量并插入
      const texts = codeChunks.map(chunk => chunk.codeContent);
      const embeddings = [];
      
      for (let i = 0; i < texts.length; i++) {
        const embedding = await embedder.embed(texts[i]);
        embeddings.push(embedding);
        
        // 发送进度
        event.sender.send('vectorize-progress', {
          stage: 'processing',
          message: `正在处理: ${codeChunks[i].fileName}`,
          current: i + 1,
          total: texts.length,
          progress: Math.round(((i + 1) / texts.length) * 100)
        });
      }

      // 插入数据库
      const inserted = await dbManager.insertEmbeddings(projectInfo.name, codeChunks, embeddings);
      await dbManager.close();

      // 通知完成
      event.sender.send('vectorize-progress', {
        stage: 'completed',
        message: `完成！成功插入 ${inserted} 条记录`,
        result: { success: inserted }
      });

      return { success: true, message: `成功插入 ${inserted} 条记录` };
    } catch (error) {
      await dbManager.close().catch(() => {});
      
      event.sender.send('vectorize-progress', {
        stage: 'error',
        message: error.message
      });
      
      const errorMessage = error && typeof error === 'object' 
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });

  // 语义搜索
  ipcMain.handle('search-similar', async (event, params) => {
    const { query, projectName, limit, dbConfig, ollamaConfig } = params;
    const dbManager = new DatabaseManager(dbConfig);
    const embedder = new OllamaEmbedder(ollamaConfig);

    try {
      // 1. 将查询文本转为向量
      const embedding = await embedder.embed(query);
      if (!embedding) {
        throw new Error('查询向量化失败，请检查 Ollama 连接和 bge-m3 模型');
      }

      // 2. 连接数据库并执行相似度搜索
      await dbManager.connect();
      const results = await dbManager.searchSimilar(embedding, projectName, limit || 10);
      await dbManager.close();

      return { success: true, data: results };
    } catch (error) {
      await dbManager.close().catch(() => {});
      const errorMessage = error && typeof error === 'object'
        ? (error.message || String(error))
        : String(error);
      return { success: false, message: errorMessage };
    }
  });
}

// 应用准备就绪
app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// 所有窗口关闭时退出应用
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

console.log('[Main] 主进程入口已加载');
