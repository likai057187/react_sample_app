export type ViewMode = "swipe" | "list" | "grid";

type Props = {
  value: ViewMode;
  onChange: (mode: ViewMode) => void;
};

const OPTIONS: { id: ViewMode; label: string }[] = [
  { id: "swipe", label: "Swipe" },
  { id: "list", label: "List" },
  { id: "grid", label: "Grid" },
];

export function CatalogViewToggle({ value, onChange }: Props) {
  return (
    <div className="view-toggle" role="tablist" aria-label="Catalog layout">
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={`view-toggle__btn${value === o.id ? " view-toggle__btn--active" : ""}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
