import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { CLIENTES } from "./types";

/** Lista de clientes disponible para asignar a tareas. */
export function useClients() {
  const [clients, setClients] = useState<string[]>([...CLIENTES]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("clients")
      .select("nombre")
      .order("nombre", { ascending: true });
    setLoading(false);
    if (error || !data) return;
    setClients(data.map((r) => r.nombre));
  }, []);

  useEffect(() => {
    refresh().catch(() => undefined);
  }, [refresh]);

  /** Agrega un cliente nuevo (solo admin por RLS) y devuelve el nombre guardado. */
  const addClient = useCallback(
    async (nombre: string) => {
      const clean = nombre.trim();
      if (!clean) throw new Error("El nombre del cliente no puede estar vacío");
      const { error } = await supabase.from("clients").insert({ nombre: clean });
      // 23505 = ya existe; lo tratamos como éxito
      if (error && error.code !== "23505") throw new Error(error.message);
      await refresh();
      return clean;
    },
    [refresh],
  );

  return { clients, loading, refresh, addClient };
}
