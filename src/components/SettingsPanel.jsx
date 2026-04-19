import React, { useState, useEffect } from 'react';
import { X, FolderOpen, Cookie, AlertTriangle, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SettingsPanel({ onClose }) {
  const [settings, setSettings] = useState({ outputDir: '', cookiesFile: '', audioQuality: '320K' });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUpdateLibs, setShowUpdateLibs] = useState(false);

  useEffect(() => {
    window.electronAPI.getSettings().then(setSettings);
  }, []);

  const handleSave = async () => {
    await window.electronAPI.saveSettings(settings);
    onClose();
  };

  const browseCookies = async () => {
    const p = await window.electronAPI.browseCookies();
    if (p) setSettings((s) => ({ ...s, cookiesFile: p }));
  };

  const browseOutput = async () => {
    const p = await window.electronAPI.browseOutput();
    if (p) setSettings((s) => ({ ...s, outputDir: p }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-[480px] rounded-xl border border-border bg-zinc-900 shadow-xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold">Settings</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X size={18} />
          </button>
        </div>

        <div className="space-y-5">
          {/* Output directory */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Output Directory</label>
            <div className="flex gap-2">
              <Input
                value={settings.outputDir}
                onChange={(e) => setSettings((s) => ({ ...s, outputDir: e.target.value }))}
                placeholder="~/Music/YT"
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={browseOutput} title="Browse">
                <FolderOpen size={16} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">Where MP3 files will be saved.</p>
          </div>

          {/* Cookies file */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Cookies File (optional)</label>
            <div className="flex gap-2">
              <Input
                value={settings.cookiesFile}
                onChange={(e) => setSettings((s) => ({ ...s, cookiesFile: e.target.value }))}
                placeholder="Path to cookies.txt (for private playlists)"
                className="flex-1"
              />
              <Button variant="outline" size="icon" onClick={browseCookies} title="Browse">
                <Cookie size={16} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Netscape-format cookies for private playlist auth. Export with browser extension.
            </p>
          </div>

          {/* Audio quality */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Audio Quality</label>
            <div className="flex gap-2">
              {['128K', '192K', '256K', '320K'].map((q) => (
                <button
                  key={q}
                  onClick={() => setSettings((s) => ({ ...s, audioQuality: q }))}
                  className={`px-3 py-1.5 rounded-md text-sm transition-colors border ${
                    settings.audioQuality === q
                      ? 'bg-zinc-700 border-zinc-500 text-foreground'
                      : 'border-border text-muted-foreground hover:text-foreground hover:bg-zinc-800'
                  }`}
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Higher = better quality, larger file. 192K is good default, 320K for best quality.
            </p>
          </div>

          {/* Update Libraries */}
          <div>
            <label className="block text-sm font-medium mb-1.5">Dependencies</label>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowUpdateLibs(true)}
            >
              <Package size={14} className="mr-1.5" />
              Update Libraries (yt-dlp & AtomicParsley)
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Check for updates and install the latest versions.
            </p>
          </div>

          {/* Danger zone */}
          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium mb-1.5 text-red-400">Danger Zone</label>
            <Button
              variant="outline"
              className="w-full border-red-800 text-red-400 hover:bg-red-950/40 hover:text-red-300"
              onClick={() => setShowResetConfirm(true)}
            >
              <AlertTriangle size={14} className="mr-1.5" />
              Reset & Clear All Data
            </Button>
            <p className="text-xs text-muted-foreground mt-1">
              Deletes all downloaded MP3 files, library data, and scan history. This cannot be undone.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save</Button>
        </div>
      </div>

      {/* Reset confirm dialog */}
      {showResetConfirm && (
        <ResetDialog
          outputDir={settings.outputDir || '~/Music/YT'}
          onConfirm={async (options) => {
            await window.electronAPI.resetAllData(options);
            setShowResetConfirm(false);
            onClose();
            window.location.reload();
          }}
          onClose={() => setShowResetConfirm(false)}
        />
      )}

      {showUpdateLibs && (
        <UpdateLibsDialog onClose={() => setShowUpdateLibs(false)} />
      )}
    </div>
  );
}

function ResetDialog({ outputDir, onConfirm, onClose }) {
  const [options, setOptions] = useState({
    downloadedFiles: true,
    library: true,
    scanHistory: true,
    cookies: true,
    settings: true,
  });

  const toggle = (key) => setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  const anySelected = Object.values(options).some(Boolean);

  const items = [
    { key: 'downloadedFiles', label: 'Downloaded MP3 files', desc: `All files in ${outputDir}` },
    { key: 'library', label: 'Library database', desc: 'Track metadata, download status, thumbnails' },
    { key: 'scanHistory', label: 'Scan history', desc: 'Playlist scan records' },
    { key: 'cookies', label: 'Cookie file setting', desc: 'Saved cookies.txt path' },
    { key: 'settings', label: 'All settings', desc: 'Output directory, audio quality, etc.' },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70">
      <div className="w-[440px] rounded-xl border border-red-800 bg-zinc-900 shadow-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-950 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-red-400" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-red-400">Factory Reset</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Select what to clear. This cannot be undone.</p>
          </div>
        </div>

        <div className="space-y-1 mb-5">
          {items.map(({ key, label, desc }) => (
            <label
              key={key}
              className="flex items-start gap-3 px-3 py-2.5 rounded-lg hover:bg-zinc-800/50 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={options[key]}
                onChange={() => toggle(key)}
                className="mt-0.5 w-4 h-4 rounded border-border bg-zinc-800 accent-red-500"
              />
              <div>
                <span className="text-sm font-medium">{label}</span>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </label>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button
            onClick={() => {
              const allOn = Object.values(options).every(Boolean);
              const newVal = !allOn;
              setOptions({ downloadedFiles: newVal, library: newVal, scanHistory: newVal, cookies: newVal, settings: newVal });
            }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {Object.values(options).every(Boolean) ? 'Deselect all' : 'Select all'}
          </button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button
              className="bg-red-600 hover:bg-red-700 text-white"
              disabled={!anySelected}
              onClick={() => onConfirm(options)}
            >
              Reset Selected
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function UpdateLibsDialog({ onClose }) {
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [versions, setVersions] = useState(null);
  const [result, setResult] = useState(null);
  const fetchedRef = React.useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    window.electronAPI.checkLibUpdates().then((v) => {
      setVersions(v);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const handleUpdate = async () => {
    setUpdating(true);
    try {
      const r = await window.electronAPI.updateLibs();
      setResult(r);
      const v = await window.electronAPI.checkLibUpdates();
      setVersions(v);
    } catch (e) {
      setResult({ error: e.message });
    } finally {
      setUpdating(false);
    }
  };

  const normalizeVersion = (v) => {
    if (!v) return '';
    return v.split('.').map((p) => p.replace(/^0+/, '') || '0').join('.');
  };

  const libs = versions ? [
    { name: 'yt-dlp', current: versions.ytDlp?.current || 'Not installed', latest: versions.ytDlp?.latest || 'Unknown' },
    { name: 'AtomicParsley', current: versions.atomicParsley?.current || 'Not installed', latest: versions.atomicParsley?.latest || 'Unknown' },
  ] : [];

  const hasUpdates = versions && libs.some((l) => {
    if (l.latest === 'Unknown' || l.current === 'Not installed') return false;
    return normalizeVersion(l.current) !== normalizeVersion(l.latest);
  });

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70" onClick={(e) => e.stopPropagation()}>
      <div className="w-[440px] rounded-xl border border-border bg-zinc-900 shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Package size={18} /> Update Libraries
          </h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X size={16} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw size={20} className="animate-spin text-muted-foreground" />
            <span className="ml-2 text-sm text-muted-foreground">Checking versions...</span>
          </div>
        ) : (
          <>
            <div className="space-y-3 mb-5">
              {libs.map((lib) => {
                const isUpToDate = lib.latest === 'Unknown' || normalizeVersion(lib.current) === normalizeVersion(lib.latest);
                return (
                  <div key={lib.name} className="flex items-center justify-between px-3 py-3 rounded-lg bg-zinc-800/50 border border-border">
                    <div>
                      <span className="text-sm font-medium">{lib.name}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">Current: <span className="text-foreground font-mono">{lib.current}</span></span>
                      </div>
                    </div>
                    <div className="text-right">
                      {isUpToDate ? (
                        <span className="text-xs text-emerald-400">✓ Up to date</span>
                      ) : (
                        <span className="text-xs text-amber-400">→ {lib.latest}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {result && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-zinc-800/50 border border-border">
                <p className="text-xs text-emerald-400">Update complete. Restart the app if needed.</p>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={onClose}>Close</Button>
              {hasUpdates && !result && (
                <Button onClick={handleUpdate} disabled={updating}>
                  {updating ? <RefreshCw size={14} className="mr-1.5 animate-spin" /> : <Package size={14} className="mr-1.5" />}
                  {updating ? 'Updating...' : 'Update All'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
