import { useListProjects, useGetDashboardSummary, useCreateProject, getListProjectsQueryKey, getGetDashboardSummaryQueryKey } from "@workspace/api-client-react";
import { Link, useLocation } from "wouter";
import { Plus, Home, MapPin, Building, ArrowRight, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { formatArea } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import heroCasa from "@/assets/hero-casa.jpg";

const projectSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  description: z.string().optional(),
  location: z.string().optional(),
  wallSystem: z.enum(["bahareque", "tapia_pisada", "adobe", "guadua_vista"]),
  roofType: z.enum(["teja_barro", "palma", "zinc", "techo_verde"]),
});

export default function Dashboard() {
  const { data: projects, isLoading: projectsLoading } = useListProjects();
  const { data: summary, isLoading: summaryLoading } = useGetDashboardSummary();
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const createProject = useCreateProject();

  const form = useForm<z.infer<typeof projectSchema>>({
    resolver: zodResolver(projectSchema),
    defaultValues: {
      name: "",
      description: "",
      location: "",
      wallSystem: "bahareque",
      roofType: "teja_barro",
    },
  });

  function onSubmit(values: z.infer<typeof projectSchema>) {
    createProject.mutate(
      { data: values },
      {
        onSuccess: (newProject) => {
          queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() });
          queryClient.invalidateQueries({ queryKey: getGetDashboardSummaryQueryKey() });
          setOpen(false);
          form.reset();
          setLocation(`/proyectos/${newProject.id}`);
        },
      }
    );
  }

  const formatWallSystem = (ws: string) => {
    switch (ws) {
      case "bahareque": return "Bahareque";
      case "tapia_pisada": return "Tapia Pisada";
      case "adobe": return "Adobe";
      case "guadua_vista": return "Guadua a la vista";
      default: return ws;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "diseno": return "bg-blue-100 text-blue-800 border-blue-200";
      case "cotizado": return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "construccion": return "bg-orange-100 text-orange-800 border-orange-200";
      case "terminado": return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const formatStatus = (status: string) => {
    switch (status) {
      case "diseno": return "Diseño";
      case "cotizado": return "Cotizado";
      case "construccion": return "En Construcción";
      case "terminado": return "Terminado";
      default: return status;
    }
  };

  if (projectsLoading || summaryLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div 
        className="relative w-full h-[400px] flex items-center justify-center overflow-hidden bg-primary"
      >
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroCasa})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#16291a] via-[#16291a]/60 to-transparent" />
        
        <div className="relative z-10 p-8 max-w-6xl w-full mx-auto flex items-end justify-between h-full pb-20">
          <div className="text-white max-w-2xl">
            <h1 className="text-5xl font-serif font-bold tracking-tight">Panel de Control</h1>
            <p className="text-white/80 mt-3 text-lg leading-relaxed font-light">
              Bienvenido a tu taller digital. Diseña, presupuesta y construye el futuro en tierra y guadua.
            </p>
          </div>

          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 bg-white text-primary hover:bg-white/90 shadow-lg hover:-translate-y-1 transition-all duration-300">
                <Plus className="w-4 h-4" />
                Nuevo Proyecto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Iniciar un Nuevo Proyecto</DialogTitle>
              </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del proyecto</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Casa en Barichara" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="location"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ubicación</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Santander, Colombia" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="wallSystem"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Sistema de Muros</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="bahareque">Bahareque</SelectItem>
                            <SelectItem value="tapia_pisada">Tapia Pisada</SelectItem>
                            <SelectItem value="adobe">Adobe</SelectItem>
                            <SelectItem value="guadua_vista">Guadua a la vista</SelectItem>
                            <SelectItem value="mixta">Mixta (adobe + bahareque)</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="roofType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tipo de Cubierta</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecciona" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="teja_barro">Teja de Barro</SelectItem>
                            <SelectItem value="palma">Palma</SelectItem>
                            <SelectItem value="zinc">Zinc</SelectItem>
                            <SelectItem value="techo_verde">Techo Verde</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descripción (Opcional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Notas iniciales del proyecto..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createProject.isPending}>
                    {createProject.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Crear Proyecto
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="p-8 max-w-6xl mx-auto space-y-12 -mt-16 relative z-20">
        {summary && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-primary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-primary/10 rounded-full text-primary">
                  <Home className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Proyectos</p>
                  <h3 className="text-3xl font-serif font-bold text-foreground">{summary.totalProjects}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-secondary/10">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-secondary/10 rounded-full text-secondary">
                  <Building className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Espacios (Salas, Habitaciones...)</p>
                  <h3 className="text-3xl font-serif font-bold text-foreground">{summary.totalRooms}</h3>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-card shadow-md hover:shadow-lg transition-all duration-300 hover:-translate-y-1 border-border/50">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="p-4 bg-accent rounded-full text-foreground shadow-sm">
                  <MapPin className="w-8 h-8" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Área Total Diseñada</p>
                  <h3 className="text-3xl font-serif font-bold text-foreground">{formatArea(summary.totalFloorAreaM2 || 0)}</h3>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <div>
          <h2 className="text-2xl font-serif font-semibold mb-6">Tus Proyectos</h2>
          {(!projects || projects.length === 0) ? (
            <div className="text-center py-24 bg-card rounded-xl border border-dashed border-border/60 hover:shadow-md transition-all duration-300">
              <Home className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground">El lienzo está en blanco</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Aún no tienes proyectos. Crea tu primera casa bioconstruida para empezar a diseñar.
              </p>
              <Button className="mt-6" onClick={() => setOpen(true)}>
                Empezar mi primer proyecto
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {projects.map((project, i) => (
                <Card key={project.id} className="group hover:border-primary/50 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer flex flex-col" onClick={() => setLocation(`/proyectos/${project.id}`)} style={{ animationDelay: `${i * 100}ms` }}>
                  <CardHeader>
                  <div className="flex justify-between items-start mb-2">
                    <Badge variant="outline" className={getStatusColor(project.status)}>
                      {formatStatus(project.status)}
                    </Badge>
                  </div>
                  <CardTitle className="group-hover:text-primary transition-colors">{project.name}</CardTitle>
                  {project.location && (
                    <CardDescription className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {project.location}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex-1">
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {project.description || "Sin descripción."}
                  </p>
                  <div className="mt-4 flex gap-2 flex-wrap">
                    <Badge variant="secondary" className="font-normal text-xs">{formatWallSystem(project.wallSystem)}</Badge>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 justify-between items-center text-sm text-muted-foreground">
                  <span>{new Date(project.createdAt).toLocaleDateString('es-CO')}</span>
                  <div className="w-8 h-8 rounded-full bg-accent flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
    </div>
  );
}
