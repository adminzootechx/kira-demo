CREATE TABLE IF NOT EXISTS "customer_notes" (
  "id" serial PRIMARY KEY,
  "customer_key" varchar(80) NOT NULL,
  "author_id" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "body" text NOT NULL,
  "pause_until" date,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "customer_notes_customer_idx" ON "customer_notes" ("customer_key", "created_at");
