import { resetAuctionScheduleToDefault } from '../src/lib/auctionDb.js';
import { prisma } from '../src/config/db.js';

await resetAuctionScheduleToDefault();
await prisma.$disconnect();
console.log('Auction schedule reset to default (lots open until configured end).');
