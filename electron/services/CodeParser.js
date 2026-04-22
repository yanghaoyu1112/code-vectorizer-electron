import { promises as fs } from 'fs'
import path from 'path'
import { DEFAULT_EXCLUDE_PATTERNS } from './ProjectScanner.js'

class CodeParser {
  constructor(projectPath, projectType, projectName, excludePatterns = []) {
    this.projectPath = projectPath
    this.projectType = projectType
    this.projectName = projectName
    this.excludePatterns = [...DEFAULT_EXCLUDE_PATTERNS, ...excludePatterns]
  }

  async parseAll() {
    const chunks = []

    const walk = async (dir, relativePath = '') => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true })

        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relPath = path.join(relativePath, entry.name)

          if (entry.isDirectory()) {
            // 检查是否在排除列表中
            if (this._shouldExclude(entry.name)) continue
            if (entry.name.startsWith('.')) continue

            await walk(fullPath, relPath)
          } else {
            // 检查文件是否应该被处理
            if (this._shouldExcludeFile(relPath)) continue

            const fileChunks = await this._parseFile(fullPath, relPath)
            chunks.push(...fileChunks)
          }
        }
      } catch (err) {
        console.error(`Error walking ${dir}:`, err.message)
      }
    }

    await walk(this.projectPath)

    return chunks
  }

  _shouldExclude(name) {
    return this.excludePatterns.some(pattern => {
      if (pattern.includes('*')) {
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$')
        return regex.test(name)
      }
      return name === pattern
    })
  }

  _shouldExcludeFile(filePath) {
    return this.excludePatterns.some(pattern => filePath.includes(pattern))
  }

  async _parseFile(filePath, relPath) {
    const ext = path.extname(filePath).toLowerCase()

    try {
      switch (ext) {
        case '.vue':
          if (this.projectType === 'vue' || this.projectType === 'unknown') {
            return await this._parseVueFile(filePath, relPath)
          }
          break
        case '.js':
        case '.ts':
        case '.jsx':
        case '.tsx':
          if (this.projectType === 'vue' || this.projectType === 'react' || this.projectType === 'unknown') {
            return await this._parseJsFile(filePath, relPath, ext)
          }
          break
        case '.java':
          if (this.projectType === 'springboot' || this.projectType === 'unknown') {
            return await this._parseJavaFile(filePath, relPath)
          }
          break
        case '.xml':
          if (this.projectType === 'springboot') {
            return await this._parseXmlFile(filePath, relPath)
          }
          break
      }
    } catch (err) {
      console.error(`Error parsing ${relPath}:`, err.message)
    }

    return []
  }

  async _parseVueFile(filePath, relPath) {
    const content = await fs.readFile(filePath, 'utf-8')
    const chunks = []
    const moduleName = this._extractModuleName(relPath)

    // 提取 template
    const templateMatch = content.match(/<template>([\s\S]*?)<\/template>/)
    if (templateMatch) {
      const startLine = content.substring(0, templateMatch.index).split('\n').length
      const endLine = startLine + templateMatch[1].split('\n').length

      chunks.push({
        filePath: relPath,
        fileName: path.basename(filePath),
        language: 'Vue',
        projectType: 'vue',
        moduleName,
        entityType: 'template',
        codeContent: `<template>${templateMatch[1].trim()}</template>`,
        startLine,
        endLine,
        chunkIndex: 0,
        totalChunks: 1,
        signature: `${moduleName}#template`.slice(0, 255),
        dependencies: [],
        tags: ['vue', 'template']
      })
    }

    // 提取 script
    const scriptMatch = content.match(/<script([^>]*)>([\s\S]*?)<\/script>/)
    if (scriptMatch) {
      const scriptContent = scriptMatch[2].trim()
      const isTs = scriptMatch[1].includes('ts') || scriptMatch[1].includes('typescript')
      const scriptChunks = this._extractScriptChunks(
        scriptContent, relPath, path.basename(filePath),
        moduleName, isTs ? 'TypeScript' : 'JavaScript'
      )

      const baseLine = content.substring(0, scriptMatch.index).split('\n').length
      scriptChunks.forEach(chunk => {
        chunk.startLine += baseLine - 1
        chunk.endLine += baseLine - 1
      })

      chunks.push(...scriptChunks)
    }

    // 提取 style
    const styleMatch = content.match(/<style([^>]*)>([\s\S]*?)<\/style>/)
    if (styleMatch) {
      const startLine = content.substring(0, styleMatch.index).split('\n').length
      const endLine = startLine + styleMatch[2].split('\n').length
      const scoped = styleMatch[1].includes('scoped')

      chunks.push({
        filePath: relPath,
        fileName: path.basename(filePath),
        language: 'CSS/SCSS',
        projectType: 'vue',
        moduleName,
        entityType: 'style',
        codeContent: `<style${styleMatch[1]}>${styleMatch[2].trim()}</style>`,
        startLine,
        endLine,
        chunkIndex: 0,
        totalChunks: 1,
        signature: `${moduleName}#style${scoped ? ':scoped' : ''}`.slice(0, 255),
        dependencies: [],
        tags: ['vue', 'style', ...(scoped ? ['scoped'] : [])]
      })
    }

    return chunks
  }

  _extractScriptChunks(script, relPath, fileName, moduleName, language) {
    const chunks = []

    // 匹配导出函数/类
    const exportPattern = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g

    let hasExports = false
    let match

    while ((match = exportPattern.exec(script)) !== null) {
      hasExports = true
      const funcName = match[1]
      const startPos = match.index
      const body = this._extractBlockBody(script.substring(startPos))
      const lineNum = script.substring(0, startPos).split('\n').length

      chunks.push({
        filePath: relPath,
        fileName,
        language,
        projectType: 'vue',
        moduleName,
        entityType: 'export',
        codeContent: body.slice(0, 3000),
        startLine: lineNum,
        endLine: lineNum + body.split('\n').length,
        chunkIndex: chunks.length,
        totalChunks: 1,
        signature: `${moduleName}#${funcName}`.slice(0, 255),
        dependencies: this._extractImports(script),
        tags: ['vue', 'script', 'export']
      })
    }

    // 如果没有导出，保存整个脚本
    if (chunks.length === 0) {
      chunks.push({
        filePath: relPath,
        fileName,
        language,
        projectType: 'vue',
        moduleName,
        entityType: 'script',
        codeContent: script.slice(0, 5000),
        startLine: 1,
        endLine: script.split('\n').length,
        chunkIndex: 0,
        totalChunks: 1,
        signature: `${moduleName}#script`,
        dependencies: this._extractImports(script),
        tags: ['vue', 'script']
      })
    }

    return chunks
  }

  async _parseJsFile(filePath, relPath, ext) {
    const content = await fs.readFile(filePath, 'utf-8')
    const moduleName = this._extractModuleName(relPath)
    const language = ext === '.ts' || ext === '.tsx' ? 'TypeScript' : 'JavaScript'

    const chunks = []
    const exportPattern = /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var|interface|type)\s+(\w+)/g

    let match
    while ((match = exportPattern.exec(content)) !== null) {
      const funcName = match[1]
      const startPos = match.index
      const body = this._extractBlockBody(content.substring(startPos))
      const lineNum = content.substring(0, startPos).split('\n').length

      chunks.push({
        filePath: relPath,
        fileName: path.basename(filePath),
        language,
        projectType: this.projectType,
        moduleName,
        entityType: 'export',
        codeContent: body.slice(0, 3000),
        startLine: lineNum,
        endLine: lineNum + body.split('\n').length,
        chunkIndex: chunks.length,
        totalChunks: 1,
        signature: `${moduleName}#${funcName}`.slice(0, 255),
        dependencies: this._extractImports(content),
        tags: [this.projectType, 'script', 'export']
      })
    }

    if (chunks.length === 0) {
      chunks.push({
        filePath: relPath,
        fileName: path.basename(filePath),
        language,
        projectType: this.projectType,
        moduleName,
        entityType: 'file',
        codeContent: content.slice(0, 5000),
        startLine: 1,
        endLine: content.split('\n').length,
        chunkIndex: 0,
        totalChunks: 1,
        signature: moduleName.slice(0, 255),
        dependencies: this._extractImports(content),
        tags: [this.projectType, 'script']
      })
    }

    return chunks
  }

  async _parseJavaFile(filePath, relPath) {
    const content = await fs.readFile(filePath, 'utf-8')
    const moduleName = this._extractModuleName(relPath)
    const className = this._extractJavaClassName(content) || path.basename(filePath, '.java')

    const chunks = []

    // 提取类定义
    const classPattern = /(public|private|protected)?\s*(class|interface|enum|record)\s+(\w+)[^{]*\{/
    const classMatch = content.match(classPattern)

    if (classMatch) {
      const classStart = classMatch.index
      const classBody = this._extractBlockBody(content.substring(classStart))
      const startLine = content.substring(0, classStart).split('\n').length

      chunks.push({
        filePath: relPath,
        fileName: path.basename(filePath),
        language: 'Java',
        projectType: 'springboot',
        moduleName,
        entityType: classMatch[2], // class/interface/enum/record
        codeContent: classBody.slice(0, 8000),
        startLine,
        endLine: startLine + classBody.split('\n').length,
        chunkIndex: 0,
        totalChunks: 1,
        signature: `${moduleName}.${className}`,
        dependencies: this._extractJavaImports(content),
        tags: ['springboot', 'java', classMatch[2]]
      })

      // 提取方法
      const methodPattern = /(public|private|protected)\s+(?:static\s+)?(?:final\s+)?(?:<[^>]+>\s+)?([\w<>,\s]+)\s+(\w+)\s*\([^)]*\)\s*(?:throws\s+[\w,\s]+)?\s*\{/g
      let methodMatch

      while ((methodMatch = methodPattern.exec(content)) !== null) {
        const methodName = methodMatch[3]
        const methodStart = methodMatch.index
        const methodBody = this._extractBlockBody(content.substring(methodStart))
        const methodLine = content.substring(0, methodStart).split('\n').length

        chunks.push({
          filePath: relPath,
          fileName: path.basename(filePath),
          language: 'Java',
          projectType: 'springboot',
          moduleName,
          entityType: 'method',
          codeContent: methodBody.slice(0, 3000),
          startLine: methodLine,
          endLine: methodLine + methodBody.split('\n').length,
          chunkIndex: chunks.length,
          totalChunks: 1,
          signature: `${moduleName}.${className}#${methodName}()`,
          dependencies: [],
          tags: ['springboot', 'java', 'method']
        })
      }
    }

    return chunks
  }

  async _parseXmlFile(filePath, relPath) {
    const content = await fs.readFile(filePath, 'utf-8')

    if (content.length > 10000) {
      // 大文件分块
      const chunks = []
      const lines = content.split('\n')
      const chunkSize = 100

      for (let i = 0; i < lines.length; i += chunkSize) {
        const chunkLines = lines.slice(i, i + chunkSize)
        chunks.push({
          filePath: relPath,
          fileName: path.basename(filePath),
          language: 'XML',
          projectType: 'springboot',
          moduleName: this._extractModuleName(relPath),
          entityType: 'config',
          codeContent: chunkLines.join('\n'),
          startLine: i + 1,
          endLine: Math.min(i + chunkSize, lines.length),
          chunkIndex: i / chunkSize,
          totalChunks: Math.ceil(lines.length / chunkSize),
          signature: `${this._extractModuleName(relPath)}#part${i / chunkSize}`.slice(0, 255),
          dependencies: [],
          tags: ['springboot', 'xml', 'config']
        })
      }

      return chunks
    }

    return [{
      filePath: relPath,
      fileName: path.basename(filePath),
      language: 'XML',
      projectType: 'springboot',
      moduleName: this._extractModuleName(relPath),
      entityType: 'config',
      codeContent: content.slice(0, 5000),
      startLine: 1,
      endLine: content.split('\n').length,
      chunkIndex: 0,
      totalChunks: 1,
      signature: this._extractModuleName(relPath).slice(0, 255),
      dependencies: [],
      tags: ['springboot', 'xml', 'config']
    }]
  }

  _extractBlockBody(code) {
    let braceCount = 0
    let started = false

    for (let i = 0; i < code.length; i++) {
      if (code[i] === '{') {
        braceCount++
        started = true
      } else if (code[i] === '}') {
        braceCount--
        if (started && braceCount === 0) {
          return code.slice(0, i + 1)
        }
      }
    }

    return code
  }

  _extractModuleName(relPath) {
    const parts = relPath.split(/[\\/]/)

    if (parts.includes('src')) {
      const idx = parts.indexOf('src')
      return parts.slice(idx + 1).join('/').replace(/\.(vue|js|ts|java)$/, '')
    }

    if (parts.includes('java')) {
      const idx = parts.indexOf('java')
      return parts.slice(idx + 1).join('.').replace('.java', '')
    }

    return relPath.replace(/\.(vue|js|ts|java)$/, '')
  }

  _extractJavaClassName(content) {
    const match = content.match(/(?:class|interface|enum|record)\s+(\w+)/)
    return match ? match[1] : null
  }

  _extractImports(content) {
    const imports = []
    const importPattern = /import\s+(['"]?)([^'";\n]+)\1/g
    let match

    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[2])
    }

    return imports.slice(0, 20)
  }

  _extractJavaImports(content) {
    const imports = []
    const importPattern = /import\s+([^;]+);/g
    let match

    while ((match = importPattern.exec(content)) !== null) {
      imports.push(match[1].trim())
    }

    return imports.slice(0, 20)
  }
}

export { CodeParser }
