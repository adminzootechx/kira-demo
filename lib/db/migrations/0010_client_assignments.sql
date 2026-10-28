CREATE TABLE IF NOT EXISTS "client_assignments" (
  "client_key" varchar(80) PRIMARY KEY NOT NULL,
  "owner" varchar(200) NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
