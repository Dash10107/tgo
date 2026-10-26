/**
 * miniprogram-ci verification script
 *
 * Usage:
 *   node ci.js pack-npm    # Verify the npm build (no key needed)
 *   node ci.js compile     # Compile check (key needed, no IP whitelist needed)
 *   node ci.js preview     # Full compile + preview (key and IP whitelist needed)
 *
 * Getting the key: WeChat Official Platform → Management → Development Management → Development Settings → Mini Program Code Upload
 * Put the downloaded key file in the project directory and name it private.wx.key
 */
const ci = require('miniprogram-ci')
const path = require('path')
const fs = require('fs')

const PROJECT_DIR = __dirname
const PRIVATE_KEY_PATH = path.join(PROJECT_DIR, 'private.wx.key')

const projectConfig = JSON.parse(
  fs.readFileSync(path.join(PROJECT_DIR, 'project.config.json'), 'utf8')
)
const APPID = projectConfig.appid

async function packNpm() {
  console.log('[ci] Starting npm build verification...')

  const result = await ci.packNpmManually({
    packageJsonPath: path.join(PROJECT_DIR, 'package.json'),
    miniprogramNpmDistDir: PROJECT_DIR,
  })

  console.log('[ci] npm build finished:', JSON.stringify(result, null, 2))

  if (result.warnList && result.warnList.length > 0) {
    console.warn('[ci] Warning:', result.warnList)
  }
  console.log(
    `[ci] Build succeeded - miniprogram: ${result.miniProgramPackNum}, other: ${result.otherNpmPackNum}`
  )
}

function createProject() {
  if (!fs.existsSync(PRIVATE_KEY_PATH)) {
    console.error(`[ci] Key file not found: ${PRIVATE_KEY_PATH}`)
    console.error('[ci] Download the code upload key from the WeChat Official Platform and name it private.wx.key')
    process.exit(1)
  }

  return new ci.Project({
    appid: APPID,
    type: 'miniProgram',
    projectPath: PROJECT_DIR,
    privateKeyPath: PRIVATE_KEY_PATH,
    ignores: ['node_modules/**/*', 'ci.js', 'private.wx.key', 'preview-qrcode.png'],
  })
}

async function compile() {
  console.log('[ci] Starting compile verification...')
  const project = createProject()

  const compiledResult = await ci.getCompiledResult({
    project,
    desc: 'compile check',
    setting: projectConfig.setting,
    onProgressUpdate: (info) => {
      if (info._msg) console.log(`[ci]   ${info._msg}`)
    },
  })

  const fileCount = Object.keys(compiledResult).length
  console.log(`[ci] Compile verification passed! ${fileCount} files in total`)
}

async function preview() {
  console.log('[ci] Starting full compile verification (preview)...')
  const project = createProject()

  const previewResult = await ci.preview({
    project,
    setting: projectConfig.setting,
    qrcodeFormat: 'terminal',
    qrcodeOutputDest: path.join(PROJECT_DIR, 'preview-qrcode.png'),
    pagePath: 'pages/index/index',
    onProgressUpdate: (info) => {
      if (info._msg) console.log(`[ci]   ${info._msg}`)
    },
  })

  console.log('[ci] Compile verification passed!', JSON.stringify(previewResult, null, 2))
}

async function main() {
  const cmd = process.argv[2]

  if (!cmd || cmd === 'pack-npm') {
    await packNpm()
  } else if (cmd === 'compile') {
    await packNpm()
    await compile()
  } else if (cmd === 'preview') {
    await packNpm()
    await preview()
  } else {
    console.error(`Unknown command: ${cmd}`)
    console.error('Usage: node ci.js [pack-npm|compile|preview]')
    process.exit(1)
  }
}

main().then(() => {
  process.exit(0)
}).catch((err) => {
  console.error('[ci] Failed:', err.message || err)
  process.exit(1)
})
