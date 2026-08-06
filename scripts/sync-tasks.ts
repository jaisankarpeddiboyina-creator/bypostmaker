import fs from 'fs'
import path from 'path'

interface Task {
  id: string
  title: string
  phase: string
  type: string
  priority: string
  status: string
  path: string
  commitHash?: string
}

function parseTaskFile(filePath: string, relativePath: string): Task {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  
  const fileName = path.basename(filePath, '.md')
  const idMatch = fileName.match(/^(P\d+-\d+)/)
  const id = idMatch ? idMatch[1] : fileName

  const titleLine = lines.find(l => l.startsWith('# '))
  let title = titleLine ? titleLine.replace(/^#\s*(P\d+-\d+\s+—\s+)?/, '').trim() : fileName

  let phase = 'Unknown'
  let type = 'Core'
  let priority = 'Medium'
  let status = 'Not Started'
  let commitHash: string | undefined

  for (const line of lines) {
    if (line.includes('**Phase:**')) phase = line.split('**Phase:**')[1].trim()
    else if (line.includes('**Type:**')) {
      type = line.split('**Type:**')[1].trim()
      type = type.split(' ')[0].trim()
    }
    else if (line.includes('**Priority:**')) priority = line.split('**Priority:**')[1].trim()
    else if (line.includes('**Status:**')) status = line.split('**Status:**')[1].trim()
    
    const commitMatch = line.match(/\*?\s*\*\*Commit:\*\*\s*`?([a-f0-9]{7,40})`?/i)
    if (commitMatch) {
      commitHash = commitMatch[1]
    }
  }

  return { id, title, phase, type, priority, status, path: relativePath, commitHash }
}

function getTasks(dir: string, baseDir: string): Task[] {
  let results: Task[] = []
  if (!fs.existsSync(dir)) return results
  const files = fs.readdirSync(dir)
  for (const file of files) {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat.isDirectory()) {
      results = results.concat(getTasks(fullPath, baseDir))
    } else if (file.endsWith('.md') && file !== 'README.md') {
      const relPath = path.relative(baseDir, fullPath)
      results.push(parseTaskFile(fullPath, relPath))
    }
  }
  return results
}

