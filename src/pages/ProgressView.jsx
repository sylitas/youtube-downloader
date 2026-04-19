import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, RotateCcw, CheckCircle2, XCircle, Loader2, Clock, PauseCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

function StatusBadge({ status }) {
  switch (status) {
    case 'done':
      return <Badge variant="success"><CheckCircle2 size={10} className="mr-1" />Done</Badge>;
    case 'error':
      return <Badge variant="destructive"><XCircle size={10} className="mr-1" />Error</Badge>;
    case 'downloading':
      return <Badge variant="secondary"><Loader2 size={10} className="mr-1 animate-spin" />Downloading</Badge>;
    case 'skipped':
      return <Badge variant="muted">Skipped</Badge>;
    case 'rate-limited':
      return <Badge variant="destructive"><PauseCircle size={10} className="mr-1" />Rate Limited</Badge>;
    case 'queued':
    default:
      return <Badge variant="muted"><Clock size={10} className="mr-1" />Queued</Badge>;
  }
}

const CONCURRENCY_DEFAULT = 10;

export default function ProgressView({ playlist, onBack }) {
  const pendingVideos = playlist.videos.filter((v) => v.status === 'pending');

  const [concurrency, setConcurrency] = useState(null);
  const [videoStates, setVideoStates] = useState(() => {
    const map = {};
    pendingVideos.forEach((v) => {
      map[v.videoId] = { status: 'queued', progress: 0, error: null };
    });
    return map;
  });
  const [done, setDone] = useState(false);
  const [rateLimited, setRateLimited] = useState(false);
  const startedRef = useRef(false);
  const rateLimitedRef = useRef(false);

  // Load concurrency from settings
  useEffect(() => {
    window.electronAPI.getSettings().then((s) => {
      setConcurrency(s.concurrency || CONCURRENCY_DEFAULT);
    });
  }, []);

  // Start download once concurrency is loaded — only once
  useEffect(() => {
    if (concurrency === null) return;
    if (startedRef.current) return;
    startedRef.current = true;

    if (pendingVideos.length > 0) {
      runQueue(pendingVideos);
    } else {
      setDone(true);
    }
  }, [concurrency]); // eslint-disable-line react-hooks/exhaustive-deps

  // Progress listener
  useEffect(() => {
    const unsubscribe = window.electronAPI.onProgress(({ videoId, progress }) => {
      setVideoStates((prev) => ({
        ...prev,
        [videoId]: { ...prev[videoId], progress, status: 'downloading' },
      }));
    });
    return unsubscribe;
  }, []);

  // Download one video — always resolves, never rejects
  const downloadOneVideo = async (video) => {
    setVideoStates((prev) => ({
      ...prev,
      [video.videoId]: { status: 'downloading', progress: 0, error: null },
    }));
    try {
      await window.electronAPI.downloadVideo({
        video,
        playlistId: playlist.playlistId,
        playlistTitle: playlist.playlistTitle,
        source: 'playlist',
      });
      setVideoStates((prev) => ({
        ...prev,
        [video.videoId]: { status: 'done', progress: 100, error: null },
      }));
    } catch (e) {
      setVideoStates((prev) => ({
        ...prev,
        [video.videoId]: { status: 'error', progress: 0, error: e?.message || String(e) },
      }));
      // Detect rate limit
      if (/rate.?limit/i.test(e?.message || '')) {
        rateLimitedRef.current = true;
        setRateLimited(true);
      }
    }
  };

  // Queue runner — runs N workers, each grabs from shared index
  const runQueue = async (videos) => {
    let idx = 0;
    const total = videos.length;

    const worker = async (workerId) => {
      while (true) {
        if (rateLimitedRef.current) {
          console.log(`[worker ${workerId}] rate limited, stopping`);
          break;
        }
        const myIdx = idx++;
        if (myIdx >= total) {
          console.log(`[worker ${workerId}] no more items, exiting`);
          break;
        }
        const video = videos[myIdx];
        console.log(`[worker ${workerId}] downloading #${myIdx + 1}: ${video.title}`);
        await downloadOneVideo(video);
        console.log(`[worker ${workerId}] finished #${myIdx + 1}`);
      }
    };

    const promises = [];
    for (let i = 0; i < Math.min(concurrency || CONCURRENCY_DEFAULT, total); i++) {
      promises.push(worker(i));
    }
    await Promise.allSettled(promises);
    console.log('[queue] all workers finished');

    // If rate limited, mark remaining queued items
    if (rateLimitedRef.current) {
      setVideoStates((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((id) => {
          if (next[id].status === 'queued') {
            next[id] = { status: 'rate-limited', progress: 0, error: 'Skipped — YouTube rate limit detected' };
          }
        });
        return next;
      });
    }

    setDone(true);
  };

  const retryVideo = (video) => downloadOneVideo(video);

  // eslint-disable-next-line
  const retryAllErrors = () => {
    const errorVideos = pendingVideos.filter((v) => {
      const s = videoStates[v.videoId]?.status;
      return s === 'error' || s === 'rate-limited';
    });
    if (!errorVideos.length) return;
    rateLimitedRef.current = false;
    setRateLimited(false);
    setVideoStates((prev) => {
      const next = { ...prev };
      errorVideos.forEach((v) => { next[v.videoId] = { status: 'queued', progress: 0, error: null }; });
      return next;
    });
    setDone(false);
    runQueue(errorVideos);
  };

  const doneCount = Object.values(videoStates).filter((s) => s.status === 'done' || s.status === 'skipped').length;
  const errorCount = Object.values(videoStates).filter((s) => s.status === 'error' || s.status === 'rate-limited').length;
  const totalCount = pendingVideos.length;
  const overallPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      <div>
        <h2 className="text-lg font-semibold truncate">{playlist.playlistTitle}</h2>
        {totalCount > 0 ? (
          <>
            <div className="flex items-center gap-3 mt-2">
              <Progress value={overallPct} className="flex-1 h-2" />
              <span className="text-sm text-muted-foreground shrink-0">
                {doneCount}/{totalCount}
              </span>
            </div>
            {done && (
              <p className={`text-sm mt-1 ${rateLimited ? 'text-amber-400' : 'text-emerald-400'}`}>
                {rateLimited
                  ? `⚠️ Paused — YouTube rate limit detected. ${errorCount} track(s) skipped.`
                  : errorCount > 0 ? `Completed with ${errorCount} error(s).` : 'All downloads complete!'}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm mt-2 text-muted-foreground">No pending downloads — all tracks are already downloaded.</p>
        )}
      </div>

      <div className="flex-1 overflow-y-auto space-y-1 pr-1">
        {pendingVideos.map((video, i) => {
          const state = videoStates[video.videoId] || { status: 'queued', progress: 0 };
          return (
            <div key={video.videoId} className="rounded-lg border border-border px-3 py-2.5 bg-zinc-900/50">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6 text-right shrink-0">{i + 1}</span>
                <img
                  src={video.thumbnail}
                  alt=""
                  className="w-10 h-10 rounded object-cover shrink-0 bg-zinc-800"
                  onError={(e) => { e.target.style.display = 'none'; }}
                />
                <span className="flex-1 text-sm truncate">{video.title}</span>
                <StatusBadge status={state.status} />
                {state.status === 'error' && (
                  <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => retryVideo(video)}>
                    <RotateCcw size={12} className="mr-1" /> Retry
                  </Button>
                )}
              </div>
              {state.status === 'downloading' && (
                <div className="mt-1.5 ml-9">
                  <Progress value={state.progress} className="h-1" />
                  <span className="text-xs text-muted-foreground">{state.progress.toFixed(1)}%</span>
                </div>
              )}
              {state.status === 'error' && state.error && (
                <p className="mt-1 ml-9 text-xs text-red-400 truncate">{state.error}</p>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-border">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft size={14} className="mr-1" /> Back
        </Button>
        {errorCount > 0 && !done && (
          <span className="text-xs text-muted-foreground">
            {errorCount} error(s) so far
          </span>
        )}
        {errorCount > 0 && done && (
          <Button variant="secondary" size="sm" onClick={retryAllErrors}>
            <RotateCcw size={14} className="mr-1" /> Retry All Errors ({errorCount})
          </Button>
        )}
      </div>
    </div>
  );
}
