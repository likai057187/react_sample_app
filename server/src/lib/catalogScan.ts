/**
 * Scan `client/asset/artwork` and build catalog entries (same rules as the old client glob).
 * Image URLs are served under `/api/media/...` by static.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import type { CatalogEntry } from './pricing.js';

type CatalogMetadata = {
  title: string;
  description?: string;
  priceCents?: number;
  dimensions?: string;
  medium?: string;
  year?: string;
  artistName: string;
  index: number;
};

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function lotIndexFromTitle(title: string): number {
  const m = title.match(/NO\.(\d+)/i);
  return m ? parseInt(m[1]!, 10) : 0;
}

function scoreStem(stem: string): number {
  if (/\(main\)/i.test(stem)) return 100;
  if (/\bmain\b/i.test(stem)) return 50;
  return 0;
}

function sortCandidates(rels: string[]): string[] {
  return [...rels].sort((a, b) => {
    const stemA = path.basename(a, path.extname(a));
    const stemB = path.basename(b, path.extname(b));
    const sa = scoreStem(stemA);
    const sb = scoreStem(stemB);
    if (sa !== sb) return sb - sa;
    return a.localeCompare(b);
  });
}

/** relative from artwork root, e.g. `Alika/Berlin/Berlin.png` */
function mediaUrl(relPosix: string): string {
  return `/api/media/${relPosix.split('/').map(encodeURIComponent).join('/')}`;
}

export async function buildCatalogEntries(artworkRoot: string): Promise<CatalogEntry[]> {
  let files: string[] = [];
  try {
    files = await collectFiles(artworkRoot);
  } catch {
    return [];
  }

  const groups = new Map<string, { artistName: string; lotTitle: string; files: string[] }>();

  for (const abs of files) {
    const rel = path.relative(artworkRoot, abs).replace(/\\/g, '/');
    if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(rel)) continue;
    if (rel.includes('.DS_Store') || rel.endsWith('.textClipping')) continue;

    const parsed = parseRelativeArtwork(rel);
    if (!parsed) continue;
    const key = `${parsed.artistName}/${parsed.lotTitle}`;
    const g = groups.get(key);
    if (g) g.files.push(abs);
    else groups.set(key, { artistName: parsed.artistName, lotTitle: parsed.lotTitle, files: [abs] });
  }

  const metadata = await loadCatalogMetadata(artworkRoot);
  const entries: CatalogEntry[] = [];

  for (const { artistName, lotTitle, files: groupFiles } of groups.values()) {
    const meta = metadata.get(metadataKey(artistName, lotTitle));
    const displayArtistName = meta?.artistName ?? artistName;
    const displayTitle = meta?.title ?? lotTitle;
    const rels = groupFiles.map((abs) => path.relative(artworkRoot, abs).replace(/\\/g, '/'));
    const sortedRels = sortCandidates(rels);
    const imageUrls = sortedRels.map(mediaUrl);
    const artistId = slugify(displayArtistName);
    const id = `${artistId}--${slugify(displayTitle)}`;
    entries.push({
      id,
      title: displayTitle,
      artistId,
      artistName: displayArtistName,
      imageUrl: imageUrls[0] ?? '',
      imageUrls,
      index: meta?.index ?? lotIndexFromTitle(displayTitle),
      description: meta?.description,
      priceCents: meta?.priceCents,
      dimensions: meta?.dimensions,
      medium: meta?.medium,
      year: meta?.year,
    });
  }

  entries.sort((a, b) => a.index - b.index || a.title.localeCompare(b.title));
  return entries;
}

async function collectFiles(dir: string): Promise<string[]> {
  const out: string[] = [];
  const walk = async (d: string) => {
    let ents;
    try {
      ents = await fs.readdir(d, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) await walk(p);
      else out.push(p);
    }
  };
  await walk(dir);
  return out;
}

function parseRelativeArtwork(rel: string): { artistName: string; lotTitle: string } | null {
  const segments = rel.split('/').filter(Boolean);
  if (segments.length < 2) return null;
  if (segments.some((segment) => /^badge$/i.test(segment))) return null;
  const artistName = segments[0]!;
  if (!artistName || /^badge$/i.test(artistName)) return null;

  const fileName = segments[segments.length - 1]!;
  if (!/\.(jpe?g|png|webp|gif|avif)$/i.test(fileName)) return null;

  let lotTitle: string;
  if (segments.length === 2) {
    lotTitle = fileName.replace(/\.[^.]+$/i, '');
  } else {
    const lotFolder = segments[segments.length - 2]!;
    if (lotFolder === 'artwork' || lotFolder === 'asset') return null;
    lotTitle = lotFolder;
  }
  return { artistName, lotTitle };
}

function metadataKey(artistName: string, title: string): string {
  return `${slugify(artistName)}/${slugify(title)}`;
}

async function loadCatalogMetadata(artworkRoot: string): Promise<Map<string, CatalogMetadata>> {
  const csvPath = path.join(artworkRoot, 'catalog.csv');
  let raw: string;
  try {
    raw = await fs.readFile(csvPath, 'utf8');
  } catch {
    return new Map();
  }

  const rows = parseCsv(raw);
  const [headers, ...dataRows] = rows;
  if (!headers) return new Map();

  const out = new Map<string, CatalogMetadata>();
  dataRows.forEach((cells, index) => {
    const row = Object.fromEntries(headers.map((header, i) => [header.trim(), cells[i]?.trim() ?? '']));
    const title = row.Name;
    const artistName = row.Artist;
    if (!title || !artistName) return;

    const priceCents = parsePriceCents(row.Price);
    out.set(metadataKey(artistName, title), {
      title,
      artistName,
      description: row.Description || undefined,
      priceCents,
      dimensions: row.Size || undefined,
      medium: row.Media || undefined,
      year: row.Year || undefined,
      index,
    });
  });
  return out;
}

function parsePriceCents(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const value = Number.parseFloat(raw.replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(value) || value <= 0) return undefined;
  return Math.round(value * 100);
}

function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < raw.length; i += 1) {
    const char = raw[i]!;
    const next = raw[i + 1];

    if (quoted) {
      if (char === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim()));
}
