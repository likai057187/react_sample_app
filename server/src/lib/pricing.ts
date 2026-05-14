/** Full `Artwork` payload for the client (single source with server bid validation). */

const SERIES = 'Rockefeller Center 2026';

export type CatalogEntry = {
  id: string;
  title: string;
  artistId: string;
  artistName: string;
  imageUrl: string;
  imageUrls: string[];
  index: number;
  description?: string;
  priceCents?: number;
  dimensions?: string;
  medium?: string;
  year?: string;
};

export type ClientArtwork = CatalogEntry & {
  series: string;
  medium: string;
  dimensions: string;
  year: string;
  description: string;
  estimateLowCents: number;
  estimateHighCents: number;
  openingBidCents: number;
};

function fallbackDescription(entry: CatalogEntry): string {
  const details = [entry.medium, entry.dimensions, entry.year].filter(Boolean).join(' · ');
  return `${entry.title} by ${entry.artistName}${details ? ` (${details})` : ''}.`;
}

export function buildArtworksForClient(entries: CatalogEntry[]): ClientArtwork[] {
  return entries.map((e, i) => {
    const priceCents = e.priceCents;
    const fallbackBase = 2800 + i * 220;
    const fallbackSpread = 400 + (i % 5) * 120;
    const openingBidCents = priceCents ?? Math.max((fallbackBase - 500) * 100, 80000);
    const estimateLowCents = priceCents ? priceCents : (fallbackBase - 200) * 100;
    const estimateHighCents = priceCents ? Math.round(priceCents * 1.25) : (fallbackBase + fallbackSpread) * 100;
    return {
      ...e,
      series: SERIES,
      medium: e.medium ?? 'Mixed media',
      dimensions: e.dimensions ?? 'Dimensions available on request',
      year: e.year ?? '2026',
      description: e.description || fallbackDescription(e),
      estimateLowCents,
      estimateHighCents,
      openingBidCents,
    };
  });
}
