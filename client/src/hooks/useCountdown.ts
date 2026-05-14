import { useEffect, useState } from "react";

export function useCountdown(endMs: number) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = globalThis.setInterval(() => setNow(Date.now()), 1000);
    return () => globalThis.clearInterval(id);
  }, [endMs]);

  const leftMs = Math.max(0, endMs - now);
  return { leftMs, ended: leftMs === 0 };
}

export function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const parts: string[] = [];
  if (d) parts.push(`${d}d`);
  if (h || d) parts.push(`${h}h`);
  parts.push(`${m}m`);
  parts.push(`${sec}s`);
  return parts.join(" ");
}

/** “Closes in …” — includes seconds for a live ticking feel. */
export function formatClosingIn(ms: number): string {
  const s = Math.floor(ms / 1000);
  const sec = s % 60;
  const m = Math.floor((s % 3600) / 60);
  const h = Math.floor((s % 86400) / 3600);
  const d = Math.floor(s / 86400);
  if (s < 60) return `${s}s`;
  if (d > 0) return `${d}d ${h}h ${m}m ${sec}s`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}
