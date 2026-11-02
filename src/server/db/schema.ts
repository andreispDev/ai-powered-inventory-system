import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  customType,
  date,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const roleEnum = pgEnum("role", ["developer", "admin", "user"]);
export const userStatusEnum = pgEnum("user_status", ["invited", "active", "deactivated"]);
export const officeStatusEnum = pgEnum("office_status", ["active", "archived"]);
export const grantSubjectEnum = pgEnum("grant_subject", ["user", "office"]);
export const grantEffectEnum = pgEnum("grant_effect", ["allow", "deny"]);
export const itemStatusEnum = pgEnum("item_status", ["active", "in_repair", "retired", "lost"]);
export const movementTypeEnum = pgEnum("movement_type", ["receive", "issue", "adjust", "return", "transfer_out", "transfer_in"]);

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType: () => "bytea",
  fromDriver: (value) => Buffer.from(value),
});

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const office = pgTable("office", {
  id: uuid("id").primaryKey().defaultRandom(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  address: text("address"),
  contactEmail: text("contact_email"),
  status: officeStatusEnum("status").notNull().default("active"),
  ...timestamps,
});

export const appUser = pgTable(
  "app_user",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    role: roleEnum("role").notNull().default("user"),
    officeId: uuid("office_id").references(() => office.id),
    status: userStatusEnum("status").notNull().default("invited"),
    preferences: jsonb("preferences").$type<Record<string, unknown>>(),
    ...timestamps,
  },
  (t) => [
    index("app_user_office_idx").on(t.officeId),
    check(
      "app_user_role_office",
      sql`(${t.role} = 'developer' AND ${t.officeId} IS NULL) OR (${t.role} <> 'developer' AND ${t.officeId} IS NOT NULL)`,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    ...timestamps,
  },
  (t) => [index("session_user_idx").on(t.userId)],
);

export const account = pgTable(
  "account",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("account_provider_idx").on(t.providerId, t.accountId),
    uniqueIndex("account_user_provider_idx").on(t.userId, t.providerId),
  ],
);

export const verification = pgTable("verification", {
  id: uuid("id").primaryKey().defaultRandom(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  ...timestamps,
});

export const permissionGrant = pgTable(
  "permission_grant",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    subjectType: grantSubjectEnum("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => office.id),
    permission: text("permission").notNull(),
    effect: grantEffectEnum("effect").notNull(),
    reason: text("reason").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    grantedBy: uuid("granted_by")
      .notNull()
      .references(() => appUser.id),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("permission_grant_subject_idx").on(t.subjectType, t.subjectId, t.permission),
    index("permission_grant_office_idx").on(t.officeId),
  ],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    officeId: uuid("office_id").references(() => office.id),
    actorId: uuid("actor_id").references(() => appUser.id),
    actorRole: roleEnum("actor_role"),
    action: text("action").notNull(),
    entityType: text("entity_type"),
    entityId: text("entity_id"),
    before: jsonb("before"),
    after: jsonb("after"),
    requestId: text("request_id"),
    ip: text("ip"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_log_office_at_idx").on(t.officeId, t.at.desc()),
    index("audit_log_actor_at_idx").on(t.actorId, t.at.desc()),
  ],
);

export const outbox = pgTable(
  "outbox",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    officeId: uuid("office_id").references(() => office.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
  },
  (t) => [index("outbox_unpublished_idx").on(t.createdAt).where(sql`${t.publishedAt} IS NULL`)],
);

export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    key: text("key").notNull(),
    result: jsonb("result"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("idempotency_key_idx").on(t.userId, t.key)],
);

export const category = pgTable(
  "category",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => office.id),
    parentId: uuid("parent_id"),
    name: text("name").notNull(),
    description: text("description"),
    /** Standard item fields this category has turned off */
    disabledFields: text("disabled_fields").array().notNull().default(sql`'{}'::text[]`),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("category_office_id_uq").on(t.officeId, t.id),
    uniqueIndex("category_office_parent_name_idx").on(t.officeId, t.parentId, t.name),
    // A parent must belong to the same office.
    foreignKey({ columns: [t.officeId, t.parentId], foreignColumns: [t.officeId, t.id] }),
  ],
);

