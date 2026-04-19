import React, { useState, useEffect } from 'react';
import { RefreshCw, RotateCcw, ChevronDown, ChevronRight, AlertCircle, FolderOpen, Music } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

export default function ErrorsView() {
  const [library, setLibrary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedPlaylists, setExpandedPlaylists] = useState({});
  const [retryingIds, setRetryingIds] = useState({});
  const [retryProgress, setRetryProgress] = useState({});

  const load = async () => {
    setLoading(true);
    const lib = await window.electronAPI.getLibrary();
    setLibrary(lib);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Listen to progress events for retries
  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress(({ videoId, progress }) => {
      setRetryProgress((prev) => ({ ...prev, [videoId]: progress }));
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

  const retryPlaylist = async (playlist) => {
    for (const item of playlist.items) {
      await retryOne(item);
    }
  };

  const retryAll = async () => {
    for (const playlist of playlistList) {
      await retryPlaylist(playlist);
    }
  };

  const totalErrors = errorItems.length;
  const currentlyRetrying = Object.values(retryingIds).filter(Boolean).length;

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
            <Button variant="secondary" size="sm" onClick={retryAll} disabled={currentlyRetrying > 0}>
              <RotateCcw size={14} className="mr-1" />
              Retry All ({totalErrors})
            </Button>
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
                        <div className="flex items-center gap-3">
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
                            <span className="text-sm truncate block">{item.title}</span>
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
                              <RefreshCw size={10} className="mr-1 animate-spin" />Retrying
                            </Badge>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs shrink-0"
                              onClick={() => retryOne(item)}
                              disabled={currentlyRetrying > 0}
                            >
                              <RotateCcw size={12} className="mr-1" /> Retry
                            </Button>
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
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground pt-16">
            <AlertCircle size={40} className="opacity-20" />
            <p className="text-sm">No download errors. All good!</p>
          </div>
        )}
      </div>
    </div>
  );
}
