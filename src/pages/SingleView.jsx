import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, CheckCircle2, XCircle, RotateCcw, Music, FolderPlus, ChevronsUp, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function SingleView() {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [videoInfo, setVideoInfo] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [showPlaylistPicker, setShowPlaylistPicker] = useState(false);
  const [showNewPlaylistInput, setShowNewPlaylistInput] = useState(false);
  const [lastSavedPlaylist, setLastSavedPlaylist] = useState('');
  const [showMoveDialog, setShowMoveDialog] = useState(false);

  const [recentDownloads, setRecentDownloads] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [animating, setAnimating] = useState(false);

  const inputRef = useRef(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress(({ videoId, progress }) => {
      setRecentDownloads((prev) =>
        prev.map((d) => d.videoId === videoId ? { ...d, status: 'downloading', progress } : d)
      );
    });
    return unsubscribe;
  }, []);

  const loadPlaylists = async () => {
    try { const p = await window.electronAPI.getPlaylists(); setPlaylists(p || []); } catch (_) {}
  };

  const loadRecentDownloads = async () => {
    try {
      const lib = await window.electronAPI.getLibrary();
      const items = Object.values(lib.items)
        .filter((item) => item.source === 'single')
        .sort((a, b) => (b.downloadedAt || '').localeCompare(a.downloadedAt || ''));
      setRecentDownloads((prev) => {
        const inProgress = prev.filter((d) => d.status === 'downloading' || d.status === 'queued');
        const merged = [...inProgress];
        for (const item of items) {
          if (!merged.find((d) => d.videoId === item.videoId)) merged.push(item);
        }
        return merged;
      });
    } catch (_) {}
  };

  useEffect(() => { loadPlaylists(); loadRecentDownloads(); }, []);

  const isYouTubeUrl = (text) => text.includes('youtube.com/watch') || text.includes('youtu.be/');

  const cleanVideoUrl = (rawUrl) => {
    const secondHttp = rawUrl.indexOf('http', 1);
    const cleaned = secondHttp > 0 ? rawUrl.slice(0, secondHttp).trim() : rawUrl.trim();
    try {
      const u = new URL(cleaned);
      const v = u.searchParams.get('v');
      if (v) return { url: `https://www.youtube.com/watch?v=${v}`, videoId: v };
      if (u.hostname === 'youtu.be') { const id = u.pathname.slice(1); return { url: `https://www.youtube.com/watch?v=${id}`, videoId: id }; }
    } catch (_) {}
    return { url: cleaned, videoId: null };
  };

  const handleScan = async (targetUrl) => {
    const raw = (targetUrl || url).trim();
    if (!raw) return;
    const { url: cleanUrl, videoId } = cleanVideoUrl(raw);
    if (!videoId) { setError('Could not extract video ID from URL.'); return; }

    setScanning(true); setError(null); setVideoInfo(null);
    setShowPlaylistPicker(false); setShowMoveDialog(false);
    setShowNewPlaylistInput(false); setNewPlaylistName('');

    try {
      const settings = await window.electronAPI.getSettings();
      const result = await window.electronAPI.scanPlaylist({ url: cleanUrl, cookiesFile: settings.cookiesFile || '' });
      let video = result.videos?.[0] || {
        videoId, title: result.playlistTitle || videoId, url: cleanUrl,
        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`, status: 'pending',
      };
      setVideoInfo(video);
      setShowPlaylistPicker(true);
      if (lastSavedPlaylist) { setSelectedPlaylist(lastSavedPlaylist); setShowNewPlaylistInput(false); }
      else { setShowNewPlaylistInput(true); }
      await loadPlaylists();
    } catch (e) { setError(e.message); }
    finally { setScanning(false); }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim();
    e.preventDefault(); e.stopPropagation();
    setUrl(pasted);
    if (isYouTubeUrl(pasted)) setTimeout(() => handleScan(pasted), 100);
  };

  const getTargetPlaylist = () => {
    if (newPlaylistName.trim()) return newPlaylistName.trim();
    if (selectedPlaylist) return selectedPlaylist;
    return '';
  };

  const handleDownload = async () => {
    if (!videoInfo) return;
    const playlistTitle = getTargetPlaylist();
    const savedVideo = { ...videoInfo };

    const newEntry = {
      videoId: savedVideo.videoId, title: savedVideo.title,
      thumbnail: savedVideo.thumbnail || `https://i.ytimg.com/vi/${savedVideo.videoId}/hqdefault.jpg`,
      playlistTitle: playlistTitle || 'Root', status: 'downloading', progress: 0,
      downloadedAt: new Date().toISOString(),
    };

    // Animate card flying down
    setAnimating(true);
    await new Promise((r) => setTimeout(r, 600));

    // Add to recent, DON'T open panel, reset top
    setRecentDownloads((prev) => [newEntry, ...prev.filter((d) => d.videoId !== savedVideo.videoId)]);
    setVideoInfo(null); setUrl(''); setShowPlaylistPicker(false); setAnimating(false);

    // Download in background
    try {
      await window.electronAPI.downloadVideo({
        video: savedVideo, playlistId: 'single', playlistTitle: playlistTitle || '', source: 'single',
      });
      setRecentDownloads((prev) =>
        prev.map((d) => d.videoId === savedVideo.videoId ? { ...d, status: 'done', progress: 100 } : d)
      );
      setLastSavedPlaylist(playlistTitle);
      await loadPlaylists();
    } catch (e) {
      setRecentDownloads((prev) =>
        prev.map((d) => d.videoId === savedVideo.videoId ? { ...d, status: 'error', error: e.message } : d)
      );
    }
    await loadRecentDownloads();
  };

  const handleRetry = async (item) => {
    setRecentDownloads((prev) =>
      prev.map((d) => d.videoId === item.videoId ? { ...d, status: 'downloading', progress: 0, error: null } : d)
    );
    try {
      await window.electronAPI.downloadVideo({
        video: { videoId: item.videoId, title: item.title, url: `https://www.youtube.com/watch?v=${item.videoId}`, thumbnail: item.thumbnail },
        playlistId: 'single', playlistTitle: item.playlistTitle || '', source: 'single',
      });
      setRecentDownloads((prev) =>
        prev.map((d) => d.videoId === item.videoId ? { ...d, status: 'done', progress: 100 } : d)
      );
    } catch (e) {
      setRecentDownloads((prev) =>
        prev.map((d) => d.videoId === item.videoId ? { ...d, status: 'error', error: e.message } : d)
      );
    }
    await loadRecentDownloads();
  };

  const handleDeleteRecent = async (item) => {
    await window.electronAPI.deleteTrack(item.videoId);
    setRecentDownloads((prev) => prev.filter((d) => d.videoId !== item.videoId));
  };

  const handleClearHistory = async () => {
    await window.electronAPI.clearSingleHistory();
    setRecentDownloads([]);
  };

  const handleMoveTrack = async (targetTitle) => {
    if (!videoInfo) return;
    try {
      await window.electronAPI.moveTrack({ videoId: videoInfo.videoId, targetPlaylistTitle: targetTitle });
      setShowMoveDialog(false); await loadPlaylists();
    } catch (e) { alert('Move failed: ' + e.message); }
  };

  const handleHistoryClick = (item) => {
    const link = `https://www.youtube.com/watch?v=${item.videoId}`;
    setUrl(link); setHistoryOpen(false); handleScan(link);
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4 relative">
      {/* URL input */}
      <div>
        <label className="block text-sm font-medium mb-2">Video URL</label>
        <div className="flex gap-2">
          <Input ref={inputRef} value={url} onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste} onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Paste YouTube video URL here…" className="flex-1" disabled={scanning} />
          <Button onClick={() => handleScan()} disabled={scanning || !url.trim()}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
            {scanning ? 'Loading…' : 'Get'}
          </Button>
        </div>
        {error && !videoInfo && (
          <p className="mt-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-md px-3 py-2">{error}</p>
        )}
      </div>

      {/* Video info card */}
      {videoInfo && (
        <div className={`flex flex-col items-center gap-4 py-4 ${
          animating ? 'fixed inset-x-0 top-0 bottom-0 z-40 flex items-center justify-center animate-genie-down' : ''
        }`}>
          <img src={videoInfo.thumbnail || `https://i.ytimg.com/vi/${videoInfo.videoId}/hqdefault.jpg`}
            alt="" className="w-52 rounded-lg object-cover bg-zinc-800 shadow-lg"
            onError={(e) => { e.target.style.display = 'none'; }} />
          <h2 className="text-base font-semibold text-center max-w-md">{videoInfo.title}</h2>

          {showPlaylistPicker && videoInfo.status !== 'downloaded' && (
            <div className="w-72 space-y-2">
              <label className="block text-xs font-medium text-muted-foreground">Save to playlist</label>
              <select value={showNewPlaylistInput ? '__new__' : selectedPlaylist}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '__new__') { setShowNewPlaylistInput(true); setSelectedPlaylist(''); }
                  else { setSelectedPlaylist(val); setNewPlaylistName(''); setShowNewPlaylistInput(false); }
                }}
                className="w-full bg-zinc-800 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring">
                <option value="__new__">+ Create New Playlist</option>
                <option value="">Root (~/Music/YT)</option>
                {playlists.map((p) => (
                  <option key={p.playlistTitle} value={p.playlistTitle}>{p.playlistTitle} ({p.count})</option>
                ))}
              </select>
              {showNewPlaylistInput && (
                <Input value={newPlaylistName} onChange={(e) => { setNewPlaylistName(e.target.value); setSelectedPlaylist(''); }}
                  placeholder="Enter playlist name…" className="text-sm" autoFocus
                  onKeyDown={(e) => { if (e.key === 'Escape') { setShowNewPlaylistInput(false); setNewPlaylistName(''); setSelectedPlaylist(''); } }} />
              )}
            </div>
          )}

          {videoInfo.status === 'downloaded' ? (
            <Badge variant="success" className="text-sm px-3 py-1"><CheckCircle2 size={14} className="mr-1.5" /> Already downloaded</Badge>
          ) : (
            <Button onClick={handleDownload} disabled={animating}>
              <Download size={16} className="mr-1.5" /> Download
            </Button>
          )}
        </div>
      )}

      {/* Spacer to push history to bottom */}
      <div className="flex-1" />

      {/* Empty state — show when no video scanned */}
      {!videoInfo && !scanning && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground pointer-events-none" style={{ top: '80px', bottom: '80px' }}>
          <Music size={40} className="opacity-20" />
          <p className="text-sm">Paste a YouTube video URL above to get started.</p>
        </div>
      )}

      {/* Bottom: Recent Downloads — same design as playlist history */}
      <div className="flex justify-center pb-1">
        <button
          onClick={() => { setHistoryOpen(!historyOpen); if (!historyOpen) loadRecentDownloads(); }}
          className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
        >
          <div className={`transition-transform ${historyOpen ? 'rotate-180' : 'animate-bounce-subtle'}`}>
            <ChevronsUp size={20} />
          </div>
          <span className="text-[11px]">
            {historyOpen ? 'Hide downloads' : `Recent Downloads${recentDownloads.length > 0 ? ` (${recentDownloads.length})` : ''}`}
          </span>
        </button>
      </div>

      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${historyOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="border border-border rounded-lg bg-zinc-900/60 overflow-y-auto max-h-[260px]">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Recent Downloads{recentDownloads.length > 0 ? ` (${recentDownloads.length})` : ''}
            </span>
            {recentDownloads.length > 0 && (
              <button onClick={handleClearHistory} className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors">
                Clear all
              </button>
            )}
          </div>

          {recentDownloads.length === 0 && (
            <div className="px-4 py-6 text-center text-muted-foreground text-xs">No downloads yet.</div>
          )}

          {recentDownloads.map((item) => (
            <div key={item.videoId}
              onClick={() => { if (item.status === 'done') handleHistoryClick(item); }}
              className={`flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-b-0 hover:bg-zinc-800/50 transition-colors group ${item.status === 'done' ? 'cursor-pointer' : ''}`}>
              {item.thumbnail ? (
                <img src={item.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-zinc-800"
                  onError={(e) => { e.target.style.display = 'none'; }} />
              ) : (
                <div className="w-10 h-10 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                  <Music size={14} className="text-muted-foreground" />
                </div>
              )}

              <div className="flex-1 min-w-0">
                <span className="text-sm truncate block">{item.title}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{item.playlistTitle || 'Root'}</span>
                  {item.downloadedAt && item.status === 'done' && (
                    <>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(item.downloadedAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </>
                  )}
                </div>
                {item.status === 'downloading' && (
                  <Progress value={item.progress || 0} className="h-1 mt-1" />
                )}
                {item.status === 'error' && item.error && (
                  <p className="text-[10px] text-red-400 truncate mt-0.5">{item.error}</p>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {item.status === 'downloading' && (
                  <span className="text-xs text-muted-foreground">{(item.progress || 0).toFixed(0)}%</span>
                )}
                {item.status === 'done' && (
                  <Badge variant="success" className="text-[10px]"><CheckCircle2 size={9} className="mr-0.5" />Done</Badge>
                )}
                {item.status === 'error' && (
                  <Button variant="ghost" size="icon" className="h-7 w-7" title="Retry"
                    onClick={(e) => { e.stopPropagation(); handleRetry(item); }}>
                    <RotateCcw size={13} />
                  </Button>
                )}
                <Button variant="ghost" size="icon"
                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-950/40"
                  title="Delete" onClick={(e) => { e.stopPropagation(); handleDeleteRecent(item); }}>
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showMoveDialog && (
        <MoveDialog playlists={playlists} onMove={handleMoveTrack} onClose={() => setShowMoveDialog(false)} />
      )}
    </div>
  );
}

function MoveDialog({ playlists, onMove, onClose }) {
  const [selected, setSelected] = useState('');
  const [newName, setNewName] = useState('');
  const target = newName.trim() || selected;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[400px] rounded-xl border border-border bg-zinc-900 shadow-xl p-6">
        <h3 className="text-base font-semibold mb-4">Move to playlist</h3>
        <div className="space-y-3">
          <select value={selected} onChange={(e) => { setSelected(e.target.value); setNewName(''); }}
            className="w-full bg-zinc-800 border border-border rounded-md px-3 py-2 text-sm text-foreground focus:outline-none">
            <option value="">Select existing playlist…</option>
            {playlists.map((p) => (<option key={p.playlistTitle} value={p.playlistTitle}>{p.playlistTitle} ({p.count})</option>))}
          </select>
          <div className="flex items-center gap-2"><div className="flex-1 h-px bg-border" /><span className="text-xs text-muted-foreground">or</span><div className="flex-1 h-px bg-border" /></div>
          <Input value={newName} onChange={(e) => { setNewName(e.target.value); setSelected(''); }} placeholder="Create new playlist…" />
        </div>
        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => target && onMove(target)} disabled={!target}>Move</Button>
        </div>
      </div>
    </div>
  );
}
