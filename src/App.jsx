import React, { useState } from 'react';
import { Library, Settings, AlertTriangle, Music, ListMusic, Home } from 'lucide-react';
import { cn } from '@/lib/utils';
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
    </div>
  );
}
