import { apiMediaUrl } from "../lib/apiClient";

/** Curatorial blurbs keyed by folder slug (`slugify` of artist directory name). */
export const ARTIST_BIOS: Record<string, string> = {
  "ning-zhang":
    "Ning Zhang’s surfaces balance gesture and restraint—each panel a quiet field where light seems to settle rather than strike.",
  alika:
    "Alika works between memory and place—layered color, movement, and stillness—inviting the viewer to linger as the room changes around the canvas.",
  "ling-huang":
    "Ling Huang brings ink, paper, and gesture into meditative balance, where each mark carries both motion and stillness.",
  cris:
    "Cris explores cosmic abstraction through saturated fields, layered texture, and luminous movement.",
  moni:
    "Moni bridges traditional visual language with contemporary rhythm, creating works that feel both ceremonial and immediate.",
  olivia:
    "Olivia’s mixed-media works turn everyday phrases into intimate, psychologically charged compositions.",
  "david-hayes":
    "David Hayes works across welded steel and gouache, translating landscape, balance, and architectural form into crisp modernist silhouettes.",
};

/** Badge portrait — same origin as catalog images (`server` serves `client/asset/artwork` at `/api/media/…`). */
export const ARTIST_BADGE_URL: Record<string, string> = {
  alika: "/api/media/Alika/badge/alika.avif",
  "ning-zhang": "/api/media/Ning%20Zhang/badge/ningzhang.avif",
  "ling-huang": "/api/media/Ling%20Huang/badge/LingHuang.jpg",
  cris: "/api/media/Cris/badge/Cris.avif",
  moni: "/api/media/Moni/badge/Moni.avif",
  olivia: "/api/media/Olivia/badge/Olivia.jpg",
  "david-hayes": "/api/media/David%20Hayes/badge/DavidHeys.png",
};

export const ARTIST_ROLE_LINE: Record<string, string> = {
  alika: "Painter · Exhibition 2026",
  "ning-zhang": "Painter · Exhibition 2026",
  "ling-huang": "Ink artist · Exhibition 2026",
  cris: "Painter · Exhibition 2026",
  moni: "Painter · Exhibition 2026",
  olivia: "Mixed media artist · Exhibition 2026",
  "david-hayes": "Sculptor · Exhibition 2026",
};

export function getArtistBio(artistId: string): string {
  return ARTIST_BIOS[artistId] ?? "Exhibiting artist — biography coming soon.";
}

export function getArtistBadgeUrl(artistId: string): string | null {
  const raw = ARTIST_BADGE_URL[artistId];
  return raw ? apiMediaUrl(raw) : null;
}

export function getArtistRoleLine(artistId: string): string {
  return ARTIST_ROLE_LINE[artistId] ?? "Artist · Exhibition 2026";
}
