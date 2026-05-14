import type { Artwork } from "../types";
import { apiFetch, apiMediaUrl } from "../lib/apiClient";

type CatalogApiResponse = {
  version: number;
  artworks: Artwork[];
};

/**
 * Full artwork list from `GET /api/catalog` (pricing and copy match the server).
 * Expo does not proxy `/api`, so media URLs are normalized to the API origin.
 */
export async function fetchArtworks(): Promise<Artwork[]> {
  const res = await apiFetch("/api/catalog", {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Catalog request failed (${res.status})`);
  }
  const data = (await res.json()) as CatalogApiResponse;
  if (!data.artworks || !Array.isArray(data.artworks)) {
    throw new Error("Invalid catalog response");
  }
  return data.artworks.map((artwork) => ({
    ...artwork,
    imageUrl: apiMediaUrl(artwork.imageUrl),
    imageUrls: artwork.imageUrls.map(apiMediaUrl),
  }));
}
