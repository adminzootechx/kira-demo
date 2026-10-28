CREATE TABLE IF NOT EXISTS "targets" (
  "year" integer NOT NULL,
  "owner" varchar(200) DEFAULT '' NOT NULL,
  "amount" double precision NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("year", "owner")
);
CREATE TABLE IF NOT EXISTS "owner_monthly" (
  "owner" varchar(200) NOT NULL,
  "month" varchar(7) NOT NULL,
  "revenue" double precision NOT NULL,
  PRIMARY KEY ("owner", "month")
);
