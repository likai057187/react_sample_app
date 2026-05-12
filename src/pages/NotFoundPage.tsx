import { Link } from "react-router-dom";

export function NotFoundPage() {
  return (
    <div className="not-found">
      <h1 className="sr-only">Page not found</h1>
      <p>
        <Link to="/#catalog" className="nav-pill nav-pill--compact">
          Lots
        </Link>
      </p>
    </div>
  );
}
