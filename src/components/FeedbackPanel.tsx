import type { FormEvent } from "react";
import { useMemo, useState } from "react";
import { formatRelativeTime } from "../lib/format";
import { getDisplayName } from "../lib/guest";
import { useAuction } from "../context/AuctionProvider";

type Props = {
  lotId: string;
};

export function FeedbackPanel({ lotId }: Props) {
  const { addFeedback, state } = useAuction();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const items = useMemo(
    () => state.feedback.filter((f) => f.lotId === lotId).sort((a, b) => b.createdAt - a.createdAt),
    [lotId, state.feedback],
  );

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const res = addFeedback(lotId, body, getDisplayName());
    if (!res.ok) {
      setError(res.error ?? "Not saved.");
      return;
    }
    setBody("");
  };

  return (
    <section className="panel" aria-labelledby={`fb-${lotId}`}>
      <h2 className="panel__title" id={`fb-${lotId}`}>
        Note
      </h2>
      <form onSubmit={onSubmit} className="bid-form">
        <label className="sr-only" htmlFor={`fb-body-${lotId}`}>
          Note
        </label>
        <textarea
          id={`fb-body-${lotId}`}
          className="textarea textarea--compact"
          maxLength={600}
          value={body}
          onChange={(ev) => setBody(ev.target.value)}
          placeholder="A few words…"
          rows={3}
        />
        <button type="submit" className="btn btn--primary btn--block">
          Send
        </button>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
      {items.length > 0 && (
        <ul className="feedback-list" aria-label="Notes">
          {items.map((f) => (
            <li key={f.id} className="feedback-item">
              <div className="feedback-item__head">
                <span className="feedback-item__name">{f.displayName}</span>
                <time dateTime={new Date(f.createdAt).toISOString()}>{formatRelativeTime(f.createdAt)}</time>
              </div>
              <p className="feedback-item__body">{f.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
