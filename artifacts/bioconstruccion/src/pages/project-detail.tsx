import { useState, useRef, useMemo, useEffect, Suspense, lazy } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useGetProject, useUpdateProject, useDeleteProject, 
  useListRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, 
  useGetProjectEstimate, getGetProjectQueryKey, getListRoomsQueryKey, getGetProjectEstimateQueryKey, getListProjectsQueryKey,
  useListMaterials,
  useListInstallations, useCreateInstallation, useDeleteInstallation, getListInstallationsQueryKey,
  type Installation
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Loader2, ArrowLeft, Trash2, Pencil, Plus, Maximize, AlertCircle, Map, Droplets, Home, Clock, Users, Flame, ExternalLink, X
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TechnicalPlan } from "@/components/technical-plan";
import { MeasureWizard, type WizardRoom } from "@/components/measure-wizard";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatCOP, formatArea } from "@/lib/format";
import { Room } from "@workspace/api-client-react";
import heroCasa from "@/assets/hero-casa.jpg";

const PlanViewer3DScene = lazy(() => import("@/components/PlanViewer3D"));

const roomSchema = z.object({
  name: z.string().min(1, "Obligatorio"),
  floor: z.coerce.number().min(1).max(2).default(1),
  kind: z.enum(["habitacion", "sala", "cocina", "bano", "comedor", "corredor", "taller", "otro"]),
  widthM: z.coerce.number().min(0.1),
  lengthM: z.coerce.number().min(0.1),
  heightM: z.coerce.number().min(0.1),
  posX: z.coerce.number().optional(),
  posY: z.coerce.number().optional(),
});

const terrainSchema = z.object({
  terrainAccess: z.enum(['facil', 'medio', 'dificil']).nullable().optional(),
  terrainSlope: z.enum(['plano', 'pendiente_suave', 'pendiente_fuerte']).nullable().optional(),
  waterDistanceM: z.coerce.number().nullable().optional(),
  canStay: z.boolean().nullable().optional(),
  canCook: z.boolean().nullable().optional(),
  numPeople: z.coerce.number().nullable().optional(),
  targetMonths: z.coerce.number().nullable().optional(),
});

// ---- Instalaciones (capas eléctrica, agua limpia y aguas sucias sobre el plano) ----
type InstallLayer = "electrica" | "agua" | "sanitaria";
type InstallTool = { layer: InstallLayer; kind: Installation["kind"] } | null;

const LAYER_COLORS: Record<InstallLayer, string> = {
  electrica: "#d97706", // ámbar
  agua: "#2563eb",      // azul
  sanitaria: "#7c4a21", // café (aguas sucias)
};

const INSTALL_STYLES: Record<string, { label: string; short: string; run?: boolean }> = {
  toma:        { label: "Toma corriente", short: "T" },
  interruptor: { label: "Interruptor", short: "I" },
  lampara:     { label: "Lámpara", short: "L" },
  tablero:     { label: "Tablero eléctrico", short: "TB" },
  cable:       { label: "Cable (recorrido)", short: "~", run: true },
  llave:       { label: "Llave de agua", short: "LL" },
  ducha:       { label: "Ducha", short: "D" },
  desague:     { label: "Desagüe", short: "DS" },
  tanque:      { label: "Tanque", short: "TQ" },
  tuberia:     { label: "Tubería (recorrido)", short: "≈", run: true },
};

const installColor = (layer: string) => LAYER_COLORS[layer as InstallLayer] ?? "#888";

const ELECTRICA_KINDS = ["toma", "interruptor", "lampara", "tablero", "cable"] as const;
const AGUA_KINDS = ["llave", "ducha", "tanque", "tuberia"] as const;
const SANITARIA_KINDS = ["desague", "ducha", "tuberia"] as const;

function InstallationsOverlay({ installations, visibleLayers, draftPoints, draftTool, onElementClick }: {
  installations: Installation[];
  visibleLayers: Record<InstallLayer, boolean>;
  draftPoints: { x: number; y: number }[];
  draftTool: InstallTool;
  onElementClick: (inst: Installation) => void;
}) {
  const visible = installations.filter(i => visibleLayers[i.layer as InstallLayer]);
  return (
    <g>
      {visible.map(inst => {
        const st = INSTALL_STYLES[inst.kind] ?? { label: inst.kind, short: "?" };
        const color = installColor(inst.layer);
        if (st.run && inst.points.length >= 2) {
          return (
            <g key={inst.id} className="cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onElementClick(inst); }}>
              <polyline
                points={inst.points.map(p => `${p.x},${p.y}`).join(" ")}
                fill="none" stroke={color} strokeWidth={0.12}
                strokeDasharray={inst.layer !== "electrica" ? "0.3 0.15" : undefined}
                strokeLinecap="round" strokeLinejoin="round" opacity={0.85}
              />
              {inst.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={0.12} fill={color} />
              ))}
            </g>
          );
        }
        const p = inst.points[0];
        if (!p) return null;
        return (
          <g key={inst.id} className="cursor-pointer" onPointerDown={(e) => { e.stopPropagation(); }} onClick={(e) => { e.stopPropagation(); onElementClick(inst); }}>
            <circle cx={p.x} cy={p.y} r={0.35} fill="white" stroke={color} strokeWidth={0.08} />
            <text x={p.x} y={p.y + 0.02} textAnchor="middle" dominantBaseline="middle"
              style={{ fontSize: "0.3px", fill: color, fontWeight: 700 }} className="select-none pointer-events-none">
              {st.short}
            </text>
          </g>
        );
      })}
      {draftTool && draftPoints.length > 0 && (
        <g className="pointer-events-none">
          <polyline
            points={draftPoints.map(p => `${p.x},${p.y}`).join(" ")}
            fill="none" stroke={installColor(draftTool.layer)}
            strokeWidth={0.12} strokeDasharray="0.2 0.2" opacity={0.7}
          />
          {draftPoints.map((p, i) => (
            <circle key={i} cx={p.x} cy={p.y} r={0.15} fill={installColor(draftTool.layer)} />
          ))}
        </g>
      )}
    </g>
  );
}

