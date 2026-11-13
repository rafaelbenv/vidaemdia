-- CreateEnum
CREATE TYPE "GoogleSyncOperation" AS ENUM ('UPSERT', 'DELETE');

-- CreateEnum
CREATE TYPE "GoogleSyncStatus" AS ENUM ('PENDING', 'PROCESSING', 'DONE', 'FAILED');

-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "google_event_id" TEXT,
ADD COLUMN     "google_sync_error" TEXT,
ADD COLUMN     "google_synced_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "google_sync_jobs" (
    "id" TEXT NOT NULL,
    "appointment_id" TEXT NOT NULL,
    "operation" "GoogleSyncOperation" NOT NULL,
    "status" "GoogleSyncStatus" NOT NULL DEFAULT 'PENDING',
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "next_retry_at" TIMESTAMP(3),
    "last_error" TEXT,
    "claimed_at" TIMESTAMP(3),
    "claimed_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "google_sync_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "google_sync_jobs_status_next_retry_at_idx" ON "google_sync_jobs"("status", "next_retry_at");

-- AddForeignKey
ALTER TABLE "google_sync_jobs" ADD CONSTRAINT "google_sync_jobs_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
