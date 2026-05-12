import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { Artwork } from "../types";
import { formatUsdFromCents } from "../lib/format";
import { useAuction } from "../context/AuctionProvider";

type Props = {
  artworks: Artwork[];
};

export function CatalogSwipe({ artworks }: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { getLot } = useAuction();

  const syncActive = useCallback(() => {
    const el = scrollerRef.current;
    if (!el || !el.clientWidth) return;
    const i = Math.min(artworks.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth)));
    setActive(i);
  }, [artworks.length]);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    syncActive();
    el.addEventListener("scroll", syncActive, { passive: true });
    const ro = new ResizeObserver(syncActive);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", syncActive);
      ro.disconnect();
    };
  }, [syncActive, artworks.length]);

  const goToSlide = useCallback(
    (index: number) => {
      const el = scrollerRef.current;
      if (!el || !el.clientWidth) return;
      const i = Math.min(artworks.length - 1, Math.max(0, index));
      const reduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      el.scrollTo({ left: i * el.clientWidth, behavior: reduceMotion ? "auto" : "smooth" });
    },
    [artworks.length],
  );

  return (
    <div className="catalog-swipe-wrap">
      <div ref={scrollerRef} className="catalog-swipe" tabIndex={0}>
        {artworks.map((a) => {
          const lot = getLot(a.id);
          const hasBids = lot ? lot.bids.length > 0 : false;
          const display = hasBids && lot ? lot.currentBidCents : a.openingBidCents;
          return (
            <article key={a.id} className="catalog-swipe__slide" aria-roledescription="slide">
              <div className="catalog-swipe__media">
                <img src={a.imageUrl} alt={a.title} loading="lazy" decoding="async" />
                <div className="catalog-swipe__scrim" aria-hidden />
              </div>
              <div className="catalog-swipe__panel">
                <p className="catalog-swipe__series">{a.series}</p>
                <h2 className="catalog-swipe__title">{a.title}</h2>
                <p className="catalog-swipe__desc">{a.description}</p>
                <div className="catalog-swipe__meta">
                  <span className="catalog-swipe__from">{hasBids ? "Current" : "Opens"}</span>
                  <span className="catalog-swipe__price">{formatUsdFromCents(display)}</span>
                </div>
                <Link to={`/lot/${a.id}`} className="catalog-swipe__cta">
                  View lot
                </Link>
              </div>
            </article>
          );
        })}
      </div>
      {artworks.length > 1 && (
        <div className="catalog-swipe__dots" role="tablist" aria-label="Choose a lot">
          {artworks.map((a, i) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`catalog-swipe__dot${i === active ? " catalog-swipe__dot--on" : ""}`}
              aria-label={`Lot ${i + 1}: ${a.title}`}
              onClick={() => goToSlide(i)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
