# SQLs Pendientes de Ejecutar

Ejecutar en orden en Supabase Dashboard → SQL Editor:

## 1. Sistema de Cotizaciones
**Archivo:** `sql/2025-12-12-add-quotations-system.sql`
**Descripción:** Crea tablas de cotizaciones, items, función para generar números automáticos
**Ejecutar:** Copiar todo el contenido y ejecutar

## 2. Sistema Completo de Flujo de Solicitudes
**Archivo:** `sql/2025-12-13-service-requests-workflow-system.sql`
**Descripción:** 
- Tabla de comentarios/respuestas
- Tabla de historial de cambios
- Tabla de notificaciones
- Triggers automáticos para logging
- Vista con contexto completo
- Funciones para notificaciones

**Ejecutar:** Copiar todo el contenido y ejecutar

---

## Verificación Post-Ejecución

Verificar que se crearon correctamente:

```sql
-- Verificar tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
  'quotations',
  'quotation_items',
  'service_request_comments',
  'service_request_history',
  'service_request_notifications'
);

-- Verificar columnas nuevas en service_requests
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'service_requests' 
AND column_name IN (
  'quotation_id',
  'rejection_count',
  'requires_technical_closure',
  'parent_request_id',
  'last_admin_action_at',
  'last_technician_action_at'
);

-- Verificar funciones
SELECT routine_name FROM information_schema.routines 
WHERE routine_schema = 'public' 
AND routine_name IN (
  'generate_quotation_number',
  'create_service_request_notification',
  'log_service_request_change',
  'notify_rejection'
);
```

## Orden de Ejecución Recomendado

1. `2025-12-12-add-quotations-system.sql` (si no lo ejecutaste aún)
2. `2025-12-13-service-requests-workflow-system.sql`

Ambos usan `IF NOT EXISTS` así que son seguros de re-ejecutar.
