const { app, BrowserWindow, ipcMain, shell, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync } = require('child_process');

const isDev = process.env.NODE_ENV === 'development';

// App data directory
const APP_DATA_DIR = path.join(app.getPath('userData'), 'app-data');
const LIBRARY_PATH = path.join(APP_DATA_DIR, 'library.json');
const SETTINGS_PATH = path.join(APP_DATA_DIR, 'settings.json');
const HISTORY_PATH = path.join(APP_DATA_DIR, 'scan-history.json');

// Ensure app-data dir exists
if (!fs.existsSync(APP_DATA_DIR)) {
  fs.mkdirSync(APP_DATA_DIR, { recursive: true });
}

// Default settings
const DEFAULT_SETTINGS = {
  outputDir: path.join(os.homedir(), 'Music', 'YT'),
  cookiesFile: '',
  audioQuality: '320K',
};

// Default manifest
const DEFAULT_LIBRARY = {
  version: 1,
  outputDir: path.join(os.homedir(), 'Music', 'YT'),
  items: {},
};

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8')) };
    }
  } catch (_) {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(settings) {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function loadLibrary() {
  try {
    if (fs.existsSync(LIBRARY_PATH)) {
      return JSON.parse(fs.readFileSync(LIBRARY_PATH, 'utf8'));
    }
  } catch (_) {}
  return { ...DEFAULT_LIBRARY };
}

function saveLibrary(library) {
  fs.writeFileSync(LIBRARY_PATH, JSON.stringify(library, null, 2));
}

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_PATH)) {
      return JSON.parse(fs.readFileSync(HISTORY_PATH, 'utf8'));
    }
  } catch (_) {}
  return [];
}

function saveHistory(history) {
  fs.writeFileSync(HISTORY_PATH, JSON.stringify(history, null, 2));
}

function resolveDir(dir) {
  if (dir.startsWith('~')) return path.join(os.homedir(), dir.slice(1));
  return dir;
}

let mainWindow;

// ─── Library dependency helpers ───────────────────────────────────────────────

function commandExists(cmd) {
  try { execSync(`which ${cmd}`, { stdio: 'ignore' }); return true; } catch (_) { return false; }
}

function getVersion(cmd) {
  try {
    if (cmd === 'AtomicParsley') {
      // AtomicParsley --version doesn't output useful version, use brew
      const out = execSync('brew list --versions atomicparsley', { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
      const parts = out.split(/\s+/);
      return parts.length > 1 ? parts[1] : out;
    }
    return execSync(`${cmd} --version`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim().split('\n')[0];
  } catch (_) { return null; }
}

function brewInstall(pkg) {
  return new Promise((resolve, reject) => {
    const proc = spawn('brew', ['install', pkg], { stdio: 'pipe' });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `brew install ${pkg} failed with code ${code}`));
    });
    proc.on('error', () => reject(new Error('Homebrew not found. Please install Homebrew first: https://brew.sh')));
  });
}

function brewUpgrade(pkg) {
  return new Promise((resolve, reject) => {
    const proc = spawn('brew', ['upgrade', pkg], { stdio: 'pipe' });
    let stderr = '';
    proc.stderr.on('data', (d) => { stderr += d.toString(); });
    proc.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `brew upgrade ${pkg} failed with code ${code}`));
    });
    proc.on('error', () => reject(new Error('Homebrew not found.')));
  });
}

function getBrewLatestVersion(pkg) {
  try {
    const info = execSync(`brew info ${pkg} --json=v2`, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
    const data = JSON.parse(info);
    return data.formulae?.[0]?.versions?.stable || null;
  } catch (_) { return null; }
}

async function checkAndInstallDeps() {
  const missing = [];
  if (!commandExists('yt-dlp')) missing.push('yt-dlp');
  if (!commandExists('AtomicParsley')) missing.push('atomicparsley');

  if (missing.length === 0) return;

  // Check if brew exists
  if (!commandExists('brew')) {
    dialog.showErrorBox(
      'Missing Dependencies',
      `This app requires: ${missing.join(', ')}\n\nPlease install Homebrew first (https://brew.sh), then restart the app.`
    );
    return;
  }

  const result = await dialog.showMessageBox(mainWindow || null, {
    type: 'question',
    buttons: ['Install Now', 'Later'],
    defaultId: 0,
    title: 'Missing Dependencies',
    message: `The following required tools are not installed:\n\n${missing.map(m => `• ${m}`).join('\n')}\n\nInstall them now via Homebrew?`,
  });

  if (result.response === 0) {
    for (const pkg of missing) {
      try {
        await brewInstall(pkg);
      } catch (e) {
        dialog.showErrorBox('Install Failed', `Failed to install ${pkg}: ${e.message}`);
      }
    }
  }
}

function createWindow() {
  // Ensure default output dir exists on first launch
  const settings = loadSettings();
  const outputDir = resolveDir(settings.outputDir);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#09090b',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  createWindow();
  await checkAndInstallDeps();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  app.quit();
});

