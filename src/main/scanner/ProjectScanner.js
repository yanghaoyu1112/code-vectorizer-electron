const { promises: fs } = require('fs')
const path = require('path')
const { execSync } = require('child_process')

// 排除的文件和目录
const DEFAULT_EXCLUDE_PATTERNS = [
  'node_modules', 'dist', 'build', 'target', '.git', '.idea', '.vscode',
  'out', 'coverage', '.nuxt', '.output', '__pycache__', '.turbo',
  'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml', 'Cargo.lock'
]

// 文件扩展名映射
const LANGUAGE_MAP = {
  '.vue': 'Vue',
  '.js': 'JavaScript',
  '.ts': 'TypeScript',
  '.jsx': 'JavaScript',
  '.tsx': 'TypeScript',
  '.java': 'Java',
  '.xml': 'XML',
  '.json': 'JSON',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.properties': 'Properties',
  '.sql': 'SQL',
  '.md': 'Markdown',
  '.gradle': 'Gradle',
  '.sh': 'Shell',
  '.py': 'Python',
  '.go': 'Go',
  '.rs': 'Rust'
}

class ProjectScanner {
  constructor(projectPath) {
    this.projectPath = projectPath
    this.name = path.basename(projectPath)
  }

  async analyze() {
    const info = {
      name: this.name,
      path: this.projectPath,
      projectType: 'unknown',
      gitUrl: '',
      defaultBranch: 'main',
      languageStats: {},
      frameworkVersion: '',
      description: '',
      detectableExcludeDirs: [],
      nestedProjects: []
    }

    // 检测项目类型
    info.projectType = await this._detectProjectType()

    // 统计语言
    info.languageStats = await this._analyzeLanguages()

    // 检测 Git 信息
    const gitInfo = await this._detectGitInfo()
    info.gitUrl = gitInfo.url
    info.defaultBranch = gitInfo.branch

    // 检测框架版本
    info.frameworkVersion = await this._detectFrameworkVersion(info.projectType)

    // 检测可排除的目录
    info.detectableExcludeDirs = await this._detectExcludeDirs(info.projectType)

    // 检测嵌套子项目
    info.nestedProjects = await this._detectNestedProjects(info.projectType)

    return info
  }

  async _detectProjectType() {
    try {
      const files = await fs.readdir(this.projectPath)

      // Vue 项目检测
      const vueIndicators = ['vue.config.js', 'vue.config.ts', 'vite.config.ts',
        'vite.config.js', 'nuxt.config.ts', 'nuxt.config.js',
        'nuxt.config.mjs', 'quasar.config.js']
      if (vueIndicators.some(f => files.includes(f))) {
        return 'vue'
      }

      if (files.includes('package.json')) {
        const pkg = await this._readJson(path.join(this.projectPath, 'package.json'))
        if (pkg) {
          const deps = { ...pkg.dependencies, ...pkg.devDependencies }
          if (deps.vue || deps.nuxt || deps.vite) {
            return 'vue'
          }
          if (deps.react || deps['react-dom']) {
            return 'react'
          }
        }
      }

      // Spring Boot 项目检测
      if (files.includes('pom.xml')) {
        return 'springboot'
      }
      if (files.includes('build.gradle') || files.includes('build.gradle.kts')) {
        return 'springboot'
      }

      // 检查 src/main/java 结构
      const javaPath = path.join(this.projectPath, 'src', 'main', 'java')
      try {
        await fs.access(javaPath)
        return 'springboot'
      } catch { }

      return 'unknown'
    } catch {
      return 'unknown'
    }
  }

  async _analyzeLanguages() {
    const stats = {}

    const walk = async (dir) => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)

