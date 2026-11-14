-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "google_etag" TEXT;

-- AlterTable
ALTER TABLE "calendars" ADD COLUMN     "google_last_sync_at" TIMESTAMP(3),
ADD COLUMN     "google_sync_error" TEXT,
ADD COLUMN     "google_sync_token" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "appointments_calendar_id_google_event_id_key" ON "appointments"("calendar_id", "google_event_id");

