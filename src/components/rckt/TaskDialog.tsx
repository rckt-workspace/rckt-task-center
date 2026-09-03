import { useEffect, useRef, useState } from "react";
import { Link2, Mic, Plus, Square, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateField } from "./DateField";
import { fileIcon, formatSize } from "./TaskAttachments";
import { AREAS, CLIENTES, ESTADOS } from "@/lib/rckt/types";
import type { Area, Cliente, Colaborador, Estado, Task } from "@/lib/rckt/types";
import { todayISO } from "@/lib/rckt/dates";
import type { TaskInput } from "@/lib/rckt/useAppStore";

type Mode = "create" | "edit";

const ACCEPT =
  "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  /** false = vista colaborador: solo estado, fecha de entrega y observaciones */
  canEditAll: boolean;
  task?: Task | null | undefined;
  defaultColaborador?: Colaborador | undefined;
  colaboradores?: string[] | undefined;
  /** Mapa nombre → cargo para mostrar el cargo junto al nombre */
  cargos?: Record<string, string> | undefined;
  onSubmit: (values: TaskInput) => void;
}

const emptyValues = (colaborador?: Colaborador): TaskInput => ({
  colaborador: colaborador ?? "",
  area: AREAS[0],
  cliente: CLIENTES[0],
  tarea: "",
  estado: "En curso",
  fechaLimite: "",
  horaLimite: null,
  fechaEntrega: null,
  observaciones: "",
  enlaces: [],
  nuevosArchivos: [],
  eliminarAdjuntos: [],
});

