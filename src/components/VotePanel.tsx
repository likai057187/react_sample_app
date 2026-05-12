import { useAuction } from "../context/AuctionProvider";

type Props = {
  lotId: string;
};

export function VotePanel({ lotId }: Props) {
  const { getAverageVote, getMyVote, setVote, state } = useAuction();
  const avg = getAverageVote(lotId);
  const mine = getMyVote(lotId);
  const map = state.votes[lotId];
  const count = map ? Object.keys(map).length : 0;

  return (
    <section className="panel" aria-labelledby={`vote-${lotId}`}>
      <h2 className="panel__title" id={`vote-${lotId}`}>
        Rate
      </h2>
      <div className="stars" role="group" aria-label="1 to 5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            className={`star-btn${mine === n ? " star-btn--active" : ""}`}
            aria-pressed={mine === n}
            onClick={() => setVote(lotId, n)}
            aria-label={`${n} of 5`}
          >
            <span aria-hidden>{n}</span>
          </button>
        ))}
      </div>
      <p className="vote-summary vote-summary--tight">
        {avg != null ? (
          <>
            {avg.toFixed(1)} · {count}
          </>
        ) : (
          <>—</>
        )}
      </p>
    </section>
  );
}
