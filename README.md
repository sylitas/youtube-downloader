# YT Playlist Sync

**Your YouTube music, offline.**

A lightweight macOS app to download and manage music from YouTube — single tracks or entire playlists.

![Electron](https://img.shields.io/badge/Electron-34-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![License](https://img.shields.io/badge/License-ISC-green)

## ✨ Features

- **Single Track** — Paste a video URL, pick a playlist folder, download
- **Playlist Sync** — Paste a playlist URL, scan all tracks, download in parallel (10 concurrent)
- **Smart Library** — Tracks organized by playlist folders in `~/Music/YT`
- **Download Manager** — Real-time progress, retry on failure, auto quality fallback (320K → 128K)
- **Thumbnail & Metadata** — Album art and tags embedded in every MP3
- **Scan History** — Quick re-scan from previous sessions
- **Error Recovery** — Dedicated Errors tab, retry individual or bulk
- **Cookie Auth** — Support private/unlisted playlists via `cookies.txt`
- **Auto Setup** — Installs required dependencies on first launch
- **Factory Reset** — Selectively clear downloads, library, history, or settings

## 📋 Requirements

- **macOS** (Apple Silicon)
- **Homebrew** — for automatic dependency installation
- The app will auto-install these via Homebrew on first launch:
  - [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube downloader
  - [AtomicParsley](https://github.com/wez/atomicparsley) — MP3 artwork embedding

## 🚀 Getting Started

### Option 1: Download Release
1. Download the `.dmg` from [Releases](../../releases)
2. Drag to Applications
3. Open — the app will install dependencies automatically
4. Paste a YouTube link and start downloading

> ⚠️ The app is unsigned. If macOS blocks it, run:
> ```bash
> xattr -cr /Applications/YT\ Playlist\ Sync.app
> ```

### Option 2: Run from Source
```bash
git clone <repo-url>
cd download-youtube-playlist
npm install
npm run dev
```

## 🏗️ Tech Stack

- **Electron** — Desktop app framework
- **React 18** + **Vite** — Fast UI development
- **Tailwind CSS** + **shadcn/ui** — Styling & components
- **lucide-react** — Icons
- **yt-dlp** — YouTube audio extraction
- **AtomicParsley** — MP3 metadata/artwork embedding

## 📁 Project Structure

```
electron/
  main.js            — Main process (IPC, downloads, manifest)
  preload.js         — Context bridge
src/
  App.jsx            — Layout, tabs, deps overlay
  pages/
    DashboardView    — Home / welcome screen
    SingleView       — Single track download
    ScanView         — Playlist scan + history
    ProgressView     — Playlist download progress
    LibraryView      — Browse downloaded files
    ErrorsView       — Error retry management
  components/
    SettingsPanel    — Settings, update libs, factory reset
    ui/              — shadcn components
build/
  icon.png/.icns     — App icon
```

## 📦 Build

```bash
# Production build (creates .dmg in release/)
npm run dist
```

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Output Directory | `~/Music/YT` | Where MP3 files are saved |
| Audio Quality | 320K | Auto fallback: 320K → 256K → 192K → 128K |
| Cookies File | — | `cookies.txt` for private playlist access |

## 📝 License

ISC
