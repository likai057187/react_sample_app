import type { Artwork } from "../types";
import type { CatalogEntry } from "./catalog";

const SERIES = "Divine Illumination";
const MEDIUM = "Mixed media on canvas";
const DIMENSIONS = '48" × 36"';
const YEAR = "2026";

const WALL_TEXT = [
  "Veils of pigment and shell gold drift across the plane, catching light the way late sun finds the edge of stone.",
  "A luminous field built in layers—glaze, graphite, and metallic ground—so the surface reads differently every hour of the day.",
  "Calligraphic gestures settle into a slow horizon; depth is suggested more than drawn, like memory half recalled.",
  "Cool chroma lifts from a warm undertone, a quiet tension between stillness and the suggestion of motion.",
  "The composition leans into asymmetry: weight on one side, breath on the other, held in equipoise.",
  "Fine linear work threads through broader washes, mapping a kind of interior weather onto the canvas.",
  "Metallic grounds catch skylight and lamplight differently—first silvered, then softly burnished as you move.",
  "Edges are softened; the center holds a brighter pulse, as if the work were lit from within rather than above.",
];

export function catalogToArtworks(entries: CatalogEntry[]): Artwork[] {
  return entries.map((e, i) => {
    const base = 2800 + i * 220;
    const spread = 400 + (i % 5) * 120;
    const estimateLowCents = (base - 200) * 100;
    const estimateHighCents = (base + spread) * 100;
    const openingBidCents = Math.max(estimateLowCents - 300_00, 800_00);
    const reserveCents = openingBidCents + Math.round((estimateHighCents - openingBidCents) * 0.35);

    return {
      id: e.id,
      title: e.title,
      series: SERIES,
      medium: MEDIUM,
      dimensions: DIMENSIONS,
      year: YEAR,
      imageUrl: e.imageUrl,
      description: WALL_TEXT[i % WALL_TEXT.length]!,
      estimateLowCents,
      estimateHighCents,
      openingBidCents,
      reserveCents,
    };
  });
}
