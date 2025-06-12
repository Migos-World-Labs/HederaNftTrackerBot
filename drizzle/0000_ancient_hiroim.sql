CREATE TABLE "collections" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "collections_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token_id" text NOT NULL,
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"added_date" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "collections_token_id_unique" UNIQUE("token_id")
);
--> statement-breakpoint
CREATE TABLE "server_configs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "server_configs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"guild_id" text NOT NULL,
	"channel_id" text NOT NULL,
	"guild_name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"added_date" timestamp DEFAULT now() NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "server_configs_guild_id_unique" UNIQUE("guild_id")
);
--> statement-breakpoint
CREATE TABLE "bot_state" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bot_state_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"key" text NOT NULL,
	"value" jsonb,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "bot_state_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "processed_sales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "processed_sales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"sale_id" text NOT NULL,
	"token_id" text NOT NULL,
	"processed_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "processed_sales_sale_id_unique" UNIQUE("sale_id")
);