export function TaskDialog({
  open,
  onOpenChange,
  mode,
  canEditAll,
  task,
  defaultColaborador,
  colaboradores = [],
  cargos,
  onSubmit,
}: Props) {
  const [v, setV] = useState<TaskInput>(emptyValues(defaultColaborador));
  const [error, setError] = useState<string | null>(null);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [audioError, setAudioError] = useState<string | null>(null);

  useEffect(() => {
    if (!recording) return;
    const t = window.setInterval(() => setRecSeconds((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [recording]);

  const stopRecording = () => {
    recorderRef.current?.stop();
  };

  const startRecording = async () => {
    setAudioError(null);
    if (typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setAudioError("Tu navegador no permite grabar audio. Sube un archivo de audio en su lugar.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg"].find((m) =>
        MediaRecorder.isTypeSupported(m),
      );
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const type = rec.mimeType || "audio/webm";
        const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
        const blob = new Blob(chunksRef.current, { type });
        if (blob.size > 0) {
          const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
          const file = new File([blob], `nota-de-voz-${stamp}.${ext}`, { type });
          setV((prev) => ({ ...prev, nuevosArchivos: [...prev.nuevosArchivos, file] }));
        }
        setRecording(false);
        setRecSeconds(0);
        recorderRef.current = null;
      };
      recorderRef.current = rec;
      rec.start();
      setRecSeconds(0);
      setRecording(true);
    } catch {
      setAudioError("No se pudo acceder al micrófono. Revisa los permisos del navegador.");
    }
  };

  // Detener grabación si se cierra el diálogo
  useEffect(() => {
    if (!open && recorderRef.current) recorderRef.current.stop();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setLinkDraft("");
    setLinkError(null);
    const areaFromCargo = (nombre: string, fallback: Area): Area => {
      const cargo = cargos?.[nombre];
      return cargo && (AREAS as readonly string[]).includes(cargo) ? cargo : fallback;
    };
    if (task) {
      setV({
        colaborador: task.colaborador,
        area: areaFromCargo(task.colaborador, task.area),
        cliente: task.cliente,
        tarea: task.tarea,
        estado: task.estado,
        fechaLimite: task.fechaLimite,
        horaLimite: task.horaLimite,
        fechaEntrega: task.fechaEntrega,
        observaciones: task.observaciones,
        enlaces: [...task.enlaces],
        nuevosArchivos: [],
        eliminarAdjuntos: [],
      });
    } else {
      const base = emptyValues(defaultColaborador);
      base.area = areaFromCargo(base.colaborador, base.area);
      setV(base);
    }
  }, [open, task, defaultColaborador, cargos]);

  const existingAdjuntos = (task?.adjuntos ?? []).filter((a) => !v.eliminarAdjuntos.includes(a.id));

  const addLink = () => {
    let raw = linkDraft.trim();
    if (!raw) return;
    if (!/^https?:\/\//i.test(raw)) raw = `https://${raw}`;
    try {
      const u = new URL(raw);
      if (!u.hostname.includes(".")) throw new Error();
    } catch {
      setLinkError("Ingresa una URL válida (ej. https://drive.google.com/…).");
      return;
    }
    if (v.enlaces.includes(raw)) {
      setLinkError("Ese enlace ya está agregado.");
      return;
    }
    setV((prev) => ({ ...prev, enlaces: [...prev.enlaces, raw] }));
    setLinkDraft("");
    setLinkError(null);
  };

  const setEstado = (estado: Estado) => {
    setV((prev) => ({
      ...prev,
      estado,
      fechaEntrega:
        estado === "Completada"
          ? (prev.fechaEntrega ?? todayISO())
          : task?.estado === "Completada" || prev.estado === "Completada"
            ? null
            : prev.fechaEntrega,
    }));
  };

  const submit = () => {
    if (!v.colaborador || !v.area || !v.cliente || !v.tarea.trim() || !v.fechaLimite) {
      setError("Colaborador, Área, Cliente, Tarea y Fecha límite son obligatorios.");
      return;
    }
    // Si quedó un enlace escrito sin agregar, lo incluimos automáticamente
    const enlaces = [...v.enlaces];
    const pending = linkDraft.trim();
    if (pending) {
      const normalized = /^https?:\/\//i.test(pending) ? pending : `https://${pending}`;
      if (!enlaces.includes(normalized)) enlaces.push(normalized);
    }
    onSubmit({ ...v, enlaces, tarea: v.tarea.trim() });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "Nueva tarea" : "Editar tarea"}</DialogTitle>
          <DialogDescription>
            {canEditAll
              ? "Completa la información de la tarea de la semana."
              : "Puedes actualizar estado, fecha de entrega y observaciones."}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Colaborador</Label>
            <Select
              value={v.colaborador}
              onValueChange={(x) => {
                const cargo = cargos?.[x];
                setV((prev) => ({
                  ...prev,
                  colaborador: x as Colaborador,
                  // Sincroniza el área con el cargo del colaborador seleccionado
                  area: cargo && (AREAS as readonly string[]).includes(cargo) ? cargo : prev.area,
                }));
              }}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colaboradores.map((c) => (
                  <SelectItem key={c} value={c}>
                    {cargos?.[c] ? `${c} — ${cargos[c]}` : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {cargos?.[v.colaborador] ? (
              <p className="text-xs text-muted-foreground">
                El área se completa con el cargo de esta persona.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Área</Label>
            <Select
              value={v.area}
              onValueChange={(x) => setV({ ...v, area: x as Area })}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {AREAS.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select
              value={v.cliente}
              onValueChange={(x) => setV({ ...v, cliente: x as Cliente })}
              disabled={!canEditAll}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLIENTES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Estado</Label>
            <Select value={v.estado} onValueChange={(x) => setEstado(x as Estado)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ESTADOS.map((e) => (
                  <SelectItem key={e} value={e}>
                    {e}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Tarea / Entregable</Label>
            <Textarea
              ref={(el) => {
                if (el) {
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }
              }}
              rows={3}
              className="min-h-20 resize-none overflow-hidden"
              value={v.tarea}
              onChange={(e) => setV({ ...v, tarea: e.target.value })}
              placeholder="Describe el entregable"
              disabled={!canEditAll}
            />
          </div>

          <div className="space-y-1.5">
            <Label>Fecha y hora límite</Label>
            <div className="flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <DateField
                  value={v.fechaLimite || null}
                  onChange={(iso) => setV({ ...v, fechaLimite: iso ?? "" })}
                  disabled={!canEditAll}
                />
              </div>
              <Input
                type="time"
                aria-label="Hora límite"
                className="w-28 shrink-0"
                value={v.horaLimite ?? ""}
                onChange={(e) => setV({ ...v, horaLimite: e.target.value || null })}
                disabled={!canEditAll}
              />
            </div>
            {canEditAll ? (
              <p className="text-xs text-muted-foreground">
                La tarea se asigna automáticamente a la semana de esta fecha.
              </p>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label>Fecha de entrega</Label>
            <DateField
              value={v.fechaEntrega}
              onChange={(iso) => setV({ ...v, fechaEntrega: iso })}
              clearable
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Observaciones</Label>
            <Textarea
              rows={3}
              value={v.observaciones}
              onChange={(e) => setV({ ...v, observaciones: e.target.value })}
              placeholder="Notas, bloqueos o contexto"
            />
          </div>

          {/* Adjuntos */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Adjuntos</Label>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files ?? []);
                if (files.length) setV((prev) => ({ ...prev, nuevosArchivos: [...prev.nuevosArchivos, ...files] }));
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-3.5" />
              Subir archivos
            </Button>
            <p className="text-xs text-muted-foreground">
              Imágenes, videos, PDF, Word y Excel. Puedes seleccionar varios a la vez (máx. 50 MB c/u).
            </p>
            {existingAdjuntos.length > 0 || v.nuevosArchivos.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {existingAdjuntos.map((a) => {
                  const Icon = fileIcon(a.mime);
                  return (
                    <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{a.name}</span>
                      <span className="text-xs text-muted-foreground">{formatSize(a.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Quitar adjunto"
                        onClick={() =>
                          setV((prev) => ({ ...prev, eliminarAdjuntos: [...prev.eliminarAdjuntos, a.id] }))
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
                {v.nuevosArchivos.map((f, i) => {
                  const Icon = fileIcon(f.type);
                  return (
                    <li key={`${f.name}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <Icon className="size-4 shrink-0 text-muted-foreground" />
                      <span className="min-w-0 flex-1 truncate">{f.name}</span>
                      <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-medium uppercase">
                        Nuevo
                      </span>
                      <span className="text-xs text-muted-foreground">{formatSize(f.size)}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-label="Quitar archivo"
                        onClick={() =>
                          setV((prev) => ({
                            ...prev,
                            nuevosArchivos: prev.nuevosArchivos.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <X className="size-3.5" />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>

          {/* Nota de voz */}
          {canEditAll ? (
            <div className="space-y-2 sm:col-span-2">
              <Label>Nota de voz</Label>
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length)
                    setV((prev) => ({ ...prev, nuevosArchivos: [...prev.nuevosArchivos, ...files] }));
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                {recording ? (
                  <Button type="button" variant="destructive" size="sm" className="gap-2" onClick={stopRecording}>
                    <Square className="size-3.5" />
                    Detener ({String(Math.floor(recSeconds / 60)).padStart(2, "0")}:
                    {String(recSeconds % 60).padStart(2, "0")})
                  </Button>
                ) : (
                  <Button type="button" variant="outline" size="sm" className="gap-2" onClick={() => void startRecording()}>
                    <Mic className="size-3.5" />
                    Grabar audio
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-2"
                  disabled={recording}
                  onClick={() => audioInputRef.current?.click()}
                >
                  <Upload className="size-3.5" />
                  Subir audio
                </Button>
                {recording ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-destructive">
                    <span className="size-2 animate-pulse rounded-full bg-destructive" />
                    Grabando…
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                Explica de viva voz en qué consiste la tarea. El audio quedará en los adjuntos y el colaborador podrá
                escucharlo en el detalle.
              </p>
              {audioError ? <p className="text-xs text-destructive">{audioError}</p> : null}
            </div>
          ) : null}

          {/* Enlaces */}
          <div className="space-y-2 sm:col-span-2">
            <Label>Enlaces</Label>
            <div className="flex items-center gap-2">
              <Input
                type="url"
                placeholder="https://drive.google.com/… · Figma · Canva"
                value={linkDraft}
                onChange={(e) => {
                  setLinkDraft(e.target.value);
                  setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addLink();
                  }
                }}
              />
              <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5" onClick={addLink}>
                <Plus className="size-3.5" />
                Agregar enlace
              </Button>
            </div>
            {linkError ? <p className="text-xs text-destructive">{linkError}</p> : null}
            {v.enlaces.length > 0 ? (
              <ul className="divide-y divide-border rounded-md border border-border bg-background">
                {v.enlaces.map((url, i) => (
                  <li key={`${url}-${i}`} className="flex items-center gap-2 px-3 py-2 text-sm">
                    <Link2 className="size-4 shrink-0 text-muted-foreground" />
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-w-0 flex-1 truncate text-primary hover:underline"
                      title={url}
                    >
                      {url}
                    </a>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="size-7"
                      aria-label="Quitar enlace"
                      onClick={() =>
                        setV((prev) => ({ ...prev, enlaces: prev.enlaces.filter((_, j) => j !== i) }))
                      }
                    >
                      <X className="size-3.5" />
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          {/* Comentarios (solo tareas existentes) */}
          {mode === "edit" && task ? (
            <TaskComments taskId={task.id} authorName={currentUserName ?? ""} isAdmin={canEditAll} />
          ) : null}
        </div>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={submit}>{mode === "create" ? "Crear tarea" : "Guardar cambios"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
