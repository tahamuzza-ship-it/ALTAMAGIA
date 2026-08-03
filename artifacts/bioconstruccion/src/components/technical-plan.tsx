import { useEffect, useMemo, useState } from "react";
import type { Project, Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Printer } from "lucide-react";

/**
 * Plano técnico estilo arquitecto: cotas, áreas, norte y rótulo (cajetín).
 * Pensado para imprimirse (o guardarse como PDF) a escala real.
 */

const KIND_LABELS: Record<string, string> = {
  habitacion: "HABITACIÓN", sala: "SALA", cocina: "COCINA", bano: "BAÑO",
  comedor: "COMEDOR", corredor: "CORREDOR", taller: "TALLER", otro: "ESPACIO",
};

const WALL = 0.15; // grosor de muro dibujado (m)

type Props = {
  project: Project;
  rooms: Room[];
  floor: number;
  onSaveOwner: (owner: string) => void;
};

export function TechnicalPlan({ project, rooms, floor, onSaveOwner }: Props) {
  const [scaleDen, setScaleDen] = useState<50 | 100>(50);
  const [owner, setOwner] = useState(project.owner ?? "");
  useEffect(() => { setOwner(project.owner ?? ""); }, [project.owner]);

  const floorRooms = rooms.filter(r => (r.floor ?? 1) === floor);

  const layout = useMemo(() => floorRooms.map((r, i) => ({
    room: r,
    x: r.posX ?? (i * 5),
    y: r.posY ??  0,
    w: r.widthM,
    l: r.lengthM,
  })), [floorRooms]);

  const bounds = useMemo(() => {
    if (layout.length === 0) return { minX: 0, minY: 0, maxX: 10, maxY: 8 };
    return {
      minX: Math.min(...layout.map(p => p.x)),
      minY: Math.min(...layout.map(p => p.y)),
      maxX: Math.max(...layout.map(p => p.x + p.w)),
      maxY: Math.max(...layout.map(p => p.y + p.l)),
    };
  }, [layout]);

  // Margen alrededor del dibujo (en metros) para cotas, norte y cajetín
  const M = 2.6;
  const CAJETIN_H = 3.2;
  const vbX = bounds.minX - M;
  const vbY = bounds.minY - M;
  const vbW = (bounds.maxX - bounds.minX) + M * 2;
  const vbH = (bounds.maxY - bounds.minY) + M * 2 + CAJETIN_H;

  // Tamaño físico al imprimir: 1 m real = (1000 / escala) mm en papel
  const mmPerM = 1000 / scaleDen;
  const printW = vbW * mmPerM;
  const printH = vbH * mmPerM;

  const totalArea = floorRooms.reduce((s, r) => s + r.widthM * r.lengthM, 0);
  const today = new Date().toLocaleDateString("es-CO", { year: "numeric", month: "2-digit", day: "2-digit" });

  const fmt = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");

  // Línea de cota con testeros y texto
  const Dim = ({ x1, y1, x2, y2, label, vertical = false }: { x1: number; y1: number; x2: number; y2: number; label: string; vertical?: boolean }) => (
    <g stroke="#000" strokeWidth={0.02} fill="#000">
      <line x1={x1} y1={y1} x2={x2} y2={y2} />
      {vertical ? (<>
        <line x1={x1 - 0.15} y1={y1} x2={x1 + 0.15} y2={y1} />
        <line x1={x2 - 0.15} y1={y2} x2={x2 + 0.15} y2={y2} />
        <text x={x1 - 0.12} y={(y1 + y2) / 2} fontSize={0.32} textAnchor="middle" stroke="none"
          transform={`rotate(-90 ${x1 - 0.12} ${(y1 + y2) / 2})`}>{label}</text>
      </>) : (<>
        <line x1={x1} y1={y1 - 0.15} x2={x1} y2={y1 + 0.15} />
        <line x1={x2} y1={y2 - 0.15} x2={x2} y2={y2 + 0.15} />
        <text x={(x1 + x2) / 2} y={y1 - 0.12} fontSize={0.32} textAnchor="middle" stroke="none">{label}</text>
      </>)}
    </g>
  );

  const cajX = vbX + 0.3;
  const cajY = bounds.maxY + M - 0.4;
  const cajW = vbW - 0.6;

  return (
    <div>
      {/* Controles (no salen en la impresión) */}
      <div className="flex flex-wrap items-center gap-2 p-3 border-b bg-muted/30 print:hidden">
        <div className="flex bg-background border rounded-lg p-1">
          {[50, 100].map(s => (
            <Button key={s} variant={scaleDen === s ? "secondary" : "ghost"} size="sm"
              className="h-7 text-xs px-3" onClick={() => setScaleDen(s as 50 | 100)}>
              Escala 1:{s}
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <Input value={owner} onChange={e => setOwner(e.target.value)} placeholder="Propietario (para el rótulo)"
            className="h-8 w-52 text-xs" />
          {owner !== (project.owner ?? "") && (
            <Button size="sm" className="h-8 text-xs" onClick={() => onSaveOwner(owner)}>Guardar</Button>
          )}
        </div>
        <Button size="sm" variant="outline" className="h-8 text-xs ml-auto" onClick={() => window.print()}>
          <Printer className="w-3.5 h-3.5 mr-1" /> Imprimir / PDF
        </Button>
      </div>

      <p className="px-3 pt-2 text-[11px] text-muted-foreground print:hidden">
        Para el trámite de licencia, estos planos deben ser revisados y firmados por un arquitecto con matrícula profesional.
      </p>

      <div className="plancha-tecnica overflow-auto bg-white p-2">
        <svg
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          className="w-full h-auto plancha-svg"
          style={{ ["--print-w" as string]: `${printW}mm`, ["--print-h" as string]: `${printH}mm` }}
        >
          {/* Marco de la plancha */}
          <rect x={vbX + 0.15} y={vbY + 0.15} width={vbW - 0.3} height={vbH - 0.3} fill="#fff" stroke="#000" strokeWidth={0.05} />

          {/* Espacios: muros en negro */}
          {layout.map(({ room, x, y, w, l }, i) => {
            // Carriles alternados para que las cotas de espacios vecinos no se pisen
            const laneH = 0.45 + (i % 2) * 0.4;
            const laneV = 0.45 + (i % 2) * 0.4;
            return (
            <g key={room.id}>
              <rect x={x} y={y} width={w} height={l} fill="none" stroke="#000" strokeWidth={WALL} />
              <text x={x + w / 2} y={y + l / 2 - 0.25} fontSize={0.38} fontWeight="bold" textAnchor="middle" fill="#000">
                {KIND_LABELS[room.kind] ?? room.kind.toUpperCase()}
              </text>
              <text x={x + w / 2} y={y + l / 2 + 0.25} fontSize={0.3} textAnchor="middle" fill="#000">
                {room.name}
              </text>
              <text x={x + w / 2} y={y + l / 2 + 0.72} fontSize={0.3} textAnchor="middle" fill="#000">
                Área: {fmt(w * l)} m²
              </text>
              {/* Cotas por espacio */}
              <Dim x1={x} y1={y - laneH} x2={x + w} y2={y - laneH} label={`${fmt(w)}`} />
              <Dim x1={x - laneV} y1={y} x2={x - laneV} y2={y + l} label={`${fmt(l)}`} vertical />
            </g>
            );
          })}

          {/* Cotas generales */}
          {layout.length > 1 && (<>
            <Dim x1={bounds.minX} y1={bounds.minY - 1.3} x2={bounds.maxX} y2={bounds.minY - 1.3}
              label={`${fmt(bounds.maxX - bounds.minX)}`} />
            <Dim x1={bounds.minX - 1.3} y1={bounds.minY} x2={bounds.minX - 1.3} y2={bounds.maxY}
              label={`${fmt(bounds.maxY - bounds.minY)}`} vertical />
          </>)}

          {/* Norte */}
          <g transform={`translate(${bounds.maxX + M - 1.2}, ${vbY + 1.4})`} stroke="#000" fill="#000">
            <circle r={0.55} fill="none" strokeWidth={0.04} />
            <path d="M 0,-0.45 L 0.18,0.3 L 0,0.15 L -0.18,0.3 Z" strokeWidth={0.02} />
            <text y={-0.7} fontSize={0.35} textAnchor="middle" stroke="none" fontWeight="bold">N</text>
          </g>

          {/* Cajetín / rótulo */}
          <g stroke="#000" strokeWidth={0.04} fill="none">
            <rect x={cajX} y={cajY} width={cajW} height={CAJETIN_H - 0.2} />
            <line x1={cajX} y1={cajY + 0.9} x2={cajX + cajW} y2={cajY + 0.9} />
            <line x1={cajX + cajW * 0.62} y1={cajY + 0.9} x2={cajX + cajW * 0.62} y2={cajY + CAJETIN_H - 0.2} />
            <line x1={cajX + cajW * 0.62} y1={cajY + 1.6} x2={cajX + cajW} y2={cajY + 1.6} />
            <line x1={cajX + cajW * 0.81} y1={cajY + 1.6} x2={cajX + cajW * 0.81} y2={cajY + CAJETIN_H - 0.2} />
          </g>
          <g fill="#000" stroke="none">
            <text x={cajX + 0.25} y={cajY + 0.6} fontSize={0.42} fontWeight="bold">
              PLANO ARQUITECTÓNICO — PISO {floor}
            </text>
            <text x={cajX + 0.25} y={cajY + 1.35} fontSize={0.32}>
              PROYECTO: {project.name}
            </text>
            <text x={cajX + 0.25} y={cajY + 1.85} fontSize={0.32}>
              PROPIETARIO: {owner || "________________"}
            </text>
            <text x={cajX + 0.25} y={cajY + 2.35} fontSize={0.32}>
              DIRECCIÓN: {project.location || "________________"}
            </text>
            <text x={cajX + cajW * 0.62 + 0.2} y={cajY + 1.35} fontSize={0.32}>ESCALA: 1:{scaleDen}</text>
            <text x={cajX + cajW * 0.81 + 0.2} y={cajY + 1.35} fontSize={0.32}>FECHA: {today}</text>
            <text x={cajX + cajW * 0.62 + 0.2} y={cajY + 2.1} fontSize={0.32}>ÁREA PISO: {fmt(totalArea)} m²</text>
            <text x={cajX + cajW * 0.81 + 0.2} y={cajY + 2.1} fontSize={0.32}>PLANCHA: A-{floor.toString().padStart(2, "0")}</text>
            <text x={cajX + cajW * 0.62 + 0.2} y={cajY + 2.6} fontSize={0.26}>
              REQUIERE FIRMA DE ARQUITECTO CON MATRÍCULA PROFESIONAL
            </text>
          </g>
        </svg>
      </div>

      {/* Al imprimir: solo la plancha, a tamaño real según la escala */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          .plancha-tecnica, .plancha-tecnica * { visibility: visible !important; }
          .plancha-tecnica { position: absolute !important; left: 0; top: 0; padding: 0 !important; }
          .plancha-svg { width: var(--print-w) !important; height: var(--print-h) !important; }
          @page { size: auto; margin: 8mm; }
        }
      `}</style>
    </div>
  );
}
