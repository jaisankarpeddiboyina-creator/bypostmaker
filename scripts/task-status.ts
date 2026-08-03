import fs from 'fs'
import path from 'path'

interface TaskInfo {
  id: string
  title: string
  phase: string
  type: string
  priority: string
  status: string
  filePath: string
}

function parseTaskFile(filePath: string): TaskInfo | null {
  const content = fs.readFileSync(filePath, 'utf8')
  const lines = content.split('\n')
  
  const fileName = path.basename(filePath, '.md')
  const titleLine = lines.find(l => l.startsWith('# '))
  const title = titleLine ? titleLine.replace('# ', '').trim() : fileName

  let phase = 'Unknown'
  let type = 'Core'
  let priority = 'Medium'
  let status = 'Not Started'

  for (const line of lines) {
    if (line.startsWith('**Phase:**')) phase = line.replace('**Phase:**', '').trim()
    else if (line.startsWith('**Type:**')) type = line.replace('**Type:**', '').trim()
    else if (line.startsWith('**Priority:**')) priority = line.replace('**Priority:**', '').trim()
    else if (line.startsWith('**Status:**')) status = line.replace('**Status:**', '').trim()
  }

  return { id: fileName, title, phase, type, priority, status, filePath }
}

function getAllTaskFiles(dir: string): string[] {
  let results: string[] = []
  const list = fs.readdirSync(dir)
  list.forEach(file => {
    const fullPath = path.join(dir, file)
    const stat = fs.statSync(fullPath)
    if (stat && stat.isDirectory()) {
      results = results.concat(getAllTaskFiles(fullPath))
    } else if (file.endsWith('.md') && file !== 'README.md') {
      results.push(fullPath)
    }
  })
  return results
}

function main() {
  const tasksDir = path.resolve(__dirname, '../docs/tasks/phases')
  if (!fs.existsSync(tasksDir)) {
    console.error('Task directory not found:', tasksDir)
    process.exit(1)
  }

  const files = getAllTaskFiles(tasksDir)
  const tasks: TaskInfo[] = files.map(parseTaskFile).filter((t): t is TaskInfo => t !== null)

  const phases = Array.from(new Set(tasks.map(t => t.phase))).sort()
  const completed = tasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done'))
  const inProgress = tasks.filter(t => t.status.toLowerCase().includes('progress'))
  const blocked = tasks.filter(t => t.status.toLowerCase().includes('blocked'))
  const notStarted = tasks.filter(t => t.status.toLowerCase().includes('not started') || t.status.toLowerCase().includes('not selected'))

  const percent = ((completed.length / tasks.length) * 100).toFixed(1)

  console.log('\n===========================================================')
  console.log(` 🚀 POSTMAKER TASK STATUS DASHBOARD [${completed.length}/${tasks.length} Completed — ${percent}%]`)
  console.log('===========================================================\n')

  console.log(`📊 Status Summary: ${completed.length} Completed | ${inProgress.length} In Progress | ${blocked.length} Blocked | ${notStarted.length} Pending\n`)

  phases.forEach(ph => {
    const phaseTasks = tasks.filter(t => t.phase === ph)
    const phCompleted = phaseTasks.filter(t => t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done'))
    const phPercent = ((phCompleted.length / phaseTasks.length) * 100).toFixed(0)

    const barLength = 12
    const filled = Math.round((phCompleted.length / phaseTasks.length) * barLength)
    const bar = '█'.repeat(filled) + '░'.repeat(barLength - filled)

    console.log(`📌 ${ph} [${bar}] ${phCompleted.length}/${phaseTasks.length} (${phPercent}%)`)
    phaseTasks.forEach(t => {
      let icon = '  [ ]'
      if (t.status.toLowerCase().includes('completed') || t.status.toLowerCase().includes('done')) icon = '  [x]'
      else if (t.status.toLowerCase().includes('progress')) icon = '  [/]'
      else if (t.status.toLowerCase().includes('blocked')) icon = '  [!]'

      console.log(`   ${icon} ${t.id.padEnd(52)} ${t.status}`)
    })
    console.log('')
  })

  if (inProgress.length > 0) {
    console.log('⚡ CURRENTLY IN PROGRESS:')
    inProgress.forEach(t => console.log(`   - ${t.title} (${t.filePath})`))
    console.log('')
  }

  const nextActionable = tasks.find(t => t.status.toLowerCase().includes('not started'))
  if (nextActionable) {
    console.log('🎯 NEXT ACTIONABLE TASK:')
    console.log(`   - ${nextActionable.title} [${nextActionable.id}]`)
    console.log(`     Location: ${nextActionable.filePath}\n`)
  }
}

main()