function PlanViewer({ rooms, selectedFloor, onRoomClick, onRoomDrop, installations, visibleLayers, activeTool, draftPoints, onPlanTap, onInstallationClick }: {
  rooms: Room[], selectedFloor: number, onRoomClick: (r: Room) => void, onRoomDrop: (r: Room, posX: number, posY: number) => void,
  installations: Installation[],
  visibleLayers: Record<InstallLayer, boolean>,
  activeTool: InstallTool,
  draftPoints: { x: number; y: number }[],
  onPlanTap: (x: number, y: number) => void,
  onInstallationClick: (inst: Installation) => void,
}) {
  const padding = 2;
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [dragState, setDragState] = useState<{ roomId: number; offsetX: number; offsetY: number; x: number; y: number; moved: boolean } | null>(null);

  const floorRooms = rooms.filter(r => r.floor === selectedFloor);
  const floorInstallations = installations.filter(i => i.floor === selectedFloor);

  const svgPointFromEvent = (clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return null;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return null;
    const p = pt.matrixTransform(ctm.inverse());
    // Snap a 0.25m para símbolos y recorridos
    return { x: Math.round(p.x * 4) / 4, y: Math.round(p.y * 4) / 4 };
  };

  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!activeTool) return;
    const p = svgPointFromEvent(e.clientX, e.clientY);
    if (p) onPlanTap(p.x, p.y);
  };

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, room: Room, displayedX: number, displayedY: number) => {
    if (activeTool) return; // en modo instalación, los toques colocan símbolos
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const svg = svgRef.current;
    if (!svg) return;
    
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    
    const svgPt = pt.matrixTransform(ctm.inverse());
    const roomX = displayedX;
    const roomY = displayedY;
    
    setDragState({
      roomId: room.id,
      offsetX: svgPt.x - roomX,
      offsetY: svgPt.y - roomY,
      x: roomX,
      y: roomY,
      moved: false
    });
  };

  const handlePointerMove = (e: React.PointerEvent<SVGGElement>) => {
    if (!dragState) return;
    const svg = svgRef.current;
    if (!svg) return;

    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;

    const svgPt = pt.matrixTransform(ctm.inverse());
    
    // Snap to 0.5m
    let newX = Math.round((svgPt.x - dragState.offsetX) * 2) / 2;
    let newY = Math.round((svgPt.y - dragState.offsetY) * 2) / 2;

    if (dragState.x !== newX || dragState.y !== newY) {
      setDragState(prev => prev ? { ...prev, x: newX, y: newY, moved: true } : null);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGGElement>, room: Room) => {
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (dragState && dragState.moved) {
      onRoomDrop(room, dragState.x, dragState.y);
    } else if (dragState && !dragState.moved) {
      onRoomClick(room);
    }
    setDragState(null);
  };

  const bounds = useMemo(() => {
    if (!floorRooms.length) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    floorRooms.forEach((r, i) => {
      const isDragging = dragState?.roomId === r.id;
      const x = isDragging ? dragState!.x : (r.posX ?? (i * 5));
      const y = isDragging ? dragState!.y : (r.posY ?? 0);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + r.widthM);
      maxY = Math.max(maxY, y + r.lengthM);
    });
    
    return {
      minX: minX - padding,
      minY: minY - padding,
      maxX: maxX + padding,
      maxY: maxY + padding,
      width: (maxX - minX) + padding * 2,
      height: (maxY - minY) + padding * 2
    };
  }, [floorRooms, dragState]);

  if (!floorRooms.length) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-card rounded-xl border border-dashed border-border/60">
        <p className="text-muted-foreground text-center">
          Agrega tu primer espacio en el Piso {selectedFloor}.<br/>
          <span className="text-sm opacity-70">El plano se dibujará automáticamente y podrás arrastrar los cuartos.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-card/50 rounded-xl border relative overflow-hidden flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
      
      <svg 
        ref={svgRef}
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className={`w-full h-full max-h-[70vh] drop-shadow-sm touch-none ${activeTool ? "cursor-crosshair" : ""}`}
        preserveAspectRatio="xMidYMid meet"
        onClick={handleSvgClick}
      >
        {floorRooms.map((r, i) => {
          const isDragging = dragState?.roomId === r.id;
          const x = isDragging ? dragState!.x : (r.posX ?? (i * 5));
          const y = isDragging ? dragState!.y : (r.posY ?? 0);
          return (
            <g 
              key={r.id} 
              transform={`translate(${x}, ${y})`} 
              className={`transition-all ${activeTool ? 'pointer-events-none' : 'cursor-grab active:cursor-grabbing'} ${isDragging ? 'opacity-80' : ''}`}
              onPointerDown={(e) => handlePointerDown(e, r, x, y)}
              onPointerMove={handlePointerMove}
              onPointerUp={(e) => handlePointerUp(e, r)}
              onPointerCancel={(e) => handlePointerUp(e, r)}
            >
              <rect 
                width={r.widthM} 
                height={r.lengthM} 
                className="fill-background stroke-primary/40 stroke-[0.1] hover:stroke-primary hover:fill-primary/5 transition-colors"
                rx={0.1}
                strokeDasharray={r.kind === 'corredor' ? '0.35 0.25' : undefined}
              />
              {r.kind !== 'corredor' && (
                <rect 
                  x={0.1} y={0.1} 
                  width={r.widthM - 0.2} 
                  height={r.lengthM - 0.2} 
                  className="fill-transparent stroke-muted/30 stroke-[0.05]"
                />
              )}
              {(() => {
                // Letra que quepa dentro del espacio: se achica en espacios angostos
                // y en corredores va todo en una sola línea para que no se encimen.
                const small = r.lengthM < 2 || r.widthM < 2;
                if (small) {
                  // Espacio angosto: una sola línea que QUEPA adentro.
                  // Si es más largo que ancho (corredor vertical), se rota 90°.
                  const label = `${r.name} · ${r.widthM}×${r.lengthM}m`;
                  const vertical = r.lengthM > r.widthM * 1.4;
                  const avail = (vertical ? r.lengthM : r.widthM) - 0.3;
                  const fsFit = Math.max(0.18, Math.min(0.38, avail / (label.length * 0.58), (vertical ? r.widthM : r.lengthM) * 0.5));
                  return (
                    <text
                      x={r.widthM / 2}
                      y={r.lengthM / 2}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fsFit}
                      transform={vertical ? `rotate(90 ${r.widthM / 2} ${r.lengthM / 2})` : undefined}
                      className="font-sans fill-foreground font-medium pointer-events-none select-none"
                    >
                      {label}
                    </text>
                  );
                }
                const fs = Math.max(0.24, Math.min(0.4, r.lengthM * 0.28, (r.widthM * 1.4) / Math.max(6, r.name.length)));
                return (
                  <>
                    <text
                      x={r.widthM / 2}
                      y={r.lengthM / 2 - fs * 0.35}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={fs}
                      className="font-sans fill-foreground font-medium pointer-events-none select-none"
                    >
                      {r.name}
                    </text>
                    <text
                      x={r.widthM / 2}
                      y={r.lengthM / 2 + fs * 0.95}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fontSize={Math.max(0.2, fs * 0.65)}
                      className="font-sans fill-muted-foreground pointer-events-none select-none"
                    >
                      {r.widthM}m × {r.lengthM}m
                    </text>
                  </>
                );
              })()}
            </g>
          );
        })}
        <InstallationsOverlay
          installations={floorInstallations}
          visibleLayers={visibleLayers}
          draftPoints={draftPoints}
          draftTool={activeTool}
          onElementClick={onInstallationClick}
        />
      </svg>
      <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur border text-xs px-3 py-1.5 rounded-md text-muted-foreground flex items-center gap-2">
        <Maximize className="w-3 h-3" />
        {activeTool ? "Toca el plano para colocar" : "Arrastra para mover"}
      </div>
    </div>
  );
}


