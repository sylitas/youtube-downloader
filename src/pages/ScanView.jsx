import React, { useState, useRef, useEffect } from 'react';
import { Search, Download, CheckCircle2, Clock, Loader2, ChevronsUp, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function formatDateTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch (_) { return iso; }
}

export default function ScanView({ onSyncStart }) {
  const [url, setUrl] = useState('');
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);
  const [playlist, setPlaylist] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([]);
  const inputRef = useRef(null);

  // Load history
  const loadHistory = async () => {
    try {
      const h = await window.electronAPI.getHistory();
      setHistory(h || []);
    } catch (_) {}
  };

  useEffect(() => { loadHistory(); }, []);

  const isYouTubeUrl = (text) =>
    text.includes('youtube.com') || text.includes('youtu.be');

  const cleanPlaylistUrl = (rawUrl) => {
    const secondHttp = rawUrl.indexOf('http', 1);
    const cleaned = secondHttp > 0 ? rawUrl.slice(0, secondHttp).trim() : rawUrl.trim();
    try {
      const u = new URL(cleaned);
      const listId = u.searchParams.get('list');
      if (listId) return `https://www.youtube.com/playlist?list=${listId}`;
    } catch (_) {}
    return cleaned;
  };

  const handleScan = async (targetUrl) => {
    const u = cleanPlaylistUrl((targetUrl || url).trim());
    if (!u) return;
    setScanning(true);
    setError(null);
    setPlaylist(null);
    setHistoryOpen(false);
    try {
      const settings = await window.electronAPI.getSettings();
      const result = await window.electronAPI.scanPlaylist({
        url: u,
        cookiesFile: settings.cookiesFile || '',
      });
      setPlaylist(result);
      // Refresh history after scan
      await loadHistory();
    } catch (e) {
      setError(e.message);
    } finally {
      setScanning(false);
    }
  };

  const handlePaste = (e) => {
    const pasted = e.clipboardData.getData('text').trim();
    e.preventDefault();
    e.stopPropagation();
    if (inputRef.current) {
      inputRef.current.value = pasted;
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
      nativeInputValueSetter.call(inputRef.current, pasted);
      inputRef.current.dispatchEvent(new Event('input', { bubbles: true }));
    }
    setUrl(pasted);
    if (isYouTubeUrl(pasted)) {
      setTimeout(() => handleScan(pasted), 100);
    }
  };

  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setIsDragging(false);
    const text = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain') || '';
    const trimmed = text.trim().split('\n')[0].trim();
    if (trimmed && isYouTubeUrl(trimmed)) { setUrl(trimmed); handleScan(trimmed); }
    else if (trimmed) { setError('Dropped URL does not appear to be a YouTube playlist.'); }
  };

  const handleHistoryClick = (item) => {
    setUrl(item.playlistUrl);
    setHistoryOpen(false);
    handleScan(item.playlistUrl);
  };

  const handleHistoryDelete = async (e, id) => {
    e.stopPropagation();
    await window.electronAPI.deleteHistory(id);
    await loadHistory();
  };

  const pendingCount = playlist ? playlist.videos.filter((v) => v.status === 'pending').length : 0;
  const downloadedCount = playlist ? playlist.videos.filter((v) => v.status === 'downloaded').length : 0;

  return (
    <div
      className={`relative flex flex-col h-full p-6 gap-6 transition-colors ${
        isDragging ? 'border-2 border-dashed border-blue-500 bg-blue-950/10 rounded-xl' : ''
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-6 flex items-center justify-center z-10 pointer-events-none">
          <div className="bg-blue-950/80 border-2 border-blue-500 rounded-xl px-8 py-6 text-center">
            <p className="text-blue-300 text-base font-medium">Drop YouTube playlist URL here</p>
          </div>
        </div>
      )}

      {/* URL input */}
      <div>
        <label className="block text-sm font-medium mb-2">Playlist URL</label>
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onPaste={handlePaste}
            onKeyDown={(e) => e.key === 'Enter' && handleScan()}
            placeholder="Paste YouTube playlist URL here…"
            className="flex-1"
            disabled={scanning}
          />
          <Button onClick={() => handleScan()} disabled={scanning || !url.trim()}>
            {scanning ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
            {scanning ? 'Scanning…' : 'Scan'}
          </Button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-400 bg-red-950/30 border border-red-800 rounded-md px-3 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Playlist info */}
      {playlist && (
        <>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{playlist.playlistTitle}</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {playlist.videos.length} videos · {downloadedCount} downloaded · {pendingCount} pending
              </p>
            </div>
            <Button onClick={() => onSyncStart(playlist)} disabled={pendingCount === 0}>
              <Download size={16} />
              Sync {pendingCount > 0 ? `(${pendingCount})` : ''}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {playlist.videos.map((video, i) => (
              <div key={video.videoId} className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors">
                <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                <img src={video.thumbnail} alt="" className="w-10 h-10 rounded object-cover shrink-0 bg-zinc-800"
                  onError={(e) => { e.target.style.display = 'none'; }} />
                <span className="flex-1 text-sm truncate">{video.title}</span>
                {video.status === 'downloaded' ? (
                  <Badge variant="success" className="shrink-0"><CheckCircle2 size={10} className="mr-1" />Downloaded</Badge>
                ) : (
                  <Badge variant="muted" className="shrink-0"><Clock size={10} className="mr-1" />Pending</Badge>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Empty state — only when no playlist loaded */}
      {!playlist && !scanning && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 text-muted-foreground">
          <Search size={40} className="opacity-20" />
          <p className="text-sm">Paste a YouTube playlist URL above to get started.</p>
        </div>
      )}

      {/* Bottom history panel — show when no playlist loaded */}
      {!playlist && !scanning && (
        <>
          {/* Toggle button — chevrons with bounce animation */}
          <div className="flex justify-center pb-1">
            <button
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex flex-col items-center gap-0.5 text-muted-foreground hover:text-foreground transition-colors focus:outline-none"
            >
              <div className={`transition-transform ${historyOpen ? 'rotate-180' : 'animate-bounce-subtle'}`}>
                <ChevronsUp size={20} />
              </div>
              <span className="text-[11px]">{historyOpen ? 'Hide history' : 'Scan history'}</span>
            </button>
          </div>

          {/* History panel with slide animation */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              historyOpen ? 'max-h-[280px] opacity-100' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="border border-border rounded-lg bg-zinc-900/60 overflow-y-auto max-h-[260px]">
              <div className="px-4 py-2 border-b border-border flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Scan History</span>
                {history.length > 0 && (
                  <button
                    onClick={async (e) => { e.stopPropagation(); await window.electronAPI.clearHistory(); await loadHistory(); }}
                    className="text-[10px] text-muted-foreground hover:text-red-400 transition-colors"
                  >Clear all</button>
                )}
              </div>
              {history.length === 0 && (
                <div className="px-4 py-6 text-center text-muted-foreground text-xs">
                  No scan history yet. Scan a playlist to see it here.
                </div>
              )}
              {history.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleHistoryClick(item)}
                  className="flex items-center gap-3 px-4 py-2.5 hover:bg-zinc-800/50 cursor-pointer transition-colors border-b border-border/30 last:border-b-0 group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{item.playlistTitle}</span>
                      <Badge variant="muted" className="text-[10px] shrink-0">{item.videoCount} videos</Badge>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-muted-foreground">{formatDateTime(item.scannedAt)}</span>
                      <span className="text-xs text-muted-foreground">·</span>
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">{item.playlistUrl}</span>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    title="Delete"
                    onClick={(e) => handleHistoryDelete(e, item.id)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
