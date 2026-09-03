import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, Pencil, Trash2, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAppStore } from "@/lib/rckt/useAppStore";
import { AREAS } from "@/lib/rckt/types";
import { createTeamUser, deleteTeamUser, updateUserCargo } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Usuarios del equipo · Centro de Control RCKT" },
      {
        name: "description",
        content: "Panel de administración para crear y gestionar cuentas del equipo RCKT.",
      },
      { property: "og:title", content: "Usuarios del equipo · Centro de Control RCKT" },
      {
        property: "og:description",
        content: "Gestión de cuentas y roles del equipo RCKT.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const store = useAppStore();
  const navigate = useNavigate();
  const createUser = useServerFn(createTeamUser);
  const deleteUser = useServerFn(deleteTeamUser);
  const saveCargo = useServerFn(updateUserCargo);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<"admin" | "colaborador">("colaborador");
  const [cargo, setCargo] = useState<string>(AREAS[0]);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<{ id: string; nombre: string; cargo: string } | null>(
    null,
  );
  const [editCargo, setEditCargo] = useState<string>(AREAS[0]);
  const [savingEdit, setSavingEdit] = useState(false);

  if (!store.hydrated) return <div className="min-h-screen" />;

  if (!store.isAdmin) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4">
        <div className="text-center">
          <h1 className="text-xl font-semibold">Acceso restringido</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Solo la administradora puede gestionar usuarios.
          </p>
          <Button className="mt-4" onClick={() => void navigate({ to: "/dashboard" })}>
            Volver al panel
          </Button>
        </div>
      </main>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await createUser({ data: { email, password, fullName, role, cargo } });
      toast.success("Cuenta creada");
      setEmail("");
      setPassword("");
      setFullName("");
      setRole("colaborador");
      setCargo(AREAS[0]);
      await store.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la cuenta");
    }
    setSaving(false);
  };

  const openEdit = (p: { id: string; nombre: string; cargo: string }) => {
    setEditing(p);
    setEditCargo(p.cargo && AREAS.includes(p.cargo as (typeof AREAS)[number]) ? p.cargo : AREAS[0]);
  };

  const submitEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    try {
      await saveCargo({ data: { userId: editing.id, cargo: editCargo } });
      toast.success("Cargo actualizado");
      setEditing(null);
      await store.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el cargo");
    }
    setSavingEdit(false);
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-header bg-header text-header-foreground">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Button
            variant="ghost"
            size="sm"
            asChild
            className="gap-2 text-header-foreground hover:bg-header-foreground/15 hover:text-header-foreground"
          >
            <Link to="/dashboard">
              <ArrowLeft className="size-4" />
              Panel
            </Link>
          </Button>
          <h1 className="text-lg font-semibold text-header-foreground">Usuarios del equipo</h1>
        </div>
      </header>


      <main className="mx-auto max-w-3xl space-y-8 px-4 py-6 sm:px-6">
        <form
          onSubmit={submit}
          className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-panel sm:grid-cols-2"
        >
          <div className="space-y-1.5 sm:col-span-2">
            <h2 className="text-base font-semibold">Crear cuenta</h2>
            <p className="text-sm text-muted-foreground">
              La persona podrá ingresar de inmediato con este correo y contraseña.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="fullName">Nombre completo</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newEmail">Correo</Label>
            <Input
              id="newEmail"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">Contraseña temporal</Label>
            <Input
              id="newPassword"
              type="text"
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label>Rol</Label>
            <Select value={role} onValueChange={(v) => setRole(v as "admin" | "colaborador")}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="admin">Administradora</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" className="gap-2" disabled={saving}>
              <UserPlus className="size-4" />
              {saving ? "Creando…" : "Crear cuenta"}
            </Button>
          </div>
        </form>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-panel">
          <Table>
            <TableHeader>
              <TableRow className="bg-secondary/70 hover:bg-secondary/70">
                <TableHead>Nombre</TableHead>
                <TableHead>Correo</TableHead>
                <TableHead className="w-[80px] text-right">Acción</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {store.profiles.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">{p.email}</TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Eliminar usuario"
                      onClick={async () => {
                        try {
                          await deleteUser({ data: { userId: p.id } });
                          toast.success("Cuenta eliminada");
                          await store.refresh();
                        } catch (err) {
                          toast.error(
                            err instanceof Error ? err.message : "No se pudo eliminar la cuenta",
                          );
                        }
                      }}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </section>
      </main>
    </div>
  );
}
