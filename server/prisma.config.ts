import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const defaultUrl =
  'postgresql://auction:auction_dev@localhost:5433/react_sample_auction?schema=public';

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL ?? defaultUrl,
  },
});
