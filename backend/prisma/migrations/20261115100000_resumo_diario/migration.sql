-- AlterTable
ALTER TABLE "users" ADD COLUMN     "daily_summary_enabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "daily_summary_hour" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "daily_summary_last_sent_on" TEXT;
