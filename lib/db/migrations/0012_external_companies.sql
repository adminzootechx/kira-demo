CREATE TABLE IF NOT EXISTS "external_companies" (
  "company_key" varchar(120) PRIMARY KEY NOT NULL,
  "name" varchar(300) NOT NULL,
  "country" varchar(100),
  "owner" varchar(200),
  "data" jsonb,
  "added_by" varchar(200),
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "external_companies_owner_idx" ON "external_companies" ("owner");
