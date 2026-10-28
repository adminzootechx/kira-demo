CREATE TABLE "tradeapi_sync_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"from_date" varchar(16) NOT NULL,
	"to_date" varchar(16) NOT NULL,
	"last_total_count" integer DEFAULT 0 NOT NULL,
	"last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_import_id" integer
);
--> statement-breakpoint
ALTER TABLE "tradeapi_sync_state" ADD CONSTRAINT "tradeapi_sync_state_last_import_id_imports_id_fk" FOREIGN KEY ("last_import_id") REFERENCES "public"."imports"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tradeapi_sync_state_window_idx" ON "tradeapi_sync_state" USING btree ("from_date","to_date");