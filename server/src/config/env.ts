import dotenv from 'dotenv';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config({ path: resolve(__dirname, '../../.env') });

const DEFAULT_DATABASE_URL =
  'postgresql://auction:auction_dev@localhost:5433/react_sample_auction?schema=public';

export const env = {
  PORT: parseInt(process.env.PORT ?? '3847', 10),
  API_KEY: String(process.env.API_KEY ?? '').trim(),
  DATABASE_URL: (process.env.DATABASE_URL ?? '').trim() || DEFAULT_DATABASE_URL,
  ROBOFLOW_API_KEY: String(process.env.ROBOFLOW_API_KEY ?? '').trim(),
  ROBOFLOW_MODEL_ID: String(process.env.ROBOFLOW_MODEL_ID ?? '').trim(),
  ROBOFLOW_INFERENCE_URL: String(process.env.ROBOFLOW_INFERENCE_URL ?? '').trim(),
  DISCOVERY_MATCH_THRESHOLD: parseFloat(process.env.DISCOVERY_MATCH_THRESHOLD ?? '0.4'),
} as const;
