# 📋 RESUMEN COMPLETO - PLATAFORMA MIREGA
## Sistema de Gestión de Mantenimiento y Emergencias para Ascensores

**Fecha del Respaldo:** 22 de Enero de 2026  
**Versión:** Producción Estable  
**Repositorio GitHub:** appmirega/app.mirega  
**URL Producción:** https://app-mirega.vercel.app

---

## 🏗️ ARQUITECTURA TÉCNICA

### Stack Tecnológico
- **Frontend:** React 18 + TypeScript + Vite
- **Estilos:** TailwindCSS
- **Base de Datos:** Supabase (PostgreSQL)
- **Autenticación:** Supabase Auth
- **Storage:** Supabase Storage (fotos, PDFs, firmas)
- **Hosting:** Vercel (auto-deploy desde GitHub)
- **PDF Generation:** jsPDF
- **Iconos:** Lucide React

### Estructura del Proyecto
```
app-mirega-recovery/
├── src/
│   ├── components/       # Componentes React
│   │   ├── dashboards/   # Dashboards por rol
│   │   ├── emergency/    # Módulo de emergencias
│   │   ├── checklist/    # Módulo de mantenimientos
│   │   ├── views/        # Vistas principales
│   │   └── ...
│   ├── contexts/         # Context API (AuthContext)
│   ├── lib/              # Configuración (Supabase client)
│   ├── utils/            # Utilidades (PDF generators)
│   ├── App.tsx           # Componente principal + routing
│   └── main.tsx          # Entry point
├── sql/                  # Scripts SQL de la base de datos
├── public/               # Assets estáticos
├── vercel.json          # Configuración de deployment
└── package.json         # Dependencias

```

---

## 👥 SISTEMA DE ROLES Y PERMISOS

### 1. Developer (Desarrollador)
**Acceso Total** - Máximo nivel de permisos
- ✅ Todas las funcionalidades de Admin
- ✅ Gestión de permisos (asignar/modificar roles)
- ✅ Registro de auditoría completo
- ✅ Operaciones masivas
- ✅ Configuración del sistema

### 2. Admin (Administrador)
**Gestión Operativa**
- ✅ Dashboard con estadísticas
- ✅ Gestión de usuarios
- ✅ Gestión de clientes
- ✅ Gestión de ascensores
- ✅ Mantenimientos (programar, revisar)
- ✅ Certificaciones
- ✅ Solicitudes de servicio
- ✅ Estadísticas y reportes
- ✅ Historial de emergencias
- ✅ Órdenes de trabajo
- ✅ Rutas
- ✅ Cotizaciones
- ✅ Códigos QR
- ✅ Carpeta Cero
- ✅ Capacitaciones de rescate (gestión)
- ✅ Permisos (limitado)

### 3. Technician (Técnico)
**Ejecución en Terreno**
- ✅ Dashboard técnico (mantenimientos del día)
- ✅ Mantenimientos (ejecutar checklist)
- ✅ Emergencias (crear reportes)
- ✅ Solicitudes de servicio (crear)
- ✅ Órdenes de trabajo (asignadas)
- ✅ Rutas (ver asignadas)
- ✅ Gestión de ascensores (consulta)
- ✅ Manuales técnicos
- ✅ Notificaciones

### 4. Client (Cliente)
**Consulta y Seguimiento**
- ✅ Dashboard cliente (resumen)
- ✅ Mis emergencias (historial)
- ✅ Mis cotizaciones (ver estado)
- ✅ Gestión de ascensores (propios)
- ✅ Información técnica
- ✅ Carpeta Cero (documentos)
- ✅ Inducción de rescate (ver)
- ✅ Notificaciones

---

## 🔥 MÓDULO DE EMERGENCIAS (COMPLETO)

### Características Principales
✅ **Formulario Multi-Paso**
- Paso 1: Selección de cliente y ascensores
- Paso 2: Estado inicial de ascensores
- Paso 3: Descripción de falla + 2 fotos
- Paso 4: Revisión de solicitud de servicio (si aplica)
- Paso 5: Estado final
- Paso 6: Generación automática de solicitud (si detenido)
- Paso 7: Resolución + 2 fotos + causa
- Paso 8: Firma del receptor

✅ **Auto-Guardado Inteligente**
- Guardado al salir de cada campo (onBlur)
- Guardado al seleccionar botones (200ms delay)
- Guardado al presionar "Atrás" (300ms espera)
- Guardado al navegar a otra vista (fetch con keepalive)
- Guardado al cerrar ventana/pestaña (beforeunload)
- Guardado cada 30 segundos (respaldo)

✅ **Generación de PDF**
- Encabezado con logo MIREGA (izquierda) + títulos centrados
- Información general del cliente
- Tabla de ascensores afectados
- Descripción de falla con fotos
- Resolución con fotos
- Estado final y causa
- Firma digital del receptor
- Guardado automático en Supabase Storage

✅ **Gestión de Solicitudes**
- Creación automática si ascensor queda detenido
- Vinculación con sistema de solicitudes
- Campos: tipo, prioridad, título, descripción

