import {
  boolean,
  doublePrecision,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  location: text("location"),
  owner: text("owner"),
  wallSystem: text("wall_system").notNull(),
  roofType: text("roof_type").notNull(),
  status: text("status").notNull().default("diseno"),
  notes: text("notes"),
  terrainAccess: text("terrain_access"),
  terrainSlope: text("terrain_slope"),
  waterDistanceM: doublePrecision("water_distance_m"),
  canStay: boolean("can_stay"),
  canCook: boolean("can_cook"),
  numPeople: integer("num_people"),
  targetMonths: doublePrecision("target_months"),
  referenceLinks: jsonb("reference_links").$type<string[]>(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
