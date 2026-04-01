const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vicMail', {
  generateMail: (payload) => ipcRenderer.invoke('vic-mail:generate', payload),
  getDefaults: () => ipcRenderer.invoke('vic-mail:get-defaults'),
  testConnection: (payload) => ipcRenderer.invoke('vic-mail:test-connection', payload),
  openGmailCompose: (payload) => ipcRenderer.invoke('vic-mail:open-gmail-compose', payload),
});

