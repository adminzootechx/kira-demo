import {
  type AnyPgColumn, boolean, date, doublePrecision, index, integer, jsonb, primaryKey, pgTable, real, serial, text, timestamp, uniqueIndex, varchar,
} from "drizzle-orm/pg-core";

/**
 * LUSTRE's persistence layer.
 *
 * The shape follows one rule: **raw imported rows are the source of truth, and
 * every score is a derived artefact that can be thrown away and rebuilt.** If
 * a model changes, we re-score from `customer_rows` rather than migrating
 * numbers we can no longer explain.
 *
 * Snapshots are what make trends possible. Each scoring run is stored whole,
 * so period-over-period movement is a query rather than an assumption.
 */

/* ------------------------------------------------------------------ */
/* Imports — one row per file ingested                                 */
/* ------------------------------------------------------------------ */

export const imports = pgTable(
  "imports",
  {
    id: serial("id").primaryKey(),
    fileName: text("file_name").notNull(),
    /** "csv" for an uploaded file, "sample" for the seeded demo book. */
    source: varchar("source", { length: 16 }).notNull().default("csv"),
    importedAt: timestamp("imported_at", { withTimezone: true }).notNull().defaultNow(),
    rowCount: integer("row_count").notNull(),
    /** Rows rejected for missing a name or a revenue figure. */
    skippedCount: integer("skipped_count").notNull().default(0),
    /** The column mapping used, kept so an import can be explained later. */
    columnMapping: jsonb("column_mapping").$type<Record<string, number>>(),
    /** Fields the file did not supply, which fell back to defaults. */
    assumedFields: jsonb("assumed_fields").$type<string[]>().default([]),
    /** Row-level problems, for auditing an import after the fact. */
    issues: jsonb("issues").$type<{ row: number; field: string; message: string }[]>().default([]),
    /** Exactly one import is active at a time; the app reads that one. */
    isActive: boolean("is_active").notNull().default(false),
    /** The real latest transaction date this import's data actually covers
     *  through (YYYY-MM-DD) — not the wall clock, not when the import ran.
     *  Null for imports that predate this column (CSV path, older syncs). */
    dataAsOf: varchar("data_as_of", { length: 16 }),
  },
  (t) => [index("imports_active_idx").on(t.isActive)],
);

/* ------------------------------------------------------------------ */
/* Customer rows — the imported facts, never scores                    */
/* ------------------------------------------------------------------ */

export const customerRows = pgTable(
  "customer_rows",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),

    /** Stable key within the import, used by the /customers/[id] routes. */
    customerKey: varchar("customer_key", { length: 128 }).notNull(),
    name: text("name").notNull(),
    country: text("country").notNull(),
    flag: varchar("flag", { length: 16 }),

    ytd: real("ytd").notNull(),
    lastYear: real("last_year").notNull(),
    carats: real("carats").notNull().default(0),
    stones: integer("stones").notNull().default(0),
    transactions: integer("transactions").notNull().default(1),
    avgTxn: real("avg_txn").notNull().default(0),

    firstPurchase: varchar("first_purchase", { length: 32 }),
    lastPurchase: varchar("last_purchase", { length: 32 }),
    daysSince: integer("days_since").notNull().default(0),
    cycleLower: integer("cycle_lower").notNull().default(14),
    cycleUpper: integer("cycle_upper").notNull().default(28),
    cycleType: varchar("cycle_type", { length: 24 }).notNull().default("Regular"),

    owner: text("owner"),
    broker: text("broker"),
    terms: varchar("terms", { length: 32 }),
    paymentScore: integer("payment_score").notNull().default(85),
    avgDiscount: real("avg_discount").notNull().default(0),
    estimatedCapacity: real("estimated_capacity").notNull().default(0),

    preferences: jsonb("preferences").$type<{
      shape: string; carat: string; colour: string; clarity: string; lab: string;
    }>(),
    crossSell: jsonb("cross_sell").$type<string[]>().default([]),
    action: text("action"),
  },
  (t) => [
    // Customer keys only have to be unique inside their own import.
    uniqueIndex("customer_rows_import_key_idx").on(t.importId, t.customerKey),
    index("customer_rows_import_idx").on(t.importId),
  ],
);

