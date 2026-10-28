-- Hand-written, same reason as 0005: drizzle-kit generate needs an
-- interactive TTY not available here. Drop+recreate is safe again — this is
-- local dev seed data only (2 users, 2 roles, 13 permission rows), none of it
-- referenced by lot_rows/customer_rows/imports/snapshots, which are
-- untouched. Re-run `lib/db/seedAccess.ts` after this migration.
--
-- Splits the old `roles` (label + access rights in one row) into `roles`
-- (label only) and `groups` (isSystem/scopeOwnData/permissions — the actual
-- access-control unit), adds `group_roles` (which labels a group offers),
-- and adds per-user permission overrides via `users.group_id` +
-- `users.permission_mode` + `user_permissions`.

DROP TABLE IF EXISTS "user_preferences" CASCADE;
DROP TABLE IF EXISTS "role_permissions" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;
DROP TABLE IF EXISTS "roles" CASCADE;

CREATE TABLE "roles" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(32) NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_key_unique" UNIQUE("key")
);

CREATE TABLE "groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" varchar(32) NOT NULL,
	"label" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"scope_own_data" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "groups_key_unique" UNIQUE("key")
);

CREATE TABLE "group_roles" (
	"group_id" integer NOT NULL,
	"role_id" integer NOT NULL,
	CONSTRAINT "group_roles_group_role_idx" UNIQUE("group_id","role_id")
);

-- departments/markets already exist from 0005 and are untouched here.

CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"name" text NOT NULL,
	"role_id" integer NOT NULL,
	"group_id" integer NOT NULL,
	"permission_mode" varchar(16) DEFAULT 'inherit' NOT NULL,
	"department_id" integer,
	"market_id" integer,
	"owner_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE "group_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"group_id" integer NOT NULL,
	"permission_key" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"category" varchar(16) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "group_permissions_group_key_idx" UNIQUE("group_id","permission_key")
);

CREATE TABLE "user_permissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"permission_key" varchar(64) NOT NULL,
	"label" text NOT NULL,
	"category" varchar(16) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" integer,
	CONSTRAINT "user_permissions_user_key_idx" UNIQUE("user_id","permission_key")
);

CREATE TABLE "user_preferences" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"key" varchar(128) NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_preferences_user_key_idx" UNIQUE("user_id","key")
);

ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_roles" ADD CONSTRAINT "group_roles_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "roles"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "users" ADD CONSTRAINT "users_market_id_markets_id_fk" FOREIGN KEY ("market_id") REFERENCES "markets"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "group_permissions" ADD CONSTRAINT "group_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE cascade ON UPDATE no action;
