CREATE TABLE IF NOT EXISTS "book_state" (
  "id" integer PRIMARY KEY NOT NULL,
  "as_of" varchar(16) NOT NULL,
  "state" jsonb NOT NULL,
  "import_id" integer REFERENCES "imports"("id") ON DELETE SET NULL,
  "last_checked_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