export const categoryField = pgTable(
  "category_field",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    /** Machine name inside item.attributes. Never changes, so labels can. */
    key: text("key").notNull(),
    label: text("label").notNull(),
    type: text("type").notNull(),
    config: jsonb("config").$type<Record<string, unknown>>().notNull().default({}),
    position: integer("position").notNull(),
    retiredAt: timestamp("retired_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("category_field_key_idx").on(t.categoryId, t.key),
    foreignKey({
      columns: [t.officeId, t.categoryId],
      foreignColumns: [category.officeId, category.id],
    }),
  ],
);

export const item = pgTable(
  "item",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id").notNull(),
    categoryId: uuid("category_id").notNull(),
    name: text("name").notNull(),
    sku: text("sku"),
    status: itemStatusEnum("status").notNull().default("active"),
    quantity: integer("quantity").notNull().default(0),
    unit: text("unit").notNull().default("pcs"),
    location: text("location"),
    condition: text("condition"),
    serialNumber: text("serial_number"),
    supplier: text("supplier"),
    unitCost: numeric("unit_cost", { precision: 14, scale: 2 }),
    purchaseDate: date("purchase_date"),
    warrantyExpiry: date("warranty_expiry"),
    notes: text("notes"),
    attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
    searchTsv: tsvector("search_tsv").generatedAlwaysAs(
      sql`to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(sku, '') || ' ' || coalesce(serial_number, '') || ' ' || coalesce(notes, ''))`,
    ),
    version: integer("version").notNull().default(1),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    unique("item_office_id_uq").on(t.officeId, t.id),
    uniqueIndex("item_office_sku_idx").on(t.officeId, t.sku).where(sql`${t.sku} IS NOT NULL AND ${t.deletedAt} IS NULL`),
    index("item_office_category_idx").on(t.officeId, t.categoryId),
    index("item_office_name_idx").on(t.officeId, t.name),
    index("item_search_idx").using("gin", t.searchTsv),
    index("item_attributes_idx").using("gin", sql`${t.attributes} jsonb_path_ops`),
    check("item_quantity_not_negative", sql`${t.quantity} >= 0`),
    foreignKey({
      columns: [t.officeId, t.categoryId],
      foreignColumns: [category.officeId, category.id],
    }),
  ],
);

export const stockMovement = pgTable(
  "stock_movement",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    officeId: uuid("office_id").notNull(),
    itemId: uuid("item_id").notNull(),
    type: movementTypeEnum("type").notNull(),
    delta: integer("delta").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    reason: text("reason").notNull(),
    actorId: uuid("actor_id")
      .notNull()
      .references(() => appUser.id),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("stock_movement_item_idx").on(t.officeId, t.itemId, t.occurredAt.desc()),
    foreignKey({ columns: [t.officeId, t.itemId], foreignColumns: [item.officeId, item.id] }),
  ],
);

/** The latest forecast for each item. Written only by the background worker. */
export const forecast = pgTable(
  "forecast",
  {
    itemId: uuid("item_id").primaryKey(),
    officeId: uuid("office_id").notNull(),
    state: text("state").notNull(),
    method: text("method"),
    weeklyDemand: doublePrecision("weekly_demand"),
    weeklyLow: doublePrecision("weekly_low"),
    weeklyHigh: doublePrecision("weekly_high"),
    stockoutAt: date("stockout_at"),
    stockoutEarliest: date("stockout_earliest"),
    stockoutLatest: date("stockout_latest"),
    reorderQuantity: integer("reorder_quantity"),
    reorderBy: date("reorder_by"),
    confidence: text("confidence").$type<"high" | "medium" | "low">(),
    backtestError: doublePrecision("backtest_error"),
    baselineError: doublePrecision("baseline_error"),
    reason: text("reason").notNull(),
    generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("forecast_office_stockout_idx").on(t.officeId, t.stockoutAt),
    foreignKey({ columns: [t.officeId, t.itemId], foreignColumns: [item.officeId, item.id] }),
  ],
);

export const transferStatusEnum = pgEnum("transfer_status", ["pending", "accepted", "rejected", "cancelled"]);

export const assignment = pgTable(
  "assignment",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id").notNull(),
    itemId: uuid("item_id").notNull(),
    assigneeId: uuid("assignee_id")
      .notNull()
      .references(() => appUser.id),
    assignedBy: uuid("assigned_by")
      .notNull()
      .references(() => appUser.id),
    since: date("since").notNull(),
    dueAt: date("due_at"),
    returnedAt: timestamp("returned_at", { withTimezone: true }),
    note: text("note"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("assignment_item_idx").on(t.officeId, t.itemId),
    index("assignment_open_idx").on(t.officeId, t.dueAt).where(sql`${t.returnedAt} IS NULL`),
    foreignKey({ columns: [t.officeId, t.itemId], foreignColumns: [item.officeId, item.id] }),
  ],
);