function PlanViewer3D({ rooms, onRoomClick }: { rooms: Room[], onRoomClick: (r: Room) => void }) {
  const padding = 3;
  const cos30 = 0.866025;
  const sin30 = 0.5;

  const project = (x: number, y: number, z: number) => ({
    x: (x - y) * cos30,
    y: (x + y) * sin30 - z
  });

  const maxH1 = Math.max(2.5, ...rooms.filter(r => r.floor === 1).map(r => r.heightM), 0);

  const rooms3D = rooms.map((r, i) => {
    const x = r.posX ?? (i * 5);
    const y = r.posY ?? 0;
    const w = r.widthM;
    const l = r.lengthM;
    const h = r.heightM;
    const z = r.floor === 2 ? maxH1 : 0;
    return { ...r, x, y, z, w, l, h };
  }).sort((a, b) => {
    const depthA = a.x + a.y;
    const depthB = b.x + b.y;
    if (Math.abs(depthA - depthB) > 0.1) return depthA - depthB;
    return a.floor - b.floor;
  });

  let minScreenX = Infinity, minScreenY = Infinity, maxScreenX = -Infinity, maxScreenY = -Infinity;
  const addPt = (p: {x: number, y: number}) => {
    minScreenX = Math.min(minScreenX, p.x); maxScreenX = Math.max(maxScreenX, p.x);
    minScreenY = Math.min(minScreenY, p.y); maxScreenY = Math.max(maxScreenY, p.y);
  };

  rooms3D.forEach(r => {
    addPt(project(r.x, r.y, r.z));
    addPt(project(r.x+r.w, r.y, r.z));
    addPt(project(r.x, r.y+r.l, r.z));
    addPt(project(r.x+r.w, r.y+r.l, r.z));
    addPt(project(r.x, r.y, r.z+r.h));
    addPt(project(r.x+r.w, r.y, r.z+r.h));
    addPt(project(r.x, r.y+r.l, r.z+r.h));
    addPt(project(r.x+r.w, r.y+r.l, r.z+r.h));
  });

  const f1Rooms = rooms3D.filter(r => r.floor === 1);
  let rMinX = Infinity, rMinY = Infinity, rMaxX = -Infinity, rMaxY = -Infinity;
  if (f1Rooms.length > 0) {
    f1Rooms.forEach(r => {
      rMinX = Math.min(rMinX, r.x); rMaxX = Math.max(rMaxX, r.x + r.w);
      rMinY = Math.min(rMinY, r.y); rMaxY = Math.max(rMaxY, r.y + r.l);
    });
    const roofH = 1.5;
    const midY = (rMinY + rMaxY) / 2;
    const midX = (rMinX + rMaxX) / 2;
    addPt(project(rMinX, rMinY, maxH1));
    addPt(project(rMaxX, rMaxY, maxH1));
    addPt(project(rMinX, midY, maxH1 + roofH));
    addPt(project(rMaxX, midY, maxH1 + roofH));
    addPt(project(midX, rMinY, maxH1 + roofH));
    addPt(project(midX, rMaxY, maxH1 + roofH));
  }

  if (minScreenX === Infinity) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-card rounded-xl border border-dashed border-border/60">
        <p className="text-muted-foreground text-center">No hay espacios para renderizar en 3D.</p>
      </div>
    );
  }

  const vb = {
    x: minScreenX - padding,
    y: minScreenY - padding,
    w: (maxScreenX - minScreenX) + padding * 2,
    h: (maxScreenY - minScreenY) + padding * 2
  };

  return (
    <div className="w-full h-full min-h-[500px] bg-card/50 rounded-xl border relative overflow-hidden flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
      <svg 
        viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
        className="w-full h-full max-h-[70vh] drop-shadow-md"
        preserveAspectRatio="xMidYMid meet"
      >
        {rooms3D.map(r => {
          const t0 = project(r.x, r.y, r.z+r.h);
          const tx = project(r.x+r.w, r.y, r.z+r.h);
          const ty = project(r.x, r.y+r.l, r.z+r.h);
          const txy = project(r.x+r.w, r.y+r.l, r.z+r.h);

          const px = project(r.x+r.w, r.y, r.z);
          const pxy = project(r.x+r.w, r.y+r.l, r.z);
          const py = project(r.x, r.y+r.l, r.z);

          const cx = (t0.x + tx.x + ty.x + txy.x) / 4;
          const cy = (t0.y + tx.y + ty.y + txy.y) / 4;

          return (
            <g key={r.id} onClick={() => onRoomClick(r)} className="cursor-pointer group transition-all">
              <polygon 
                points={`${tx.x},${tx.y} ${px.x},${px.y} ${pxy.x},${pxy.y} ${txy.x},${txy.y}`}
                className="fill-[#e8dcc7] stroke-[#d4c3ab] stroke-[0.05] group-hover:fill-[#e0d0b5] transition-colors"
              />
              <polygon 
                points={`${ty.x},${ty.y} ${py.x},${py.y} ${pxy.x},${pxy.y} ${txy.x},${txy.y}`}
                className="fill-[#d4c3ab] stroke-[#c0af98] stroke-[0.05] group-hover:fill-[#c9b49a] transition-colors"
              />
              {/* Sobrecimiento de piedra (30 cm) en la base — solo piso 1 */}
              {r.floor === 1 && (() => {
                const bX0 = project(r.x + r.w, r.y, r.z + 0.3);
                const bXY = project(r.x + r.w, r.y + r.l, r.z + 0.3);
                const bY0 = project(r.x, r.y + r.l, r.z + 0.3);
                return (
                  <>
                    <polygon
                      points={`${bX0.x},${bX0.y} ${px.x},${px.y} ${pxy.x},${pxy.y} ${bXY.x},${bXY.y}`}
                      className="fill-[#8b8175] stroke-[#736a5e] stroke-[0.04] pointer-events-none"
                    />
                    <polygon
                      points={`${bY0.x},${bY0.y} ${py.x},${py.y} ${pxy.x},${pxy.y} ${bXY.x},${bXY.y}`}
                      className="fill-[#7d746a] stroke-[#736a5e] stroke-[0.04] pointer-events-none"
                    />
                  </>
                );
              })()}
              <polygon 
                points={`${t0.x},${t0.y} ${tx.x},${tx.y} ${txy.x},${txy.y} ${ty.x},${ty.y}`}
                className="fill-[#f5ebd8] stroke-[#d4c3ab] stroke-[0.05] group-hover:fill-[#eee1ca] transition-colors"
              />
              <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" className="text-[0.4px] font-sans fill-[#73634e] font-medium pointer-events-none select-none">
                {r.name}
              </text>
            </g>
          )
        })}

        {f1Rooms.length > 0 && (() => {
          const roofH = 1.5;
          const isXLonger = (rMaxX - rMinX) >= (rMaxY - rMinY);

          if (isXLonger) {
            const midY = (rMinY + rMaxY) / 2;
            const p1 = project(rMinX, rMinY, maxH1); 
            const p2 = project(rMaxX, rMinY, maxH1); 
            const p3 = project(rMaxX, rMaxY, maxH1); 
            const p4 = project(rMinX, rMaxY, maxH1); 
            const r1 = project(rMinX, midY, maxH1 + roofH); 
            const r2 = project(rMaxX, midY, maxH1 + roofH); 

            return (
              <g className="pointer-events-none" style={{ mixBlendMode: 'multiply' }}>
                <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${r2.x},${r2.y} ${r1.x},${r1.y}`} className="fill-[#b35e3b]/20 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p4.x},${p4.y} ${p3.x},${p3.y} ${r2.x},${r2.y} ${r1.x},${r1.y}`} className="fill-[#994e2f]/40 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p1.x},${p1.y} ${p4.x},${p4.y} ${r1.x},${r1.y}`} className="fill-[#cc6d45]/20 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p2.x},${p2.y} ${p3.x},${p3.y} ${r2.x},${r2.y}`} className="fill-[#cc6d45]/40 stroke-[#8c4a2e]/40 stroke-[0.05]" />
              </g>
            );
          } else {
            const midX = (rMinX + rMaxX) / 2;
            const p1 = project(rMinX, rMinY, maxH1); 
            const p2 = project(rMaxX, rMinY, maxH1); 
            const p3 = project(rMaxX, rMaxY, maxH1); 
            const p4 = project(rMinX, rMaxY, maxH1); 
            const r1 = project(midX, rMinY, maxH1 + roofH); 
            const r2 = project(midX, rMaxY, maxH1 + roofH); 

            return (
              <g className="pointer-events-none" style={{ mixBlendMode: 'multiply' }}>
                <polygon points={`${p1.x},${p1.y} ${p4.x},${p4.y} ${r2.x},${r2.y} ${r1.x},${r1.y}`} className="fill-[#b35e3b]/20 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p2.x},${p2.y} ${p3.x},${p3.y} ${r2.x},${r2.y} ${r1.x},${r1.y}`} className="fill-[#994e2f]/40 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p1.x},${p1.y} ${p2.x},${p2.y} ${r1.x},${r1.y}`} className="fill-[#cc6d45]/20 stroke-[#8c4a2e]/40 stroke-[0.05]" />
                <polygon points={`${p4.x},${p4.y} ${p3.x},${p3.y} ${r2.x},${r2.y}`} className="fill-[#cc6d45]/40 stroke-[#8c4a2e]/40 stroke-[0.05]" />
              </g>
            );
          }
        })()}
      </svg>
      <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur border text-xs px-3 py-1.5 rounded-md text-muted-foreground flex items-center gap-2">
        <Maximize className="w-3 h-3" />
        Vista Isométrica
      </div>
    </div>
  );
}


export default function ProjectDetail() {
  const [, params] = useRoute("/proyectos/:id");
  const projectId = Number(params?.id);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: project, isLoading: projectLoading } = useGetProject(projectId, { query: { enabled: !!projectId, queryKey: getGetProjectQueryKey(projectId) } });
  const { data: rooms, isLoading: roomsLoading } = useListRooms(projectId, { query: { enabled: !!projectId, queryKey: getListRoomsQueryKey(projectId) } });
  const { data: estimate, isLoading: estimateLoading } = useGetProjectEstimate(projectId, { query: { enabled: !!projectId, queryKey: getGetProjectEstimateQueryKey(projectId) } });
  const { data: catalogMaterials } = useListMaterials();

  // Cotización final: cantidades que el usuario digita a mano (se guardan en el navegador)
  const finalQtyKey = `biocasa-final-qty-${projectId}`;
  const [finalQty, setFinalQty] = useState<Record<number, number>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem(finalQtyKey);
      setFinalQty(saved ? JSON.parse(saved) : {});
    } catch { setFinalQty({}); }
  }, [finalQtyKey]);
  const setQty = (materialId: number, value: number) => {
    setFinalQty(prev => {
      const next = { ...prev };
      if (value > 0) next[materialId] = value;
      else delete next[materialId];
      try { localStorage.setItem(finalQtyKey, JSON.stringify(next)); } catch { /* sin espacio */ }
      return next;
    });
  };
  // Costos adicionales de la cotización final (arquitecto, permisos, maestría)
  const EXTRA_ITEMS = [
    { key: "arquitecto", label: "Firma del arquitecto (diseño y planos)" },
    { key: "permisos", label: "Permisos y licencia de construcción" },
    { key: "maestria", label: "Maestría (dirección de obra)" },
  ] as const;
  const finalExtraKey = `biocasa-final-extra-${projectId}`;
  const [finalExtras, setFinalExtras] = useState<Record<string, number>>({});
  useEffect(() => {
    try {
      const saved = localStorage.getItem(finalExtraKey);
      setFinalExtras(saved ? JSON.parse(saved) : {});
    } catch { setFinalExtras({}); }
  }, [finalExtraKey]);
  const setExtra = (key: string, value: number) => {
    setFinalExtras(prev => {
      const next = { ...prev };
      if (value > 0) next[key] = value;
      else delete next[key];
      try { localStorage.setItem(finalExtraKey, JSON.stringify(next)); } catch { /* sin espacio */ }
      return next;
    });
  };
  const extrasTotal = EXTRA_ITEMS.reduce((sum, it) => sum + (finalExtras[it.key] || 0), 0);
  const materialsTotal = (catalogMaterials || []).reduce((sum, m) => sum + (finalQty[m.id] || 0) * m.unitPrice, 0);
  const finalTotal = materialsTotal + extrasTotal;

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  const [terrainDialogOpen, setTerrainDialogOpen] = useState(false);
  const [selectedFloor, setSelectedFloorRaw] = useState<number>(1);
  // Al cambiar de piso se descarta cualquier recorrido a medio dibujar,
  // para no guardar puntos de un piso en el otro.
  const setSelectedFloor = (floor: number) => {
    setSelectedFloorRaw(floor);
    setDraftPoints([]);
  };
  const [viewMode, setViewMode] = useState<"2d" | "3d" | "tecnico">("2d");
  const [wizardOpen, setWizardOpen] = useState(false);

  // Instalaciones eléctricas y de agua sobre el plano
  const { data: installations } = useListInstallations(projectId);
  const createInstallation = useCreateInstallation();
  const deleteInstallation = useDeleteInstallation();
  const [visibleLayers, setVisibleLayers] = useState<Record<InstallLayer, boolean>>({ electrica: true, agua: true, sanitaria: true });
  const [activeTool, setActiveTool] = useState<InstallTool>(null);
  const [draftPoints, setDraftPoints] = useState<{ x: number; y: number }[]>([]);

  const invalidateInstallations = () =>
    queryClient.invalidateQueries({ queryKey: getListInstallationsQueryKey(projectId) });

  const handlePlanTap = (x: number, y: number) => {
    if (!activeTool) return;
    const isRun = INSTALL_STYLES[activeTool.kind]?.run;
    if (isRun) {
      setDraftPoints(prev => [...prev, { x, y }]);
      return;
    }
    createInstallation.mutate(
      { id: projectId, data: { floor: selectedFloor, layer: activeTool.layer, kind: activeTool.kind, points: [{ x, y }] } },
      { onSuccess: invalidateInstallations },
    );
  };

  const handleFinishRun = () => {
    if (!activeTool || draftPoints.length < 2) {
      setDraftPoints([]);
      return;
    }
    createInstallation.mutate(
      { id: projectId, data: { floor: selectedFloor, layer: activeTool.layer, kind: activeTool.kind, points: draftPoints } },
      { onSuccess: () => { invalidateInstallations(); setDraftPoints([]); } },
    );
  };

  const handleInstallationClick = (inst: Installation) => {
    const label = INSTALL_STYLES[inst.kind]?.label ?? inst.kind;
    if (window.confirm(`¿Borrar "${label}" del plano?`)) {
      deleteInstallation.mutate({ id: inst.id }, { onSuccess: invalidateInstallations });
    }
  };

  const selectTool = (layer: InstallLayer, kind: Installation["kind"]) => {
    setDraftPoints([]);
    setActiveTool(prev => (prev && prev.layer === layer && prev.kind === kind ? null : { layer, kind }));
    setVisibleLayers(prev => ({ ...prev, [layer]: true }));
  };

  const roomForm = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: { name: "", floor: 1, kind: "habitacion", widthM: 3, lengthM: 3, heightM: 2.5, posX: 0, posY: 0 },
  });

  const terrainForm = useForm<z.infer<typeof terrainSchema>>({
    resolver: zodResolver(terrainSchema),
    defaultValues: {
      terrainAccess: null,
      terrainSlope: null,
      waterDistanceM: null,
      canStay: false,
      canCook: false,
      numPeople: null,
      targetMonths: null,
    },
  });

  const handleOpenNewRoom = () => {
    setEditingRoom(null);
    roomForm.reset({ name: "", floor: selectedFloor, kind: "habitacion", widthM: 3, lengthM: 3, heightM: 2.5, posX: 0, posY: 0 });
    setRoomDialogOpen(true);
  };

  const handleOpenEditRoom = (r: Room) => {
    setEditingRoom(r);
    roomForm.reset({
      name: r.name,
      floor: r.floor ?? 1,
      kind: r.kind,
      widthM: r.widthM,
      lengthM: r.lengthM,
      heightM: r.heightM,
      posX: r.posX ?? 0,
      posY: r.posY ?? 0,
    });
    setRoomDialogOpen(true);
  };

  const handleOpenEditTerrain = () => {
    if (project) {
      terrainForm.reset({
        terrainAccess: project.terrainAccess || null,
        terrainSlope: project.terrainSlope || null,
        waterDistanceM: project.waterDistanceM || null,
        canStay: project.canStay || false,
        canCook: project.canCook || false,
        numPeople: project.numPeople || null,
        targetMonths: project.targetMonths || null,
      });
    }
    setTerrainDialogOpen(true);
  };

  const onTerrainSubmit = (values: z.infer<typeof terrainSchema>) => {
    updateProject.mutate(
      { id: projectId, data: values },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setTerrainDialogOpen(false);
        }
      }
    );
  };

  const onRoomSubmit = (values: z.infer<typeof roomSchema>) => {
    if (editingRoom) {
      updateRoom.mutate(
        { id: editingRoom.id, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
            setRoomDialogOpen(false);
          }
        }
      );
    } else {
      createRoom.mutate(
        { id: projectId, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(projectId) });
            queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
            setRoomDialogOpen(false);
          }
        }
      );
    }
  };

  const onRoomDrop = (room: Room, posX: number, posY: number) => {
    updateRoom.mutate(
      { id: room.id, data: { posX, posY } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
        }
      }
    );
  };

  const handleDeleteRoom = (id: number) => {
    if (confirm("¿Eliminar este espacio?")) {
      deleteRoom.mutate({ id }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
          setRoomDialogOpen(false);
        }
      });
    }
  };

  const handleDeleteProject = () => {
    if (confirm("¿Estás seguro de eliminar todo el proyecto? Esta acción no se puede deshacer.")) {
      deleteProject.mutate({ id: projectId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          setLocation("/");
        }
      });
    }
  };

  const updateProjectStatus = (status: any) => {
    updateProject.mutate(
      { id: projectId, data: { status } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
        }
      }
    );
  };

  const updateProjectSystem = (field: 'wallSystem' | 'roofType', val: any) => {
    updateProject.mutate(
      { id: projectId, data: { [field]: val } },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
        }
      }
    );
  };

  const [linkInput, setLinkInput] = useState("");

  const addReferenceLink = () => {
    if (!linkInput || !project) return;
    try {
      const parsed = new URL(linkInput);
      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error("protocolo no permitido");
      }
      const newLinks = [...(project.referenceLinks || []), linkInput];
      updateProject.mutate({ id: projectId, data: { referenceLinks: newLinks } }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
          setLinkInput("");
        }
      });
    } catch (e) {
      alert("Por favor ingresa una URL válida (ej. https://youtube.com/...)");
    }
  };

  const removeReferenceLink = (index: number) => {
    if (!project) return;
    const newLinks = [...(project.referenceLinks || [])];
    newLinks.splice(index, 1);
    updateProject.mutate({ id: projectId, data: { referenceLinks: newLinks } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
      }
    });
  };

  if (projectLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) return <div className="p-8">Proyecto no encontrado</div>;

  const hasMissingPrices = estimate?.items.some(i => !i.priced);

  return (
    <div className="animate-in fade-in duration-500 pb-24">
      <div className="relative w-full h-[250px] md:h-[300px] flex items-end overflow-hidden bg-primary mb-8">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroCasa})`, backgroundPositionY: '30%' }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#16291a]/90 via-[#16291a]/50 to-transparent" />
        
        <div className="relative z-10 w-full max-w-7xl mx-auto px-4 md:px-8 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div className="text-white">
            <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-4 -ml-3 text-white/80 hover:text-white hover:bg-white/10">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Volver al panel
            </Button>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl md:text-5xl font-serif font-bold tracking-tight">{project.name}</h1>
              <Badge variant="outline" className="text-sm bg-white/10 border-white/20 text-white backdrop-blur-sm">
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
            </div>
            {project.location && <p className="text-white/80 flex items-center gap-1.5"><Map className="w-4 h-4" /> {project.location}</p>}
            {project.description && <p className="text-white/70 mt-2 max-w-2xl font-light">{project.description}</p>}
          </div>
          
          <div className="flex items-center gap-2 pb-1">
            <Select value={project.status} onValueChange={updateProjectStatus}>
              <SelectTrigger className="w-[180px] bg-white/10 text-white border-white/20 hover:bg-white/20 backdrop-blur-md">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diseno">Diseño</SelectItem>
                <SelectItem value="cotizado">Cotizado</SelectItem>
                <SelectItem value="construccion">En Construcción</SelectItem>
                <SelectItem value="terminado">Terminado</SelectItem>
              </SelectContent>
            </Select>
            
            <Button variant="destructive" size="icon" onClick={handleDeleteProject} title="Eliminar proyecto" className="bg-red-500/80 hover:bg-red-500 border border-white/20 shadow-sm backdrop-blur-md">
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="px-4 md:px-8 max-w-7xl mx-auto space-y-6">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
          <Card className="lg:col-span-1 border-primary/20 bg-primary/5 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <CardTitle className="text-base text-primary">Evaluación del Terreno</CardTitle>
                <Button variant="ghost" size="sm" className="h-8 px-2 text-primary hover:bg-primary/10" onClick={handleOpenEditTerrain}>
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
              </div>
            </CardHeader>
          <CardContent className="text-sm space-y-3 pb-4">
            {(!project.terrainAccess && !project.terrainSlope && !project.waterDistanceM && project.canStay == null) ? (
              <p className="text-muted-foreground text-center py-4 bg-background/50 rounded border border-dashed">
                Completa el checklist de visita al sitio.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><Map className="w-3 h-3" /> Acceso</span>
                  <p className="font-medium capitalize">{project.terrainAccess?.replace('_', ' ') || 'No evaluado'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><Map className="w-3 h-3" /> Pendiente</span>
                  <p className="font-medium capitalize">{project.terrainSlope?.replace('_', ' ') || 'No evaluado'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><Droplets className="w-3 h-3" /> Agua a</span>
                  <p className="font-medium">{project.waterDistanceM != null ? `${project.waterDistanceM}m` : 'N/A'}</p>
                </div>
                <div className="space-y-1">
                  <span className="text-muted-foreground text-xs flex items-center gap-1"><Clock className="w-3 h-3" /> Meta</span>
                  <p className="font-medium">{project.targetMonths != null ? `${project.targetMonths} meses` : 'N/A'}</p>
                </div>
                <div className="space-y-1 col-span-2 mt-2 pt-2 border-t border-primary/10">
                  <div className="flex items-center justify-between text-muted-foreground text-xs">
                    <span className="flex items-center gap-1"><Users className="w-3 h-3" /> Habitantes: {project.numPeople || '-'}</span>
                    <span className="flex items-center gap-1"><Home className="w-3 h-3" /> Campamento: {project.canStay ? 'Sí' : 'No'}</span>
                    <span className="flex items-center gap-1"><Flame className="w-3 h-3" /> Cocina: {project.canCook ? 'Sí' : 'No'}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-1 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-muted-foreground">Sistemas Constructivos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Sistema de Muros</p>
              <Select value={project.wallSystem} onValueChange={(v) => updateProjectSystem('wallSystem', v)}>
                <SelectTrigger className="w-full border-none shadow-none bg-accent/50 hover:bg-accent h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bahareque">Bahareque</SelectItem>
                  <SelectItem value="tapia_pisada">Tapia Pisada</SelectItem>
                  <SelectItem value="adobe">Adobe</SelectItem>
                  <SelectItem value="guadua_vista">Guadua a la vista</SelectItem>
                  <SelectItem value="mixta">Mixta (adobe + bahareque)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Tipo de Cubierta</p>
              <Select value={project.roofType} onValueChange={(v) => updateProjectSystem('roofType', v)}>
                <SelectTrigger className="w-full border-none shadow-none bg-accent/50 hover:bg-accent h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="teja_barro">Teja de Barro</SelectItem>
                  <SelectItem value="palma">Palma</SelectItem>
                  <SelectItem value="zinc">Zinc</SelectItem>
                  <SelectItem value="techo_verde">Techo Verde</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
        
          <Card className="lg:col-span-1 shadow-sm hover:shadow-md transition-all duration-300 hover:-translate-y-1">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-primary">Videos y Referencias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Input 
                  placeholder="https://..." 
                  value={linkInput} 
                  onChange={(e) => setLinkInput(e.target.value)}
                  onKeyDown={(e) => { if(e.key === 'Enter') addReferenceLink(); }}
                />
                <Button size="icon" variant="secondary" onClick={addReferenceLink} disabled={!linkInput || updateProject.isPending}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="space-y-2">
                {(!project.referenceLinks || project.referenceLinks.length === 0) ? (
                  <p className="text-sm text-muted-foreground text-center py-4">No has guardado referencias aún.</p>
                ) : (
                  project.referenceLinks.map((link, i) => {
                    let domain = link;
                    try { domain = new URL(link).hostname.replace('www.', ''); } catch(e){}
                    return (
                      <div key={i} className="flex items-center justify-between bg-muted/30 border rounded-md p-2 text-sm group">
                        <a href={link} target="_blank" rel="noreferrer" className="flex items-center gap-2 truncate text-foreground hover:text-primary transition-colors">
                          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                          <span className="truncate">{domain}</span>
                        </a>
                        <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all" onClick={() => removeReferenceLink(i)}>
                          <X className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    )
                  })
                )}
              </div>
            </CardContent>
          </Card>

        {estimate && (
          <Card className="bg-primary text-primary-foreground border-primary-border shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 lg:col-span-1">
            <CardContent className="p-4 flex flex-col justify-center h-full">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-sm font-medium opacity-80">Costo Total Estimado</p>
                  <h3 className="text-3xl font-bold font-serif mt-1">{formatCOP(estimate.totalCost || 0)}</h3>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium opacity-80">Área Techada</p>
                  <h3 className="text-xl font-bold mt-1">{formatArea(estimate.roofAreaM2 || 0)}</h3>
                </div>
              </div>
              {hasMissingPrices && (
                <p className="text-xs flex items-center gap-1 mt-auto bg-black/10 w-fit px-2 py-1 rounded-full">
                  <AlertCircle className="w-3 h-3" /> Faltan precios de materiales en catálogo
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      <MeasureWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        floor={selectedFloor}
        saving={createRoom.isPending}
        onAddRoom={async (r: WizardRoom) => {
          // Colocar el espacio nuevo sin encimarlo sobre los existentes:
          // a la derecha del plano actual, y salto de fila cada 14 m de ancho.
          const floorRooms = (rooms || []).filter(rm => (rm.floor ?? 1) === selectedFloor);
          let posX = 0, posY = 0;
          if (floorRooms.length > 0) {
            const maxX = Math.max(...floorRooms.map((rm, i) => (rm.posX ?? i * 5) + rm.widthM));
            if (maxX + r.widthM <= 14) {
              posX = maxX + 0.5;
            } else {
              posY = Math.max(...floorRooms.map((rm) => (rm.posY ?? 0) + rm.lengthM)) + 0.5;
            }
          }
          await createRoom.mutateAsync({ id: projectId, data: { ...r, posX, posY } });
          queryClient.invalidateQueries({ queryKey: getListRoomsQueryKey(projectId) });
          queryClient.invalidateQueries({ queryKey: getGetProjectEstimateQueryKey(projectId) });
        }}
      />
      <Tabs defaultValue="plano" className="mt-8">
        <TabsList className="grid w-full md:w-auto grid-cols-1 sm:grid-cols-3 h-auto p-1 bg-muted/50">
          <TabsTrigger value="plano" className="py-2.5">Diseño de Planos</TabsTrigger>
          <TabsTrigger value="cotizacion" className="py-2.5">Cotización preliminar</TabsTrigger>
          <TabsTrigger value="cotizacion-final" className="py-2.5">Cotización final</TabsTrigger>
        </TabsList>
        
        <TabsContent value="plano" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="h-full border-muted-foreground/20 shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="bg-muted/30 pb-4 border-b flex-col md:flex-row md:items-center justify-between space-y-4 md:space-y-0">
                  <div>
                    <CardTitle>{viewMode === "2d" ? "Plano Arquitectónico 2D" : "Vista Isométrica 3D"}</CardTitle>
                    <CardDescription>{viewMode === "2d" ? "Haz clic para editar. Arrastra para mover (ajuste a 0.5m)." : "Explora los volúmenes del diseño. Haz clic para editar."}</CardDescription>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="flex bg-background border rounded-lg p-1">
                      <Button variant={viewMode === "2d" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("2d")} className="h-7 text-xs px-3">
                        Plano 2D
                      </Button>
                      <Button variant={viewMode === "3d" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("3d")} className="h-7 text-xs px-3">
                        Vista 3D
                      </Button>
                      <Button variant={viewMode === "tecnico" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("tecnico")} className="h-7 text-xs px-3">
                        Plano técnico
                      </Button>
                    </div>
                    <Button variant="outline" size="sm" className="h-9 text-xs" onClick={() => setWizardOpen(true)}>
                      📐 Asistente de medidas
                    </Button>
                    {viewMode !== "3d" && (
                      <div className="flex bg-background border rounded-lg p-1">
                        <Button variant={selectedFloor === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedFloor(1)} className="h-7 text-xs px-3">
                          Piso 1
                        </Button>
                        <Button variant={selectedFloor === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedFloor(2)} className="h-7 text-xs px-3">
                          Piso 2
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  {roomsLoading ? (
                    <div className="flex items-center justify-center min-h-[500px]">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : viewMode === "3d" ? (
                    <Suspense fallback={<div className="flex items-center justify-center min-h-[500px]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
                      <PlanViewer3DScene rooms={rooms || []} wallSystem={project.wallSystem} roofType={project.roofType} installations={installations || []} />
                    </Suspense>
                  ) : viewMode === "tecnico" ? (
                    <TechnicalPlan
                      project={project}
                      rooms={rooms || []}
                      floor={selectedFloor}
                      onSaveOwner={(owner) => updateProject.mutate(
                        { id: projectId, data: { owner } },
                        { onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) }) },
                      )}
                    />
                  ) : (
                    <PlanViewer
                      rooms={rooms || []}
                      selectedFloor={selectedFloor}
                      onRoomClick={handleOpenEditRoom}
                      onRoomDrop={onRoomDrop}
                      installations={installations || []}
                      visibleLayers={visibleLayers}
                      activeTool={activeTool}
                      draftPoints={draftPoints}
                      onPlanTap={handlePlanTap}
                      onInstallationClick={handleInstallationClick}
                    />
                  )}
                </CardContent>
                {viewMode === "2d" && (
                  <div className="border-t bg-muted/20 p-3 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Instalaciones:</span>
                      <Button
                        variant={visibleLayers.electrica ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-3"
                        onClick={() => setVisibleLayers(p => ({ ...p, electrica: !p.electrica }))}
                      >
                        ⚡ Eléctrica {visibleLayers.electrica ? "" : "(oculta)"}
                      </Button>
                      <Button
                        variant={visibleLayers.agua ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-3"
                        onClick={() => setVisibleLayers(p => ({ ...p, agua: !p.agua }))}
                      >
                        💧 Agua limpia {visibleLayers.agua ? "" : "(oculta)"}
                      </Button>
                      <Button
                        variant={visibleLayers.sanitaria ? "secondary" : "ghost"} size="sm" className="h-7 text-xs px-3"
                        onClick={() => setVisibleLayers(p => ({ ...p, sanitaria: !p.sanitaria }))}
                      >
                        🚽 Aguas sucias {visibleLayers.sanitaria ? "" : "(oculta)"}
                      </Button>
                      {activeTool && (
                        <Badge variant="outline" className="text-xs">
                          Colocando: {INSTALL_STYLES[activeTool.kind]?.label}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {ELECTRICA_KINDS.map(k => (
                        <Button key={k}
                          variant={activeTool?.kind === k ? "default" : "outline"} size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => selectTool("electrica", k)}
                        >
                          {INSTALL_STYLES[k].short} {INSTALL_STYLES[k].label.split(" ")[0]}
                        </Button>
                      ))}
                      <span className="mx-1 text-muted-foreground">|</span>
                      {AGUA_KINDS.map(k => (
                        <Button key={k}
                          variant={activeTool?.kind === k && activeTool.layer === "agua" ? "default" : "outline"} size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => selectTool("agua", k)}
                        >
                          {INSTALL_STYLES[k].short} {INSTALL_STYLES[k].label.split(" ")[0]}
                        </Button>
                      ))}
                      <span className="mx-1 text-muted-foreground">|</span>
                      {SANITARIA_KINDS.map(k => (
                        <Button key={`s-${k}`}
                          variant={activeTool?.kind === k && activeTool.layer === "sanitaria" ? "default" : "outline"} size="sm"
                          className="h-7 text-xs px-2"
                          onClick={() => selectTool("sanitaria", k)}
                        >
                          {INSTALL_STYLES[k].short} {INSTALL_STYLES[k].label.split(" ")[0]} 🚽
                        </Button>
                      ))}
                    </div>
                    {activeTool && INSTALL_STYLES[activeTool.kind]?.run && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">Toca el plano punto por punto ({draftPoints.length} puntos)</span>
                        <Button size="sm" className="h-7 text-xs" disabled={draftPoints.length < 2} onClick={handleFinishRun}>
                          Guardar recorrido
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => { setDraftPoints([]); setActiveTool(null); }}>
                          Cancelar
                        </Button>
                      </div>
                    )}
                    {activeTool && !INSTALL_STYLES[activeTool.kind]?.run && (
                      <p className="text-xs text-muted-foreground">
                        Toca el plano para colocar. Vuelve a pulsar el botón para salir. Toca un símbolo ya puesto para borrarlo.
                      </p>
                    )}
                  </div>
                )}
              </Card>
            </div>
            
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="font-serif font-semibold text-lg">Lista de Espacios</h3>
                <Button size="sm" onClick={handleOpenNewRoom}>
                  <Plus className="w-4 h-4 mr-1" /> Agregar
                </Button>
              </div>
              
              <div className="space-y-3 overflow-y-auto max-h-[600px] pr-2">
                {!rooms || rooms.length === 0 ? (
                  <p className="text-sm text-muted-foreground p-4 bg-muted/30 rounded-lg text-center">
                    No hay espacios definidos.
                  </p>
                ) : (
                  rooms.map(room => (
                    <Card key={room.id} className="cursor-pointer hover:border-primary/50 transition-colors" onClick={() => handleOpenEditRoom(room)}>
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <div className="font-medium flex items-center gap-2">
                            {room.name}
                            <Badge variant="outline" className="text-[10px] h-4 py-0 border-transparent bg-muted">Piso {room.floor}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{room.kind} • {room.widthM}m × {room.lengthM}m</p>
                        </div>
                        <div className="text-right text-sm">
                          <p className="font-medium text-primary">{formatArea(room.widthM * room.lengthM)}</p>
                          <p className="text-xs text-muted-foreground">x: {room.posX||0}, y: {room.posY||0}</p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </div>
          </div>
        </TabsContent>
        
        <TabsContent value="cotizacion" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cotización preliminar (sin ultimar detalles)</CardTitle>
              <CardDescription>
                Calculada automáticamente con las medidas de los {rooms?.length || 0} espacios: la app toma los metros cuadrados de pisos, muros y techo, les aplica un rendimiento por m² para cada material (la fórmula aparece debajo de cada ítem) y multiplica por el precio del catálogo. <br/>
                <span className="text-primary/80 font-medium">Es una aproximación de anteproyecto para tener un orden de magnitud. Cuando tengas la lista definitiva de materiales, usa la pestaña "Cotización final". El rubro "Otros" (con unidad "día") corresponde a jornadas de obra.</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              {estimateLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
              ) : !estimate || estimate.items.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No hay estimación disponible. Agrega espacios al proyecto.
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(
                    estimate.items.reduce((acc, item) => {
                      if (!acc[item.category]) acc[item.category] = [];
                      acc[item.category].push(item);
                      return acc;
                    }, {} as Record<string, typeof estimate.items>)
                  ).map(([category, items]) => (
                    <div key={category}>
                      <h4 className="font-serif font-semibold text-lg capitalize mb-3 text-primary border-b pb-1 flex items-center gap-2">
                        {category}
                      </h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Ítem</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">V. Unitario</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                <div className="flex flex-col gap-0.5">
                                  <div className="flex items-center gap-2">
                                    {item.materialName}
                                    {!item.priced && (
                                      <Badge variant="destructive" className="py-0 h-4 px-1.5 text-[10px] uppercase font-bold tracking-wider">¡Añade precio en el catálogo!</Badge>
                                    )}
                                  </div>
                                  {item.formula && (
                                    <span className="text-[11px] text-muted-foreground font-normal leading-tight opacity-80">{item.formula}</span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground align-top pt-3">
                                {item.quantity.toLocaleString("es-CO", { maximumFractionDigits: 1 })} {item.unit}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground align-top pt-3">
                                {item.priced ? formatCOP(item.unitPrice || 0) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium align-top pt-3">
                                {formatCOP(item.subtotal || 0)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={3} className="text-right font-medium text-muted-foreground">Subtotal {category}:</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCOP(items.reduce((sum, i) => sum + (i.subtotal || 0), 0))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  
                  <div className="flex justify-end pt-6 border-t border-primary/20">
                    <div className="bg-primary/5 px-8 py-4 rounded-xl border border-primary/20 text-right">
                      <p className="text-sm text-primary font-medium mb-1">Costo Total Directo</p>
                      <h2 className="text-4xl font-serif font-bold text-foreground">{formatCOP(estimate.totalCost)}</h2>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cotizacion-final" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Cotización final</CardTitle>
              <CardDescription>
                Cuando ya tengas la lista definitiva de materiales, escribe aquí la cantidad de cada uno y el total sale al instante con los precios de tu catálogo. Las cantidades se guardan en este navegador.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!catalogMaterials || catalogMaterials.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  No hay materiales en el catálogo. Agrégalos primero en la página de Materiales.
                </div>
              ) : (
                <div className="space-y-8">
                  {Object.entries(
                    catalogMaterials.reduce((acc, m) => {
                      if (!acc[m.category]) acc[m.category] = [];
                      acc[m.category].push(m);
                      return acc;
                    }, {} as Record<string, typeof catalogMaterials>)
                  ).map(([category, mats]) => (
                    <div key={category}>
                      <h4 className="font-serif font-semibold text-lg capitalize mb-3 text-primary border-b pb-1">{category}</h4>
                      <Table>
                        <TableHeader>
                          <TableRow className="hover:bg-transparent">
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">V. Unitario</TableHead>
                            <TableHead className="text-right w-[130px]">Cantidad</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {mats.map((m) => (
                            <TableRow key={m.id}>
                              <TableCell className="font-medium">{m.name} <span className="text-muted-foreground font-normal">({m.unit})</span></TableCell>
                              <TableCell className="text-right text-muted-foreground">{formatCOP(m.unitPrice)}</TableCell>
                              <TableCell className="text-right">
                                <Input
                                  type="number"
                                  min={0}
                                  step="any"
                                  inputMode="decimal"
                                  className="w-[110px] ml-auto text-right"
                                  value={finalQty[m.id] ?? ""}
                                  placeholder="0"
                                  onChange={(e) => setQty(m.id, Number(e.target.value) || 0)}
                                />
                              </TableCell>
                              <TableCell className="text-right font-medium">
                                {finalQty[m.id] ? formatCOP(Math.round(finalQty[m.id] * m.unitPrice)) : "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow className="bg-muted/50 hover:bg-muted/50">
                            <TableCell colSpan={3} className="text-right font-medium text-muted-foreground">Subtotal {category}:</TableCell>
                            <TableCell className="text-right font-bold">
                              {formatCOP(Math.round(mats.reduce((sum, m) => sum + (finalQty[m.id] || 0) * m.unitPrice, 0)))}
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  <div>
                    <h4 className="font-serif font-semibold text-lg mb-3 text-primary border-b pb-1">Costos adicionales</h4>
                    <Table>
                      <TableHeader>
                        <TableRow className="hover:bg-transparent">
                          <TableHead>Concepto</TableHead>
                          <TableHead className="text-right w-[200px]">Valor (COP)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {EXTRA_ITEMS.map((it) => (
                          <TableRow key={it.key}>
                            <TableCell className="font-medium">{it.label}</TableCell>
                            <TableCell className="text-right">
                              <Input
                                type="number"
                                min={0}
                                step="any"
                                inputMode="numeric"
                                className="w-[180px] ml-auto text-right"
                                value={finalExtras[it.key] ?? ""}
                                placeholder="0"
                                onChange={(e) => setExtra(it.key, Number(e.target.value) || 0)}
                              />
                            </TableCell>
                          </TableRow>
                        ))}
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell className="text-right font-medium text-muted-foreground">Subtotal adicionales:</TableCell>
                          <TableCell className="text-right font-bold">{formatCOP(Math.round(extrasTotal))}</TableCell>
                        </TableRow>
                      </TableBody>
                    </Table>
                  </div>

                  <div className="flex justify-end pt-6 border-t border-primary/20">
                    <div className="bg-primary/5 px-8 py-4 rounded-xl border border-primary/20 text-right">
                      <p className="text-sm text-muted-foreground mb-1">Materiales: {formatCOP(Math.round(materialsTotal))} + Adicionales: {formatCOP(Math.round(extrasTotal))}</p>
                      <p className="text-sm text-primary font-medium mb-1">Total cotización final</p>
                      <h2 className="text-4xl font-serif font-bold text-foreground">{formatCOP(Math.round(finalTotal))}</h2>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog para crear/editar Room */}
      <Dialog open={roomDialogOpen} onOpenChange={setRoomDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingRoom ? "Editar Espacio" : "Agregar Nuevo Espacio"}</DialogTitle>
          </DialogHeader>
          <Form {...roomForm}>
            <form onSubmit={roomForm.handleSubmit(onRoomSubmit)} className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={roomForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input placeholder="Ej. Habitación Principal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="floor"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Piso</FormLabel>
                      <Select onValueChange={field.onChange} value={String(field.value)}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="1">Piso 1</SelectItem>
                          <SelectItem value="2">Piso 2 / Mezzanine</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={roomForm.control}
                name="kind"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tipo</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="habitacion">Habitación</SelectItem>
                        <SelectItem value="sala">Sala</SelectItem>
                        <SelectItem value="cocina">Cocina</SelectItem>
                        <SelectItem value="bano">Baño</SelectItem>
                        <SelectItem value="comedor">Comedor</SelectItem>
                        <SelectItem value="corredor">Corredor / Pasillo</SelectItem>
                        <SelectItem value="taller">Taller / Estudio</SelectItem>
                        <SelectItem value="otro">Otro</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4 border-t pt-4">
                <h4 className="col-span-3 text-sm font-semibold mb-[-10px]">Dimensiones (metros)</h4>
                <FormField
                  control={roomForm.control}
                  name="widthM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ancho</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="lengthM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Largo</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="heightM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Altura Muro</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4 border-t pt-4">
                <h4 className="col-span-2 text-sm font-semibold mb-[-10px]">Posición en el Plano (metros)</h4>
                <FormField
                  control={roomForm.control}
                  name="posX"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Eje X (→)</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} value={field.value ?? 0} /></FormControl>
                      <FormDescription>Posición horizontal</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={roomForm.control}
                  name="posY"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Eje Y (↓)</FormLabel>
                      <FormControl><Input type="number" step="0.1" {...field} value={field.value ?? 0} /></FormControl>
                      <FormDescription>Posición vertical</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <DialogFooter className="pt-4 flex !justify-between items-center sm:justify-between">
                {editingRoom ? (
                  <Button type="button" variant="destructive" onClick={() => handleDeleteRoom(editingRoom.id)}>
                    Eliminar
                  </Button>
                ) : <div />}
                <Button type="submit" disabled={createRoom.isPending || updateRoom.isPending}>
                  {(createRoom.isPending || updateRoom.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {editingRoom ? "Guardar Cambios" : "Agregar Espacio"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Dialog para Terrain Evaluation */}
      <Dialog open={terrainDialogOpen} onOpenChange={setTerrainDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Evaluación del Terreno</DialogTitle>
            <DialogDescription>Checklist para preparar la obra en el sitio.</DialogDescription>
          </DialogHeader>
          <Form {...terrainForm}>
            <form onSubmit={terrainForm.handleSubmit(onTerrainSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={terrainForm.control}
                  name="terrainAccess"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Acceso Vehicular</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="facil">Fácil</SelectItem>
                          <SelectItem value="medio">Medio</SelectItem>
                          <SelectItem value="dificil">Difícil</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={terrainForm.control}
                  name="terrainSlope"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Pendiente</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value || undefined}>
                        <FormControl><SelectTrigger><SelectValue placeholder="Seleccionar" /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="plano">Plano</SelectItem>
                          <SelectItem value="pendiente_suave">Suave</SelectItem>
                          <SelectItem value="pendiente_fuerte">Fuerte</SelectItem>
                        </SelectContent>
                      </Select>
                    </FormItem>
                  )}
                />
                <FormField
                  control={terrainForm.control}
                  name="waterDistanceM"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Dist. al Agua (m)</FormLabel>
                      <FormControl><Input type="number" placeholder="Metros" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={terrainForm.control}
                  name="targetMonths"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Tiempo Meta (meses)</FormLabel>
                      <FormControl><Input type="number" placeholder="Meses" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={terrainForm.control}
                  name="numPeople"
                  render={({ field }) => (
                    <FormItem className="col-span-2">
                      <FormLabel>Número de Habitantes Previsto</FormLabel>
                      <FormControl><Input type="number" placeholder="Ej. 4" {...field} value={field.value ?? ""} /></FormControl>
                    </FormItem>
                  )}
                />
                
                <div className="col-span-2 flex items-center justify-between border rounded-lg p-3 bg-muted/20">
                  <FormField
                    control={terrainForm.control}
                    name="canStay"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-1">
                        <FormLabel className="text-sm">Campamento en obra</FormLabel>
                        <FormDescription className="text-xs">¿El equipo puede pernoctar?</FormDescription>
                        <FormControl>
                          <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={terrainForm.control}
                    name="canCook"
                    render={({ field }) => (
                      <FormItem className="flex flex-col space-y-1 items-end">
                        <FormLabel className="text-sm">Cocina en obra</FormLabel>
                        <FormDescription className="text-xs">¿Se puede cocinar?</FormDescription>
                        <FormControl>
                          <Switch checked={field.value || false} onCheckedChange={field.onChange} />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              <DialogFooter className="pt-4">
                <Button type="submit" disabled={updateProject.isPending}>
                  {updateProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Guardar Evaluación
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
    </div>
  );
}
