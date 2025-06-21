const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  signup: (credentials: any) => ipcRenderer.invoke('auth:signup', credentials),
  login: (credentials: any) => ipcRenderer.invoke('auth:login', credentials),
  loginSuccess: () => ipcRenderer.send('auth:success'),
  createCheckoutSession: (userId: any) => ipcRenderer.invoke('payment:checkout', { userId }),
  createAdminSession: () => ipcRenderer.invoke('admin:create-session'),
  getCurrentUser: () => ipcRenderer.invoke('auth:get-user'),
  getStripePublishableKey: () => ipcRenderer.invoke('payment:get-publishable-key'),
  getSessionStatus: (userId: any) => ipcRenderer.invoke('session:get-status', { userId }),
  startSession: (userId: any) => ipcRenderer.invoke('session:start', { userId }),
  sendChatMessage: (data: any) => ipcRenderer.send('chat:send', data),
  onChatStream: (callback: any) => ipcRenderer.on('chat:stream-chunk', (_event: any, data: any) => callback(data)),
  removeAllListeners: (channel: any) => ipcRenderer.removeAllListeners(channel),
  captureScreen: () => ipcRenderer.invoke('capture-screen'),
  uploadAudio: (uploadData: any) => ipcRenderer.invoke('audio:upload', uploadData),
  openExternalUrl: (url: any) => ipcRenderer.invoke('open-external-url', url),
  loadPaymentPage: () => ipcRenderer.send('nav:payment'),
  loadStartSessionPage: () => ipcRenderer.send('nav:start-session'),
  loadMainAppPage: () => ipcRenderer.send('nav:main-app'),
}); 