          if (entry.isDirectory()) {
            if (!DEFAULT_EXCLUDE_PATTERNS.includes(entry.name) && !entry.name.startsWith('.')) {
              await walk(fullPath)
            }
          } else {
            const ext = path.extname(entry.name).toLowerCase()
            if (LANGUAGE_MAP[ext]) {
              stats[LANGUAGE_MAP[ext]] = (stats[LANGUAGE_MAP[ext]] || 0) + 1
            }
          }
        }
      } catch { }
    }

    await walk(this.projectPath)

    // 按数量排序
    return Object.fromEntries(
      Object.entries(stats).sort(([, a], [, b]) => b - a)
    )
  }

  async _detectGitInfo() {
    const gitDir = path.join(this.projectPath, '.git')
    try {
      await fs.access(gitDir)
    } catch {
      return { url: '', branch: 'main' }
    }

    try {
      // 获取远程 URL
      let url = ''
      try {
        url = execSync('git remote get-url origin', {
          cwd: this.projectPath,
          encoding: 'utf-8',
          timeout: 5000
        }).trim()
      } catch { }

      // 获取当前分支
      let branch = 'main'
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: this.projectPath,
          encoding: 'utf-8',
          timeout: 5000
        }).trim()
      } catch { }

      return { url, branch }
    } catch {
      return { url: '', branch: 'main' }
    }
  }

  async _detectFrameworkVersion(projectType) {
    if (projectType === 'vue') {
      const pkg = await this._readJson(path.join(this.projectPath, 'package.json'))
      if (pkg) {
        const deps = { ...pkg.dependencies, ...pkg.devDependencies }
        if (deps.vue) {
          const ver = deps.vue.replace(/^[~^]/, '')
          return `Vue ${ver}`
        }
        if (deps.nuxt) {
          const ver = deps.nuxt.replace(/^[~^]/, '')
          return `Nuxt ${ver}`
        }
      }
    }

    if (projectType === 'springboot') {
      const pomPath = path.join(this.projectPath, 'pom.xml')
      try {
        const content = await fs.readFile(pomPath, 'utf-8')

        // 匹配 parent version
        const parentMatch = content.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)
        if (parentMatch) {
          return `Spring Boot ${parentMatch[1]}`
        }

        // 匹配 spring-boot-starter-parent
        const bootMatch = content.match(/spring-boot-starter-parent<\/artifactId>\s*<version>([^<]+)<\/version>/)
        if (bootMatch) {
          return `Spring Boot ${bootMatch[1]}`
        }
      } catch { }
    }

    return ''
  }

  async _readJson(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8')
      return JSON.parse(content)
    } catch {
      return null
    }
  }

  /**
   * 检测项目中可排除的目录（如 assets、第三方库等）
   */
  async _detectExcludeDirs(projectType) {
    const excludeDirs = []
    const checkedDirs = new Set()

    // 常见的前端资源目录和第三方库目录
    const commonExcludePatterns = [
      'assets', 'public', 'static', 'vendor', 'lib', 'libs', 
      'third-party', 'external', 'deps', 'components/lib'
    ]

    const walk = async (dir, relativePath = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          if (entry.name.startsWith('.')) continue
          if (DEFAULT_EXCLUDE_PATTERNS.includes(entry.name)) continue

          const fullPath = path.join(dir, entry.name)
          const relPath = path.join(relativePath, entry.name)

          // 检查是否是可排除的目录
          const dirName = entry.name.toLowerCase()
          const isCommonExclude = commonExcludePatterns.some(pattern => 
            dirName === pattern || dirName.includes(pattern)
          )

          // 检查 assets 目录下的第三方库文件
          let hasThirdPartyFiles = false
          if (isCommonExclude && !checkedDirs.has(relPath)) {
            checkedDirs.add(relPath)
            hasThirdPartyFiles = await this._checkHasThirdPartyFiles(fullPath)
          }

          // 如果是常见排除目录，或者是 src 下的 assets 目录
          const isSrcAssets = relPath === 'src/assets' || relPath.startsWith('src/assets/')
          
          if (isCommonExclude || isSrcAssets || hasThirdPartyFiles) {
            // 计算文件数量
            const fileCount = await this._countFiles(fullPath)
            if (fileCount > 0) {
              excludeDirs.push({
                path: relPath,
                name: entry.name,
                fileCount: fileCount,
                reason: this._getExcludeReason(dirName, isSrcAssets, hasThirdPartyFiles)
              })
            }
          }

          // 限制扫描深度，避免遍历太深
          const depth = relPath.split(/[\\/]/).length
          if (depth < 4) {
            await walk(fullPath, relPath)
          }
        }
      } catch { }
    }

    await walk(this.projectPath)

    // 按路径排序
    return excludeDirs.sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * 检查目录是否包含第三方库文件
   */
  async _checkHasThirdPartyFiles(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      const thirdPartyPatterns = ['.min.', 'vendor', 'lib.', 'jquery', 'bootstrap', 'lodash', 'moment']
      
      for (const entry of entries) {
        const name = entry.name.toLowerCase()
        if (thirdPartyPatterns.some(p => name.includes(p))) {
          return true
        }
      }
      return false
    } catch {
      return false
    }
  }

  /**
   * 计算目录中的文件数量
   */
  async _countFiles(dir) {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      let count = 0
      for (const entry of entries) {
        if (entry.isFile()) {
          count++
        }
      }
      return count
    } catch {
      return 0
    }
  }

  /**
   * 获取排除原因说明
   */
  _getExcludeReason(dirName, isSrcAssets, hasThirdPartyFiles) {
    if (hasThirdPartyFiles) return '可能包含第三方库文件'
    if (isSrcAssets) return '前端资源目录'
    if (['assets', 'static', 'public'].includes(dirName)) return '静态资源目录'
    if (['vendor', 'lib', 'libs', 'third-party'].includes(dirName)) return '第三方库存放目录'
    return '可排除目录'
  }

  /**
   * 检测嵌套子项目
   * 用于检测如 Java 项目中嵌套的 Vue 前端项目
   */
  async _detectNestedProjects(parentProjectType) {
    const nestedProjects = []
    const checkedDirs = new Set()

    const walk = async (dir, relativePath = '', depth = 0) => {
      // 限制扫描深度，避免遍历 node_modules 等深层目录
      if (depth > 3) return

      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        // 检查当前目录是否是一个项目
        const files = entries.filter(e => e.isFile()).map(e => e.name)
        const subProjectType = this._detectProjectTypeFromFiles(files)

        // 如果检测到是一个完整的项目，且不是父项目根目录
        if (subProjectType !== 'unknown' && relativePath !== '') {
          // 检查 package.json 或 pom.xml 确认是完整项目
          const isFullProject = await this._isFullProject(dir, subProjectType)
          
          if (isFullProject && !checkedDirs.has(relativePath)) {
            checkedDirs.add(relativePath)
            
            // 获取项目信息
            const projectInfo = await this._getNestedProjectInfo(dir, subProjectType)
            
            nestedProjects.push({
              path: relativePath,
              name: path.basename(relativePath),
              type: subProjectType,
              ...projectInfo
            })

            // 不继续遍历这个目录的子目录（避免重复检测项目内部的目录）
            return
          }
        }

        // 继续遍历子目录
        for (const entry of entries) {
          if (!entry.isDirectory()) continue
          if (entry.name.startsWith('.')) continue
          if (DEFAULT_EXCLUDE_PATTERNS.includes(entry.name)) continue

          const fullPath = path.join(dir, entry.name)
          const relPath = path.join(relativePath, entry.name)

          await walk(fullPath, relPath, depth + 1)
        }
      } catch { }
    }

    await walk(this.projectPath)

    // 按路径排序
    return nestedProjects.sort((a, b) => a.path.localeCompare(b.path))
  }

  /**
   * 根据文件列表检测项目类型
   */
  _detectProjectTypeFromFiles(files) {
    // Vue 项目检测
    const vueIndicators = ['vue.config.js', 'vue.config.ts', 'vite.config.ts',
      'vite.config.js', 'nuxt.config.ts', 'nuxt.config.js']
    if (vueIndicators.some(f => files.includes(f))) {
      return 'vue'
    }

    if (files.includes('package.json')) {
      // 可能是 Vue/React/Node 项目，需要进一步检查
      return 'unknown'
    }

    // Spring Boot 项目检测
    if (files.includes('pom.xml') || files.includes('build.gradle')) {
      return 'springboot'
    }

    return 'unknown'
  }

  /**
   * 检查目录是否是完整的项目
   */
  async _isFullProject(dir, projectType) {
    try {
      if (projectType === 'vue' || projectType === 'unknown') {
        // 检查 package.json 是否存在且有效
        const pkgPath = path.join(dir, 'package.json')
        const pkg = await this._readJson(pkgPath)
        if (pkg) {
          // 有 dependencies 或 devDependencies 说明是完整项目
          const hasDeps = (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) ||
                           (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0)
          if (hasDeps) {
            return true
          }
        }
      }

      if (projectType === 'springboot') {
        // 检查是否有 src/main/java 目录结构
        const javaPath = path.join(dir, 'src', 'main', 'java')
        try {
          await fs.access(javaPath)
          return true
        } catch {
          return false
        }
      }

      return false
    } catch {
      return false
    }
  }

  /**
   * 获取嵌套项目的信息
   */
  async _getNestedProjectInfo(dir, projectType) {
    const info = {
      frameworkVersion: '',
      fileCount: 0,
      description: ''
    }

    try {
      // 统计文件数量
      info.fileCount = await this._countProjectFiles(dir)

      if (projectType === 'vue') {
        const pkg = await this._readJson(path.join(dir, 'package.json'))
        if (pkg) {
          const deps = { ...pkg.dependencies, ...pkg.devDependencies }
          if (deps.vue) {
            info.frameworkVersion = `Vue ${deps.vue.replace(/^[~^]/, '')}`
          } else if (deps.nuxt) {
            info.frameworkVersion = `Nuxt ${deps.nuxt.replace(/^[~^]/, '')}`
          } else if (deps.react) {
            info.frameworkVersion = `React ${deps.react.replace(/^[~^]/, '')}`
          }
          info.description = pkg.description || ''
        }
      }

      if (projectType === 'springboot') {
        const pomPath = path.join(dir, 'pom.xml')
        try {
          const content = await fs.readFile(pomPath, 'utf-8')
          const parentMatch = content.match(/<parent>[\s\S]*?<version>([^<]+)<\/version>[\s\S]*?<\/parent>/)
          if (parentMatch) {
            info.frameworkVersion = `Spring Boot ${parentMatch[1]}`
          }
        } catch { }
      }
    } catch { }

    return info
  }

  /**
   * 统计项目目录中的文件数量（粗略估计）
   */
  async _countProjectFiles(dir, currentDepth = 0) {
    if (currentDepth > 2) return 0 // 限制深度

    try {
      const entries = await fs.readdir(dir, { withFileTypes: true })
      let count = 0

      for (const entry of entries) {
        if (entry.name.startsWith('.')) continue
        if (DEFAULT_EXCLUDE_PATTERNS.includes(entry.name)) continue

        if (entry.isFile()) {
          count++
        } else if (entry.isDirectory() && currentDepth < 2) {
          count += await this._countProjectFiles(
            path.join(dir, entry.name), 
            currentDepth + 1
          )
        }
      }

      return count
    } catch {
      return 0
    }
  }
}

module.exports = { ProjectScanner, DEFAULT_EXCLUDE_PATTERNS }
