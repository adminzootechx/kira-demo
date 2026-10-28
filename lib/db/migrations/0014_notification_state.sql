CREATE TABLE IF NOT EXISTS "notification_state" (
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "notification_id" varchar(200) NOT NULL,
  "read" boolean DEFAULT false NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY ("user_id", "notification_id")
);
