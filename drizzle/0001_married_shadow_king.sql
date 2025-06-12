ALTER TABLE "collections" DROP CONSTRAINT "collections_token_id_unique";--> statement-breakpoint
ALTER TABLE "collections" ADD COLUMN "guild_id" text NOT NULL;