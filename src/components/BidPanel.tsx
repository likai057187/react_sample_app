import type { FormEvent } from "react";
import { useState } from "react";
import type { Artwork, LotRuntime } from "../types";
import { useAuction } from "../context/AuctionProvider";
import { formatUsdFromCents } from "../lib/format";
import { Countdown } from "./Countdown";
import { isReserveMet, nextMinimumBidCents } from "../lib/bidding";

type Props = {
  artwork: Artwork;
};

export function BidPanel({ artwork }: Props) {
  const { getLot, placeBid, nextMinBid, isLeading, isLotClosed } = useAuction();
  const lot = getLot(artwork.id);
  const min = nextMinBid(artwork.id);
  const closed = isLotClosed(artwork.id);
  const leading = isLeading(artwork.id);
  const reserveOk = lot ? isReserveMet(artwork, lot) : false;
  const hasBids = lot ? lot.bids.length > 0 : false;

  const defaultUsd = min ? Math.ceil(min / 100) : Math.ceil(artwork.openingBidCents / 100);
  const [raw, setRaw] = useState(String(defaultUsd));
  const [error, setError] = useState<string | null>(null);

  if (!lot || min === null) return null;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const dollars = Number.parseFloat(raw.replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(dollars) || dollars <= 0) {
      setError("Invalid amount.");
      return;
    }
    const cents = Math.round(dollars * 100);
    const res = placeBid(artwork.id, cents);
    if (!res.ok) {
      setError(res.error ?? "Bid not accepted.");
      return;
    }
    const nextLot: LotRuntime = {
      ...lot,
      currentBidCents: cents,
      bids: [
        {
          id: "temp",
          guestId: "temp",
          amountCents: cents,
          placedAt: Date.now(),
        },
        ...lot.bids,
      ],
    };
    const floor = nextMinimumBidCents(artwork, nextLot);
    setRaw(String(Math.ceil(floor / 100)));
  };

  return (
    <section className="panel" aria-labelledby={`bid-heading-${artwork.id}`}>
      <h2 className="panel__title" id={`bid-heading-${artwork.id}`}>
        Bid
      </h2>
      <div className="bid-status">
        <div className="bid-status__current">
          <span className="bid-status__label">{hasBids ? "High" : "Opens"}</span>
          <span className="bid-status__amount">
            {hasBids ? formatUsdFromCents(lot.currentBidCents) : formatUsdFromCents(artwork.openingBidCents)}
          </span>
        </div>
        <div className="bid-tags">
          {reserveOk ? (
            <span className="tag tag--ok">Reserve</span>
          ) : (
            <span className="tag">Res. {formatUsdFromCents(artwork.reserveCents)}</span>
          )}
          {leading && !closed && <span className="tag tag--lead">Leading</span>}
          {closed && <span className="tag tag--closed">Closed</span>}
        </div>
      </div>
      <p className="panel__fine">
        Next {formatUsdFromCents(min)} · <Countdown endMs={lot.endsAt} />
      </p>
      <form className="bid-form" onSubmit={onSubmit}>
        <div className="bid-form__row">
          <div className="field">
            <label className="field__label" htmlFor={`bid-${artwork.id}`}>
              USD
            </label>
            <input
              id={`bid-${artwork.id}`}
              className="field__input"
              inputMode="decimal"
              autoComplete="off"
              disabled={closed}
              value={raw}
              onChange={(ev) => setRaw(ev.target.value)}
            />
          </div>
          <button type="submit" className="btn btn--primary" disabled={closed}>
            Bid
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