// Check if AtomicParsley is available (needed for thumbnail embed on macOS)
function checkAtomicParsley() {
  try {
    const { execSync } = require('child_process');
    execSync('which AtomicParsley', { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

const hasAtomicParsley = checkAtomicParsley();
if (!hasAtomicParsley) {
  console.warn('[yt-sync] Warning: AtomicParsley not found in PATH. Thumbnail embedding will be skipped. Install with: brew install atomicparsley');
}



// ─── IPC: Library dependencies ────────────────────────────────────────────────

ipcMain.handle('libs:check', () => {
  return {
    ytDlp: { installed: commandExists('yt-dlp'), version: getVersion('yt-dlp') },
    atomicParsley: { installed: commandExists('AtomicParsley'), version: getVersion('AtomicParsley') },
  };
});

ipcMain.handle('libs:check-updates', async () => {
  const ytDlpCurrent = getVersion('yt-dlp');
  const apCurrent = getVersion('AtomicParsley');
  const ytDlpLatest = getBrewLatestVersion('yt-dlp');
  const apLatest = getBrewLatestVersion('atomicparsley');
  return {
    ytDlp: { current: ytDlpCurrent, latest: ytDlpLatest },
    atomicParsley: { current: apCurrent, latest: apLatest },
  };
});

ipcMain.handle('libs:update', async () => {
  const results = { ytDlp: null, atomicParsley: null };
  try { await brewUpgrade('yt-dlp'); results.ytDlp = 'updated'; } catch (e) { results.ytDlp = e.message; }
  try { await brewUpgrade('atomicparsley'); results.atomicParsley = 'updated'; } catch (e) { results.atomicParsley = e.message; }
  return results;
});

ipcMain.handle('settings:get', () => loadSettings());

ipcMain.handle('settings:save', (_, settings) => {
  saveSettings(settings);
  return true;
});

ipcMain.handle('settings:browse-cookies', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select cookies file',
    filters: [{ name: 'Text files', extensions: ['txt'] }],
    properties: ['openFile'],
  });
  return result.canceled ? null : result.filePaths[0];
});

ipcMain.handle('settings:browse-output', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Select output directory',
    properties: ['openDirectory', 'createDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── IPC: Library ─────────────────────────────────────────────────────────────

ipcMain.handle('library:get', () => {
  const lib = loadLibrary();
  // Check file existence for each item
  const items = {};
  for (const [id, item] of Object.entries(lib.items)) {
    items[id] = {
      ...item,
      fileExists: item.filePath ? fs.existsSync(item.filePath) : false,
    };
  }
  return { ...lib, items };
});

ipcMain.handle('library:open-file', (_, filePath) => {
  shell.openPath(filePath);
});

ipcMain.handle('library:open-folder', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

// ─── IPC: Scan History ────────────────────────────────────────────────────────

ipcMain.handle('history:get', () => loadHistory());

ipcMain.handle('history:delete', (_, id) => {
  const history = loadHistory();
  const updated = history.filter((h) => h.id !== id);
  saveHistory(updated);
  return true;
});

ipcMain.handle('history:clear', () => {
  saveHistory([]);
  return true;
});

ipcMain.handle('library:clear-single-history', () => {
  const library = loadLibrary();
  const newItems = {};
  for (const [id, item] of Object.entries(library.items)) {
    if (item.source !== 'single') {
      newItems[id] = item;
    }
  }
  library.items = newItems;
  saveLibrary(library);
  return true;
});

ipcMain.handle('settings:reset-all', async (_, options = {}) => {
  const settings = loadSettings();
  const outputDir = resolveDir(settings.outputDir);

  // 1. Delete downloaded files
  if (options.downloadedFiles) {
    try {
      if (fs.existsSync(outputDir)) {
        fs.rmSync(outputDir, { recursive: true, force: true });
        fs.mkdirSync(outputDir, { recursive: true });
      }
    } catch (e) {
      console.error('Failed to clear output dir:', e.message);
    }
  }

  // 2. Clear library
  if (options.library) {
    saveLibrary({ ...DEFAULT_LIBRARY });
  }

  // 3. Clear scan history
  if (options.scanHistory) {
    saveHistory([]);
  }

  // 4. Reset settings (must be last so other steps can still read current settings)
  if (options.settings) {
    saveSettings({ ...DEFAULT_SETTINGS });
  } else if (options.cookies) {
    // Only clear cookie path if not already resetting all settings
    const current = loadSettings();
    current.cookiesFile = '';
    saveSettings(current);
  }

  return true;
});

ipcMain.handle('library:delete-track', async (_, videoId) => {
  const library = loadLibrary();
  const item = library.items[videoId];
  if (!item) throw new Error('Track not found in library');

  // Try to move file to trash, fallback to unlink
  if (item.filePath && fs.existsSync(item.filePath)) {
    try {
      await shell.trashItem(item.filePath);
    } catch (_) {
      try {
        fs.unlinkSync(item.filePath);
      } catch (e) {
        throw new Error('Failed to delete file: ' + e.message);
      }
    }
  }

  // Remove from manifest
  delete library.items[videoId];
  saveLibrary(library);
  return true;
});


// ─── IPC: Scan playlist ───────────────────────────────────────────────────────

ipcMain.handle('yt:scan-playlist', async (event, { url, cookiesFile }) => {
  return new Promise((resolve, reject) => {
    const args = ['--flat-playlist', '-J', '--no-warnings', '--ignore-errors'];
    if (cookiesFile) args.push('--cookies', cookiesFile);
    args.push(url);

    const proc = spawn('yt-dlp', args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `yt-dlp exited with code ${code}`));
        return;
      }
      try {
        const data = JSON.parse(stdout);
        const library = loadLibrary();

        const videos = (data.entries || [])
          .filter((entry) => {
            // Skip private, deleted, or unavailable videos
            if (!entry || !entry.id) return false;
            const t = (entry.title || '').toLowerCase();
            if (t === '[private video]' || t === '[deleted video]' || t === '[unavailable]') return false;
            return true;
          })
          .map((entry) => {
          const videoId = entry.id;
          const libItem = library.items[videoId];
          let status = 'pending';
          if (libItem && libItem.status === 'done') {
            // Check file exists AND is not empty
            let fileValid = false;
            if (libItem.filePath && fs.existsSync(libItem.filePath)) {
              try {
                const stat = fs.statSync(libItem.filePath);
                fileValid = stat.size > 0;
              } catch (_) {}
            }
            status = fileValid ? 'downloaded' : 'pending';
          }
          return {
            videoId,
            title: entry.title || entry.id,
            url: entry.url || `https://www.youtube.com/watch?v=${videoId}`,
            thumbnail: (entry.thumbnails && entry.thumbnails.length > 0)
              ? entry.thumbnails[0].url
              : `https://i.ytimg.com/vi/${videoId}/default.jpg`,
            status,
          };
        });

        // Save to scan history
        const history = loadHistory();
        history.unshift({
          id: `${data.id}_${Date.now()}`,
          playlistId: data.id,
          playlistTitle: data.title || data.id,
          playlistUrl: url,
          videoCount: videos.length,
          scannedAt: new Date().toISOString(),
        });
        // Keep last 50 entries
        if (history.length > 50) history.length = 50;
        saveHistory(history);

        resolve({
          playlistId: data.id,
          playlistTitle: data.title || data.id,
          videos,
        });
      } catch (e) {
        reject(new Error('Failed to parse yt-dlp output: ' + e.message));
      }
    });

    proc.on('error', (e) => reject(new Error('yt-dlp not found. Install it with: brew install yt-dlp')));
  });
});

