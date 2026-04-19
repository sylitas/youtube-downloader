import React from 'react';
import { Music, ListMusic, Disc3 } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardView({ onNavigate }) {
  return (
    <div className="flex flex-col h-full items-center justify-center gap-8">
      {/* Logo / branding */}
      <div className="flex flex-col items-center gap-3">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center shadow-lg">
          <Disc3 size={32} className="text-white" />
        </div>
        <h1 className="text-2xl font-bold">YT Playlist Sync</h1>
        <p className="text-sm text-muted-foreground">Download YouTube music to your local library</p>
      </div>

      {/* Action buttons */}
      <div className="flex gap-4">
        <button
          onClick={() => onNavigate('single')}
          className="group flex flex-col items-center gap-3 w-44 p-6 rounded-xl border border-border bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-600 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <Music size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold">Single Track</p>
            <p className="text-xs text-muted-foreground mt-0.5">Download one song</p>
          </div>
        </button>

        <button
          onClick={() => onNavigate('playlist')}
          className="group flex flex-col items-center gap-3 w-44 p-6 rounded-xl border border-border bg-zinc-900/50 hover:bg-zinc-800/80 hover:border-zinc-600 transition-all"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 flex items-center justify-center transition-colors">
            <ListMusic size={22} className="text-muted-foreground group-hover:text-foreground transition-colors" />
          </div>
          <div>
            <p className="text-sm font-semibold">Playlist</p>
            <p className="text-xs text-muted-foreground mt-0.5">Sync entire playlist</p>
          </div>
        </button>
      </div>
    </div>
  );
}
