CREATE TABLE IF NOT EXISTS "bequests" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"title" text,
	"beneficiary_address" text NOT NULL,
	"asset_symbol" text NOT NULL,
	"asset_chain" text NOT NULL,
	"amount_decimal" text NOT NULL,
	"checkin_window_seconds" integer NOT NULL,
	"wallet_address" text NOT NULL,
	"wallet_key_ciphertext" text NOT NULL,
	"wallet_key_nonce" text NOT NULL,
	"policy_json" text,
	"agent_token_ciphertext" text,
	"agent_token_nonce" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"last_ping_at" timestamp with time zone,
	"armed_at" timestamp with time zone,
	"triggered_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"txn_hash" text,
	"failure_reason" text,
	CONSTRAINT "bequests_wallet_address_unique" UNIQUE("wallet_address")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "magic_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "magic_links_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "nudges" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bequest_id" text NOT NULL,
	"kind" text NOT NULL,
	"ping_cycle_at" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ping_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bequest_id" text NOT NULL,
	"source" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "telegram_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	CONSTRAINT "telegram_links_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"telegram_chat_id" text,
	"owner_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "bequests" ADD CONSTRAINT "bequests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "nudges" ADD CONSTRAINT "nudges_bequest_id_bequests_id_fk" FOREIGN KEY ("bequest_id") REFERENCES "public"."bequests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "ping_logs" ADD CONSTRAINT "ping_logs_bequest_id_bequests_id_fk" FOREIGN KEY ("bequest_id") REFERENCES "public"."bequests"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bequest_user_idx" ON "bequests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "bequest_status_idx" ON "bequests" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "nudge_dedupe_idx" ON "nudges" USING btree ("bequest_id","kind","ping_cycle_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "ping_log_bequest_idx" ON "ping_logs" USING btree ("bequest_id");