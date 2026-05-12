import { Link, useParams } from "react-router-dom";
import { formatUsdFromCents } from "../lib/format";
import { useAuction } from "../context/AuctionProvider";
import { BidPanel } from "../components/BidPanel";
import { FeedbackPanel } from "../components/FeedbackPanel";
import { ShareButton } from "../components/ShareButton";
import { VotePanel } from "../components/VotePanel";

export function LotPage() {
  const { id } = useParams();
  const { getArtwork } = useAuction();
  const artwork = id ? getArtwork(id) : undefined;

  if (!artwork) {
    return (
      <div className="not-found">
        <h1>Not found</h1>
        <p>
          <Link to="/#catalog" className="nav-pill">
            Lots
          </Link>
        </p>
      </div>
    );
  }

  return (
    <article>
      <p className="lot-back">
        <Link to="/#catalog" className="nav-pill nav-pill--compact">
          ← Lots
        </Link>
      </p>
      <div className="detail-layout">
        <figure className="detail-figure">
          <img src={artwork.imageUrl} alt={artwork.title} loading="eager" decoding="async" />
        </figure>
        <div className="detail-panel">
          <div className="detail-head">
            <h1 className="detail-title">{artwork.title}</h1>
            <div className="detail-share">
              <ShareButton title={artwork.title} />
            </div>
          </div>
          <p className="detail-inline-meta">
            {artwork.dimensions} · {artwork.year}
          </p>
          <p className="detail-description">{artwork.description}</p>
          <p className="estimate estimate--inline">
            <span className="estimate__label">Estimate </span>
            <span className="estimate__value estimate__value--inline">
              {formatUsdFromCents(artwork.estimateLowCents)}–{formatUsdFromCents(artwork.estimateHighCents)}
            </span>
          </p>
          <div className="sticky-bid">
            <BidPanel artwork={artwork} />
          </div>
          <VotePanel lotId={artwork.id} />
          <FeedbackPanel lotId={artwork.id} />
        </div>
      </div>
    </article>
  );
}
