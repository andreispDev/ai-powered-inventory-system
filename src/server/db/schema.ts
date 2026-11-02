import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  customType,
  date,
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
export const movementTypeEnum = pgEnum("movement_type", ["receive", "issue", "adjust", "return"]);

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
    reorderLevel: integer("reorder_level"),
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
