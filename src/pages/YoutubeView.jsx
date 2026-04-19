import React, { useRef, useState, useEffect } from 'react';
import { ArrowLeft, ArrowRight, RotateCcw, Home, ExternalLink } from 'lucide-react';

export default function YoutubeView() {
  const webviewRef = useRef(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(false);
  const [currentUrl, setCurrentUrl] = useState('https://www.youtube.com');

  const handleDomReady = () => {
    const wv = webviewRef.current;
    if (!wv) return;
    setCanGoBack(wv.canGoBack());
    setCanGoForward(wv.canGoForward());
  };

  const handleNavigate = (e) => {
    setCurrentUrl(e.url);
    const wv = webviewRef.current;
    if (!wv) return;
    setTimeout(() => {
      setCanGoBack(wv.canGoBack());
      setCanGoForward(wv.canGoForward());
    }, 100);
  };

  // Attach webview events via DOM (React doesn't support webview events natively)
  useEffect(() => {
    const wv = webviewRef.current;
    if (!wv) return;
    wv.addEventListener('dom-ready', handleDomReady);
    wv.addEventListener('did-navigate', handleNavigate);
    wv.addEventListener('did-navigate-in-page', handleNavigate);
    return () => {
      wv.removeEventListener('dom-ready', handleDomReady);
      wv.removeEventListener('did-navigate', handleNavigate);
      wv.removeEventListener('did-navigate-in-page', handleNavigate);
    };
  }, []);

  const goBack = () => webviewRef.current?.goBack();
  const goForward = () => webviewRef.current?.goForward();
  const reload = () => webviewRef.current?.reload();
  const goHome = () => webviewRef.current?.loadURL('https://www.youtube.com');
  const openExternal = () => window.electronAPI.openExternal(currentUrl);

  return (
    <div className="flex flex-col h-full">
      {/* Browser toolbar */}
      <div className="flex items-center gap-1 px-3 py-1.5 border-b border-border bg-zinc-900/50 shrink-0">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className="p-1.5 rounded-md hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-default transition-colors"
          title="Forward"
        >
          <ArrowRight size={14} />
        </button>
        <button
          onClick={reload}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
          title="Reload"
        >
          <RotateCcw size={14} />
        </button>
        <button
          onClick={goHome}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
          title="YouTube Home"
        >
          <Home size={14} />
        </button>
        <input
          type="text"
          value={currentUrl}
          onChange={(e) => setCurrentUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              let url = currentUrl.trim();
              if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
              webviewRef.current?.loadURL(url);
            }
          }}
          className="flex-1 mx-2 px-3 py-1 rounded-md bg-zinc-800/60 border border-border text-xs text-foreground truncate outline-none focus:ring-1 focus:ring-zinc-600"
        />
        <button
          onClick={openExternal}
          className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors text-muted-foreground"
          title="Open in browser"
        >
          <ExternalLink size={14} />
        </button>
      </div>

      {/* Webview */}
      <webview
        ref={webviewRef}
        src="https://www.youtube.com"
        className="flex-1"
        style={{ width: '100%', height: '100%' }}
        allowpopups="true"
      />
    </div>
  );
}