/* ------------------------------------------------------------------ */
/* Snapshots — one scoring run over one import                         */
/* ------------------------------------------------------------------ */

export const snapshots = pgTable(
  "snapshots",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    /** Bump when a formula changes, so old scores are never silently compared
     *  against new ones. */
    modelVersion: varchar("model_version", { length: 32 }).notNull(),
    /** The dataset's "as of" date, not the wall clock. */
    asOfDate: varchar("as_of_date", { length: 32 }).notNull(),

    /* Portfolio aggregates, stored flat so trends are a plain SQL query. */
    customerCount: integer("customer_count").notNull(),
    activeCount: integer("active_count").notNull(),
    atRiskCount: integer("at_risk_count").notNull(),
    atRiskValue: real("at_risk_value").notNull(),
    reordersDue: integer("reorders_due").notNull(),
    expansionAccounts: integer("expansion_accounts").notNull(),
    expansionValue: real("expansion_value").notNull(),
    totalRevenue: real("total_revenue").notNull(),
    medianHealth: real("median_health").notNull(),
    medianChurn: real("median_churn").notNull(),

    /** Segment counts, RFM grid and concentration, kept whole for replay. */
    segmentation: jsonb("segmentation").$type<unknown>(),
    concentration: jsonb("concentration").$type<unknown>(),
  },
  (t) => [index("snapshots_created_idx").on(t.createdAt)],
);

/* ------------------------------------------------------------------ */
/* Scores — the computed profile per customer, per snapshot            */
/* ------------------------------------------------------------------ */

export const customerScores = pgTable(
  "customer_scores",
  {
    id: serial("id").primaryKey(),
    snapshotId: integer("snapshot_id")
      .notNull()
      .references(() => snapshots.id, { onDelete: "cascade" }),
    customerKey: varchar("customer_key", { length: 128 }).notNull(),

    segment: varchar("segment", { length: 32 }).notNull(),
    health: integer("health").notNull(),
    churnRisk: integer("churn_risk").notNull(),
    rfmR: integer("rfm_r").notNull(),
    rfmF: integer("rfm_f").notNull(),
    rfmM: integer("rfm_m").notNull(),
    ltv: real("ltv").notNull(),
    riskAdjustedValue: real("risk_adjusted_value").notNull(),
    growth: real("growth").notNull(),
    walletShare: real("wallet_share").notNull(),
    priceSensitivity: varchar("price_sensitivity", { length: 16 }).notNull(),
    /** Evidence behind the scores, so a weak one is never read as a strong one. */
    evidenceScore: integer("evidence_score").notNull().default(0),
  },
  (t) => [
    uniqueIndex("customer_scores_snapshot_key_idx").on(t.snapshotId, t.customerKey),
    index("customer_scores_snapshot_idx").on(t.snapshotId),
    // Supports "who is at risk in the latest snapshot" without a full scan.
    index("customer_scores_churn_idx").on(t.snapshotId, t.churnRisk),
  ],
);

export type ImportRecord = typeof imports.$inferSelect;
export type CustomerRow = typeof customerRows.$inferSelect;
export type NewCustomerRow = typeof customerRows.$inferInsert;
export type Snapshot = typeof snapshots.$inferSelect;
export type CustomerScore = typeof customerScores.$inferSelect;

/* ------------------------------------------------------------------ */
/* Lot rows — the transaction grain, one row per stone sold            */
/* ------------------------------------------------------------------ */

/**
 * The export LUSTRE actually sends is lot-grain: one row per stone, carrying the
 * specification, the realised price, the stock location and both the stock-in
 * and sale dates. Rolling that up to one row per customer at import time threw
 * away every dimension except the customer, which left product, pricing,
 * salesperson and inventory intelligence with nothing to read.
 *
 * These are facts, exactly like `customer_rows` — no score is stored here. The
 * dimension rollups every engine reads are SQL over this table, so a new
 * analytic never needs a re-import.
 *
 * Stone geometry (table %, depth, crown/pavilion angles, measurements) is
 * deliberately not carried: it describes the stone, not the commerce, and
 * nothing in the SOW reads it.
 */
