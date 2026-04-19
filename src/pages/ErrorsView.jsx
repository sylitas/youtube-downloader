import React, { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw, ChevronDown, ChevronRight, AlertCircle, FolderOpen, Music, Copy, Check, Trash2, Search, X, Loader2, Download, ThumbsUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function formatViews(n) {
  if (!n) return '0';
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1) + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toString();
}

export default function ErrorsView() {
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlaylists, setExpandedPlaylists] = useState({});
  const [retryingIds, setRetryingIds] = useState({});
  const [retryProgress, setRetryProgress] = useState({});
  const [copiedId, setCopiedId] = useState(null);
  const [searchItem, setSearchItem] = useState(null); // item being searched
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [downloadingAlt, setDownloadingAlt] = useState(null);
  const [altVideoMap, setAltVideoMap] = useState({}); // newVideoId -> originalVideoId

  const load = async () => {
    setLoading(true);
    const lib = await window.electronAPI.getLibrary();
    setLibrary(lib);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Listen to progress events for retries (including alt downloads)
  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress(({ videoId, progress }) => {
      // Map alt video progress to original record
      setAltVideoMap((map) => {
        const targetId = map[videoId] || videoId;
        setRetryProgress((prev) => ({ ...prev, [targetId]: progress }));
        return map;
      });
    });
    return unsubscribe;
  }, []);

  // Group error items by playlist
  const errorItems = library
    ? Object.values(library.items).filter((item) => item.status === 'error')
    : [];

  const playlists = {};
  errorItems.forEach((item) => {
    const key = item.playlistId || 'unknown';
    if (!playlists[key]) {
      playlists[key] = {
        playlistId: item.playlistId,
        playlistTitle: item.playlistTitle || 'Unknown Playlist',
        items: [],
      };
    }
    playlists[key].items.push(item);
  });

  const playlistList = Object.values(playlists).sort((a, b) =>
    a.playlistTitle.localeCompare(b.playlistTitle)
  );

  const togglePlaylist = (playlistId) => {
    setExpandedPlaylists((prev) => ({
      ...prev,
      [playlistId]: !prev[playlistId],
    }));
  };

  // Expand all by default on first load
  useEffect(() => {
    if (playlistList.length > 0 && Object.keys(expandedPlaylists).length === 0) {
      const expanded = {};
      playlistList.forEach((p) => { expanded[p.playlistId || 'unknown'] = true; });
      setExpandedPlaylists(expanded);
    }
  }, [playlistList.length]);

  const retryOne = async (item) => {
    setRetryingIds((prev) => ({ ...prev, [item.videoId]: true }));
    setRetryProgress((prev) => ({ ...prev, [item.videoId]: 0 }));
    try {
      await window.electronAPI.downloadVideo({
        video: {
          videoId: item.videoId,
          title: item.title,
          url: `https://www.youtube.com/watch?v=${item.videoId}`,
          thumbnail: item.thumbnail,
        },
        playlistId: item.playlistId,
        playlistTitle: item.playlistTitle,
        source: item.source || 'playlist',
      });
      // Reload library to get updated status
      await load();
    } catch (e) {
      // Error is saved in manifest by main process, reload to show updated error
      await load();
    } finally {
      setRetryingIds((prev) => ({ ...prev, [item.videoId]: false }));
      setRetryProgress((prev) => {
        const next = { ...prev };
        delete next[item.videoId];
        return next;
      });
    }
  };

  // Sequential retry — one at a time
  const retryPlaylist = async (playlist) => {
    for (const item of playlist.items) {
      await retryOne(item);
    }
  };

  const retryAll = async () => {
    const allItems = playlistList.flatMap((p) => p.items);
    for (const item of allItems) {
      await retryOne(item);
    }
  };

  const totalErrors = errorItems.length;
  const currentlyRetrying = Object.values(retryingIds).filter(Boolean).length;

  const deleteOne = async (videoId) => {
    await window.electronAPI.deleteError(videoId);
    await load();
  };

  const deleteAll = async () => {
    await window.electronAPI.deleteAllErrors();
    await load();
  };

  const handleSearchSimilar = async (item) => {
    setSearchItem(item);
    setSearchResults([]);
    setSearching(true);
    try {
      const results = await window.electronAPI.searchSimilar(item.title);
      setSearchResults(results);
    } catch (e) {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleDownloadAlt = async (result) => {
    if (!searchItem) return;
    const originalVideoId = searchItem.videoId;
    const playlistId = searchItem.playlistId;
    const playlistTitle = searchItem.playlistTitle;
    const source = searchItem.source || 'playlist';

    // Close dialog immediately
    setSearchItem(null);
    setSearchResults([]);

    // Map new videoId progress to original record
    setAltVideoMap((prev) => ({ ...prev, [result.videoId]: originalVideoId }));

    // Show downloading state on the original record
    setRetryingIds((prev) => ({ ...prev, [originalVideoId]: true }));
    setRetryProgress((prev) => ({ ...prev, [originalVideoId]: 0 }));

    try {
      // Delete old error record
      await window.electronAPI.deleteError(originalVideoId);
      // Download new video into same playlist
      await window.electronAPI.downloadVideo({
        video: {
          videoId: result.videoId,
          title: result.title,
          url: result.url,
          thumbnail: result.thumbnail,
        },
        playlistId,
        playlistTitle,
        source,
      });
      await load();
    } catch (e) {
      await load();
    } finally {
      setRetryingIds((prev) => ({ ...prev, [originalVideoId]: false }));
      setRetryProgress((prev) => {
        const next = { ...prev };
        delete next[originalVideoId];
        return next;
      });
      setAltVideoMap((prev) => {
        const next = { ...prev };
        delete next[result.videoId];
        return next;
      });
    }
  };

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Download Errors</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {totalErrors} {totalErrors === 1 ? 'error' : 'errors'} across {playlistList.length} {playlistList.length === 1 ? 'playlist' : 'playlists'}
            {currentlyRetrying > 0 && ` · ${currentlyRetrying} retrying…`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} title="Refresh">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </Button>
          {totalErrors > 0 && (
            <>
              <Button variant="secondary" size="sm" onClick={retryAll} disabled={currentlyRetrying > 0}>
                <RotateCcw size={14} className="mr-1" />
                Retry All ({totalErrors})
              </Button>
              <Button variant="destructive" size="sm" onClick={deleteAll} disabled={currentlyRetrying > 0}>
                <Trash2 size={14} className="mr-1" />
                Delete All
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Playlist / Error list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {playlistList.map((playlist) => {
          const key = playlist.playlistId || 'unknown';
          const isExpanded = expandedPlaylists[key] !== false;

          return (
            <div key={key} className="rounded-lg border border-border bg-zinc-900/30">
              {/* Playlist header */}
              <button
                onClick={() => togglePlaylist(key)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-800/40 transition-colors rounded-t-lg"
              >
                {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <FolderOpen size={16} className="text-muted-foreground" />
                <span className="flex-1 text-sm font-medium text-left truncate">{playlist.playlistTitle}</span>
                <Badge variant="destructive" className="text-[10px]">
                  {playlist.items.length} {playlist.items.length === 1 ? 'error' : 'errors'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs ml-1"
                  onClick={(e) => { e.stopPropagation(); retryPlaylist(playlist); }}
                  disabled={currentlyRetrying > 0}
                >
                  <RotateCcw size={12} className="mr-1" /> Retry All
                </Button>
              </button>

              {/* Error items */}
              {isExpanded && (
                <div className="border-t border-border">
                  {playlist.items.map((item) => {
                    const isRetrying = retryingIds[item.videoId];
                    const progress = retryProgress[item.videoId];

                    return (
                      <div
                        key={item.videoId}
                        className="flex flex-col px-4 py-2.5 hover:bg-zinc-800/30 transition-colors border-b border-border/50 last:border-b-0"
                      >
                        <div
                        className="flex items-center gap-3 cursor-pointer group/row"
                        onClick={() => {
                          navigator.clipboard.writeText(item.title);
                          setCopiedId(item.videoId);
                          setTimeout(() => setCopiedId((prev) => prev === item.videoId ? null : prev), 1500);
                        }}
                        title="Click to copy title"
                      >
                          {item.thumbnail ? (
                            <img
                              src={item.thumbnail}
                              alt=""
                              className="w-9 h-9 rounded object-cover shrink-0 bg-zinc-800"
                              onError={(e) => { e.target.style.display = 'none'; }}
                            />
                          ) : (
                            <div className="w-9 h-9 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                              <Music size={14} className="text-muted-foreground" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm truncate block flex items-center gap-1.5">
                              {item.title}
                              {copiedId === item.videoId ? (
                                <Check size={12} className="text-emerald-400 shrink-0" />
                              ) : (
                                <Copy size={12} className="text-muted-foreground opacity-0 group-hover/row:opacity-100 transition-opacity shrink-0" />
                              )}
                            </span>
                            {item.lastError && !isRetrying && (
                              <p className="text-xs text-red-400 truncate mt-0.5">{item.lastError}</p>
                            )}
                            {isRetrying && progress !== undefined && (
                              <div className="flex items-center gap-2 mt-1">
                                <Progress value={progress} className="h-1 flex-1" />
                                <span className="text-xs text-muted-foreground">{progress.toFixed(0)}%</span>
                              </div>
                            )}
                          </div>
                          {isRetrying ? (
                            <Badge variant="secondary" className="shrink-0">
                              <RefreshCw size={10} className="mr-1 animate-spin" />Downloading
                            </Badge>
                          ) : (
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={(e) => { e.stopPropagation(); retryOne(item); }}
                                disabled={currentlyRetrying > 0}
                                title="Retry"
                              >
                                <RotateCcw size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-blue-950/30"
                                onClick={(e) => { e.stopPropagation(); handleSearchSimilar(item); }}
                                title="Find similar video on YouTube"
                              >
                                <Search size={12} />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs text-red-400 hover:text-red-300 hover:bg-red-950/30"
                                onClick={(e) => { e.stopPropagation(); deleteOne(item.videoId); }}
                                disabled={currentlyRetrying > 0}
                              >
                                <Trash2 size={12} />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {/* Empty state */}
        {!loading && totalErrors === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground -mt-16">
            <ThumbsUp size={40} className="opacity-20" />
            <p className="text-sm">No download errors. All good!</p>
          </div>
        )}
      </div>

      {/* Search Similar Dialog */}
      {searchItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => { setSearchItem(null); setSearchResults([]); }}>
          <div className="w-[520px] max-h-[70vh] flex flex-col rounded-xl border border-border bg-zinc-900 shadow-xl" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-border shrink-0">
              <div className="min-w-0">
                <h3 className="text-sm font-semibold">Find Similar</h3>
                <p className="text-xs text-muted-foreground truncate mt-0.5">{searchItem.title}</p>
              </div>
              <button onClick={() => { setSearchItem(null); setSearchResults([]); }} className="text-muted-foreground hover:text-foreground transition-colors shrink-0 ml-3">
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 py-3">
              {searching && (
                <div className="flex items-center justify-center py-8 gap-2">
                  <Loader2 size={18} className="animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Searching YouTube…</span>
                </div>
              )}

              {!searching && searchResults.length === 0 && (
                <div className="flex items-center justify-center py-8">
                  <p className="text-sm text-muted-foreground">No results found.</p>
                </div>
              )}

              {!searching && searchResults.length > 0 && (
                <div className="space-y-2">
                  {searchResults.map((result) => (
                    <div
                      key={result.videoId}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:bg-zinc-800/50 transition-colors"
                    >
                      {result.thumbnail ? (
                        <img
                          src={result.thumbnail}
                          alt=""
                          className="w-16 h-10 rounded object-cover shrink-0 bg-zinc-800"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-16 h-10 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                          <Music size={14} className="text-muted-foreground" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate">{result.title}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {result.uploader}{result.duration ? ` · ${result.duration}` : ''}{result.viewCount ? ` · ${formatViews(result.viewCount)} views` : ''}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        className="shrink-0 h-7 px-2 text-xs"
                        disabled={downloadingAlt === result.videoId}
                        onClick={() => handleDownloadAlt(result)}
                      >
                        {downloadingAlt === result.videoId ? (
                          <><Loader2 size={12} className="mr-1 animate-spin" /> Downloading…</>
                        ) : (
                          <><Download size={12} className="mr-1" /> Download</>
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
