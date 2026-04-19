import React, { useState, useEffect } from 'react';
import { FolderOpen, FileAudio, RefreshCw, Search, Trash2 } from 'lucide-react';
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

  const items = library
    ? Object.values(library.items).filter((item) => item.status === 'done')
    : [];

  const filtered = query
    ? items.filter(
        (item) =>
          item.title.toLowerCase().includes(query.toLowerCase()) ||
          (item.playlistTitle || '').toLowerCase().includes(query.toLowerCase())
      )
    : items;

  // Sort by most recent first
  const sorted = [...filtered].sort((a, b) =>
    (b.downloadedAt || '').localeCompare(a.downloadedAt || '')
  );

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title or playlist…"
            className="pl-9"
          />
        </div>
        <Button variant="ghost" size="icon" onClick={load} title="Refresh">
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </Button>
      </div>

      {/* Count */}
      {!loading && (
        <p className="text-xs text-muted-foreground">
          {sorted.length} {sorted.length === 1 ? 'track' : 'tracks'}{query ? ` matching "${query}"` : ''}
        </p>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {sorted.map((item) => (
          <div
            key={item.videoId}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/60 transition-colors group"
          >
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
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{item.title}</span>
                {!item.fileExists && (
                  <Badge variant="destructive" className="shrink-0 text-[10px] py-0">Missing</Badge>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground truncate">{item.playlistTitle}</span>
                <span className="text-xs text-muted-foreground">·</span>
                <span className="text-xs text-muted-foreground shrink-0">{formatDate(item.downloadedAt)}</span>
              </div>
            </div>
            {/* Actions */}
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

        {/* Empty state */}
        {!loading && sorted.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-muted-foreground pt-16">
            <FileAudio size={40} className="opacity-20" />
            <p className="text-sm">
              {query ? 'No tracks match your search.' : 'No downloaded tracks yet.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
