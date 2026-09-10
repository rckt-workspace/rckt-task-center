# Rocket Control Center

Construye una aplicación web interna llamada "Centro de Control Semanal RCKT" para reemplazar un Excel de seguimiento semanal.

La aplicación tiene dos roles:

Coordinadora: acceso completo y administración.

Colaborador: solo puede ver y actualizar sus propias tareas.

No implementar login ni autenticación real en esta primera etapa. Al entrar, mostrar "¿Quién eres?" y permitir seleccionar:

Coordinadora

Anyely Huelgos

Jaime Cardona

Mariana Cano

Daniel Mendez

Guardar la selección en el navegador para recordarla al volver a entrar y permitir cambiar de usuario.

La aplicación debe ser desktop-first y responsive para tablet y móvil.

Diseño: ejecutivo, minimalista y moderno, con marfil, azul elegante, morado claro elegante y neutros. Evitar colores saturados, exceso de sombras, gradientes y elementos innecesarios.

Task

Construye la aplicación funcional utilizando inicialmente persistencia local, sin Supabase.

Datos iniciales

Colaboradores:

Anyely Huelgos

Jaime Cardona

Mariana Cano

Daniel Mendez

Clientes:

La Voz estratégica

La Cuisine Appliances Colombia

Grill Brothers

Miel Dalí

Magda - HEOR

Newbody COL

Áreas:

AI & Data Engineer

Shopify & Frontend Developer

Performance y campañas

Performance Creative

Estados:

Completada

En curso

Pendiente

Tipos de puntos de atención:

Decisión CEO

Pendiente cliente

En gestión

Modelo de tareas

Cada tarea debe tener:

ID

Semana (lunes)

Colaborador

Área

Cliente

Tarea / Entregable

Estado

Fecha límite

Fecha de entrega

Observaciones

created_at

updated_at

No incorporar columnas auxiliares del Excel que no tengan función en la aplicación.

Semanas

La aplicación trabaja por semanas de lunes a domingo.

La semana actual debe aparecer automáticamente al entrar.

Tanto coordinadora como colaboradores pueden seleccionar semanas anteriores mediante calendario.

La coordinadora puede crear una nueva semana seleccionando el lunes mediante calendario.

Conservar internamente los datos de semanas anteriores, pero no crear un módulo de histórico acumulado.

Las fechas deben mostrarse en formato colombiano DD/MM/YYYY y seleccionarse exclusivamente mediante calendario, nunca mediante escritura manual.

Vista colaborador

Crear una vista donde el colaborador vea exclusivamente sus propias tareas de la semana seleccionada.

Mostrar:

Nombre.

Semana.

Selector de semana.

Total de tareas.

Completadas.

En curso.

Pendientes.

Porcentaje de cumplimiento.

Tareas vencidas.

Tabla de tareas.

La tabla debe mostrar:

Estado.

Cliente.

Área.

Tarea / Entregable.

Fecha límite.

Fecha de entrega.

Observaciones.

Acción para editar.

El colaborador puede modificar:

Estado.

Fecha de entrega.

Observaciones.

No puede modificar:

Tarea / Entregable.

Cliente.

Colaborador.

Área.

No puede crear ni eliminar tareas.

Vista coordinadora

Crear una vista con acceso a todas las tareas de la semana seleccionada.

Debe poder:

Crear tareas.

Editar tareas.

Eliminar tareas.

Reasignar tareas.

Cambiar cliente.

Cambiar colaborador.

Cambiar área.

Cambiar estado.

Cambiar fechas.

Editar observaciones.

Consultar semanas anteriores.

Crear semanas.

El formulario de tarea debe contener:

Colaborador.

Área.

Cliente.

Tarea / Entregable.

Fecha límite.

Fecha de entrega.

Estado.

Observaciones.

Obligatorios:

Colaborador.

Área.

Cliente.

Tarea / Entregable.

Fecha límite.

Toda tarea nueva debe comenzar en estado "En curso".

Reglas de estado

Estados permitidos únicamente:

Completada

En curso

Pendiente

Cuando una tarea pasa a Completada, colocar automáticamente la fecha actual como Fecha de Entrega.

La Fecha de Entrega puede modificarse manualmente mediante calendario.

Si una tarea cambia de Completada a En curso o Pendiente, limpiar la Fecha de Entrega.

Una tarea está vencida cuando:

Fecha límite < fecha actual

y Estado != Completada.

Las tareas vencidas deben tener una señal visual clara.

Guidelines

Utiliza componentes reutilizables y una estructura limpia que permita conectar Supabase posteriormente sin reconstruir la aplicación.

Prioriza tablas para desktop y layouts compactos para móvil.

La interfaz debe ser profesional y sencilla.

Constraints

No Supabase todavía.

No login.

No correos.

No notificaciones.

No exportación.

No histórico analítico.

No agregar funcionalidades que no estén definidas aquí.

La aplicación debe funcionar completamente con persistencia local al finalizar este prompt.

Quiero que la app guarde toda el historial de las tareas asignadas y demás datos y que al refrescar la pagina mantenga la información guardada.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://rckt-task-center.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/66f62129-97ea-4a08-bcc1-0d6060a6f802).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
