import type { Room } from "@workspace/db";

export interface RawEstimateItem {
  materialName: string;
  category: "estructura" | "muros" | "cubierta" | "acabados" | "otros";
  quantity: number;
  unit: string;
  formula: string;
}

export interface Areas {
  floorAreaM2: number;
  wallAreaM2: number;
  roofAreaM2: number;
  upperFloorAreaM2: number;
  footprintAreaM2: number;
}

const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export function computeAreas(rooms: Room[]): Areas {
  let floor = 0;
  let wall = 0;
  let footprint = 0;
  let upper = 0;
  for (const r of rooms) {
    const area = r.widthM * r.lengthM;
    floor += area;
    wall += 2 * (r.widthM + r.lengthM) * r.heightM;
    if (r.floor >= 2) {
      upper += area;
    } else {
      footprint += area;
    }
  }
  // Roof covers the footprint (planta baja) with 15% extra for slope and eaves.
  // If everything is on floor 2 (unusual), fall back to total area.
  const roofBase = footprint > 0 ? footprint : floor;
  return {
    floorAreaM2: round(floor, 2),
    wallAreaM2: round(wall, 2),
    roofAreaM2: round(roofBase * 1.15, 2),
    upperFloorAreaM2: round(upper, 2),
    footprintAreaM2: round(roofBase, 2),
  };
}

