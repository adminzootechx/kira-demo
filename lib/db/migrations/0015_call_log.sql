CREATE TABLE IF NOT EXISTS "call_log" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "customer_key" varchar(80) NOT NULL,
  "outcome" varchar(16) NOT NULL,
  "at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "customer_key")
);
