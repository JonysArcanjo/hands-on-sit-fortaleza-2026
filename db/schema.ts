import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const participants = sqliteTable("participants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [uniqueIndex("idx_participants_email").on(table.email)]);

export const workshops = sqliteTable("workshops", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  instructor: text("instructor").notNull(),
  startsAt: text("starts_at").notNull(),
  room: text("room").notNull(),
  capacity: integer("capacity").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [check("workshops_capacity_positive", sql`${table.capacity} > 0`)]);

export const registrations = sqliteTable("registrations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  participantId: integer("participant_id").notNull().references(() => participants.id, { onDelete: "restrict" }),
  workshopId: integer("workshop_id").notNull().references(() => workshops.id, { onDelete: "restrict" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => [
  uniqueIndex("idx_registrations_participant_id").on(table.participantId),
  uniqueIndex("idx_registrations_workshop_participant").on(table.workshopId, table.participantId),
]);