function main() {
  const rootDir = path.resolve(__dirname, '..')
  const phasesDir = path.join(rootDir, 'docs/tasks/phases')
  
  const tasks = getTasks(phasesDir, rootDir)
  tasks.sort((a, b) => {
    const parseId = (id: string) => {
      const m = id.match(/P(\d+)-(\d+)/)
      if (!m) return [0, 0]
      return [parseInt(m[1]), parseInt(m[2])]
    }
    const [ap1, aNum] = parseId(a.id)
    const [bp1, bNum] = parseId(b.id)
    if (ap1 !== bp1) return ap1 - bp1
    return aNum - bNum
  })

  const completedCount = tasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')).length
  const p1Tasks = tasks.filter(t => t.phase === 'Phase 1 — Launch')
  const p1Completed = p1Tasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')).length
  
  const barLength = 12
  const filled = Math.round(p1Completed / p1Tasks.length * barLength)
  const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)

  // 1. Sync docs/tasks/README.md
  const readmePath = path.join(rootDir, 'docs/tasks/README.md')
  if (fs.existsSync(readmePath)) {
    let readme = fs.readFileSync(readmePath, 'utf8')
    
    readme = readme.replace(/- \*\*Overall Progress\*\*: `\d+ \/ \d+ tasks completed \([\d.]+%`\)/, 
      `- **Overall Progress**: \`${completedCount} / 43 tasks completed (${((completedCount / 43) * 100).toFixed(1)}%)\``)
    
    readme = readme.replace(/- \*\*Phase 1 — Launch Gate\*\*: `\[[█░]+\] \d+\/\d+ \(\d+%\)`/,
      `- **Phase 1 — Launch Gate**: \`[${bar}] ${p1Completed}/10 (${((p1Completed / 10) * 100).toFixed(0)}%)\``)
    
    const lastCompleted = [...tasks].reverse().find(t => t.commitHash && (t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')))
    if (lastCompleted) {
      readme = readme.replace(/- \*\*Recently Completed\*\*: .*/,
        `- **Recently Completed**: [\`${lastCompleted.id}: ${lastCompleted.title}\`](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/${lastCompleted.path}) (Commit \`${lastCompleted.commitHash}\`)`)
    }

    readme = readme.replace(/\| \*\*Phase 1 — Launch\*\* \| Launch Readiness & AI Engine Polish \| 10 \| 0 \| \*\*[^|]+\*\* \|/,
      `| **Phase 1 — Launch** | Launch Readiness & AI Engine Polish | 10 | 0 | **${p1Completed} / 10 (${((p1Completed / 10) * 100).toFixed(0)}%)** |`)

    for (const t of tasks) {
      const idEscaped = t.id.replace('-', '\\-')
      const rowRegex = new RegExp(`^\\|\\s*\\*\\*${idEscaped}\\*\\*\\s*\\|.*\\|$`, 'm')
      
      let statusStr = `⏳ \`Not Started\``
      if (t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')) {
        statusStr = `✅ **\`Completed\`**`
      } else if (t.status.toLowerCase().includes('postponed')) {
        statusStr = `💤 \`Postponed\``
      } else if (t.status.toLowerCase().includes('progress')) {
        statusStr = `⚡ \`In Progress\``
      } else if (t.status.toLowerCase().includes('not selected')) {
        statusStr = `⚪ \`Not Selected\``
      }

      const titleStr = statusStr.includes('Completed') ? `**${t.title}**` : t.title
      const newRow = `| **${t.id}** | ${titleStr} | ${t.type} | ${t.priority} | ${statusStr} | [${path.basename(t.path)}](file:///home/jaisankar/Documents/projects/bypostmaker/bypostmaker/${t.path}) |`
      readme = readme.replace(rowRegex, newRow)
    }
    
    fs.writeFileSync(readmePath, readme, 'utf8')
    console.log('✅ Synchronized docs/tasks/README.md')
  }

  // 2. Sync docs/ROADMAP.md
  const roadmapPath = path.join(rootDir, 'docs/ROADMAP.md')
  const roadmapDetailsMap: Record<string, string> = {}
  if (fs.existsSync(roadmapPath)) {
    let roadmap = fs.readFileSync(roadmapPath, 'utf8')
    
    for (const t of tasks) {
      const idEscaped = t.id.replace('-', '\\-')
      const rowRegex = new RegExp(`^\\|\\s*\\*\\*${idEscaped}\\*\\*\\s*\\|.*\\|$`, 'm')
      const match = roadmap.match(rowRegex)
      if (match) {
        const parts = match[0].split('|').map(p => p.trim())
        const details = parts[6] || ''
        roadmapDetailsMap[t.id] = details.replace(/`/g, '').trim()
        
        let statusStr = `⏳ \`Not Started\``
        if (t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')) {
          statusStr = `✅ **\`Completed\`**`
        } else if (t.status.toLowerCase().includes('postponed')) {
          statusStr = `💤 \`Postponed\``
        } else if (t.status.toLowerCase().includes('progress')) {
          statusStr = `⚡ \`In Progress\``
        }
        
        const titleStr = statusStr.includes('Completed') ? `**${t.title}**` : t.title
        const typeStr = parts[3] || t.type
        const priorityStr = parts[4] || t.priority
        
        const newRow = `| **${t.id}** | ${titleStr} | ${typeStr} | ${priorityStr} | ${statusStr} | ${details} |`
        roadmap = roadmap.replace(rowRegex, newRow)
      }
    }
    
    fs.writeFileSync(roadmapPath, roadmap, 'utf8')
    console.log('✅ Synchronized docs/ROADMAP.md')
  }

  // 3. Sync docs/STATUS.md
  const statusPath = path.join(rootDir, 'docs/STATUS.md')
  if (fs.existsSync(statusPath)) {
    let statusContent = fs.readFileSync(statusPath, 'utf8')
    
    statusContent = statusContent.replace(/- \*\*Phase 1 Progress\*\*: `\d+ \/ \d+ Tasks Completed \(\d+%\)`/,
      `- **Phase 1 Progress**: \`${p1Completed} / 10 Tasks Completed (${((p1Completed / 10) * 100).toFixed(0)}%)\``)
    
    const completedTasks = tasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done'))
    const completedListStr = '- **Completed**:\n' + completedTasks.map(t => {
      const details = roadmapDetailsMap[t.id] || ''
      return `  - ✅ \`${t.id}: ${t.title}\`${details ? ` (${details})` : ''}`
    }).join('\n')
    
    statusContent = statusContent.replace(/- \*\*Completed\*:\n(  - .*\n)*/, completedListStr + '\n')
    
    const activeFocusTask = tasks.find(t => t.status.toLowerCase().includes('not started') || t.status.toLowerCase().includes('progress'))
    if (activeFocusTask) {
      statusContent = statusContent.replace(/- \*\*Active Focus\*\*: .*/,
        `- **Active Focus**: \`${activeFocusTask.id}: ${activeFocusTask.title}\``)
    }
    
    fs.writeFileSync(statusPath, statusContent, 'utf8')
    console.log('✅ Synchronized docs/STATUS.md')
  }

  // 4. Sync worker/src/routes/admin.ts
  const adminPath = path.join(rootDir, 'worker/src/routes/admin.ts')
  if (fs.existsSync(adminPath)) {
    let admin = fs.readFileSync(adminPath, 'utf8')
    const startIdx = admin.indexOf('    const tasksData = [')
    if (startIdx !== -1) {
      const endMatch = admin.slice(startIdx).match(/\n    \]/)
      if (endMatch && endMatch.index) {
        const endIdx = startIdx + endMatch.index + endMatch[0].length
        
        const tasksArrayStr = '    const tasksData = [\n' + tasks.map(t => {
          const obj: any = {
            id: t.id,
            title: t.title,
            phase: t.phase,
            type: t.type,
            priority: t.priority,
            status: t.status,
            path: t.path
          }
          if (t.commitHash) {
            obj.commitHash = t.commitHash
          }
          return `      ${JSON.stringify(obj)},`
        }).join('\n') + '\n    ]'
        
        admin = admin.slice(0, startIdx) + tasksArrayStr + admin.slice(endIdx)
        fs.writeFileSync(adminPath, admin, 'utf8')
        console.log('✅ Synchronized worker/src/routes/admin.ts')
      }
    }
  }
}

main()
