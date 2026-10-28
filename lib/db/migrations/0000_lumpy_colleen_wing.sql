CREATE TABLE "customer_rows" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"customer_key" varchar(128) NOT NULL,
	"name" text NOT NULL,
	"country" text NOT NULL,
	"flag" varchar(16),
	"ytd" real NOT NULL,
	"last_year" real NOT NULL,
	"carats" real DEFAULT 0 NOT NULL,
	"stones" integer DEFAULT 0 NOT NULL,
	"transactions" integer DEFAULT 1 NOT NULL,
	"avg_txn" real DEFAULT 0 NOT NULL,
	"first_purchase" varchar(32),
	"last_purchase" varchar(32),
	"days_since" integer DEFAULT 0 NOT NULL,
	"cycle_lower" integer DEFAULT 14 NOT NULL,
	"cycle_upper" integer DEFAULT 28 NOT NULL,
	"cycle_type" varchar(24) DEFAULT 'Regular' NOT NULL,
	"owner" text,
	"broker" text,
	"terms" varchar(32),
	"payment_score" integer DEFAULT 85 NOT NULL,
	"avg_discount" real DEFAULT 0 NOT NULL,
	"estimated_capacity" real DEFAULT 0 NOT NULL,
	"preferences" jsonb,
	"cross_sell" jsonb DEFAULT '[]'::jsonb,
	"action" text
);
--> statement-breakpoint
CREATE TABLE "customer_scores" (
	"id" serial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"customer_key" varchar(128) NOT NULL,
	"segment" varchar(32) NOT NULL,
	"health" integer NOT NULL,
	"churn_risk" integer NOT NULL,
	"rfm_r" integer NOT NULL,
	"rfm_f" integer NOT NULL,
	"rfm_m" integer NOT NULL,
	"ltv" real NOT NULL,
	"risk_adjusted_value" real NOT NULL,
	"growth" real NOT NULL,
	"wallet_share" real NOT NULL,
	"price_sensitivity" varchar(16) NOT NULL,
	"evidence_score" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "imports" (
	"id" serial PRIMARY KEY NOT NULL,
	"file_name" text NOT NULL,
	"source" varchar(16) DEFAULT 'csv' NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"row_count" integer NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"column_mapping" jsonb,
	"assumed_fields" jsonb DEFAULT '[]'::jsonb,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"import_id" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"model_version" varchar(32) NOT NULL,
	"as_of_date" varchar(32) NOT NULL,
	"customer_count" integer NOT NULL,
	"active_count" integer NOT NULL,
	"at_risk_count" integer NOT NULL,
	"at_risk_value" real NOT NULL,
	"reorders_due" integer NOT NULL,
	"expansion_accounts" integer NOT NULL,
	"expansion_value" real NOT NULL,
	"total_revenue" real NOT NULL,
	"median_health" real NOT NULL,
	"median_churn" real NOT NULL,
	"segmentation" jsonb,
	"concentration" jsonb
);
--> statement-breakpoint
ALTER TABLE "customer_rows" ADD CONSTRAINT "customer_rows_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_scores" ADD CONSTRAINT "customer_scores_snapshot_id_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshots" ADD CONSTRAINT "snapshots_import_id_imports_id_fk" FOREIGN KEY ("import_id") REFERENCES "public"."imports"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_rows_import_key_idx" ON "customer_rows" USING btree ("import_id","customer_key");--> statement-breakpoint
CREATE INDEX "customer_rows_import_idx" ON "customer_rows" USING btree ("import_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_scores_snapshot_key_idx" ON "customer_scores" USING btree ("snapshot_id","customer_key");--> statement-breakpoint
CREATE INDEX "customer_scores_snapshot_idx" ON "customer_scores" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "customer_scores_churn_idx" ON "customer_scores" USING btree ("snapshot_id","churn_risk");--> statement-breakpoint
CREATE INDEX "imports_active_idx" ON "imports" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "snapshots_created_idx" ON "snapshots" USING btree ("created_at");