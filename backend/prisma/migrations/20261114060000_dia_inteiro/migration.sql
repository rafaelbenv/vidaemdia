-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "all_day" BOOLEAN NOT NULL DEFAULT false;


-- Reimporta do Google: o 8.4 ignorava eventos de dia inteiro
UPDATE "calendars" SET "google_sync_token" = NULL;
