// Reserved for future desktop bridges (file dialogs, etc.)
const { contextBridge } = require('electron')

contextBridge.exposeInMainWorld('noteBoxDesktop', {
  platform: process.platform,
})
