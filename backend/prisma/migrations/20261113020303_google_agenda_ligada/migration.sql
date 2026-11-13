-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "google_calendar_id" TEXT,
ADD COLUMN     "google_calendar_name" TEXT,
ADD COLUMN     "google_linked_at" TIMESTAMP(3);
