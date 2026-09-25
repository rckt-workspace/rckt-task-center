-- Seed initial team member contexts for Jaime and Sofía
-- Only insert if user profiles exist with matching emails
-- This migration is safe: if profiles don't exist, nothing is inserted

-- For Jaime Cardona
DO $$
DECLARE
  jaime_id UUID;
BEGIN
  SELECT id INTO jaime_id FROM profiles WHERE email = 'jaime.cardona@rckt.es';

  IF jaime_id IS NOT NULL THEN
    INSERT INTO team_member_contexts (
      user_id,
      role_title,
      role_summary,
      specialties,
      responsibilities,
      strengths,
      typical_work,
      capacity_hours_per_week,
      estimation_notes,
      collaboration_notes
    ) VALUES (
      jaime_id,
      'AI Software Engineer / Technical Production',
      'Convierte prototipos y necesidades comerciales de RCKT en sistemas técnicamente mantenibles, desplegables y preparados para producción.',
      ARRAY['TypeScript', 'React', 'TanStack Start', 'TanStack Router', 'Vite', 'Python', 'FastAPI', 'Supabase', 'RLS', 'Render', 'OpenRouter', 'Git', 'GitHub', 'Arquitectura de software', 'Agentes IA', 'Integración frontend/backend', 'Despliegue y producción'],
      ARRAY[
        'arquitectura de software',
        'transformación de prototipos Lovable en proyectos reales',
        'protección del diseño frente al desarrollo',
        'desarrollo frontend',
        'backend e integración con IA',
        'bases de datos',
        'despliegues y producción',
        'Git y GitHub',
        'flujos de trabajo con IA',
        'estandarización técnica',
        'prevención de regresiones',
        'control de costos técnicos'
      ],
      ARRAY[
        'integración full-stack',
        'arquitectura',
        'agentes IA',
        'Supabase/RLS',
        'Render',
        'resolución de problemas de producción'
      ],
      ARRAY[
        'integración frontend/backend',
        'arquitectura de agentes',
        'migraciones SQL',
        'configuración Render',
        'debugging de producción',
        'integración OpenRouter',
        'mantenimiento de proyectos Lovable/GitHub'
      ],
      NULL,
      'Las tareas pueden implicar análisis, arquitectura, implementación, integración, pruebas y despliegue. No estimar únicamente por cantidad de pantallas o cambios visibles.',
      NULL
    ) ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Team context created for Jaime (%)' , jaime_id;
  ELSE
    RAISE NOTICE 'Jaime profile not found (jaime.cardona@rckt.es) - skipping context creation';
  END IF;
END $$;

-- For Sofía Tolosa
DO $$
DECLARE
  sofia_id UUID;
BEGIN
  SELECT id INTO sofia_id FROM profiles WHERE email = 'sofia.tolosa@rckt.es';

  IF sofia_id IS NOT NULL THEN
    INSERT INTO team_member_contexts (
      user_id,
      role_title,
      role_summary,
      specialties,
      responsibilities,
      strengths,
      typical_work,
      capacity_hours_per_week,
      estimation_notes,
      collaboration_notes
    ) VALUES (
      sofia_id,
      'People & Culture',
      'Acompaña al equipo en desarrollo, seguimiento, cultura y conversaciones 1:1.',
      ARRAY['Desarrollo Humano', 'Organización', 'Comunicación'],
      ARRAY[
        'conversaciones 1:1',
        'seguimiento individual',
        'identificación de bloqueos',
        'desarrollo y aprendizaje',
        'compromisos con responsables y fechas',
        'historial de conversaciones',
        'planes de desarrollo',
        'seguimiento de formación',
        'acompañamiento al equipo'
      ],
      ARRAY[
        'seguimiento humano',
        'organización',
        'acompañamiento',
        'desarrollo de personas',
        'comunicación interna'
      ],
      ARRAY[
        'reuniones 1:1',
        'seguimiento de compromisos',
        'documentación',
        'coordinación',
        'acompañamiento de formación'
      ],
      NULL,
      'Su carga debe analizarse según reuniones, seguimiento, documentación y coordinación; no como trabajo técnico de desarrollo.',
      NULL
    ) ON CONFLICT (user_id) DO NOTHING;

    RAISE NOTICE 'Team context created for Sofía (%)', sofia_id;
  ELSE
    RAISE NOTICE 'Sofía profile not found (sofia.tolosa@rckt.es) - skipping context creation';
  END IF;
END $$;