// ─── IPC: Download ────────────────────────────────────────────────────────────

// Active download processes keyed by videoId
const activeProcs = {};

const QUALITY_LEVELS = ['320K', '256K', '192K', '128K'];

ipcMain.handle('yt:download-video', async (event, { video, playlistId, playlistTitle, source }) => {
  const settings = loadSettings();
  const baseDir = resolveDir(settings.outputDir);
  // Store in playlist subfolder, or root if no playlist
  const playlistFolder = playlistTitle ? sanitizeFilename(playlistTitle) : '';
  const outputDir = playlistFolder ? path.join(baseDir, playlistFolder) : baseDir;

  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const sanitized = sanitizeFilename(video.title);
  const outputTemplate = path.join(outputDir, `${sanitized} [${video.videoId}].%(ext)s`);
  const videoUrl = video.url || `https://www.youtube.com/watch?v=${video.videoId}`;

  const tryDownload = (quality) => {
    return new Promise((resolve, reject) => {
      const args = [
        '--extract-audio',
        '--audio-format', 'mp3',
        '--audio-quality', quality,
        '--newline',
        '-o', outputTemplate,
        '--no-warnings',
        '--add-metadata',
      ];

      if (hasAtomicParsley) args.push('--embed-thumbnail');
      if (settings.cookiesFile) args.push('--cookies', settings.cookiesFile);
      args.push(videoUrl);

      const proc = spawn('yt-dlp', args);
      activeProcs[video.videoId] = proc;

      let stderr = '';

      proc.stdout.on('data', (d) => {
        const lines = d.toString().split('\n');
        for (const line of lines) {
          const match = line.match(/\[download\]\s+([\d.]+)%/);
          if (match) {
            event.sender.send('yt:progress', { videoId: video.videoId, progress: parseFloat(match[1]) });
          }
        }
      });

      proc.stderr.on('data', (d) => { stderr += d.toString(); });

      proc.on('close', (code) => {
        delete activeProcs[video.videoId];
        if (code === 0) {
          const filePath = findOutputFile(outputDir, video.videoId);
          if (filePath) {
            try {
              const stat = fs.statSync(filePath);
              if (stat.size === 0) {
                fs.unlinkSync(filePath);
                reject(new Error('Downloaded file is empty'));
                return;
              }
            } catch (_) {}
          }
          resolve({ filePath });
        } else {
          reject(new Error(stderr.trim() || `Exited with code ${code}`));
        }
      });

      proc.on('error', () => reject(new Error('yt-dlp not found. Install it with: brew install yt-dlp')));
    });
  };

  // Build quality fallback chain starting from user's preferred quality
  const preferredQuality = settings.audioQuality || '320K';
  const startIdx = QUALITY_LEVELS.indexOf(preferredQuality);
  const qualitiesToTry = startIdx >= 0
    ? QUALITY_LEVELS.slice(startIdx)
    : [preferredQuality, ...QUALITY_LEVELS];

  let lastErr;
  for (const quality of qualitiesToTry) {
    try {
      const result = await tryDownload(quality);
      // Success — save to library
      const library = loadLibrary();
      library.items[video.videoId] = {
        videoId: video.videoId, title: video.title, playlistId, playlistTitle,
        thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`,
        filePath: result.filePath || '', downloadedAt: new Date().toISOString(),
        status: 'done', lastError: null, source: source || 'playlist',
      };
      saveLibrary(library);
      return { success: true, filePath: result.filePath };
    } catch (e) {
      lastErr = e;
      console.log(`[download] ${video.title} failed at ${quality}: ${e.message}, trying next...`);
    }
  }

  // All qualities failed
  const library = loadLibrary();
  library.items[video.videoId] = {
    videoId: video.videoId, title: video.title, playlistId, playlistTitle,
    thumbnail: video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/default.jpg`,
    filePath: '', downloadedAt: null, status: 'error', lastError: lastErr?.message || 'Download failed', source: source || 'playlist',
  };
  saveLibrary(library);
  throw lastErr;
});

ipcMain.handle('yt:cancel-download', (_, videoId) => {
  const proc = activeProcs[videoId];
  if (proc) {
    proc.kill();
    delete activeProcs[videoId];
  }
  return true;
});

// ─── IPC: Playlist folders ────────────────────────────────────────────────────

ipcMain.handle('library:get-playlists', () => {
  const library = loadLibrary();
  const playlists = {};
  for (const item of Object.values(library.items)) {
    if (item.playlistTitle && item.status === 'done') {
      if (!playlists[item.playlistTitle]) {
        playlists[item.playlistTitle] = { playlistId: item.playlistId, playlistTitle: item.playlistTitle, count: 0 };
      }
      playlists[item.playlistTitle].count++;
    }
  }
  // Also scan output dir for existing folders
  const settings = loadSettings();
  const baseDir = resolveDir(settings.outputDir);
  try {
    const dirs = fs.readdirSync(baseDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const dir of dirs) {
      if (!playlists[dir]) {
        playlists[dir] = { playlistId: null, playlistTitle: dir, count: 0 };
      }
    }
  } catch (_) {}
  return Object.values(playlists).sort((a, b) => a.playlistTitle.localeCompare(b.playlistTitle));
});

ipcMain.handle('library:move-track', async (_, { videoId, targetPlaylistTitle }) => {
  const library = loadLibrary();
  const item = library.items[videoId];
  if (!item) throw new Error('Track not found');
  if (!item.filePath || !fs.existsSync(item.filePath)) throw new Error('File not found on disk');

  const settings = loadSettings();
  const baseDir = resolveDir(settings.outputDir);
  const targetFolder = sanitizeFilename(targetPlaylistTitle);
  const targetDir = path.join(baseDir, targetFolder);
  if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

  const filename = path.basename(item.filePath);
  const targetPath = path.join(targetDir, filename);

  if (targetPath !== item.filePath) {
    fs.renameSync(item.filePath, targetPath);
  }

  item.filePath = targetPath;
  item.playlistId = item.playlistId || targetPlaylistTitle;
  item.playlistTitle = targetPlaylistTitle;
  saveLibrary(library);
  return { success: true, filePath: targetPath };
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sanitizeFilename(name) {
  return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\s+/g, ' ').trim().slice(0, 200);
}

function findOutputFile(dir, videoId) {
  try {
    const files = fs.readdirSync(dir);
    const match = files.find((f) => f.includes(`[${videoId}]`) && f.endsWith('.mp3'));
    return match ? path.join(dir, match) : null;
  } catch (_) {
    return null;
  }
}
