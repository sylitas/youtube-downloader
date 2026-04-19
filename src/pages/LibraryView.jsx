import React, { useState, useEffect } from 'react';
import { FolderOpen, FileAudio, RefreshCw, Search, Trash2, Music, Loader2, CheckCircle2, ArrowLeft, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

function formatDate(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch (_) {
    return iso;
  }
}

export default function LibraryView() {
  const [library, setLibrary] = useState(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncProgress, setSyncProgress] = useState(null);
  const [showSyncDetails, setShowSyncDetails] = useState(false);
  const [selectedPlaylist, setSelectedPlaylist] = useState(null);

  const load = async () => {
    setLoading(true);
    const lib = await window.electronAPI.getLibrary();
    setLibrary(lib);
    setLoading(false);
  };

  const handleDelete = async (item) => {
    const confirmed = window.confirm(
      `Delete track?\n\n"${item.title}"\n\nThis will remove the MP3 file and library entry.`
    );
    if (!confirmed) return;
    setDeletingId(item.videoId);
    try {
      await window.electronAPI.deleteTrack(item.videoId);
      await load();
    } catch (e) {
      alert('Failed to delete: ' + e.message);
    } finally {
      setDeletingId(null);
    }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const unsub = window.electronAPI.onMusicSyncProgress?.((data) => {
      setSyncProgress(data);
    });
    return unsub;
  }, []);

  const handleSyncToMusic = async () => {
    setSyncing(true);
    setSyncResult(null);
    setSyncProgress(null);
    try {
      const result = await window.electronAPI.syncToAppleMusic();
      setSyncResult(result);
    } catch (e) {
      setSyncResult({ errors: [{ error: e.message }] });
    } finally {
      setSyncing(false);
    }
  };

  const items = library
    ? Object.values(library.items).filter((item) => item.status === 'done')
    : [];

  // Group by playlist
  const playlistMap = {};
  items.forEach((item) => {
    const key = item.playlistTitle || 'Unknown';
    if (!playlistMap[key]) {
      playlistMap[key] = { title: key, items: [], thumbnails: [] };
    }
    playlistMap[key].items.push(item);
    if (playlistMap[key].thumbnails.length < 4 && item.thumbnail) {
      playlistMap[key].thumbnails.push(item.thumbnail);
    }
  });

  const playlists = Object.values(playlistMap).sort((a, b) => a.title.localeCompare(b.title));

  const filteredPlaylists = query
    ? playlists.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.items.some((i) => i.title.toLowerCase().includes(query.toLowerCase()))
      )
    : playlists;

  // If a playlist is selected, show its tracks
  const selectedTracks = selectedPlaylist
    ? (playlistMap[selectedPlaylist]?.items || []).sort((a, b) =>
        a.title.localeCompare(b.title)
      )
    : [];

  const filteredTracks = selectedPlaylist && query
    ? selectedTracks.filter((i) => i.title.toLowerCase().includes(query.toLowerCase()))
    : selectedTracks;

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        {selectedPlaylist && (
          <Button variant="ghost" size="icon" onClick={() => { setSelectedPlaylist(null); setQuery(''); }} title="Back">
            <ArrowLeft size={16} />
          </Button>
        )}
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={selectedPlaylist ? 'Search tracks…' : 'Search playlists…'}
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={load} title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSyncToMusic}
          disabled={syncing || items.length === 0}
          title="Sync playlists to Apple Music"
        >
          {syncing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Music size={14} className="mr-1.5" />}
          {syncing ? 'Syncing…' : 'Sync to Apple Music'}
        </Button>
      </div>

      {/* Sync status */}
      {syncing && syncProgress && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/50 border border-border">
          <Loader2 size={14} className="animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            Syncing playlist {syncProgress.done}/{syncProgress.total}: {syncProgress.playlist}
          </span>
        </div>
      )}

      {syncResult && !syncing && (
        <div className="rounded-lg bg-zinc-800/50 border border-border">
          <div className="flex items-center gap-2 px-3 py-2">
            <CheckCircle2 size={14} className="text-emerald-400 shrink-0" />
            <span className="text-xs text-muted-foreground">
              {syncResult.created?.length > 0 && `Created ${syncResult.created.length} playlist(s). `}
              {syncResult.added > 0 && `Added ${syncResult.added} track(s). `}
              {syncResult.alreadyIn > 0 && `${syncResult.alreadyIn} already synced. `}
              {syncResult.notFound?.length > 0 && `${syncResult.notFound.length} not found in Music. `}
              {syncResult.created?.length === 0 && syncResult.added === 0 && !syncResult.notFound?.length && 'Everything already synced. '}
              {syncResult.errors?.length > 0 && `${syncResult.errors.length} error(s).`}
            </span>
            {(syncResult.notFound?.length > 0 || syncResult.errors?.length > 0) && (
              <button
                onClick={() => setShowSyncDetails(!showSyncDetails)}
                className="text-xs text-blue-400 hover:text-blue-300 ml-1 shrink-0"
              >
                {showSyncDetails ? 'Hide' : 'Details'}
              </button>
            )}
            <button
              onClick={() => { setSyncResult(null); setShowSyncDetails(false); }}
              className="ml-auto text-xs text-muted-foreground hover:text-foreground shrink-0"
            >
              ✕
            </button>
          </div>
          {showSyncDetails && (
            <div className="border-t border-border px-3 py-2 max-h-48 overflow-y-auto space-y-2">
              {syncResult.notFound?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-amber-400 mb-1">Not found in Music ({syncResult.notFound.length})</p>
                  {syncResult.notFound.map((title, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">• {title}</p>
                  ))}
                </div>
              )}
              {syncResult.errors?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-red-400 mb-1">Errors ({syncResult.errors.length})</p>
                  {syncResult.errors.map((err, i) => (
                    <p key={i} className="text-xs text-muted-foreground truncate">
                      • {err.track || err.playlist}: {err.error}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {!selectedPlaylist ? (
        /* ──── Playlist Grid ──── */
        <>
          {!loading && (
            <p className="text-xs text-muted-foreground">
              {filteredPlaylists.length} {filteredPlaylists.length === 1 ? 'playlist' : 'playlists'} · {items.length} tracks
            </p>
          )}
          <div className="flex-1 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {filteredPlaylists.map((playlist) => (
                <PlaylistCard
                  key={playlist.title}
                  playlist={playlist}
                  onClick={() => { setSelectedPlaylist(playlist.title); setQuery(''); }}
                />
              ))}
            </div>

            {!loading && filteredPlaylists.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground pt-16">
                <Music size={40} className="opacity-20" />
                <p className="text-sm">
                  {query ? 'No playlists match your search.' : 'No downloaded playlists yet.'}
                </p>
              </div>
            )}
          </div>
        </>
      ) : (
        /* ──── Track List ──── */
        <>
          {/* Playlist header */}
          <div className="flex items-center gap-4">
            <PlaylistCover thumbnails={playlistMap[selectedPlaylist]?.thumbnails || []} size="lg" />
            <div>
              <h2 className="text-lg font-semibold">{selectedPlaylist}</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {filteredTracks.length} {filteredTracks.length === 1 ? 'track' : 'tracks'}
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1 pr-1">
            {filteredTracks.map((item, i) => (
              <div
                key={item.videoId}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors group"
              >
                <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                {item.thumbnail ? (
                  <img
                    src={item.thumbnail}
                    alt=""
                    className="w-10 h-10 rounded object-cover shrink-0 bg-zinc-800"
                    onError={(e) => { e.target.style.display = 'none'; }}
                  />
                ) : (
                  <div className="w-10 h-10 rounded bg-zinc-800 shrink-0 flex items-center justify-center">
                    <FileAudio size={16} className="text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium truncate block">{item.title}</span>
                  <span className="text-xs text-muted-foreground">{formatDate(item.downloadedAt)}</span>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {item.filePath && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      title="Show in Finder"
                      onClick={() => window.electronAPI.openFolder(item.filePath)}
                    >
                      <FolderOpen size={13} />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-300 hover:bg-red-950/40"
                    title="Delete track"
                    disabled={deletingId === item.videoId}
                    onClick={() => handleDelete(item)}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              </div>
            ))}

            {filteredTracks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground pt-16">
                <FileAudio size={40} className="opacity-20" />
                <p className="text-sm">
                  {query ? 'No tracks match your search.' : 'No tracks in this playlist.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* ──── Playlist Album Cover (2x2 mosaic or single) ──── */
function PlaylistCover({ thumbnails, size = 'md' }) {
  const dim = size === 'lg' ? 'w-20 h-20' : 'w-full aspect-square';
  const rounded = size === 'lg' ? 'rounded-xl' : 'rounded-xl';

  if (thumbnails.length >= 4) {
    return (
      <div className={`${dim} ${rounded} overflow-hidden grid grid-cols-2 grid-rows-2 shrink-0 bg-zinc-800`}>
        {thumbnails.slice(0, 4).map((t, i) => (
          <img key={i} src={t} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
        ))}
      </div>
    );
  }

  if (thumbnails.length > 0) {
    return (
      <div className={`${dim} ${rounded} overflow-hidden shrink-0 bg-zinc-800`}>
        <img src={thumbnails[0]} alt="" className="w-full h-full object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
      </div>
    );
  }

  return (
    <div className={`${dim} ${rounded} bg-zinc-800 shrink-0 flex items-center justify-center`}>
      <Music size={size === 'lg' ? 28 : 24} className="text-muted-foreground opacity-40" />
    </div>
  );
}

/* ──── Playlist Card with hover effect ──── */
function PlaylistCard({ playlist, onClick }) {
  return (
    <button
      onClick={onClick}
      className="group text-left rounded-xl transition-all duration-200 hover:bg-zinc-800/60 p-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500"
    >
      {/* Cover with hover overlay */}
      <div className="relative">
        <PlaylistCover thumbnails={playlist.thumbnails} />
        {/* Hover overlay with play icon */}
        <div className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center">
          <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 group-hover:scale-100 transition-all duration-200 shadow-lg">
            <Play size={22} className="text-black ml-0.5" fill="black" />
          </div>
        </div>
        {/* Track count badge */}
        <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Badge variant="secondary" className="text-[10px] bg-black/70 backdrop-blur-sm border-0">
            {playlist.items.length} tracks
          </Badge>
        </div>
      </div>
      {/* Title */}
      <div className="mt-2.5 px-0.5">
        <p className="text-sm font-medium truncate group-hover:text-foreground transition-colors">{playlist.title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{playlist.items.length} {playlist.items.length === 1 ? 'song' : 'songs'}</p>
      </div>
    </button>
  );
}