export const lotRows = pgTable(
  "lot_rows",
  {
    id: serial("id").primaryKey(),
    importId: integer("import_id")
      .notNull()
      .references(() => imports.id, { onDelete: "cascade" }),

    /** Joins a lot to its scored account in `customer_rows`. */
    customerKey: varchar("customer_key", { length: 128 }).notNull(),
    customerName: text("customer_name").notNull(),

    /* Product specification */
    shape: varchar("shape", { length: 16 }),
    carats: real("carats").notNull().default(0),
    caratBand: varchar("carat_band", { length: 16 }),
    colour: varchar("colour", { length: 16 }),
    clarity: varchar("clarity", { length: 16 }),
    cut: varchar("cut", { length: 16 }),
    polish: varchar("polish", { length: 16 }),
    symmetry: varchar("symmetry", { length: 16 }),
    fluorescence: varchar("fluorescence", { length: 16 }),
    lab: varchar("lab", { length: 16 }),

    /* Commercial */
    rap: real("rap").notNull().default(0),
    /** Null where the export recorded no discount — ~200k rows of the 2026
     *  file. Averaged as zero it would pull every discount rollup toward a
     *  figure no transaction carried, so it is stored as unknown. */
    discPercent: real("disc_percent"),
    price: real("price").notNull().default(0),
    amount: real("amount").notNull().default(0),
    soldRate: real("sold_rate").notNull().default(0),
    listPrice: real("list_price").notNull().default(0),
    finalDiscPercent: real("final_disc_percent").notNull().default(0),
    /** Cost fields are carried but unvalidated — see docs/sow-data-map.md. */
    costAmount: real("cost_amount").notNull().default(0),
    costPrice: real("cost_price").notNull().default(0),

    /* Dimensions */
    location: varchar("location", { length: 32 }),
    country: text("country"),
    owner: text("owner"),
    broker: text("broker"),
    terms: varchar("terms", { length: 48 }),

    /* Time — `saleDate - tranDate` is days in stock, the basis of 5.3 */
    tranDate: varchar("tran_date", { length: 16 }),
    saleDate: varchar("sale_date", { length: 16 }),
    daysInStock: integer("days_in_stock"),

    orderNo: varchar("order_no", { length: 48 }),
  },
  (t) => [
    index("lot_rows_import_idx").on(t.importId),
    index("lot_rows_customer_idx").on(t.importId, t.customerKey),
    index("lot_rows_spec_idx").on(t.importId, t.shape, t.caratBand, t.colour, t.clarity),
    index("lot_rows_owner_idx").on(t.importId, t.owner),
    index("lot_rows_sale_idx").on(t.importId, t.saleDate),
  ],
);

/* ------------------------------------------------------------------ */
/* LUSTRE API sync state — one row per tracked date window               */
/* ------------------------------------------------------------------ */

/**
 * The Trade Data API has no webhook or change feed — `TotalCount` for a
 * date range is the only freshness signal it exposes. This table remembers
 * the last `TotalCount` seen per window so a cheap 1-row check can tell
 * "nothing changed" from "new data landed" without re-pulling everything.
 */
export const tradeapiSyncState = pgTable("tradeapi_sync_state", {
  id: serial("id").primaryKey(),
  fromDate: varchar("from_date", { length: 16 }).notNull(),
  toDate: varchar("to_date", { length: 16 }).notNull(),
  lastTotalCount: integer("last_total_count").notNull().default(0),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  lastImportId: integer("last_import_id").references(() => imports.id, { onDelete: "set null" }),
}, (t) => [uniqueIndex("tradeapi_sync_state_window_idx").on(t.fromDate, t.toDate)]);

/* ------------------------------------------------------------------ */
/* Users, permissions, and per-user preferences                       */
/* ------------------------------------------------------------------ */

/**
 * A role is now a plain designation — a job title shown next to a user's
 * name ("Sales Rep", "Senior Sales Rep") — and carries no access rights of
 * its own. Access is entirely a `groups` concern; see below.
 */
