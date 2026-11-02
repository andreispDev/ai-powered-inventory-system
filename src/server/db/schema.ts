import { sql } from "drizzle-orm";
import {
  bigserial,
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
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
    role: roleEnum("role").notNull(),
    officeId: uuid("office_id").references(() => office.id),
    status: userStatusEnum("status").notNull().default("invited"),
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
    /** Google's permanent user ID (sub) */
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
    // One Google identity per person, so a reassigned email can't add a second one.
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
