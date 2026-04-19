const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  browseCookies: () => ipcRenderer.invoke('settings:browse-cookies'),
  browseOutput: () => ipcRenderer.invoke('settings:browse-output'),

  // Library dependencies
  checkLibs: () => ipcRenderer.invoke('libs:check'),
  checkLibUpdates: () => ipcRenderer.invoke('libs:check-updates'),
  updateLibs: () => ipcRenderer.invoke('libs:update'),

  // Library
  getLibrary: () => ipcRenderer.invoke('library:get'),
  openFile: (p) => ipcRenderer.invoke('library:open-file', p),
  openFolder: (p) => ipcRenderer.invoke('library:open-folder', p),
  deleteTrack: (videoId) => ipcRenderer.invoke('library:delete-track', videoId),

  // Scan History
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
  clearHistory: () => ipcRenderer.invoke('history:clear'),
  clearSingleHistory: () => ipcRenderer.invoke('library:clear-single-history'),
  resetAllData: (options) => ipcRenderer.invoke('settings:reset-all', options),

  // Playlist folders
  getPlaylists: () => ipcRenderer.invoke('library:get-playlists'),
  moveTrack: (opts) => ipcRenderer.invoke('library:move-track', opts),

  // YouTube / yt-dlp
  scanPlaylist: (opts) => ipcRenderer.invoke('yt:scan-playlist', opts),
  downloadVideo: (opts) => ipcRenderer.invoke('yt:download-video', opts),
  cancelDownload: (videoId) => ipcRenderer.invoke('yt:cancel-download', videoId),

  // Progress events from main
  onProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('yt:progress', handler);
    return () => ipcRenderer.removeListener('yt:progress', handler);
  },
});
