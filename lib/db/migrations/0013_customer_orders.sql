CREATE TABLE IF NOT EXISTS "customer_orders" (
  "customer_key" varchar(80) NOT NULL,
  "order_no" varchar(64) NOT NULL,
  "customer_name" text NOT NULL,
  "sale_date" varchar(10) NOT NULL,
  "stones" integer DEFAULT 0 NOT NULL,
  "carats" double precision DEFAULT 0 NOT NULL,
  "amount" double precision DEFAULT 0 NOT NULL,
  "disc_sum" double precision DEFAULT 0 NOT NULL,
  "disc_n" integer DEFAULT 0 NOT NULL,
  "owner" text,
  "location" varchar(32),
  "terms" varchar(48),
  PRIMARY KEY ("customer_key", "order_no")
);
CREATE INDEX IF NOT EXISTS "customer_orders_date_idx" ON "customer_orders" ("customer_key", "sale_date");
