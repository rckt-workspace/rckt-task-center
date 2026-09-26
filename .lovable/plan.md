# Diagnóstico: la app no carga tras el asistente de chat

## Causa más probable
El último build dice "build OK", así que la compilación no falla. Los errores de tipos que aparecen (TypeScript) no bloquean la carga en desarrollo. La sospecha más fuerte es la 1, ampliada:
- `src/lib/chat.functions.ts` (que usa el navegador) importa desde `src/server/...`, y `src/components/chat-assistant.tsx` importa `@/server/llm/types`. La protección de importaciones de TanStack Start bloquea toda la carpeta `src/server/` en el código del navegador, y eso rompe la página al cargar.
- `src/routes/api/chat.ts` también importa `src/server/...` desde un archivo de ruta, que se incluye en el código del navegador.

## Otras sospechas
- 2 (`.validator()`): sí está mal y provoca el error de tipos en `chat-assistant.tsx`, pero no es lo que tumba la página.
- 3 (`loadAllTeamContexts` sin importar): confirmado. Fallaría solo al usar el chat como admin.
- 4 y 5: no se pueden confirmar con los registros. Solo fallarían al enviar un mensaje, no al cargar la página.

## Arreglo mínimo
1. Mover `src/server/chat/*` y `src/server/llm/*` a una carpeta que no se llame `src/server/`, por ejemplo `src/lib/chat-core/`, manteniendo el sufijo `.server.ts`. Mover `types.ts` a un archivo compartido que no sea de servidor.
2. En `chat.functions.ts`, cargar la lógica de servidor con importación dinámica dentro de `.handler()`, y cambiar `.validator` por `.inputValidator`.
3. Eliminar `src/routes/api/chat.ts` (ya lo cubre la función de servidor) o usar importación dinámica dentro de su handler.
4. Importar/exportar `loadAllTeamContexts`, `TeamMemberContext` y `MemberWorkload`, y corregir los errores de tipos restantes.
5. Después, confirmar con el navegador que la app carga y probar un mensaje del chat.
