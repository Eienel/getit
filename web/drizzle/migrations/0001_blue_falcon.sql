ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "eth_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_eth_address_unique" UNIQUE("eth_address");
