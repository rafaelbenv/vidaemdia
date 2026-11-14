-- AlterTable
ALTER TABLE "appointments" ADD COLUMN     "has_conflict" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_private" BOOLEAN NOT NULL DEFAULT false;
