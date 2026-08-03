import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";

/**
 * Asistente de medidas: pide las medidas paso a paso y va creando
 * los espacios del plano uno por uno.
 */

const KINDS: { value: WizardRoomKind; label: string }[] = [
  { value: "habitacion", label: "Habitación" },
  { value: "sala", label: "Sala" },
  { value: "cocina", label: "Cocina" },
  { value: "bano", label: "Baño" },
  { value: "comedor", label: "Comedor" },
  { value: "corredor", label: "Corredor" },
  { value: "taller", label: "Taller" },
  { value: "otro", label: "Otro" },
];

export type WizardRoomKind = "habitacion" | "sala" | "cocina" | "bano" | "comedor" | "corredor" | "taller" | "otro";
export type WizardRoom = {
  name: string; kind: WizardRoomKind; widthM: number; lengthM: number; heightM: number; floor: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  floor: number;
  saving: boolean;
  onAddRoom: (room: WizardRoom) => Promise<void>;
};

export function MeasureWizard({ open, onClose, floor, saving, onAddRoom }: Props) {
  const [step, setStep] = useState(0); // 0 tipo, 1 nombre, 2 ancho, 3 largo, 4 alto
  const [kind, setKind] = useState<WizardRoomKind>("habitacion");
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [length, setLength] = useState("");
  const [height, setHeight] = useState("2.4");
  const [count, setCount] = useState(0);

  const reset = () => { setStep(0); setKind("habitacion"); setName(""); setWidth(""); setLength(""); };

  const num = (s: string) => parseFloat(s.replace(",", "."));
  const valid =
    step === 0 ? !!kind :
    step === 1 ? name.trim().length > 0 :
    step === 2 ? num(width) > 0 :
    step === 3 ? num(length) > 0 :
    num(height) > 0;

  const finishRoom = async () => {
    await onAddRoom({ name: name.trim(), kind, widthM: num(width), lengthM: num(length), heightM: num(height), floor });
    setCount(c => c + 1);
    reset();
  };

  const titles = [
    "¿Qué espacio vamos a medir?",
    "Ponle un nombre",
    "¿Cuánto mide de ANCHO? (metros)",
    "¿Cuánto mide de LARGO? (metros)",
    "¿Qué altura tienen los muros? (metros)",
  ];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) { reset(); setCount(0); onClose(); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Asistente de medidas — Piso {floor}</DialogTitle>
          <DialogDescription>
            Paso {step + 1} de 5 · {count > 0 ? `${count} espacio(s) dibujado(s)` : "El plano se dibuja mientras respondes"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <Label className="text-base">{titles[step]}</Label>

          {step === 0 && (
            <div className="grid grid-cols-2 gap-2">
              {KINDS.map(k => (
                <Button key={k.value} variant={kind === k.value ? "secondary" : "outline"}
                  className="justify-start" onClick={() => setKind(k.value)}>
                  {k.label}
                </Button>
              ))}
            </div>
          )}
          {step === 1 && (
            <Input autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="Ej. Habitación principal" />
          )}
          {step === 2 && (
            <Input autoFocus type="number" inputMode="decimal" step="0.1" value={width}
              onChange={e => setWidth(e.target.value)} placeholder="Ej. 4" />
          )}
          {step === 3 && (
            <Input autoFocus type="number" inputMode="decimal" step="0.1" value={length}
              onChange={e => setLength(e.target.value)} placeholder="Ej. 3.5" />
          )}
          {step === 4 && (
            <Input autoFocus type="number" inputMode="decimal" step="0.1" value={height}
              onChange={e => setHeight(e.target.value)} placeholder="Ej. 2.4" />
          )}

          <div className="flex justify-between gap-2 pt-2">
            <Button variant="ghost" disabled={step === 0 || saving} onClick={() => setStep(s => s - 1)}>
              Atrás
            </Button>
            {step < 4 ? (
              <Button disabled={!valid} onClick={() => setStep(s => s + 1)}>Siguiente</Button>
            ) : (
              <Button disabled={!valid || saving} onClick={finishRoom}>
                {saving && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                Dibujar espacio y seguir con otro
              </Button>
            )}
          </div>

          {count > 0 && (
            <Button variant="outline" className="w-full" onClick={() => { reset(); setCount(0); onClose(); }}>
              Terminar — ya medí todos los espacios
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
