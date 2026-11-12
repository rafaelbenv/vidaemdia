-- AlterEnum
ALTER TYPE "ReminderStatus" ADD VALUE 'PROCESSING';

-- AlterTable
ALTER TABLE "reminders" ADD COLUMN     "claimed_at" TIMESTAMP(3),
ADD COLUMN     "claimed_by" TEXT;
