-- Dados antigos dos canais removidos passam a usar o Telegram (o único canal ativo).
UPDATE "users" SET "preferred_channel" = 'TELEGRAM' WHERE "preferred_channel"::text <> 'TELEGRAM';
UPDATE "reminders" SET "channel" = 'TELEGRAM' WHERE "channel"::text <> 'TELEGRAM';

-- AlterEnum
BEGIN;
CREATE TYPE "NotificationChannel_new" AS ENUM ('TELEGRAM');
ALTER TABLE "reminders" ALTER COLUMN "channel" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "preferred_channel" DROP DEFAULT;
ALTER TABLE "users" ALTER COLUMN "preferred_channel" TYPE "NotificationChannel_new" USING ("preferred_channel"::text::"NotificationChannel_new");
ALTER TABLE "reminders" ALTER COLUMN "channel" TYPE "NotificationChannel_new" USING ("channel"::text::"NotificationChannel_new");
ALTER TYPE "NotificationChannel" RENAME TO "NotificationChannel_old";
ALTER TYPE "NotificationChannel_new" RENAME TO "NotificationChannel";
DROP TYPE "NotificationChannel_old";
ALTER TABLE "reminders" ALTER COLUMN "channel" SET DEFAULT 'TELEGRAM';
ALTER TABLE "users" ALTER COLUMN "preferred_channel" SET DEFAULT 'TELEGRAM';
COMMIT;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "phone_whatsapp";

