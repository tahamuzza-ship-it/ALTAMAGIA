import type { Room } from "@workspace/db";

export interface RawEstimateItem {
  materialName: string;
  category: "estructura" | "muros" | "cubierta" | "acabados" | "otros";
  quantity: number;
  unit: string;
}

export interface Areas {
  floorAreaM2: number;
  wallAreaM2: number;
  roofAreaM2: number;
}

const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function computeAreas(rooms: Room[]): Areas {
  let floor = 0;
  let wall = 0;
  for (const r of rooms) {
    floor += r.widthM * r.lengthM;
    wall += 2 * (r.widthM + r.lengthM) * r.heightM;
  }
  // Roof with 15% extra for slope and eaves (aleros)
  return {
    floorAreaM2: round(floor, 2),
    wallAreaM2: round(wall, 2),
    roofAreaM2: round(floor * 1.15, 2),
  };
}

/**
 * Material quantity factors for Colombian bioconstruction systems.
 * Quantities are approximations per m2 of wall/roof/floor area,
 * intended for preliminary budgeting (anteproyecto), not structural design.
 */
export function computeItems(
  wallSystem: string,
  roofType: string,
  areas: Areas,
): RawEstimateItem[] {
  const { floorAreaM2: floor, wallAreaM2: wall, roofAreaM2: roof } = areas;
  const items: RawEstimateItem[] = [];
  const add = (
    materialName: string,
    category: RawEstimateItem["category"],
    quantity: number,
    unit: string,
  ) => {
    if (quantity > 0) {
      items.push({ materialName, category, quantity: round(quantity, 1), unit });
    }
  };

  // Foundation + base structure (all systems)
  add("Piedra para cimiento", "estructura", floor * 0.15, "m3");
  add("Guadua estructural 6 m", "estructura", floor / 3 + wall * 0.15, "unidad");
  add("Alambre y clavos", "estructura", wall * 0.12, "kg");

  // Walls by system
  switch (wallSystem) {
    case "bahareque":
      add("Esterilla de guadua", "muros", wall * 1.1, "m2");
      add("Tierra arcillosa", "muros", wall * 0.06, "m3");
      add("Arena", "muros", wall * 0.03, "m3");
      add("Fibra vegetal (paja)", "muros", wall * 0.4, "kg");
      break;
    case "tapia_pisada":
      add("Tierra arcillosa", "muros", wall * 0.35, "m3");
      add("Arena", "muros", wall * 0.08, "m3");
      add("Fibra vegetal (paja)", "muros", wall * 0.2, "kg");
      break;
    case "adobe":
      add("Adobe bloque", "muros", wall * 32, "unidad");
      add("Tierra arcillosa", "muros", wall * 0.03, "m3");
      add("Arena", "muros", wall * 0.02, "m3");
      break;
    case "guadua_vista":
      add("Esterilla de guadua", "muros", wall * 0.6, "m2");
      add("Guadua estructural 6 m", "muros", wall * 0.4, "unidad");
      break;
    default:
      break;
  }

  // Roof by type (guadua roof structure for all)
  add("Guadua estructural 6 m", "cubierta", roof * 0.35, "unidad");
  switch (roofType) {
    case "teja_barro":
      add("Teja de barro", "cubierta", roof * 30, "unidad");
      break;
    case "palma":
      add("Palma seca", "cubierta", roof * 1.3, "m2");
      break;
    case "zinc":
      add("Lamina de zinc", "cubierta", roof * 0.35, "unidad");
      break;
    case "techo_verde":
      add("Membrana impermeable", "cubierta", roof * 1.05, "m2");
      add("Sustrato techo verde", "cubierta", roof * 0.12, "m3");
      break;
    default:
      break;
  }

  // Finishes: lime render (revoque de cal) on walls
  add("Cal hidratada", "acabados", wall * 0.08, "bulto");

  // Merge duplicate material lines (e.g. guadua appears in several sections)
  const merged = new Map<string, RawEstimateItem>();
  for (const item of items) {
    const key = `${item.materialName}|${item.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = round(existing.quantity + item.quantity, 1);
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}
