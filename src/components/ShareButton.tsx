import { useState } from "react";

type Props = {
  title: string;
  text?: string;
};

export function ShareButton({ title, text }: Props) {
  const [hint, setHint] = useState<string | null>(null);

  const url = typeof window !== "undefined" ? window.location.href : "";

  const onShare = async () => {
    setHint(null);
    const payload = { title, text: text ?? title, url };
    try {
      if (navigator.share) {
        await navigator.share(payload);
        return;
      }
    } catch {
      /* user cancelled or share failed */
    }
    try {
      await navigator.clipboard.writeText(url);
      setHint("Copied.");
    } catch {
      setHint("Copy blocked.");
    }
  };

  return (
    <div>
      <button type="button" className="btn btn--ghost" onClick={onShare}>
        Share
      </button>
      {hint && (
        <p className="prose-muted" style={{ margin: "8px 0 0", fontSize: "0.85rem" }}>
          {hint}
        </p>
      )}
    </div>
  );
}
