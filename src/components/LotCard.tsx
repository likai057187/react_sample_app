import { Link } from "react-router-dom";
import { isReserveMet } from "../lib/bidding";
import { formatUsdFromCents } from "../lib/format";
import type { Artwork } from "../types";
import { useAuction } from "../context/AuctionProvider";
import { Countdown } from "./Countdown";

type Props = {
  artwork: Artwork;
};

export function LotCard({ artwork }: Props) {
  const { getLot, isLotClosed } = useAuction();
  const lot = getLot(artwork.id);
  const closed = isLotClosed(artwork.id);
  const reserveOk = lot ? isReserveMet(artwork, lot) : false;
  const hasBids = lot ? lot.bids.length > 0 : false;
  const displayBid = hasBids && lot ? lot.currentBidCents : artwork.openingBidCents;
  const bidLabel = hasBids ? "Bid" : "From";

  return (
    <Link to={`/lot/${artwork.id}`} className="lot-card">
      <div className="lot-card__media">
        <img src={artwork.imageUrl} alt={artwork.title} loading="lazy" decoding="async" />
        <div className="lot-card__badge" aria-hidden>
          {reserveOk && <span className="pill pill--gold">Reserve</span>}
          {closed && <span className="pill">Closed</span>}
        </div>
      </div>
      <div className="lot-card__body">
        <h2 className="lot-card__title">{artwork.title}</h2>
        <p className="lot-card__desc">{artwork.description}</p>
        <div className="lot-card__row">
          <div>
            <div className="lot-card__bid-label">{bidLabel}</div>
            <div className="lot-card__bid-value">{formatUsdFromCents(displayBid)}</div>
          </div>
          {lot && <Countdown endMs={lot.endsAt} />}
        </div>
      </div>
    </Link>
  );
}
