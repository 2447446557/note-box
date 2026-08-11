const { execSync } = require('child_process')
const path = require('path')

process.env.ELECTRON_MIRROR =
  process.env.ELECTRON_MIRROR || 'https://cdn.npmmirror.com/binaries/electron/'
process.env.ELECTRON_BUILDER_BINARIES_MIRROR =
  process.env.ELECTRON_BUILDER_BINARIES_MIRROR ||
  'https://npmmirror.com/mirrors/electron-builder-binaries/'

const root = path.join(__dirname, '..')
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm'

function run(cmd) {
  console.log(`\n> ${cmd}\n`)
  execSync(cmd, { cwd: root, stdio: 'inherit', env: process.env })
}

const mode = process.argv[2] || 'build'

if (mode === 'dev') {
  run(`${npm} run export:web`)
  run(`npx electron electron/main.cjs`)
} else {
  run(`${npm} run export:web`)
  run(`npx electron-builder --config electron-builder.json --win nsis`)
}
