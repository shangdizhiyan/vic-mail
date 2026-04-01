const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('vicMail', {
  generateMail: (payload) => ipcRenderer.invoke('vic-mail:generate', payload),
  getDefaults: () => ipcRenderer.invoke('vic-mail:get-defaults'),
  testConnection: (payload) => ipcRenderer.invoke('vic-mail:test-connection', payload),
  openGmailCompose: (payload) => ipcRenderer.invoke('vic-mail:open-gmail-compose', payload),
  getSavedProviderSettings: () => ipcRenderer.invoke('vic-mail:get-saved-provider-settings'),
  saveProviderSettings: (payload) => ipcRenderer.invoke('vic-mail:save-provider-settings', payload),
  exportTxt: (payload) => ipcRenderer.invoke('vic-mail:export-txt', payload),
  exportDocx: (payload) => ipcRenderer.invoke('vic-mail:export-docx', payload),
  checkGrammar: (payload) => ipcRenderer.invoke('vic-mail:check-grammar', payload),
  fixGrammar: (payload) => ipcRenderer.invoke('vic-mail:fix-grammar', payload),
});
