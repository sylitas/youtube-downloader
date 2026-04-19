import React, { useState, useEffect } from 'react';
import { Library, Settings, RotateCcw, Music, ListMusic, Home, Download, Loader2, AlertCircle, Youtube } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import DashboardView from '@/pages/DashboardView';
import SingleView from '@/pages/SingleView';
import ScanView from '@/pages/ScanView';
import ProgressView from '@/pages/ProgressView';
import LibraryView from '@/pages/LibraryView';
import ErrorsView from '@/pages/ErrorsView';
import YoutubeView from '@/pages/YoutubeView';
import SettingsPanel from '@/components/SettingsPanel';

const TABS = [
  { id: 'dashboard', label: 'Home', Icon: Home },
  { id: 'single', label: 'Single', Icon: Music },
  { id: 'playlist', label: 'Playlist', Icon: ListMusic },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'errors', label: 'Retry', Icon: RotateCcw },
  { id: 'youtube', label: 'YouTube', Icon: Youtube },
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [downloadScreen, setDownloadScreen] = useState('scan');
  const [currentPlaylist, setCurrentPlaylist] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // Deps state
  const [depsStatus, setDepsStatus] = useState(null); // null | 'missing' | 'installing' | 'installed' | 'failed' | 'no-brew'
  const [depsMissing, setDepsMissing] = useState([]);
  const [depsError, setDepsError] = useState(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onDepsStatus(({ type, missing }) => {
      if (type === 'missing') {
        setDepsStatus('missing');
        setDepsMissing(missing || []);
      } else if (type === 'no-brew') {
        setDepsStatus('no-brew');
      }
    });
    return unsubscribe;
  }, []);

  const handleInstallDeps = async () => {
    setDepsStatus('installing');
    setDepsError(null);
    try {
      const results = await window.electronAPI.installDeps();
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) {
        setDepsStatus('failed');
        setDepsError(failed.map((f) => `${f.pkg}: ${f.error}`).join('\n'));
      } else {
        setDepsStatus('installed');
      }
    } catch (e) {
      setDepsStatus('failed');
      setDepsError(e.message);
    }
  };

  const handleQuit = () => {
    window.close();
  };

  const handleRestart = async () => {
    await window.electronAPI.restartApp();
  };

  const handleSyncStart = (playlist) => {
    setCurrentPlaylist(playlist);
    setDownloadScreen('progress');
  };

  const handleBack = () => {
    setDownloadScreen('scan');
    setCurrentPlaylist(null);
  };

  const handleNavigate = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="flex flex-col h-screen bg-background text-foreground select-none overflow-hidden">
      {/* Titlebar / drag region */}
      <div className="drag-region h-10 flex items-center justify-between pl-20 pr-4 shrink-0 border-b border-border">
        <div className="no-drag flex items-center gap-0.5">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors',
                activeTab === id
                  ? 'bg-zinc-800 text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-zinc-800/50'
              )}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
        <div className="no-drag">
          <button
            onClick={() => setShowSettings(true)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-zinc-800 transition-colors"
            title="Settings"
          >
            <Settings size={15} />
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-hidden">
        <div className={activeTab === 'dashboard' ? 'h-full' : 'hidden'}>
          <DashboardView onNavigate={handleNavigate} />
        </div>
        <div className={activeTab === 'single' ? 'h-full' : 'hidden'}>
          <SingleView />
        </div>
        <div className={activeTab === 'playlist' ? 'h-full' : 'hidden'}>
          {downloadScreen === 'scan' && <ScanView onSyncStart={handleSyncStart} />}
          {downloadScreen === 'progress' && currentPlaylist && (
            <ProgressView playlist={currentPlaylist} onBack={handleBack} />
          )}
        </div>
        <div className={activeTab === 'library' ? 'h-full' : 'hidden'}>
          <LibraryView />
        </div>
        <div className={activeTab === 'errors' ? 'h-full' : 'hidden'}>
          <ErrorsView />
        </div>
        <div className={activeTab === 'youtube' ? 'h-full' : 'hidden'}>
          <YoutubeView />
        </div>
      </div>

      {/* Settings modal */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Deps overlay */}
      {depsStatus && depsStatus !== 'done' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm">
          <div className="w-[380px] rounded-2xl border border-border bg-zinc-900 shadow-2xl overflow-hidden">
            {/* Header gradient bar */}
            <div className="h-1.5 bg-gradient-to-r from-red-500 via-pink-500 to-purple-500" />

            <div className="p-8 flex flex-col items-center text-center gap-4">
              {depsStatus === 'missing' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-amber-950/50 flex items-center justify-center">
                    <AlertCircle size={28} className="text-amber-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Missing Dependencies</h2>
                    <p className="text-xs text-muted-foreground mt-1">The following libraries are required to run this app</p>
                  </div>
                  <div className="w-full space-y-1.5">
                    {depsMissing.map((m) => (
                      <div key={m} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800/60 border border-border">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-sm font-mono">{m}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-muted-foreground">Will be installed via Homebrew</p>
                  <div className="flex gap-2 w-full mt-1">
                    <Button variant="ghost" className="flex-1" onClick={handleQuit}>Quit</Button>
                    <Button className="flex-1" onClick={handleInstallDeps}>
                      <Download size={14} className="mr-1.5" /> Install
                    </Button>
                  </div>
                </>
              )}

              {depsStatus === 'installing' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-zinc-800 flex items-center justify-center">
                    <Loader2 size={28} className="text-foreground animate-spin" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Installing</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please wait<AnimatedDots />
                    </p>
                  </div>
                  <div className="w-full h-1 bg-zinc-800 rounded-full overflow-hidden mt-2">
                    <div className="h-full bg-gradient-to-r from-pink-500 to-purple-500 rounded-full animate-progress" />
                  </div>
                </>
              )}

              {depsStatus === 'installed' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-emerald-950/50 flex items-center justify-center">
                    <Download size={28} className="text-emerald-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Installation Complete</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please close and reopen the app to get started.
                    </p>
                  </div>
                  <Button className="w-full mt-1" onClick={handleQuit}>Close App</Button>
                </>
              )}

              {depsStatus === 'failed' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-red-950/50 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-red-400">Installation Failed</h2>
                    {depsError && (
                      <p className="text-[11px] text-red-400/80 font-mono mt-2 bg-red-950/20 px-3 py-2 rounded-lg text-left max-h-20 overflow-auto">{depsError}</p>
                    )}
                  </div>
                  <div className="flex gap-2 w-full mt-1">
                    <Button variant="ghost" className="flex-1" onClick={handleQuit}>Quit</Button>
                    <Button className="flex-1" onClick={handleInstallDeps}>
                      <Download size={14} className="mr-1.5" /> Retry
                    </Button>
                  </div>
                </>
              )}

              {depsStatus === 'no-brew' && (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-red-950/50 flex items-center justify-center">
                    <AlertCircle size={28} className="text-red-400" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold">Homebrew Required</h2>
                    <p className="text-sm text-muted-foreground mt-1">
                      Install Homebrew first, then reopen the app.
                    </p>
                    <p className="text-xs font-mono text-muted-foreground mt-2 bg-zinc-800 px-3 py-1.5 rounded">https://brew.sh</p>
                  </div>
                  <Button variant="ghost" className="w-full mt-1" onClick={handleQuit}>Quit</Button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AnimatedDots() {
  return (
    <span className="inline-flex gap-[2px] ml-[2px]">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="inline-block text-current"
          style={{
            animation: `dot-bounce 1.4s ease-in-out ${i * 0.2}s infinite`,
          }}
        >.</span>
      ))}
    </span>
  );
}
