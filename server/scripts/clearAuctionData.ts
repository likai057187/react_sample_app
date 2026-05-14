import { clearAllAuctionParticipationData } from '../src/lib/auctionDb.js';
import { prisma } from '../src/config/db.js';

await clearAllAuctionParticipationData();
await prisma.$disconnect();
console.log(
  'Auction data cleared (bids, votes, feedback, guests). Event end set to past — lots show as closed. To reopen: npm run db:reset-auction-schedule --prefix server',
);
