const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const { ProjectScanner, DEFAULT_EXCLUDE_PATTERNS } = require('./scanner/ProjectScanner.js')
const { CodeParser } = require('./parser/CodeParser.js')
const { OllamaEmbedder } = require('./embedder/OllamaEmbedder.js')
const { DatabaseManager } = require('./database/DatabaseManager.js')

let mainWindow

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1200,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.cjs')
    },
    titleBarStyle: 'hiddenInset',
    show: false
  })

  // 加载应用
  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow()
})

// ==================== IPC 处理 ====================

// 选择项目文件夹
ipcMain.handle('select-project', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: '选择项目文件夹'
  })

  if (result.canceled || result.filePaths.length === 0) {
    return { success: false, message: '未选择文件夹' }
  }

  return { success: true, path: result.filePaths[0] }
})

// 扫描项目信息
ipcMain.handle('scan-project', async (event, projectPath) => {
  try {
    const scanner = new ProjectScanner(projectPath)
    const info = await scanner.analyze()
    return { success: true, data: info }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 测试数据库连接
ipcMain.handle('test-db-connection', async (event, config) => {
  try {
    const db = new DatabaseManager(config)
    await db.connect()
    await db.close()
    return { success: true, message: '连接成功' }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 测试 Ollama 连接
ipcMain.handle('test-ollama-connection', async (event, config) => {
  try {
    const embedder = new OllamaEmbedder(config)
    const version = await embedder.checkConnection()
    return { success: true, data: version }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 获取 Ollama 嵌入模型列表
ipcMain.handle('get-ollama-models', async (event, config) => {
  try {
    const embedder = new OllamaEmbedder(config)
    const models = await embedder.listModels()
    // 过滤出嵌入模型
    const embedModels = models.filter(m =>
      m.name.includes('embed') ||
      m.name.includes('bge') ||
      m.name.includes('m3e') ||
      m.name.includes('gte') ||
      m.name.includes('minilm') ||
      m.name.includes('mxbai')
    )
    return { success: true, data: embedModels.length > 0 ? embedModels : models }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 解析代码
ipcMain.handle('parse-code', async (event, { projectPath, projectType, projectName, excludePatterns }) => {
  try {
    const parser = new CodeParser(projectPath, projectType, projectName, excludePatterns)
    const chunks = await parser.parseAll()
    // 使用 JSON 序列化确保数据可克隆
    const safeChunks = JSON.parse(JSON.stringify(chunks))
    return { success: true, data: safeChunks }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 执行向量化流程
ipcMain.handle('vectorize', async (event, {
  projectInfo,
  codeChunks,
  dbConfig,
  ollamaConfig
}) => {
  try {
    const embedder = new OllamaEmbedder(ollamaConfig)
    const db = new DatabaseManager(dbConfig)
    await db.connect()

    const total = codeChunks.length

    // 1. 保存项目信息
    await db.upsertProject(projectInfo)
    event.sender.send('vectorize-progress', {
      stage: 'project_saved',
      message: '项目信息已保存',
      progress: 5
    })

    // 2. 删除旧数据
    await db.deleteProjectEmbeddings(projectInfo.name)
    event.sender.send('vectorize-progress', {
      stage: 'old_data_deleted',
      message: '旧数据已清理',
      progress: 10
    })

    // 3. 批量生成向量并保存
    const batchSize = 8 // bge-m3 较大，减小批次数
    let totalInserted = 0

    for (let i = 0; i < total; i += batchSize) {
      const batch = codeChunks.slice(i, i + batchSize)

      // 发送进度
      event.sender.send('vectorize-progress', {
        stage: 'embedding',
        message: `正在生成向量: ${Math.min(i + batchSize, total)}/${total}`,
        progress: Math.round((i / total) * 80) + 10,
        current: i,
        total
      })

      // 生成向量
      const embeddings = []
      for (let j = 0; j < batch.length; j++) {
        const embedding = await embedder.embed(batch[j].codeContent)
        embeddings.push(embedding)

        event.sender.send('vectorize-progress', {
          stage: 'embedding',
          message: `处理中: ${i + j + 1}/${total}`,
          progress: Math.round(((i + j + 1) / total) * 80) + 10,
          current: i + j + 1,
          total
        })
      }

      // 保存到数据库
      const inserted = await db.insertEmbeddings(
        projectInfo.name,
        batch,
        embeddings
      )
      totalInserted += inserted
    }

    await db.close()

    event.sender.send('vectorize-progress', {
      stage: 'completed',
      message: `完成! 成功 ${totalInserted}/${total}`,
      progress: 100,
      result: { total, success: totalInserted }
    })

    return {
      success: true,
      data: { total, success: totalInserted }
    }

  } catch (error) {
    event.sender.send('vectorize-progress', {
      stage: 'error',
      message: error.message,
      progress: 0
    })
    return { success: false, message: error.message }
  }
})

// 获取所有项目列表
ipcMain.handle('get-projects', async (event, dbConfig) => {
  try {
    const db = new DatabaseManager(dbConfig)
    await db.connect()
    const projects = await db.getAllProjects()
    await db.close()
    return { success: true, data: projects }
  } catch (error) {
    return { success: false, message: error.message }
  }
})

// 删除项目
ipcMain.handle('delete-project', async (event, { projectName, dbConfig }) => {
  try {
    const db = new DatabaseManager(dbConfig)
    await db.connect()
    await db.deleteProject(projectName)
    await db.close()
    return { success: true, message: '项目已删除' }
  } catch (error) {
    return { success: false, message: error.message }
  }
})
