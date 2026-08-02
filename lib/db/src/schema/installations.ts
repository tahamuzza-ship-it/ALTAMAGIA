import {
  integer,
  jsonb,
  pgTable,
  serial,
  text,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { projectsTable } from "./projects";

/**
 * Elementos de instalaciones técnicas dibujados sobre el plano 2D.
 * - layer: "electrica" | "agua"
 * - kind: símbolo puntual (toma, interruptor, lampara, tablero, llave,
 *   ducha, desague, tanque) o recorrido (cable, tuberia, desague_tubo)
 * - points: [{x, y}] en metros; 1 punto para símbolos, 2+ para recorridos
 */
export const installationsTable = pgTable("installations", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id")
    .notNull()
    .references(() => projectsTable.id, { onDelete: "cascade" }),
  floor: integer("floor").notNull().default(1),
  layer: text("layer").notNull(),
  kind: text("kind").notNull(),
  points: jsonb("points").notNull().$type<{ x: number; y: number }[]>(),
});

export const insertInstallationSchema = createInsertSchema(
  installationsTable,
).omit({ id: true });
export type InsertInstallation = z.infer<typeof insertInstallationSchema>;
export type Installation = typeof installationsTable.$inferSelect;
