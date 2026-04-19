# YT Playlist Sync

**Your YouTube music, offline.**

A lightweight macOS app to download and manage music from YouTube — single tracks or entire playlists, with Apple Music integration.

![Electron](https://img.shields.io/badge/Electron-34-blue) ![React](https://img.shields.io/badge/React-18-61dafb) ![License](https://img.shields.io/badge/License-ISC-green)

## ✨ Features

- **Single Track** — Paste a video URL, pick a playlist folder, download
- **Playlist Sync** — Paste a playlist URL, scan all tracks, download with configurable concurrency
- **Library** — Album-style grid view organized by playlist, click into track lists
- **Apple Music Sync** — One-click sync: creates playlists and adds tracks to Apple Music
- **YouTube Browser** — Built-in YouTube tab for browsing without leaving the app
- **Download Manager** — Real-time progress, auto quality fallback (320K → 128K)
- **Rate Limit Protection** — Auto-detects YouTube rate limits, pauses queue, marks remaining tracks
- **Find Similar** — When a download fails, search YouTube for alternative versions
- **Error Recovery** — Dedicated Retry tab with single retry, find similar, or bulk retry
- **Thumbnail & Metadata** — Album art and tags embedded in every MP3
- **Scan History** — Quick re-scan from previous sessions
- **Cookie Auth** — Support private/unlisted playlists via `cookies.txt`
- **Auto Setup** — Installs required dependencies on first launch
- **Factory Reset** — Selectively clear downloads, library, history, or settings

## 📋 Requirements

- **macOS** (Apple Silicon or Intel)
- **Homebrew** — for automatic dependency installation
- The app will auto-install these via Homebrew on first launch:
  - [yt-dlp](https://github.com/yt-dlp/yt-dlp) — YouTube downloader
  - [AtomicParsley](https://github.com/wez/atomicparsley) — MP3 artwork embedding

## 🚀 Getting Started

### Install from Release

1. Download the `.dmg` from [Releases](https://github.com/sylitas/youtube-downloader/releases)
2. Open the DMG and drag the app to Applications
3. **Important:** The app is unsigned. Before opening, run in Terminal:
   ```bash
   xattr -cr /Applications/YT\ Playlist\ Sync.app
   ```
4. Open the app — it will auto-install dependencies (yt-dlp, AtomicParsley) via Homebrew

### Run from Source

```bash
git clone https://github.com/sylitas/youtube-downloader.git
cd download-youtube-playlist
npm install
npm run dev
```

### Build

```bash
# Production build (creates .dmg in release/)
npm run dist
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
  main.js            — Main process (IPC, downloads, Apple Music sync)
  preload.js         — Context bridge
src/
  App.jsx            — Layout, tabs, deps overlay
  pages/
    DashboardView    — Home / welcome screen
    SingleView       — Single track download
    ScanView         — Playlist scan + history
    ProgressView     — Playlist download progress with rate limit detection
    LibraryView      — Album grid view + Apple Music sync
    ErrorsView       — Retry, find similar, error management
    YoutubeView      — Embedded YouTube browser
  components/
    SettingsPanel    — Settings, update libs, factory reset
    ui/              — shadcn components
build/
  icon.png/.icns     — App icon
```

## ⚙️ Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Output Directory | `~/Music/YT` | Where MP3 files are saved |
| Audio Quality | 320K | Auto fallback: 320K → 256K → 192K → 128K |
| Parallel Downloads | 10 | Simultaneous downloads (1–100). Lower = less chance of rate limiting |
| Cookies File | — | `cookies.txt` for private playlist access |

## 📝 License

ISC