// Adobes grandes hechos en obra: bloque de ~40 x 20 x 15 cm (aprox. 4 veces
// un ladrillo comun). Con junta de barro rinden ~15 bloques por m2 de muro.
// Rendimiento de fabricacion: ~80 adobes por jornada entre 2 personas.
const ADOBES_POR_M2 = 15;
const ADOBES_POR_JORNADA = 80;

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
  const {
    wallAreaM2: wall,
    roofAreaM2: roof,
    upperFloorAreaM2: upper,
    footprintAreaM2: footprint,
  } = areas;
  const items: RawEstimateItem[] = [];
  const add = (
    materialName: string,
    category: RawEstimateItem["category"],
    quantity: number,
    unit: string,
    formula: string,
  ) => {
    if (quantity > 0) {
      items.push({
        materialName,
        category,
        quantity: round(quantity, 1),
        unit,
        formula,
      });
    }
  };

  // Foundation + base structure (all systems)
  add(
    "Piedra para cimiento",
    "estructura",
    footprint * 0.15,
    "m3",
    `Cimiento ciclopeo sobre la huella de la casa: 0.15 m3 por m2 de planta baja (${footprint} m2 x 0.15)`,
  );
  add(
    "Guadua estructural 6 m",
    "estructura",
    footprint / 3 + wall * 0.15,
    "unidad",
    `Columnas y vigas: 1 guadua por cada 3 m2 de planta baja (${footprint} m2 / 3) + 0.15 por m2 de muro (${wall} m2 x 0.15)`,
  );
  add(
    "Alambre y clavos",
    "estructura",
    wall * 0.12,
    "kg",
    `Amarres y fijaciones: 0.12 kg por m2 de muro (${wall} m2 x 0.12)`,
  );

  // Walls by system
  switch (wallSystem) {
    case "bahareque":
      add(
        "Esterilla de guadua",
        "muros",
        wall * 1.1,
        "m2",
        `Doble cara con 10% de desperdicio: 1.1 m2 por m2 de muro (${wall} m2 x 1.1)`,
      );
      add(
        "Tierra arcillosa",
        "muros",
        wall * 0.06,
        "m3",
        `Embutido y revoque de barro: 0.06 m3 por m2 de muro (${wall} m2 x 0.06)`,
      );
      add(
        "Arena",
        "muros",
        wall * 0.03,
        "m3",
        `Mezcla del revoque: 0.03 m3 por m2 de muro (${wall} m2 x 0.03)`,
      );
      add(
        "Fibra vegetal (paja)",
        "muros",
        wall * 0.4,
        "kg",
        `Refuerzo del barro: 0.4 kg por m2 de muro (${wall} m2 x 0.4)`,
      );
      break;
    case "tapia_pisada":
      add(
        "Tierra arcillosa",
        "muros",
        wall * 0.35,
        "m3",
        `Muro macizo de ~35 cm apisonado: 0.35 m3 por m2 de muro (${wall} m2 x 0.35)`,
      );
      add(
        "Arena",
        "muros",
        wall * 0.08,
        "m3",
        `Correccion de la mezcla: 0.08 m3 por m2 de muro (${wall} m2 x 0.08)`,
      );
      add(
        "Fibra vegetal (paja)",
        "muros",
        wall * 0.2,
        "kg",
        `Estabilizante: 0.2 kg por m2 de muro (${wall} m2 x 0.2)`,
      );
      break;
    case "adobe": {
      const bloques = wall * ADOBES_POR_M2;
      const jornadas = Math.ceil(bloques / ADOBES_POR_JORNADA);
      add(
        "Adobe grande (hecho en obra)",
        "muros",
        bloques,
        "unidad",
        `Bloque de ~40x20x15 cm (4 veces un ladrillo comun): ${ADOBES_POR_M2} bloques por m2 de muro (${wall} m2 x ${ADOBES_POR_M2}). Se fabrican en obra con la tierra del lugar.`,
      );
      add(
        "Jornada fabricacion de adobes (2 personas)",
        "otros",
        jornadas,
        "dia",
        `Entre 2 personas se hacen ~${ADOBES_POR_JORNADA} adobes al dia: ${round(bloques, 0)} bloques / ${ADOBES_POR_JORNADA} = ${jornadas} jornadas. El costo del adobe es la mano de obra, no el material.`,
      );
      add(
        "Tierra arcillosa",
        "muros",
        wall * 0.02,
        "m3",
        `Mortero de pega de barro: 0.02 m3 por m2 de muro (${wall} m2 x 0.02). La tierra de los adobes sale del lote.`,
      );
      add(
        "Arena",
        "muros",
        wall * 0.02,
        "m3",
        `Mortero de pega: 0.02 m3 por m2 de muro (${wall} m2 x 0.02)`,
      );
      break;
    }
    case "guadua_vista":
      add(
        "Esterilla de guadua",
        "muros",
        wall * 0.6,
        "m2",
        `Cerramiento en esterilla: 0.6 m2 por m2 de muro (${wall} m2 x 0.6)`,
      );
      add(
        "Guadua estructural 6 m",
        "muros",
        wall * 0.4,
        "unidad",
        `Muro de guadua a la vista: 0.4 guaduas por m2 de muro (${wall} m2 x 0.4)`,
      );
      break;
    default:
      break;
  }

  // Mezzanine / second floor structure
  if (upper > 0) {
    add(
      "Guadua estructural 6 m",
      "estructura",
      upper * 0.8,
      "unidad",
      `Entrepiso del segundo piso: 0.8 guaduas por m2 de piso superior (${upper} m2 x 0.8)`,
    );
    add(
      "Esterilla de guadua",
      "estructura",
      upper * 1.05,
      "m2",
      `Tablero del entrepiso con 5% de desperdicio: 1.05 m2 por m2 de piso superior (${upper} m2 x 1.05)`,
    );
  }

  // Roof by type (guadua roof structure for all)
  add(
    "Guadua estructural 6 m",
    "cubierta",
    roof * 0.35,
    "unidad",
    `Estructura de cubierta: 0.35 guaduas por m2 de techo (${roof} m2 x 0.35)`,
  );
  switch (roofType) {
    case "teja_barro":
      add(
        "Teja de barro",
        "cubierta",
        roof * 30,
        "unidad",
        `~30 tejas por m2 de techo (${roof} m2 x 30)`,
      );
      break;
    case "palma":
      add(
        "Palma seca",
        "cubierta",
        roof * 1.3,
        "m2",
        `Traslapos del empajado: 1.3 m2 por m2 de techo (${roof} m2 x 1.3)`,
      );
      break;
    case "zinc":
      add(
        "Lamina de zinc",
        "cubierta",
        roof * 0.35,
        "unidad",
        `Lamina estandar de ~3 m2 utiles: 0.35 laminas por m2 de techo (${roof} m2 x 0.35)`,
      );
      break;
    case "techo_verde":
      add(
        "Membrana impermeable",
        "cubierta",
        roof * 1.05,
        "m2",
        `Impermeabilizacion con 5% de traslapo: 1.05 m2 por m2 de techo (${roof} m2 x 1.05)`,
      );
      add(
        "Sustrato techo verde",
        "cubierta",
        roof * 0.12,
        "m3",
        `Capa de sustrato de ~12 cm: 0.12 m3 por m2 de techo (${roof} m2 x 0.12)`,
      );
      break;
    default:
      break;
  }

  // Finishes: lime render (revoque de cal) on walls
  add(
    "Cal hidratada",
    "acabados",
    wall * 0.08,
    "bulto",
    `Revoque y pintura de cal: 0.08 bultos por m2 de muro (${wall} m2 x 0.08)`,
  );

  // Merge duplicate material lines (e.g. guadua appears in several sections)
  const merged = new Map<string, RawEstimateItem>();
  for (const item of items) {
    const key = `${item.materialName}|${item.category}`;
    const existing = merged.get(key);
    if (existing) {
      existing.quantity = round(existing.quantity + item.quantity, 1);
      existing.formula = `${existing.formula} + ${item.formula}`;
    } else {
      merged.set(key, { ...item });
    }
  }
  return [...merged.values()];
}
