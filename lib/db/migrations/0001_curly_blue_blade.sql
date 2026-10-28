CREATE TABLE "lot_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"customer_key" varchar(128) NOT NULL,
	"customer_name" text NOT NULL,
	"shape" varchar(16),
	"carats" real DEFAULT 0 NOT NULL,
	"carat_band" varchar(16),
	"colour" varchar(16),
	"clarity" varchar(16),
	"cut" varchar(16),
	"polish" varchar(16),
	"symmetry" varchar(16),
	"fluorescence" varchar(16),
	"lab" varchar(16),
	"rap" real DEFAULT 0 NOT NULL,
	"disc_percent" real DEFAULT 0 NOT NULL,
	"price" real DEFAULT 0 NOT NULL,
	"amount" real DEFAULT 0 NOT NULL,
	"sold_rate" real DEFAULT 0 NOT NULL,
	"list_price" real DEFAULT 0 NOT NULL,
	"final_disc_percent" real DEFAULT 0 NOT NULL,
	"cost_amount" real DEFAULT 0 NOT NULL,
	"cost_price" real DEFAULT 0 NOT NULL,
	"location" varchar(32),
	"country" text,
	"owner" text,
	"broker" text,
	"terms" varchar(48),
	"tran_date" varchar(16),
	"sale_date" varchar(16),
	"days_in_stock" integer,
	"order_no" varchar(48)
);
--> statement-breakpoint
ALTER TABLE "lot_rows" ADD CONSTRAINT "lot_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lot_rows_import_idx" ON "lot_rows" USING btree ("import_id");--> statement-breakpoint
CREATE INDEX "lot_rows_customer_idx" ON "lot_rows" USING btree ("import_id","customer_key");--> statement-breakpoint
CREATE INDEX "lot_rows_spec_idx" ON "lot_rows" USING btree ("import_id","shape","carat_band","colour","clarity");--> statement-breakpoint
CREATE INDEX "lot_rows_owner_idx" ON "lot_rows" USING btree ("import_id","owner");--> statement-breakpoint
CREATE INDEX "lot_rows_sale_idx" ON "lot_rows" USING btree ("import_id","sale_date");