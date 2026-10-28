ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "manager_id" integer REFERENCES "users"("id") ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS "approval_types" (
  "id" serial PRIMARY KEY,
  "name" varchar(80) NOT NULL UNIQUE,
  "needs_amount" boolean DEFAULT false NOT NULL,
  "needs_customer" boolean DEFAULT false NOT NULL,
  "active" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "approval_requests" (
  "id" serial PRIMARY KEY,
  "type_id" integer NOT NULL REFERENCES "approval_types"("id"),
  "requester_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "manager_id" integer NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "customer_key" varchar(80),
  "customer_name" text,
  "amount" double precision,
  "note" text NOT NULL,
  "status" varchar(12) DEFAULT 'waiting' NOT NULL,
  "decided_by" integer REFERENCES "users"("id") ON DELETE SET NULL,
  "decided_at" timestamp with time zone,
  "decision_note" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "approval_requests_requester_idx" ON "approval_requests" ("requester_id");
CREATE INDEX IF NOT EXISTS "approval_requests_manager_status_idx" ON "approval_requests" ("manager_id", "status");

INSERT INTO "approval_types" ("name") VALUES ('General request') ON CONFLICT ("name") DO NOTHING;

-- Existing access levels that already open My day also get the new Approvals page.
INSERT INTO "group_permissions" ("group_id", "permission_key", "label", "category", "enabled")
SELECT DISTINCT "group_id", 'nav.approvals', 'Approvals', 'page', true
FROM "group_permissions"
WHERE "permission_key" = 'nav.priorities' AND "enabled" = true
ON CONFLICT ("group_id", "permission_key") DO NOTHING;

-- Same for people who have their own page list instead of following their access level.
INSERT INTO "user_permissions" ("user_id", "permission_key", "label", "category", "enabled")
SELECT DISTINCT "user_id", 'nav.approvals', 'Approvals', 'page', true
FROM "user_permissions"
WHERE "permission_key" = 'nav.priorities' AND "enabled" = true
ON CONFLICT ("user_id", "permission_key") DO NOTHING;
