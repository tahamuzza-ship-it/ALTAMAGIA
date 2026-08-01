import { useState, useRef, useMemo } from "react";
import { useRoute, useLocation } from "wouter";
import { 
  useGetProject, useUpdateProject, useDeleteProject, 
  useListRooms, useCreateRoom, useUpdateRoom, useDeleteRoom, 
  useGetProjectEstimate, getGetProjectQueryKey, getListRoomsQueryKey, getGetProjectEstimateQueryKey, getListProjectsQueryKey
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { 
  Loader2, ArrowLeft, Trash2, Pencil, Plus, Maximize, AlertCircle, Map, Droplets, Home, Clock, Users, Flame
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { formatCOP, formatArea } from "@/lib/format";
import { Room } from "@workspace/api-client-react";

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

function PlanViewer({ rooms, selectedFloor, onRoomClick, onRoomDrop }: { rooms: Room[], selectedFloor: number, onRoomClick: (r: Room) => void, onRoomDrop: (r: Room, posX: number, posY: number) => void }) {
  const padding = 2;
  const svgRef = useRef<SVGSVGElement>(null);
  
  const [dragState, setDragState] = useState<{ roomId: number; offsetX: number; offsetY: number; x: number; y: number; moved: boolean } | null>(null);

  const floorRooms = rooms.filter(r => r.floor === selectedFloor);

  const handlePointerDown = (e: React.PointerEvent<SVGGElement>, room: Room, displayedX: number, displayedY: number) => {
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
        className="w-full h-full max-h-[70vh] drop-shadow-sm touch-none"
        preserveAspectRatio="xMidYMid meet"
      >
        {floorRooms.map((r, i) => {
          const isDragging = dragState?.roomId === r.id;
          const x = isDragging ? dragState!.x : (r.posX ?? (i * 5));
          const y = isDragging ? dragState!.y : (r.posY ?? 0);
          return (
            <g 
              key={r.id} 
              transform={`translate(${x}, ${y})`} 
              className={`cursor-grab active:cursor-grabbing transition-all ${isDragging ? 'opacity-80' : ''}`}
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
              />
              <rect 
                x={0.1} y={0.1} 
                width={r.widthM - 0.2} 
                height={r.lengthM - 0.2} 
                className="fill-transparent stroke-muted/30 stroke-[0.05]"
              />
              <text 
                x={r.widthM / 2} 
                y={r.lengthM / 2} 
                textAnchor="middle" 
                dominantBaseline="middle"
                className="text-[0.4px] font-sans fill-foreground font-medium pointer-events-none select-none"
              >
                {r.name}
              </text>
              <text 
                x={r.widthM / 2} 
                y={r.lengthM / 2 + 0.6} 
                textAnchor="middle" 
                dominantBaseline="middle"
                className="text-[0.25px] font-sans fill-muted-foreground pointer-events-none select-none"
              >
                {r.widthM}m × {r.lengthM}m
              </text>
            </g>
          );
        })}
      </svg>
      <div className="absolute bottom-4 right-4 bg-background/80 backdrop-blur border text-xs px-3 py-1.5 rounded-md text-muted-foreground flex items-center gap-2">
        <Maximize className="w-3 h-3" />
        Arrastra para mover
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

  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const createRoom = useCreateRoom();
  const updateRoom = useUpdateRoom();
  const deleteRoom = useDeleteRoom();

  const [roomDialogOpen, setRoomDialogOpen] = useState(false);
  const [editingRoom, setEditingRoom] = useState<Room | null>(null);
  
  const [terrainDialogOpen, setTerrainDialogOpen] = useState(false);
  const [selectedFloor, setSelectedFloor] = useState<number>(1);

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
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500 pb-24">
      <Button variant="ghost" size="sm" onClick={() => setLocation("/")} className="mb-2 -ml-3 text-muted-foreground">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver al panel
      </Button>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl md:text-5xl font-serif font-bold text-foreground">{project.name}</h1>
            <Badge variant="outline" className="text-sm bg-background border-primary/20 text-primary">
              {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
            </Badge>
          </div>
          {project.location && <p className="text-muted-foreground">{project.location}</p>}
          {project.description && <p className="text-foreground/80 mt-2 max-w-2xl">{project.description}</p>}
        </div>
        
        <div className="flex items-center gap-2">
          <Select value={project.status} onValueChange={updateProjectStatus}>
            <SelectTrigger className="w-[180px] bg-background">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="diseno">Fase de Diseño</SelectItem>
              <SelectItem value="cotizado">Cotizado</SelectItem>
              <SelectItem value="construccion">En Construcción</SelectItem>
              <SelectItem value="terminado">Terminado</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="destructive" size="icon" onClick={handleDeleteProject} title="Eliminar proyecto">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
        <Card className="lg:col-span-1 border-primary/20 bg-primary/5">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-base text-primary">Evaluación del Terreno</CardTitle>
              <Button variant="ghost" size="sm" className="h-8 px-2 text-primary" onClick={handleOpenEditTerrain}>
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

        <Card className="lg:col-span-1">
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
        
        {estimate && (
          <Card className="bg-primary text-primary-foreground border-primary-border shadow-md lg:col-span-1">
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

      <Tabs defaultValue="plano" className="mt-8">
        <TabsList className="grid w-full md:w-auto grid-cols-2 h-auto p-1 bg-muted/50">
          <TabsTrigger value="plano" className="py-2.5">Diseño de Planos</TabsTrigger>
          <TabsTrigger value="cotizacion" className="py-2.5">Cotización de Materiales</TabsTrigger>
        </TabsList>
        
        <TabsContent value="plano" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <Card className="h-full border-muted-foreground/20 shadow-sm overflow-hidden flex flex-col">
                <CardHeader className="bg-muted/30 pb-4 border-b flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle>Plano Arquitectónico 2D</CardTitle>
                    <CardDescription>Haz clic para editar. Arrastra para mover (ajuste a 0.5m).</CardDescription>
                  </div>
                  <div className="flex bg-background border rounded-lg p-1">
                    <Button variant={selectedFloor === 1 ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedFloor(1)} className="h-7 text-xs px-3">
                      Piso 1
                    </Button>
                    <Button variant={selectedFloor === 2 ? "secondary" : "ghost"} size="sm" onClick={() => setSelectedFloor(2)} className="h-7 text-xs px-3">
                      Piso 2
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0 flex-1">
                  {roomsLoading ? (
                    <div className="flex items-center justify-center min-h-[500px]">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <PlanViewer rooms={rooms || []} selectedFloor={selectedFloor} onRoomClick={handleOpenEditRoom} onRoomDrop={onRoomDrop} />
                  )}
                </CardContent>
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
              <CardTitle>Cantidades de Obra y Presupuesto</CardTitle>
              <CardDescription>
                Calculado automáticamente basado en los {rooms?.length || 0} espacios. <br/>
                <span className="text-primary/80 font-medium">Nota: Las cantidades son aproximaciones de anteproyecto. El rubro "Otros" (con unidad "día") corresponde a jornadas de obra.</span>
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
  );
}
