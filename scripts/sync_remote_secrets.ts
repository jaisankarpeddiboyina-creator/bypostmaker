import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

const TARGET_KEYS = [
  // Razorpay USD Plans
  'RAZORPAY_PLAN_STARTER_USD',
  'RAZORPAY_PLAN_PRO_USD',
  'RAZORPAY_PLAN_BUSINESS_USD',
  // Stock Media Providers (Assets Page)
  'PEXELS_API_KEY',
  'PIXABAY_API_KEY',
  'UNSPLASH_ACCESS_KEY',
  'GOOGLE_FONTS_API_KEY',
]

function parseArgs() {
  const args = process.argv.slice(2)
  let env = 'production'
  let isDryRun = false
  let useDevToken = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--dry-run') {
      isDryRun = true
    } else if (args[i] === '--use-dev-token') {
      useDevToken = true
    } else if (args[i] === '--env' && args[i + 1] !== undefined) {
      env = args[i + 1]
      i++
    } else if (args[i].startsWith('--env=')) {
      env = args[i].split('=')[1]
    }
  }

  return { env, isDryRun, useDevToken }
}

function loadDevVars(): Record<string, string> {
  const devVarsPath = path.join(process.cwd(), '.dev.vars')
  if (!fs.existsSync(devVarsPath)) {
    console.error(`❌ .dev.vars file not found at ${devVarsPath}`)
    process.exit(1)
  }

  const content = fs.readFileSync(devVarsPath, 'utf8')
  const vars: Record<string, string> = {}

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const partitionIndex = trimmed.indexOf('=')
    if (partitionIndex === -1) continue
    const key = trimmed.slice(0, partitionIndex).trim()
    const value = trimmed.slice(partitionIndex + 1).trim()
    vars[key] = value
  }

  return vars
}

async function putSecret(
  key: string,
  value: string,
  targetEnv: string,
  isDryRun: boolean,
  authEnv: Record<string, string>,
  useCustomToken: boolean
): Promise<{ success: boolean; isAuthError: boolean }> {
  if (isDryRun) {
    console.log(`[DRY-RUN] Key '${key}' is populated (len=${value.length}). Would run: npx wrangler secret put ${key} --env=${targetEnv}`)
    return { success: true, isAuthError: false }
  }

  return new Promise((resolve) => {
    const envArg = targetEnv === 'production' ? '' : targetEnv
    const args = ['wrangler', 'secret', 'put', key, `--env=${envArg}`]

    const envToUse = { ...process.env }
    if (useCustomToken) {
      if (authEnv.CLOUDFLARE_API_TOKEN) envToUse.CLOUDFLARE_API_TOKEN = authEnv.CLOUDFLARE_API_TOKEN
      if (authEnv.CLOUDFLARE_ACCOUNT_ID) envToUse.CLOUDFLARE_ACCOUNT_ID = authEnv.CLOUDFLARE_ACCOUNT_ID
    } else {
      delete envToUse.CLOUDFLARE_API_TOKEN
      delete envToUse.CLOUDFLARE_ACCOUNT_ID
    }

    const child = spawn('npx', args, {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: envToUse,
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', (data) => {
      stdout += data.toString()
    })

    child.stderr.on('data', (data) => {
      stderr += data.toString()
    })

    child.on('close', (code) => {
      const fullOutput = (stdout + '\n' + stderr).trim()
      const isAuthError = fullOutput.includes('10000') || fullOutput.includes('Not logged in') || fullOutput.includes('Authentication error')

      if (code === 0) {
        console.log(`✓ Secret '${key}' updated successfully on remote Cloudflare Worker (env: ${targetEnv})`)
        resolve({ success: true, isAuthError: false })
      } else {
        console.error(`❌ Failed to update secret '${key}' (env: ${targetEnv}, exit code: ${code})`)
        if (stderr) console.error(`   Output: ${stderr.trim()}`)
        resolve({ success: false, isAuthError })
      }
    })

    child.stdin.write(value)
    child.stdin.end()
  })
}

async function main() {
  const { env: targetEnv, isDryRun, useDevToken } = parseArgs()
  console.log(`🔒 Starting Cloudflare Worker Secrets Sync (target env: '${targetEnv}', dryRun: ${isDryRun})...\n`)

  const devVars = loadDevVars()

  const authEnv: Record<string, string> = {}
  if (devVars.CLOUDFLARE_API_TOKEN) {
    authEnv.CLOUDFLARE_API_TOKEN = devVars.CLOUDFLARE_API_TOKEN
  }
  if (devVars.CLOUDFLARE_ACCOUNT_ID) {
    authEnv.CLOUDFLARE_ACCOUNT_ID = devVars.CLOUDFLARE_ACCOUNT_ID
  }

  let useCustomToken = useDevToken
  let successCount = 0
  let skipCount = 0
  let failCount = 0

  for (const key of TARGET_KEYS) {
    const value = devVars[key]
    if (!value || value.trim() === '') {
      console.warn(`⚠️ Key '${key}' is missing or empty in .dev.vars — skipping`)
      skipCount++
      continue
    }

    const result = await putSecret(key, value.trim(), targetEnv, isDryRun, authEnv, useCustomToken)

    if (result.success) {
      successCount++
    } else {
      failCount++
    }
  }

  console.log(`\n📊 Secrets Sync Summary (env: ${targetEnv}):`)
  console.log(`   ✓ Updated: ${successCount}`)
  console.log(`   ⚠️ Skipped: ${skipCount}`)
  console.log(`   ❌ Failed:  ${failCount}`)

  if (failCount > 0) {
    process.exit(1)
  }
}

main().catch((err) => {
  console.error('Fatal error during secret sync:', err)
  process.exit(1)
})
