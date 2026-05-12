import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CatalogSwipe } from "../components/CatalogSwipe";
import { CatalogViewToggle, type ViewMode } from "../components/CatalogViewToggle";
import { LotCard } from "../components/LotCard";
import { useAuction } from "../context/AuctionProvider";

const VIEW_KEY = "di-catalog-view";

function readStoredView(): ViewMode {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    if (v === "swipe" || v === "list" || v === "grid") return v;
  } catch {
    /* ignore */
  }
  return "swipe";
}

function scrollCatalogIntoView(smooth: boolean) {
  const el = document.getElementById("catalog");
  if (!el) return;
  el.scrollIntoView({ behavior: smooth ? "smooth" : "auto", block: "start" });
}

export function HomePage() {
  const { artworks } = useAuction();
  const location = useLocation();
  const count = artworks.length;
  const [view, setView] = useState<ViewMode>(readStoredView);

  useEffect(() => {
    if (location.pathname !== "/") return;
    if (location.hash !== "#catalog") return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    scrollCatalogIntoView(!reduceMotion);
  }, [location.pathname, location.hash]);

  const setViewMode = (v: ViewMode) => {
    setView(v);
    try {
      localStorage.setItem(VIEW_KEY, v);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className={`catalog-page catalog-page--${view}`}>
      <section id="catalog" className="catalog-section catalog-section--browse" aria-label="Works for sale">
        {count === 0 ? (
          <div className="catalog-empty" role="status">
            No artwork found. Put images under <code>asset/artwork/NingZhang/</code> (one folder per lot, or loose files in that artist folder), then restart the dev server.
          </div>
        ) : (
          <>
            <CatalogViewToggle value={view} onChange={setViewMode} />
            <div key={view} className="catalog-view-animate">
              {view === "swipe" && <CatalogSwipe artworks={artworks} />}
              {view === "list" && (
                <div className="lot-grid lot-grid--list">
                  {artworks.map((a) => (
                    <LotCard key={a.id} artwork={a} />
                  ))}
                </div>
              )}
              {view === "grid" && (
                <div className="lot-grid lot-grid--dense">
                  {artworks.map((a) => (
                    <LotCard key={a.id} artwork={a} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
