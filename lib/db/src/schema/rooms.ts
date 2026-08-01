import {
  doublePrecision,
  integer,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kind: text("kind").notNull(),
  widthM: doublePrecision("width_m").notNull(),
  lengthM: doublePrecision("length_m").notNull(),
  heightM: doublePrecision("height_m").notNull(),
  posX: doublePrecision("pos_x"),
  posY: doublePrecision("pos_y"),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({
  id: true,
});
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
