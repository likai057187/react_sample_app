const rawModules = import.meta.glob<string>("../../asset/artwork/**/*", {
  eager: true,
  query: "?url",
  import: "default",
});

const modules: Record<string, string> = {};
for (const [path, url] of Object.entries(rawModules)) {
  if (!/\.(jpe?g|png|webp|gif)$/i.test(path)) continue;
  if (path.includes(".DS_Store") || path.endsWith(".textClipping")) continue;
  modules[path] = url;
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function lotIndexFromTitle(title: string): number {
  const m = title.match(/NO\.(\d+)/i);
  return m ? parseInt(m[1], 10) : 0;
}

export type CatalogEntry = {
  id: string;
  title: string;
  imageUrl: string;
  index: number;
};

function lotKeyFromPath(normalized: string): string | null {
  const segments = normalized.split("/").filter(Boolean);
  const artworkIdx = segments.indexOf("artwork");
  if (artworkIdx < 0) return null;

  /** Segments after `…/artwork/` — [artistDir, …?, fileName] */
  const below = segments.slice(artworkIdx + 1);
  if (below.length < 2) return null;

  const fileName = below[below.length - 1]!;
  if (!/\.(jpe?g|png|webp|gif)$/i.test(fileName)) return null;

  if (below.length === 2) {
    // asset/artwork/<artist>/image.jpg — use file stem as lot label
    return fileName.replace(/\.[^.]+$/i, "");
  }

  // asset/artwork/<artist>/<lot-folder>/image.jpg (or deeper: parent of file is lot folder)
  const lotFolder = below[below.length - 2]!;
  if (lotFolder === "artwork" || lotFolder === "asset") return null;
  return lotFolder;
}

export function loadCatalog(): CatalogEntry[] {
  const byFolder = new Map<string, string>();

  for (const [path, url] of Object.entries(modules)) {
    const normalized = path.replace(/\\/g, "/");
    const key = lotKeyFromPath(normalized);
    if (!key) continue;
    if (!byFolder.has(key)) byFolder.set(key, url);
  }

  const entries: CatalogEntry[] = [...byFolder.entries()].map(([title, imageUrl]) => ({
    id: slugify(title),
    title,
    imageUrl,
    index: lotIndexFromTitle(title),
  }));

  entries.sort((a, b) => a.index - b.index || a.title.localeCompare(b.title));
  return entries;
}