### Base de Datos (Tablas Principales)
```sql
-- Visitas de emergencia
emergency_visits (
  id, client_id, technician_id,
  visit_date, visit_time,
  failure_description, failure_photo_1_url, failure_photo_2_url,
  final_status, resolution_summary,
  resolution_photo_1_url, resolution_photo_2_url,
  failure_cause, receiver_name, receiver_signature_url,
  service_request_id, pdf_url, status, completed_at
)

-- Ascensores afectados por emergencia
emergency_visit_elevators (
  id, emergency_visit_id, elevator_id,
  initial_status, created_at
)

-- Vista: última emergencia por ascensor
last_emergency_by_elevator
```

### RLS (Row Level Security)
- Políticas por rol (developer, admin, technician, client)
- Técnicos: solo sus propias emergencias
- Clientes: solo emergencias de sus ascensores
- Admins/Developers: acceso total

---

## 🔧 MÓDULO DE MANTENIMIENTOS

### Checklist Dinámico
- 50 preguntas configurables desde base de datos
- Agrupadas por categorías
- Respuestas: Correcto / Observación / No Aplica
- Campo de observaciones por pregunta
- Fotos por pregunta (hasta 2)
- Cálculo automático de cumplimiento

### Programación
- Asignación de técnico
- Fecha y hora
- Múltiples ascensores
- Notas adicionales
- Estados: programado, en_progreso, completado

### Generación de PDF
- Formato profesional con logo MIREGA
- Resumen ejecutivo (% cumplimiento)
- Todas las preguntas con respuestas
- Fotos integradas
- Firma digital
- Guardado en Storage

---

## 📝 SISTEMA DE SOLICITUDES DE SERVICIO

### Flujo Completo
1. **Creación**
   - Manual (técnico/admin)
   - Automática (desde emergencia)
   - Tipos: reparación, repuestos, soporte

2. **Estados**
   - Pendiente → En Proceso → Completada → Cancelada

3. **Prioridades**
   - Baja, Media, Alta, Crítica

4. **Órdenes de Trabajo**
   - Creación vinculada a solicitud
   - Asignación de técnico
   - Fecha límite
   - Notas

5. **Cotizaciones**
   - Vinculadas a solicitudes
   - Estados: borrador, enviada, aprobada, rechazada
   - Ítems con cantidades y precios
   - Total calculado automáticamente

---

## 📊 CARACTERÍSTICAS ADICIONALES

### Dashboard Inteligente
- Estadísticas por rol
- Mantenimientos del día (técnicos)
- Emergencias del mes
- Solicitudes pendientes
- Gráficos y métricas

### Certificaciones
- Gestión de certificados por ascensor
- Fechas de vencimiento
- Alertas
- Archivos PDF

### Códigos QR
- Generación automática por ascensor
- Información técnica al escanear
- Galería de códigos
- Descarga individual/masiva

### Carpeta Cero
- Documentos por cliente
- Organización por categorías
- Subida y descarga
- Control de acceso

### Capacitaciones de Rescate
- Gestión de capacitaciones (admin)
- Visualización de contenido (cliente)
- Videos y documentos

### Estadísticas
- Gráficos de mantenimientos
- Análisis de emergencias
- Cumplimiento por cliente
- Exportación de datos

### Registro de Auditoría
- Todas las acciones importantes
- Usuario, fecha, acción, detalles
- Filtros por fecha y usuario

### Operaciones Masivas
- Programación de mantenimientos múltiples
- Selección masiva de ascensores
- Asignación de técnico

### Notificaciones
- Sistema en tiempo real (Supabase Realtime)
- Centro de notificaciones
- Contador en menú
- Marcar como leída

---

## 🎨 INTERFAZ Y UX

### Menú Lateral
- Icono + etiqueta
- Indicador de sección activa
- Notificaciones con badge
- Navegación forzada a vista principal (nuevo)

### Colores Corporativos MIREGA
- Azul principal: #273a8f
- Verde: #44ac4c
- Rojo: #e1162b
- Naranja: #f59e0b
- Amarillo: #fbbf24
- Negro: #1d1d1b

### Responsive
- Desktop: menú lateral fijo
- Mobile: menú hamburguesa
- Adaptativo en todas las vistas

### Componentes Principales
- Layout (estructura base)
- SplashScreen (pantalla inicial)
- LoginPage (autenticación)
- Dashboards por rol
- Formularios dinámicos
- Tablas con paginación
- Modales
- Firma digital (canvas)

---

## 🔐 SEGURIDAD

### Autenticación
- Supabase Auth (email/password)
- Gestión de sesiones
- Context API para estado global

### Autorización
- RLS a nivel de base de datos
- Validaciones por rol en frontend
- Rutas protegidas

### Storage
- Buckets separados por tipo:
  - maintenance-photos
  - emergency-photos
  - emergency-pdfs
  - certification-files
  - carpeta-cero
- Políticas de acceso por rol

---

## 📦 DEPENDENCIAS PRINCIPALES

```json
{
  "react": "^18.3.1",
  "react-dom": "^18.3.1",
  "typescript": "^5.5.3",
  "vite": "^5.4.2",
  "@supabase/supabase-js": "^2.45.4",
  "jspdf": "^2.5.2",
  "lucide-react": "^0.441.0",
  "react-signature-canvas": "^1.0.6",
  "tailwindcss": "^3.4.1"
}
```

