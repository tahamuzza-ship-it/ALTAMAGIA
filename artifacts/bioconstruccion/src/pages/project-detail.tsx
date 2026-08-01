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
  Loader2, ArrowLeft, Trash2, Pencil, Plus, Maximize, AlertCircle, Save, Check
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCOP, formatArea } from "@/lib/format";
import { Room } from "@workspace/api-client-react";

const roomSchema = z.object({
  name: z.string().min(1, "Obligatorio"),
  kind: z.enum(["habitacion", "sala", "cocina", "bano", "comedor", "corredor", "taller", "otro"]),
  widthM: z.coerce.number().min(0.1),
  lengthM: z.coerce.number().min(0.1),
  heightM: z.coerce.number().min(0.1),
  posX: z.coerce.number().optional(),
  posY: z.coerce.number().optional(),
});

function PlanViewer({ rooms, onRoomClick }: { rooms: Room[], onRoomClick: (r: Room) => void }) {
  const padding = 2;
  
  const bounds = useMemo(() => {
    if (!rooms.length) return { minX: 0, minY: 0, maxX: 10, maxY: 10, width: 10, height: 10 };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    
    rooms.forEach((r, i) => {
      const x = r.posX ?? (i * 5); // default placement if no coordinates
      const y = r.posY ?? 0;
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
  }, [rooms]);

  if (!rooms.length) {
    return (
      <div className="w-full h-full min-h-[400px] flex items-center justify-center bg-card rounded-xl border border-dashed border-border/60">
        <p className="text-muted-foreground text-center">
          Agrega tu primer espacio para comenzar el diseño.<br/>
          <span className="text-sm opacity-70">El plano se dibujará automáticamente.</span>
        </p>
      </div>
    );
  }

  return (
    <div className="w-full h-full min-h-[500px] bg-card/50 rounded-xl border relative overflow-hidden flex items-center justify-center p-4">
      {/* Background grid pattern */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, black 1px, transparent 0)', backgroundSize: '20px 20px' }}></div>
      
      <svg 
        viewBox={`${bounds.minX} ${bounds.minY} ${bounds.width} ${bounds.height}`}
        className="w-full h-full max-h-[70vh] drop-shadow-sm"
        preserveAspectRatio="xMidYMid meet"
      >
        {rooms.map((r, i) => {
          const x = r.posX ?? (i * 5);
          const y = r.posY ?? 0;
          return (
            <g 
              key={r.id} 
              transform={`translate(${x}, ${y})`} 
              className="cursor-pointer group transition-all"
              onClick={() => onRoomClick(r)}
            >
              <rect 
                width={r.widthM} 
                height={r.lengthM} 
                className="fill-background stroke-primary/40 stroke-[0.1] group-hover:stroke-primary group-hover:fill-primary/5 transition-colors"
                rx={0.1}
              />
              {/* Inner details like a subtle inner border for walls */}
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
        Escala Automática
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

  const roomForm = useForm<z.infer<typeof roomSchema>>({
    resolver: zodResolver(roomSchema),
    defaultValues: { name: "", kind: "habitacion", widthM: 3, lengthM: 3, heightM: 2.5, posX: 0, posY: 0 },
  });

  const handleOpenNewRoom = () => {
    setEditingRoom(null);
    roomForm.reset({ name: "", kind: "habitacion", widthM: 3, lengthM: 3, heightM: 2.5, posX: 0, posY: 0 });
    setRoomDialogOpen(true);
  };

  const handleOpenEditRoom = (r: Room) => {
    setEditingRoom(r);
    roomForm.reset({
      name: r.name,
      kind: r.kind,
      widthM: r.widthM,
      lengthM: r.lengthM,
      heightM: r.heightM,
      posX: r.posX ?? 0,
      posY: r.posY ?? 0,
    });
    setRoomDialogOpen(true);
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground font-medium mb-1">Sistema de Muros</p>
              <Select value={project.wallSystem} onValueChange={(v) => updateProjectSystem('wallSystem', v)}>
                <SelectTrigger className="w-[200px] border-none shadow-none bg-accent/50 hover:bg-accent h-8">
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
                <SelectTrigger className="w-[200px] border-none shadow-none bg-accent/50 hover:bg-accent h-8">
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
          <Card className="bg-primary text-primary-foreground border-primary-border shadow-md">
            <CardContent className="p-4 flex items-center justify-between h-full">
              <div>
                <p className="text-sm font-medium opacity-80">Costo Total Estimado</p>
                <h3 className="text-2xl font-bold font-serif mt-1">{formatCOP(estimate.totalCost || 0)}</h3>
                {hasMissingPrices && (
                  <p className="text-xs flex items-center gap-1 mt-1 bg-black/10 w-fit px-2 py-0.5 rounded-full">
                    <AlertCircle className="w-3 h-3" /> Faltan precios en catálogo
                  </p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium opacity-80">Área Techada</p>
                <h3 className="text-xl font-bold mt-1">{formatArea(estimate.roofAreaM2 || 0)}</h3>
              </div>
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
              <Card className="h-full border-muted-foreground/20 shadow-sm overflow-hidden">
                <CardHeader className="bg-muted/30 pb-4 border-b">
                  <div className="flex justify-between items-center">
                    <div>
                      <CardTitle>Plano Arquitectónico 2D</CardTitle>
                      <CardDescription>Haz clic en los espacios para editarlos. El origen (0,0) está en la esquina superior izquierda.</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {roomsLoading ? (
                    <div className="flex items-center justify-center min-h-[500px]">
                      <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    </div>
                  ) : (
                    <PlanViewer rooms={rooms || []} onRoomClick={handleOpenEditRoom} />
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
                          <p className="font-medium">{room.name}</p>
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
              <CardDescription>Calculado automáticamente basado en los {rooms?.length || 0} espacios y el sistema constructivo elegido.</CardDescription>
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
                            <TableHead>Material</TableHead>
                            <TableHead className="text-right">Cantidad</TableHead>
                            <TableHead className="text-right">V. Unitario</TableHead>
                            <TableHead className="text-right">Subtotal</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {items.map((item, i) => (
                            <TableRow key={i}>
                              <TableCell className="font-medium">
                                {item.materialName}
                                {!item.priced && (
                                  <Badge variant="destructive" className="ml-2 py-0 h-5 text-[10px]">Sin Precio</Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.quantity.toLocaleString("es-CO", { maximumFractionDigits: 1 })} {item.unit}
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {item.priced ? formatCOP(item.unitPrice || 0) : "-"}
                              </TableCell>
                              <TableCell className="text-right font-medium">
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
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={roomForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre</FormLabel>
                      <FormControl><Input placeholder="Ej. Habitación Principal" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
              </div>

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
    </div>
  );
}
