-- Add profile, friends, direct messages, and forum tables that predate
-- this migration in some development databases.
ALTER TABLE "Guest" ADD COLUMN IF NOT EXISTS "bio" TEXT;

CREATE TABLE IF NOT EXISTS "ForumTopic" (
  "id" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ForumTopic_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ForumReply" (
  "id" TEXT NOT NULL,
  "topicId" TEXT NOT NULL,
  "guestId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ForumReply_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "Friendship" (
  "ownerId" TEXT NOT NULL,
  "friendId" TEXT NOT NULL,
  "capturedDisplayName" TEXT,
  "addedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Friendship_pkey" PRIMARY KEY ("ownerId", "friendId")
);

CREATE TABLE IF NOT EXISTS "DirectMessage" (
  "id" TEXT NOT NULL,
  "senderId" TEXT NOT NULL,
  "recipientId" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DirectMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ForumTopic_createdAt_idx" ON "ForumTopic"("createdAt");
CREATE INDEX IF NOT EXISTS "ForumReply_topicId_createdAt_idx" ON "ForumReply"("topicId", "createdAt");
CREATE INDEX IF NOT EXISTS "ForumReply_createdAt_idx" ON "ForumReply"("createdAt");
CREATE INDEX IF NOT EXISTS "Friendship_friendId_idx" ON "Friendship"("friendId");
CREATE INDEX IF NOT EXISTS "Friendship_addedAt_idx" ON "Friendship"("addedAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_senderId_recipientId_createdAt_idx" ON "DirectMessage"("senderId", "recipientId", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_recipientId_senderId_createdAt_idx" ON "DirectMessage"("recipientId", "senderId", "createdAt");
CREATE INDEX IF NOT EXISTS "DirectMessage_createdAt_idx" ON "DirectMessage"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForumTopic_guestId_fkey') THEN
    ALTER TABLE "ForumTopic" ADD CONSTRAINT "ForumTopic_guestId_fkey"
      FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForumReply_topicId_fkey') THEN
    ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_topicId_fkey"
      FOREIGN KEY ("topicId") REFERENCES "ForumTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ForumReply_guestId_fkey') THEN
    ALTER TABLE "ForumReply" ADD CONSTRAINT "ForumReply_guestId_fkey"
      FOREIGN KEY ("guestId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Friendship_ownerId_fkey') THEN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_ownerId_fkey"
      FOREIGN KEY ("ownerId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Friendship_friendId_fkey') THEN
    ALTER TABLE "Friendship" ADD CONSTRAINT "Friendship_friendId_fkey"
      FOREIGN KEY ("friendId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_senderId_fkey') THEN
    ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_senderId_fkey"
      FOREIGN KEY ("senderId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DirectMessage_recipientId_fkey') THEN
    ALTER TABLE "DirectMessage" ADD CONSTRAINT "DirectMessage_recipientId_fkey"
      FOREIGN KEY ("recipientId") REFERENCES "Guest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
