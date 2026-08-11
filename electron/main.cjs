const { app, BrowserWindow, shell } = require('electron')
const fs = require('fs')
const http = require('http')
const path = require('path')

/** @type {BrowserWindow | null} */
let mainWindow = null
/** @type {http.Server | null} */
let staticServer = null

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
}

function getDistRoot() {
  return path.join(__dirname, '..', 'dist')
}

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        let urlPath = decodeURIComponent((req.url || '/').split('?')[0])
        if (urlPath === '/') urlPath = '/index.html'
        const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, '')
        const filePath = path.join(rootDir, safePath)
        if (!filePath.startsWith(rootDir)) {
          res.writeHead(403)
          res.end('Forbidden')
          return
        }
        fs.readFile(filePath, (err, data) => {
          if (err) {
            fs.readFile(path.join(rootDir, 'index.html'), (fallbackErr, html) => {
              if (fallbackErr) {
                res.writeHead(404)
                res.end('Not found')
                return
              }
              res.writeHead(200, { 'Content-Type': MIME['.html'] })
              res.end(html)
            })
            return
          }
          const ext = path.extname(filePath).toLowerCase()
          res.writeHead(200, {
            'Content-Type': MIME[ext] || 'application/octet-stream',
          })
          res.end(data)
        })
      } catch {
        res.writeHead(500)
        res.end('Server error')
      }
    })

    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (!address || typeof address === 'string') {
        reject(new Error('Failed to bind static server'))
        return
      }
      resolve({ server, port: address.port })
    })
  })
}

async function createWindow() {
  const distRoot = getDistRoot()
  if (!fs.existsSync(path.join(distRoot, 'index.html'))) {
    console.error(
      '缺少 Web 构建产物。请先运行: npm run export:web',
    )
  }

  const { server, port } = await startStaticServer(distRoot)
  staticServer = server

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 900,
    minHeight: 600,
    show: false,
    backgroundColor: '#d5e0e6',
    title: 'Note-box',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    icon: path.join(__dirname, '..', 'assets', 'icon.png'),
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  await mainWindow.loadURL(`http://127.0.0.1:${port}`)

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow().catch((err) => {
    console.error(err)
    app.quit()
  })
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow().catch(console.error)
    }
  })
})

app.on('window-all-closed', () => {
  if (staticServer) {
    staticServer.close()
    staticServer = null
  }
  if (process.platform !== 'darwin') app.quit()
})
