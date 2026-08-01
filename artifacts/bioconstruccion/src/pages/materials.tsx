import { useState } from "react";
import { useListMaterials, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, getListMaterialsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { formatCOP } from "@/lib/format";
import { Material, MaterialCategory, MaterialInputCategory } from "@workspace/api-client-react";

const materialSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  unit: z.string().min(1, "La unidad es obligatoria"),
  unitPrice: z.coerce.number().min(0, "El precio no puede ser negativo"),
  category: z.enum(["estructura", "muros", "cubierta", "acabados", "otros"]),
});

export default function Materials() {
  const { data: materials, isLoading } = useListMaterials();
  const queryClient = useQueryClient();
  
  const createMaterial = useCreateMaterial();
  const updateMaterial = useUpdateMaterial();
  const deleteMaterial = useDeleteMaterial();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);

  const form = useForm<z.infer<typeof materialSchema>>({
    resolver: zodResolver(materialSchema),
    defaultValues: {
      name: "",
      unit: "unidad",
      unitPrice: 0,
      category: "otros",
    },
  });

  const handleOpenNew = () => {
    setEditingMaterial(null);
    form.reset({ name: "", unit: "unidad", unitPrice: 0, category: "otros" });
    setDialogOpen(true);
  };

  const handleOpenEdit = (m: Material) => {
    setEditingMaterial(m);
    form.reset({
      name: m.name,
      unit: m.unit,
      unitPrice: m.unitPrice,
      category: m.category,
    });
    setDialogOpen(true);
  };

  const onSubmit = (values: z.infer<typeof materialSchema>) => {
    if (editingMaterial) {
      updateMaterial.mutate(
        { id: editingMaterial.id, data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
            setDialogOpen(false);
          },
        }
      );
    } else {
      createMaterial.mutate(
        { data: values },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() });
            setDialogOpen(false);
          },
        }
      );
    }
  };

  const handleDelete = (id: number) => {
    if (confirm("¿Seguro que deseas eliminar este material?")) {
      deleteMaterial.mutate(
        { id },
        {
          onSuccess: () => queryClient.invalidateQueries({ queryKey: getListMaterialsQueryKey() }),
        }
      );
    }
  };

  const categoryColors: Record<string, string> = {
    estructura: "bg-amber-100 text-amber-800",
    muros: "bg-orange-100 text-orange-800",
    cubierta: "bg-green-100 text-green-800",
    acabados: "bg-blue-100 text-blue-800",
    otros: "bg-gray-100 text-gray-800",
  };

  const categoryLabels: Record<string, string> = {
    estructura: "Estructura",
    muros: "Muros",
    cubierta: "Cubierta",
    acabados: "Acabados",
    otros: "Otros",
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-6xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-serif font-bold text-foreground">Catálogo de Materiales</h1>
          <p className="text-muted-foreground mt-2">
            Administra los precios base (COP) de guadua, tierra, tejas y otros insumos.
          </p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2" onClick={handleOpenNew}>
              <Plus className="w-4 h-4" />
              Nuevo Material
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingMaterial ? "Editar Material" : "Agregar Material"}</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nombre del material</FormLabel>
                      <FormControl>
                        <Input placeholder="Ej. Guadua cepa 6m" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Categoría</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Categoría" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(categoryLabels).map(([key, label]) => (
                              <SelectItem key={key} value={key}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="unit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Unidad (Ej. m3, bulto, unidad)</FormLabel>
                        <FormControl>
                          <Input placeholder="m3, bulto, unidad" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="unitPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Precio Unitario (COP)</FormLabel>
                      <FormControl>
                        <Input type="number" step="any" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter className="pt-4">
                  <Button type="submit" disabled={createMaterial.isPending || updateMaterial.isPending}>
                    {(createMaterial.isPending || updateMaterial.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    {editingMaterial ? "Guardar Cambios" : "Crear Material"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        {materials && materials.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría</TableHead>
                <TableHead>Unidad</TableHead>
                <TableHead className="text-right">Precio Base (COP)</TableHead>
                <TableHead className="w-[100px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((mat) => (
                <TableRow key={mat.id}>
                  <TableCell className="font-medium">{mat.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`border-transparent ${categoryColors[mat.category] || categoryColors.otros}`}>
                      {categoryLabels[mat.category] || mat.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{mat.unit}</TableCell>
                  <TableCell className="text-right font-medium">{formatCOP(mat.unitPrice || 0)}</TableCell>
                  <TableCell>
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" onClick={() => handleOpenEdit(mat)}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(mat.id)} className="text-destructive hover:text-destructive">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No hay materiales en el catálogo. Agrega tu primer material para empezar a cotizar.
          </div>
        )}
      </div>
    </div>
  );
}
