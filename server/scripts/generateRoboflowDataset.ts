import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp, { type Color } from 'sharp';

type CatalogRow = {
  Name: string;
  Description: string;
  Price: string;
  Size: string;
  Media: string;
  Year: string;
  Artist: string;
};

type AugmentSpec = {
  rotate: number;
  shear: number;
  scale: number;
  brightness: number;
  saturation: number;
  background: Color;
};

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const artworkRoot = path.join(repoRoot, 'client/asset/artwork');
const catalogPath = path.join(artworkRoot, 'catalog.csv');
const outputRoot = process.env.ROBOFLOW_DATASET_OUT
  ? path.resolve(process.env.ROBOFLOW_DATASET_OUT)
  : path.join(repoRoot, '.tools/roboflow-dataset');
const augmentationsPerArtwork = Math.max(1, parseInt(process.env.ROBOFLOW_AUGMENTATIONS_PER_ARTWORK ?? '24', 10));
const imageSize = Math.max(320, parseInt(process.env.ROBOFLOW_IMAGE_SIZE ?? '640', 10));

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function safePathSegment(value: string): string {
  return value.replace(/[<>:"/\\|?*]+/g, ' ').trim().replace(/\.+$/g, '');
}

function artworkId(row: CatalogRow): string {
  return `${slugify(row.Artist)}--${slugify(row.Name)}`;
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

async function loadCatalog(): Promise<CatalogRow[]> {
  const raw = await fs.readFile(catalogPath, 'utf8');
  const [headers, ...rows] = parseCsv(raw);
  if (!headers) throw new Error(`Missing catalog headers: ${catalogPath}`);
  return rows.map((cells) => {
    const row = Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']));
    return row as CatalogRow;
  });
}

async function findArtworkImage(row: CatalogRow): Promise<string> {
  const lotDir = path.join(artworkRoot, safePathSegment(row.Artist), safePathSegment(row.Name));
  const entries = await fs.readdir(lotDir, { withFileTypes: true });
  const image = entries.find((entry) => entry.isFile() && /\.(avif|gif|jpe?g|png|webp)$/i.test(entry.name));
  if (!image) throw new Error(`No source image found for ${row.Artist} / ${row.Name}`);
  return path.join(lotDir, image.name);
}

function makeRng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (1664525 * state + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function specFor(label: string, index: number): AugmentSpec {
  const rng = makeRng(hashString(`${label}:${index}`));
  const gray = Math.round(18 + rng() * 58);
  return {
    rotate: -16 + rng() * 32,
    shear: -0.14 + rng() * 0.28,
    scale: 0.72 + rng() * 0.24,
    brightness: 0.86 + rng() * 0.3,
    saturation: 0.82 + rng() * 0.36,
    background: {
      r: Math.min(255, gray + Math.round(rng() * 26)),
      g: Math.min(255, gray + Math.round(rng() * 26)),
      b: Math.min(255, gray + Math.round(rng() * 26)),
      alpha: 1,
    },
  };
}

async function renderAugmentation(sourcePath: string, outputPath: string, spec: AugmentSpec): Promise<void> {
  const innerSize = Math.round(imageSize * spec.scale);
  const background = spec.background;
  const transformed = await sharp(sourcePath)
    .resize({ width: innerSize, height: innerSize, fit: 'inside', withoutEnlargement: true })
    .modulate({ brightness: spec.brightness, saturation: spec.saturation })
    .rotate(spec.rotate, { background })
    .affine(
      [
        [1, spec.shear],
        [0, 1],
      ],
      { background },
    )
    .jpeg({ quality: 86 })
    .toBuffer();
  const base = await sharp(transformed).resize({ width: imageSize - 24, height: imageSize - 24, fit: 'inside' }).toBuffer();

  await sharp({
    create: {
      width: imageSize,
      height: imageSize,
      channels: 3,
      background,
    },
  })
    .composite([{ input: base, gravity: 'center' }])
    .jpeg({ quality: 88 })
    .toFile(outputPath);
}

function csvEscape(value: string): string {
  if (!/[",\n\r]/.test(value)) return value;
  return `"${value.replace(/"/g, '""')}"`;
}

async function main() {
  const rows = await loadCatalog();
  await fs.rm(outputRoot, { recursive: true, force: true });
  const imagesRoot = path.join(outputRoot, 'images');
  await fs.mkdir(imagesRoot, { recursive: true });

  const manifest = ['path,label,title,artist'];
  for (const row of rows) {
    const label = artworkId(row);
    const source = await findArtworkImage(row);
    const labelDir = path.join(imagesRoot, label);
    await fs.mkdir(labelDir, { recursive: true });

    const originalOut = path.join(labelDir, 'original.jpg');
    await sharp(source)
      .resize({ width: imageSize, height: imageSize, fit: 'inside', background: '#111111' })
      .flatten({ background: '#111111' })
      .jpeg({ quality: 90 })
      .toFile(originalOut);
    manifest.push([path.relative(outputRoot, originalOut), label, row.Name, row.Artist].map(csvEscape).join(','));

    for (let i = 0; i < augmentationsPerArtwork; i += 1) {
      const out = path.join(labelDir, `aug-${String(i + 1).padStart(3, '0')}.jpg`);
      await renderAugmentation(source, out, specFor(label, i));
      manifest.push([path.relative(outputRoot, out), label, row.Name, row.Artist].map(csvEscape).join(','));
    }
  }

  await fs.writeFile(path.join(outputRoot, 'labels.csv'), `${manifest.join('\n')}\n`, 'utf8');
  await fs.writeFile(
    path.join(outputRoot, 'README.md'),
    [
      '# Roboflow Artwork Classification Dataset',
      '',
      `Generated ${rows.length} artwork labels with ${augmentationsPerArtwork + 1} images per label.`,
      '',
      'Upload the `images` folder as a classification dataset. The folder names are app artwork IDs.',
      'Use `labels.csv` as the manifest/reference mapping back to title and artist.',
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`Generated ${rows.length * (augmentationsPerArtwork + 1)} images for ${rows.length} labels.`);
  console.log(outputRoot);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
