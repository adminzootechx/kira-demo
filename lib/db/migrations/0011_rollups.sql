CREATE TABLE IF NOT EXISTS "rollups" (
  "period" varchar(10) NOT NULL,
  "dim" varchar(24) NOT NULL,
  "value" varchar(200) NOT NULL,
  "revenue" double precision DEFAULT 0 NOT NULL,
  "carats" double precision DEFAULT 0 NOT NULL,
  "stones" integer DEFAULT 0 NOT NULL,
  "orders" integer DEFAULT 0 NOT NULL,
  "disc_sum" double precision DEFAULT 0 NOT NULL,
  "disc_n" integer DEFAULT 0 NOT NULL,
  "stock_sum" double precision DEFAULT 0 NOT NULL,
  "stock_n" integer DEFAULT 0 NOT NULL,
  "rap_val" double precision DEFAULT 0 NOT NULL,
  "rap_amt" double precision DEFAULT 0 NOT NULL,
  "list_val" double precision DEFAULT 0 NOT NULL,
  "list_amt" double precision DEFAULT 0 NOT NULL,
  PRIMARY KEY ("period", "dim", "value")
);
CREATE INDEX IF NOT EXISTS "rollups_dim_idx" ON "rollups" ("dim", "period");