---

## 🚀 DEPLOYMENT

### GitHub
**Repositorio:** appmirega/app.mirega
- Branch principal: `main`
- Auto-push después de cada commit

### Vercel
**URL:** https://app-mirega.vercel.app
- Auto-deploy desde GitHub (branch main)
- Variables de entorno:
  - VITE_SUPABASE_URL
  - VITE_SUPABASE_ANON_KEY

### Supabase
**Proyecto:** uiozlumbafsgehoui...
- PostgreSQL database
- Storage buckets
- Authentication
- Realtime subscriptions

---

## 📝 SCRIPTS SQL IMPORTANTES

### Ubicación: `sql/`
- `2025-12-06-service-requests-system.sql` - Sistema de solicitudes
- `2025-12-12-add-quotations-system.sql` - Sistema de cotizaciones
- `2025-12-13-service-requests-workflow-system.sql` - Workflow completo
- `2025-12-15-add-parts-and-external-fields.sql` - Campos adicionales
- `COMPLETE-emergency-visits-setup.sql` - Setup completo de emergencias
- `FIX-emergency-visits-rls-policies-v2.sql` - RLS corregidas

---

## 🔄 FLUJOS PRINCIPALES

### Flujo de Emergencia (Técnico)
1. Técnico accede a "Emergencias"
2. Selecciona cliente y ascensores afectados
3. Marca estado inicial de cada ascensor
4. Describe falla + sube fotos
5. Sistema detecta si necesita solicitud de servicio
6. Marca estado final
7. Si detenido: crea solicitud automática
8. Describe resolución + sube fotos
9. Selecciona causa de falla
10. Obtiene firma del receptor
11. Sistema genera PDF automáticamente
12. PDF se sube a Storage
13. Emergencia queda completada

### Flujo de Mantenimiento (Técnico)
1. Dashboard muestra mantenimientos del día
2. Técnico selecciona mantenimiento
3. Responde 50 preguntas del checklist
4. Puede subir fotos por pregunta
5. Sistema calcula % cumplimiento
6. Obtiene firma
7. Genera PDF profesional
8. Marca como completado

### Flujo de Solicitud → Cotización → Orden (Admin)
1. Se crea solicitud (manual o automática)
2. Admin revisa solicitud
3. Crea cotización vinculada
4. Agrega ítems con precios
5. Envía cotización al cliente
6. Cliente aprueba/rechaza
7. Si aprueba: se crea orden de trabajo
8. Se asigna técnico
9. Técnico completa trabajo
10. Actualiza estado

---

## 🛠️ COMANDOS ÚTILES

### Desarrollo Local
```bash
cd d:\APP\28-11-2025\app-mirega-recovery
npm install
npm run dev
# Abre http://localhost:5173
```

### Build para Producción
```bash
npm run build
npm run preview
```

### Git
```bash
git add .
git commit -m "mensaje"
git push origin main
# Vercel despliega automáticamente
```

---

## 📊 ESTADO ACTUAL (22/01/2026)

### ✅ Completado al 100%
- ✅ Sistema de emergencias con PDF
- ✅ Auto-guardado inteligente (6 métodos)
- ✅ Navegación mejorada (menú lateral)
- ✅ Sistema de mantenimientos
- ✅ Sistema de solicitudes + cotizaciones
- ✅ Dashboards por rol
- ✅ Gestión de usuarios/clientes/ascensores
- ✅ Notificaciones en tiempo real
- ✅ Certificaciones
- ✅ Códigos QR
- ✅ Carpeta Cero
- ✅ Estadísticas
- ✅ Auditoría

### 🔄 En Producción Estable
- URL: https://app-mirega.vercel.app
- Sin errores conocidos
- Todos los módulos funcionales
- PDFs generándose correctamente

---

## 📞 INFORMACIÓN DE CONTACTO

**MIREGA ASCENSORES LTDA.**
- Dirección: Pedro de Valdivia N°273 – Of. 1406, Providencia
- Teléfono: +562 6469 1048 / +569 8793 3552
- Email: contacto@mirega.cl
- Web: www.mirega.cl

---

## 🔮 PRÓXIMAS MEJORAS POTENCIALES

1. **App móvil nativa** (React Native)
2. **Reportes avanzados** (Power BI / Tableau)
3. **Integración con WhatsApp** (notificaciones)
4. **Sistema de inventario de repuestos**
5. **Planificación predictiva** (ML para mantenimientos)
6. **Portal del cliente** (seguimiento en tiempo real)
7. **API REST pública** (integración con otros sistemas)

---

## 📄 LICENCIA Y PROPIEDAD

**Propietario:** MIREGA ASCENSORES LTDA.  
**Desarrollado por:** GitHub Copilot + Equipo MIREGA  
**Año:** 2025-2026  
**Uso:** Exclusivo para MIREGA ASCENSORES LTDA.

---

*Documento generado automáticamente el 22 de Enero de 2026*  
*Este respaldo contiene el código fuente completo y funcional de la plataforma*
