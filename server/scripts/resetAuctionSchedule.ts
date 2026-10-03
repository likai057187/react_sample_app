/**
 * Reopen all lots by setting endsAt / eventEndsAt to a future time.
 *
 * Usage (from repo root):
 *   npm run db:reset-auction-schedule --prefix server
 *   npm run db:reset-auction-schedule --prefix server -- --days=30
 *   npm run db:reset-auction-schedule --prefix server -- --iso=2026-06-19T20:30:00-04:00
 */
import { resetAuctionScheduleToEndAt } from '../src/lib/auctionDb.js';
import { prisma } from '../src/config/db.js';

function parseArgs(): Date {
  const argv = process.argv.slice(2);
  const isoArg = argv.find((a) => a.startsWith('--iso='));
  if (isoArg) {
    const iso = isoArg.slice('--iso='.length);
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`Invalid --iso date: ${iso}`);
    return d;
  }
  const daysArg = argv.find((a) => a.startsWith('--days='));
  const days = daysArg ? Number.parseInt(daysArg.slice('--days='.length), 10) : 30;
  if (!Number.isFinite(days) || days < 1) throw new Error('--days must be a positive integer');
  const end = new Date();
  end.setUTCDate(end.getUTCDate() + days);
  return end;
}

const eventEndsAt = parseArgs();
await resetAuctionScheduleToEndAt(eventEndsAt);
const settings = await prisma.eventSettings.findUniqueOrThrow({ where: { id: 1 } });
const lotCount = await prisma.lot.count();
await prisma.$disconnect();

console.log(
  JSON.stringify(
    {
      ok: true,
      eventEndsAt: settings.eventEndsAt.toISOString(),
      lotsUpdated: lotCount,
      message: 'All lots now close at eventEndsAt (bidding open until then).',
    },
    null,
    2,
  ),
);