export const roles = pgTable("roles", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Groups are the actual access-control unit — everything `roles` used to
 * carry (`isSystem`, `scopeOwnData`, the page-permission matrix) lives here
 * instead. "Management" is seeded as the one `isSystem` group: it bypasses
 * `group_permissions` entirely (always full access) and can't be deleted, so
 * there's always at least one way in that can't be locked out by a
 * permissions mistake.
 */
export const groups = pgTable("groups", {
  id: serial("id").primaryKey(),
  key: varchar("key", { length: 32 }).notNull().unique(),
  label: text("label").notNull(),
  isSystem: boolean("is_system").notNull().default(false),
  /** True: users in this group see only their own book, filtered by
   *  `ownerName`. False: unrestricted, sees the whole org (like management). */
  scopeOwnData: boolean("scope_own_data").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Which role designations are offered when assigning a user to a group —
 *  e.g. the "Sales" group might offer "Sales Rep" and "Senior Sales Rep". */
export const groupRoles = pgTable("group_roles", {
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  roleId: integer("role_id").notNull().references(() => roles.id, { onDelete: "cascade" }),
}, (t) => [uniqueIndex("group_roles_group_role_idx").on(t.groupId, t.roleId)]);

export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const markets = pgTable("markets", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  /** The user's designation — display only, never checked for access. */
  roleId: integer("role_id").notNull().references(() => roles.id),
  /** The user's access-control group — isSystem/scopeOwnData/permissions
   *  all come from here (unless permissionMode is "manual"). */
  groupId: integer("group_id").notNull().references(() => groups.id),
  /** "inherit": access follows `groupId`'s group_permissions (the normal
   *  case). "manual": access follows this user's own `user_permissions` rows
   *  instead — a full, independent matrix, not a partial override layered on
   *  top of the group. isSystem/scopeOwnData always come from the group
   *  either way; they are never part of a per-user override. */
  permissionMode: varchar("permission_mode", { length: 16 }).notNull().default("inherit"),
  departmentId: integer("department_id").references(() => departments.id, { onDelete: "set null" }),
  marketId: integer("market_id").references(() => markets.id, { onDelete: "set null" }),
  /** For scopeOwnData groups: must match the `owner` string on
   *  lot_rows/customer_rows, so their view is scoped to their own book. */
  ownerName: text("owner_name"),
  /** Who this person sends approval requests to. Null = nobody yet. */
  managerId: integer("manager_id").references((): AnyPgColumn => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const groupPermissions = pgTable("group_permissions", {
  id: serial("id").primaryKey(),
  groupId: integer("group_id").notNull().references(() => groups.id, { onDelete: "cascade" }),
  /** e.g. "nav.pricing", "field.margin" — internal only, never shown to users. */
  permissionKey: varchar("permission_key", { length: 64 }).notNull(),
  /** Plain-language label shown in the settings UI. */
  label: text("label").notNull(),
  /** "page" | "field" */
  category: varchar("category", { length: 16 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (t) => [uniqueIndex("group_permissions_group_key_idx").on(t.groupId, t.permissionKey)]);

/** Same shape as `group_permissions`, keyed by user instead of group — only
 *  consulted when that user's `permissionMode` is "manual". */
export const userPermissions = pgTable("user_permissions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  permissionKey: varchar("permission_key", { length: 64 }).notNull(),
  label: text("label").notNull(),
  category: varchar("category", { length: 16 }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  updatedBy: integer("updated_by").references(() => users.id),
}, (t) => [uniqueIndex("user_permissions_user_key_idx").on(t.userId, t.permissionKey)]);

export const userPreferences = pgTable(
  "user_preferences",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    /** e.g. "command-centre.revenue-card.period" */
    key: varchar("key", { length: 128 }).notNull(),
    value: jsonb("value").notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("user_preferences_user_key_idx").on(t.userId, t.key)],
);

/* ------------------------------------------------------------------ */
/* Book state — what lets the book be topped up instead of rebuilt     */
/* ------------------------------------------------------------------ */

/**
 * One row (id = 1): the per-customer running totals behind the active book,
 * the date they cover through, and when freshness was last checked. Saved by
 * the full Excel import and by every auto-sync, so a sync only has to fetch
 * the days after `as_of` and fold them in.
 */
export const bookState = pgTable("book_state", {
  id: integer("id").primaryKey(),
  asOf: varchar("as_of", { length: 16 }).notNull(),
  state: jsonb("state").notNull(),
  importId: integer("import_id").references(() => imports.id, { onDelete: "set null" }),
  lastCheckedAt: timestamp("last_checked_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Sales targets and monthly sales per salesperson                     */
/* ------------------------------------------------------------------ */

/** Yearly sales target set by an admin. `owner` is a salesperson's name as it
 *  appears in the sales data, or '' for the whole company. */
export const targets = pgTable("targets", {
  year: integer("year").notNull(),
  owner: varchar("owner", { length: 200 }).notNull().default(""),
  amount: doublePrecision("amount").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.year, t.owner] })]);

/** Real sales per salesperson per month ('YYYY-MM'). Rebuilt by the Excel
 *  import and topped up by every auto-sync; what targets are measured against. */
export const ownerMonthly = pgTable("owner_monthly", {
  owner: varchar("owner", { length: 200 }).notNull(),
  month: varchar("month", { length: 7 }).notNull(),
  revenue: doublePrecision("revenue").notNull(),
}, (t) => [primaryKey({ columns: [t.owner, t.month] })]);

/* ------------------------------------------------------------------ */
/* Client → salesperson assignments                                    */
/* ------------------------------------------------------------------ */

/** An admin's choice of who handles a client. Wins over the salesperson
 *  named in the sales data, and survives every import and sync. */
export const clientAssignments = pgTable("client_assignments", {
  clientKey: varchar("client_key", { length: 80 }).primaryKey(),
  owner: varchar("owner", { length: 200 }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/* ------------------------------------------------------------------ */
/* Rollups — the real sales stream, pre-aggregated                     */
/* ------------------------------------------------------------------ */

/**
 * Sales summed by period and one dimension (country, owner, specification…).
 * Daily periods ('YYYY-MM-DD') for the dimensions that need exact windows,
 * monthly ('YYYY-MM') for the high-cardinality ones. Built from the Excel
 * stream by the full import and topped up by every auto-sync, so Stock, Prices,
 * Team and Home read real figures without the 1.3M raw rows being stored.
 * Every measure is a plain sum, so any window is just a sum of periods.
 */
export const rollups = pgTable("rollups", {
  period: varchar("period", { length: 10 }).notNull(),
  dim: varchar("dim", { length: 24 }).notNull(),
  value: varchar("value", { length: 200 }).notNull(),
  revenue: doublePrecision("revenue").notNull().default(0),
  carats: doublePrecision("carats").notNull().default(0),
  stones: integer("stones").notNull().default(0),
  orders: integer("orders").notNull().default(0),
  discSum: doublePrecision("disc_sum").notNull().default(0),
  discN: integer("disc_n").notNull().default(0),
  stockSum: doublePrecision("stock_sum").notNull().default(0),
  stockN: integer("stock_n").notNull().default(0),
  rapVal: doublePrecision("rap_val").notNull().default(0),
  rapAmt: doublePrecision("rap_amt").notNull().default(0),
  listVal: doublePrecision("list_val").notNull().default(0),
  listAmt: doublePrecision("list_amt").notNull().default(0),
}, (t) => [primaryKey({ columns: [t.period, t.dim, t.value] }), index("rollups_dim_idx").on(t.dim, t.period)]);

/* ------------------------------------------------------------------ */
/* External companies (new-buyer prospects and scraper opportunities)  */
/* ------------------------------------------------------------------ */

/** One row per company, so a company can belong to only one salesperson.
 *  `owner` is that salesperson's name; null means nobody has claimed it yet.
 *  `data` holds whatever the external scraper reports about the company. */
export const externalCompanies = pgTable("external_companies", {
  companyKey: varchar("company_key", { length: 120 }).primaryKey(),
  name: varchar("name", { length: 300 }).notNull(),
  country: varchar("country", { length: 100 }),
  owner: varchar("owner", { length: 200 }),
  data: jsonb("data"),
  addedBy: varchar("added_by", { length: 200 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("external_companies_owner_idx").on(t.owner)]);

/* Customer order history: one row per order. Stone-level detail is fetched
 * from the API when an order is opened. */
export const customerOrders = pgTable("customer_orders", {
  customerKey: varchar("customer_key", { length: 80 }).notNull(),
  orderNo: varchar("order_no", { length: 64 }).notNull(),
  customerName: text("customer_name").notNull(),
  saleDate: varchar("sale_date", { length: 10 }).notNull(),
  stones: integer("stones").notNull().default(0),
  carats: doublePrecision("carats").notNull().default(0),
  amount: doublePrecision("amount").notNull().default(0),
  discSum: doublePrecision("disc_sum").notNull().default(0),
  discN: integer("disc_n").notNull().default(0),
  owner: text("owner"),
  location: varchar("location", { length: 32 }),
  terms: varchar("terms", { length: 48 }),
}, (t) => [primaryKey({ columns: [t.customerKey, t.orderNo] }), index("customer_orders_date_idx").on(t.customerKey, t.saleDate)]);

/* Which bell notifications each user has seen (opened the bell while it was
 * listed) and read (opened it or marked it read). Ids name the event, not
 * just the customer, so a new order or a change of status is a new alert. */
export const notificationState = pgTable("notification_state", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  notificationId: varchar("notification_id", { length: 200 }).notNull(),
  read: boolean("read").notNull().default(false),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.notificationId] })]);

/* What each user last did about a customer on My day: "called" or "skipped"
 * (not today). One row per user and customer; the latest action wins. */
export const callLog = pgTable("call_log", {
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerKey: varchar("customer_key", { length: 80 }).notNull(),
  outcome: varchar("outcome", { length: 16 }).notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.userId, t.customerKey] })]);

/* What a salesperson can ask their manager to approve. Types are never
 * deleted (old requests point at them); turning one off hides it from new
 * requests. */
export const approvalTypes = pgTable("approval_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 80 }).notNull().unique(),
  needsAmount: boolean("needs_amount").notNull().default(false),
  needsCustomer: boolean("needs_customer").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

/* One request from a salesperson to their manager. `managerId` is who it was
 * sent to at that moment; moving the salesperson to another manager later does
 * not rewrite old requests. Once decided, the decision fields are never edited. */
export const approvalRequests = pgTable("approval_requests", {
  id: serial("id").primaryKey(),
  typeId: integer("type_id").notNull().references(() => approvalTypes.id),
  requesterId: integer("requester_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  managerId: integer("manager_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  customerKey: varchar("customer_key", { length: 80 }),
  customerName: text("customer_name"),
  amount: doublePrecision("amount"),
  note: text("note").notNull(),
  /** "waiting" | "approved" | "declined" | "cancelled" */
  status: varchar("status", { length: 12 }).notNull().default("waiting"),
  decidedBy: integer("decided_by").references(() => users.id, { onDelete: "set null" }),
  decidedAt: timestamp("decided_at", { withTimezone: true }),
  decisionNote: text("decision_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index("approval_requests_requester_idx").on(t.requesterId),
  index("approval_requests_manager_status_idx").on(t.managerId, t.status),
]);

/* Free-text notes about why a customer is behaving the way they are. Anyone who
 * can see the customer can read them. A note may also pause that customer's
 * alerts until a date; deleting the note ends the pause. */
export const customerNotes = pgTable("customer_notes", {
  id: serial("id").primaryKey(),
  customerKey: varchar("customer_key", { length: 80 }).notNull(),
  authorId: integer("author_id").references(() => users.id, { onDelete: "set null" }),
  body: text("body").notNull(),
  pauseUntil: date("pause_until", { mode: "string" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("customer_notes_customer_idx").on(t.customerKey, t.createdAt)]);

/* A salesperson's own to-do items on My day. Private to the person who wrote them. */
export const userTasks = pgTable("user_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("user_tasks_user_idx").on(t.userId, t.createdAt)]);
