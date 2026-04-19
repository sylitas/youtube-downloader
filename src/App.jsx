import React, { useState, useEffect } from 'react';
import { Library, Settings, AlertTriangle, Music, ListMusic, Home, Download, Loader2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import DashboardView from '@/pages/DashboardView';
import SingleView from '@/pages/SingleView';
import ScanView from '@/pages/ScanView';
import ProgressView from '@/pages/ProgressView';
import LibraryView from '@/pages/LibraryView';
import ErrorsView from '@/pages/ErrorsView';
import SettingsPanel from '@/components/SettingsPanel';

const TABS = [
  { id: 'dashboard', label: 'Home', Icon: Home },
  { id: 'single', label: 'Single', Icon: Music },
  { id: 'playlist', label: 'Playlist', Icon: ListMusic },
  { id: 'library', label: 'Library', Icon: Library },
  { id: 'errors', label: 'Errors', Icon: AlertTriangle },
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
      </div>

      {/* Settings modal */}
      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}

      {/* Deps overlay */}
      {depsStatus && depsStatus !== 'installed' && (
        <DepsOverlay
          status={depsStatus}
          missing={depsMissing}
          error={depsError}
          onInstall={handleInstallDeps}
          onQuit={handleQuit}
        />
      )}

      {/* Deps installed — restart required */}
      {depsStatus === 'installed' && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-emerald-950 flex items-center justify-center">
              <Download size={24} className="text-emerald-400" />
            </div>
            <h2 className="text-lg font-semibold">Installation Complete!</h2>
            <p className="text-sm text-muted-foreground max-w-xs">
              All dependencies are installed. Restart the app to start using it.
            </p>
            <Button onClick={handleRestart} className="mt-2">
              Restart App
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function DepsOverlay({ status, missing, error, onInstall, onQuit }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80">
      <div className="flex flex-col items-center gap-5 text-center max-w-sm">
        {status === 'missing' && (
          <>
            <div className="w-14 h-14 rounded-full bg-amber-950 flex items-center justify-center">
              <AlertCircle size={24} className="text-amber-400" />
            </div>
            <h2 className="text-lg font-semibold">Missing Dependencies</h2>
            <p className="text-sm text-muted-foreground">
              The following libraries are required:
            </p>
            <div className="flex flex-col gap-1">
              {missing.map((m) => (
                <span key={m} className="text-sm font-mono bg-zinc-800 px-3 py-1 rounded">{m}</span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              They will be installed via Homebrew.
            </p>
            <div className="flex gap-3 mt-2">
              <Button variant="ghost" onClick={onQuit}>Quit</Button>
              <Button onClick={onInstall}>
                <Download size={14} className="mr-1.5" /> Install Now
              </Button>
            </div>
          </>
        )}

        {status === 'installing' && (
          <>
            <Loader2 size={40} className="text-muted-foreground animate-spin" />
            <h2 className="text-lg font-semibold">Installing dependencies</h2>
            <p className="text-sm text-muted-foreground">
              Please wait<AnimatedDots />
            </p>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-950 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold text-red-400">Installation Failed</h2>
            {error && <p className="text-xs text-red-400 font-mono bg-red-950/30 px-3 py-2 rounded max-w-xs">{error}</p>}
            <div className="flex gap-3 mt-2">
              <Button variant="ghost" onClick={onQuit}>Quit</Button>
              <Button onClick={onInstall}>Retry</Button>
            </div>
          </>
        )}

        {status === 'no-brew' && (
          <>
            <div className="w-14 h-14 rounded-full bg-red-950 flex items-center justify-center">
              <AlertCircle size={24} className="text-red-400" />
            </div>
            <h2 className="text-lg font-semibold">Homebrew Required</h2>
            <p className="text-sm text-muted-foreground">
              This app needs Homebrew to install dependencies.
              <br />Visit <span className="text-foreground font-mono text-xs">https://brew.sh</span> to install it, then restart the app.
            </p>
            <Button variant="ghost" onClick={onQuit} className="mt-2">Quit</Button>
          </>
        )}
      </div>
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