export const transfer = pgTable(
  "transfer",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    fromOfficeId: uuid("from_office_id")
      .notNull()
      .references(() => office.id),
    toOfficeId: uuid("to_office_id")
      .notNull()
      .references(() => office.id),
    // Copied here, so each office sees this transfer and nothing else about the other office.
    fromOfficeName: text("from_office_name").notNull(),
    toOfficeName: text("to_office_name").notNull(),
    itemId: uuid("item_id").notNull(),
    itemName: text("item_name").notNull(),
    itemSku: text("item_sku"),
    unit: text("unit").notNull(),
    quantity: integer("quantity").notNull(),
    status: transferStatusEnum("status").notNull().default("pending"),
    note: text("note"),
    requestedBy: uuid("requested_by")
      .notNull()
      .references(() => appUser.id),
    requestedByName: text("requested_by_name").notNull(),
    respondedByName: text("responded_by_name"),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("transfer_from_idx").on(t.fromOfficeId, t.createdAt.desc()),
    index("transfer_to_idx").on(t.toOfficeId, t.createdAt.desc()),
    check("transfer_quantity_positive", sql`${t.quantity} > 0`),
    check("transfer_two_offices", sql`${t.fromOfficeId} <> ${t.toOfficeId}`),
  ],
);

export const announcement = pgTable(
  "announcement",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** The sending office. Null when a Developer sends it. */
    officeId: uuid("office_id").references(() => office.id),
    audienceType: text("audience_type").notNull(),
    audienceOfficeIds: uuid("audience_office_ids").array(),
    audienceRole: roleEnum("audience_role"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    urgent: boolean("urgent").notNull().default(false),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdBy: uuid("created_by")
      .notNull()
      .references(() => appUser.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("announcement_due_idx").on(t.scheduledAt).where(sql`${t.sentAt} IS NULL`)],
);

export const notification = pgTable(
  "notification",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => appUser.id),
    kind: text("kind").notNull(),
    title: text("title").notNull(),
    body: text("body"),
    link: text("link"),
    urgent: boolean("urgent").notNull().default(false),
    announcementId: uuid("announcement_id").references(() => announcement.id),
    /** Stops the same event notifying someone twice */
    dedupeKey: text("dedupe_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    ackedAt: timestamp("acked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("notification_once_idx").on(t.userId, t.dedupeKey),
    index("notification_user_idx").on(t.userId, t.createdAt.desc()),
  ],
);

export const jobRun = pgTable(
  "job_run",
  {
    id: bigserial("id", { mode: "bigint" }).primaryKey(),
    queue: text("queue").notNull(),
    name: text("name").notNull(),
    status: text("status").notNull(),
    error: text("error"),
    durationMs: integer("duration_ms"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("job_run_at_idx").on(t.at.desc())],
);

export const auditCheckpoint = pgTable("audit_checkpoint", {
  upToId: bigint("up_to_id", { mode: "bigint" }).primaryKey(),
  hash: text("hash").notNull(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
});

export const requestStatusEnum = pgEnum("request_status", ["pending", "approved", "rejected"]);

export const permissionRequest = pgTable(
  "permission_request",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    officeId: uuid("office_id")
      .notNull()
      .references(() => office.id),
    requesterId: uuid("requester_id")
      .notNull()
      .references(() => appUser.id),
    permission: text("permission").notNull(),
    justification: text("justification").notNull(),
    status: requestStatusEnum("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => appUser.id),
    decisionNote: text("decision_note"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("permission_request_status_idx").on(t.status, t.createdAt.desc()),
    uniqueIndex("permission_request_one_pending_idx").on(t.requesterId, t.permission).where(sql`${t.status} = 'pending'`),
  ],
);

/** An office's own name and logo, which its admins manage. */
export const officeBranding = pgTable("office_branding", {
  officeId: uuid("office_id")
    .primaryKey()
    .references(() => office.id),
  workspaceName: text("workspace_name"),
  logo: bytea("logo"),
  logoType: text("logo_type"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const userAvatar = pgTable("user_avatar", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => appUser.id),
  officeId: uuid("office_id").references(() => office.id),
  image: bytea("image").notNull(),
  imageType: text("image_type").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});
