import { prisma } from '../config/db.js';

await prisma.$executeRawUnsafe(`
DO $$
BEGIN
  IF to_regclass('"Guest"') IS NOT NULL THEN
    ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "displayNameKey" TEXT;

    UPDATE "Guest"
    SET "displayNameKey" = lower(regexp_replace(btrim("displayName"), '\\s+', ' ', 'g'))
    WHERE "displayName" IS NOT NULL
      AND btrim("displayName") <> ''
      AND "displayNameKey" IS NULL;

    WITH ranked AS (
      SELECT
        "id",
        row_number() OVER (
          PARTITION BY "displayNameKey"
          ORDER BY "id"
        ) AS rn
      FROM "Guest"
      WHERE "displayNameKey" IS NOT NULL
    )
    UPDATE "Guest"
    SET "displayNameKey" = NULL
    FROM ranked
    WHERE "Guest"."id" = ranked."id"
      AND ranked.rn > 1;

    CREATE UNIQUE INDEX IF NOT EXISTS "Guest_displayNameKey_key" ON "Guest"("displayNameKey");
  END IF;
END $$;
`);

await prisma.$disconnect();
console.log('Startup schema patches applied.');
