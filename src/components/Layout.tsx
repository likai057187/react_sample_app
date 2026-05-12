import { Link, Outlet } from "react-router-dom";
import { getDisplayName } from "../lib/guest";

export function Layout() {
  const who = getDisplayName();

  return (
    <div className="app-shell">
      <header className="site-header site-header--minimal">
        <div className="site-header__inner">
          <Link to="/" className="brand brand--tight">
            <span className="brand__title">Divine Illumination</span>
          </Link>
          <div className="site-header__right">
            {who !== "Guest" && <span className="header-greet">{who}</span>}
            <nav aria-label="Primary">
              <Link to="/#catalog" className="nav-pill nav-pill--compact">
                Lots
              </Link>
            </nav>
          </div>
        </div>
      </header>
      <main className="app-main app-main--tight">
        <Outlet />
      </main>
    </div>
  );
}
