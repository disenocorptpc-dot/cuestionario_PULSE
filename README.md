# 📋 Weekly Pulse — Cuestionario semanal del equipo de Diseño

**Weekly Pulse** es un cuestionario semanal de check-in para el equipo de Diseño Industrial y 3D de Disenocorptpc. Permite que cada diseñador registre cómo distribuyó sus horas durante la semana, qué proyectos trabajó, si hubo retrabajo y cuánto costó.

---

## 🔗 Links clave

| Recurso | URL |
|---|---|
| **Formulario live** | https://cuestionario-pulse.pages.dev |
| **Repositorio GitHub** | https://github.com/disenocorptpc-dot/cuestionario_PULSE |
| **Cloudflare Dashboard** | https://dash.cloudflare.com/5a6762dd79435352a8eb5b37752eec13 |
| **D1 Database (Console)** | https://dash.cloudflare.com/5a6762dd79435352a8eb5b37752eec13/workers/d1/databases/12937bb1-d589-4aa7-b49c-13d1ae0ff9d0/console |

---

## 🏗️ Arquitectura

```
[Diseñador] → cuestionario-pulse.pages.dev (HTML estático)
                        ↓ POST /api/submit
              Cloudflare Pages Functions
                        ↓
              Cloudflare D1 — pulse_db_
                        ↑ GET /api/responses
              Panel admin / Claude AI (reportes)
                        ↓ (Fase 2 pendiente)
              Notion — Reporte mensual
```

### Stack
- **Frontend**: HTML + CSS puro, sin frameworks. Archivo `index.html` monolítico (~83 KB).
- **Backend**: Cloudflare Pages Functions (Workers en el borde)
- **Base de datos**: Cloudflare D1 (SQLite serverless)
- **Hosting**: Cloudflare Pages, conectado al repo GitHub (auto-deploy en push a `main`)

---

## 📁 Estructura del repositorio

```
cuestionario_PULSE/
├── index.html                  # Formulario completo (frontend + lógica de UI)
├── colors_and_type.css         # Sistema de diseño: colores, tipografía
├── schema.sql                  # Schema de D1 + queries de reporte mensual comentadas
├── MODELO_DE_DATOS.md          # Explicación del rediseño v1→v2 y decisiones
├── GOOGLE_SHEET_INTEGRATION.md # Integración opcional con Google Sheets (no activa)
├── assets/                     # Imágenes y recursos estáticos
├── fonts/                      # Fuentes locales
└── functions/
    └── api/
        ├── submit.js           # POST /api/submit — guarda respuesta en D1
        ├── responses.js        # GET /api/responses — lee respuestas de D1
        └── export-csv.js       # GET /api/export-csv — exporta datos a CSV
```

---

## 🗄️ Base de datos (Cloudflare D1)

- **Nombre de la BD**: `pulse_db_`
- **Database ID**: `12937bb1-d589-4aa7-b49c-13d1ae0ff9d0`
- **Binding en Pages**: variable `DB` → apunta a `pulse_db_`
- **Tabla principal**: `weekly_pulse_v2`

### Schema resumido

```sql
CREATE TABLE weekly_pulse_v2 (
  id                 TEXT PRIMARY KEY,       -- "rec_<timestamp>"
  submitted_at       TEXT NOT NULL,
  schema_version     INTEGER DEFAULT 2,

  -- Identidad y periodo
  week_iso           TEXT NOT NULL,          -- "2026-W35"
  week_start         TEXT NOT NULL,          -- "2026-08-24" (lunes, hora Cancún)
  week_number        INTEGER NOT NULL,
  week_year          INTEGER NOT NULL,
  designer           TEXT NOT NULL,
  designer_id        TEXT NOT NULL,          -- slug único del diseñador
  designer_role      TEXT,
  team_unit          TEXT,

  -- Reparto de horas (REAL, deben sumar hours_available)
  hours_available    REAL NOT NULL,          -- 48 por defecto
  hours_value        REAL DEFAULT 0,         -- proyectos con aportación nueva
  hours_standard     REAL DEFAULT 0,         -- proyectos de ejecución conocida
  hours_projects     REAL DEFAULT 0,         -- value + standard (derivado)
  hours_operation    REAL DEFAULT 0,         -- trabajo suelto sin proyecto
  hours_coordination REAL DEFAULT 0,         -- juntas, briefs, revisiones
  hours_rework       REAL DEFAULT 0,         -- rehacer algo ya entregado
  hours_other        REAL DEFAULT 0,         -- capacitación, permisos, etc.
  hours_assigned     REAL DEFAULT 0,         -- suma real reportada (auditoría)

  -- Detalle de proyectos
  project_count      INTEGER DEFAULT 0,
  projects_json      TEXT DEFAULT '[]',
  -- formato: [{ name, hours, kind: "valor"|"estandar", contribution }]

  -- Retrabajo
  has_rework         TEXT DEFAULT 'No',
  rework_cause       TEXT,
  rework_description TEXT,
  cost_impact        TEXT,
  cost_amount_mxn    REAL,

  -- Cualitativo
  innovation_notes   TEXT,
  blockers           TEXT,

  UNIQUE (designer_id, week_iso)             -- UPSERT: el 2do envío reemplaza
);
```

> **Invariante clave**: `hours_value + hours_standard + hours_operation + hours_coordination + hours_rework + hours_other = hours_available`. Se valida en cliente y servidor.

---

## 🔌 API Endpoints

### `POST /api/submit`
Guarda o actualiza la respuesta de la semana (UPSERT por `designer_id + week_iso`).

**Campos obligatorios**: `designer_id`, `designer`, `week_iso` (`2026-W35`), `week_start` (`2026-08-24`), `hours_available > 0`.

**Respuesta exitosa**:
```json
{ "success": true, "id": "rec_1787976013817", "week_iso": "2026-W35", "designer": "Nombre" }
```

**Payload completo de ejemplo**:
```json
{
  "designer_id": "homero",
  "designer": "Homero Simpson",
  "designer_role": "Diseñador 3D",
  "team_unit": "Diseño Industrial",
  "week_iso": "2026-W35",
  "week_start": "2026-08-24",
  "week_number": 35,
  "week_year": 2026,
  "hours_available": 48,
  "hours_value": 10,
  "hours_standard": 8,
  "hours_projects": 18,
  "hours_operation": 10,
  "hours_coordination": 8,
  "hours_rework": 6,
  "hours_other": 6,
  "hours_assigned": 48,
  "project_count": 1,
  "projects_json": "[{\"name\":\"Proyecto X\",\"hours\":10,\"kind\":\"valor\",\"contribution\":\"Rediseño completo\"}]",
  "has_rework": "Si",
  "rework_cause": "Cambio de brief",
  "rework_description": "El cliente cambió los requerimientos a mitad del proyecto",
  "cost_impact": "Sin costo extra (solo tiempo de diseño)",
  "cost_amount_mxn": 0,
  "innovation_notes": "Implementamos nuevo workflow de revisión",
  "blockers": ""
}
```

---

### `GET /api/responses`
Lee respuestas de D1.

| Parámetro | Ejemplo | Descripción |
|---|---|---|
| `month` | `?month=2026-08` | Filtra por mes del `week_start` |
| `designer` | `?designer=homero` | Filtra por `designer_id` |
| `limit` | `?limit=50` | Límite de registros (default 300, max 1000) |

**Respuesta**:
```json
{ "success": true, "count": 1, "data": [ { ...registro... } ] }
```

---

### `GET /api/export-csv`
Exporta los datos en formato CSV. Acepta los mismos parámetros que `/api/responses`.

---

## 📊 Queries del reporte mensual

Listas en `schema.sql` (comentadas). Sustituir `'2026-08'` por el mes a cerrar:

```sql
-- 1. Mix del mes por diseñador
SELECT designer,
  COUNT(*) AS semanas,
  SUM(hours_available) AS h_disponibles,
  ROUND(100.0*SUM(hours_value)/SUM(hours_available), 1) AS pct_valor,
  ROUND(100.0*SUM(hours_rework)/SUM(hours_available), 1) AS tasa_retrabajo,
  SUM(COALESCE(cost_amount_mxn, 0)) AS costo_extra_mxn
FROM weekly_pulse_v2
WHERE substr(week_start, 1, 7) = '2026-08'
GROUP BY designer_id ORDER BY designer;

-- 2. Causa raíz del retrabajo
SELECT rework_cause, COUNT(*) AS incidencias,
  SUM(hours_rework) AS horas_perdidas,
  SUM(COALESCE(cost_amount_mxn, 0)) AS costo_mxn
FROM weekly_pulse_v2
WHERE substr(week_start, 1, 7) = '2026-08' AND hours_rework > 0
GROUP BY rework_cause ORDER BY horas_perdidas DESC;

-- 3. Calidad del dato
SELECT designer, week_iso, hours_available, hours_assigned,
  ROUND(hours_assigned - hours_available, 1) AS descuadre
FROM weekly_pulse_v2
WHERE substr(week_start, 1, 7) = '2026-08'
  AND ABS(hours_assigned - hours_available) > 0.01;
```

---

## 🚀 Fase 2 — Reporte mensual automático en Notion (PENDIENTE)

### Objetivo
Una tarea programada mensual que:
1. Lee las respuestas de `/api/responses?month=YYYY-MM`
2. Claude AI analiza y redacta un reporte en lenguaje natural
3. Crea una página en Notion con el reporte completo

### Flujo propuesto
```
Tarea programada (1ro de cada mes) via /schedule de Antigravity
    ↓
GET https://cuestionario-pulse.pages.dev/api/responses?month=YYYY-MM
    ↓
Claude AI genera el reporte (tablas + narrativa)
    ↓
Notion API → nueva página en la BD de reportes
```

### Checklist de implementación
- [ ] Definir base de datos de Notion donde vivirán los reportes
- [ ] Crear integration en notion.so/my-integrations → obtener token `secret_...`
- [ ] Compartir la BD de Notion con la integration
- [ ] Configurar tarea mensual con `/schedule` en Antigravity
- [ ] Validar formato del reporte con gerencia

### Formato del reporte en Notion (propuesto)

```
# Reporte Weekly Pulse — Agosto 2026

## Resumen ejecutivo
[Párrafo con hallazgos principales]

## Mix de horas por diseñador
| Diseñador | H. Disponibles | % Valor | % Operación | % Retrabajo | Costo extra |

## Retrabajo del mes
| Causa | Incidencias | Horas perdidas | Costo MXN |

## Observaciones y recomendaciones
[Patrones detectados, anomalías, acciones sugeridas]
```

---

## 🛠️ Configuración inicial (reconstrucción desde cero)

### 1. Cloudflare Pages
- Conectar repo `disenocorptpc-dot/cuestionario_PULSE`, branch `main`
- Sin build command ni output directory (sitio estático)

### 2. Crear y configurar D1
```bash
# Con wrangler CLI:
npx wrangler d1 create pulse_db_
npx wrangler d1 execute pulse_db_ --remote --file=./schema.sql
```
O desde el dashboard: D1 → Create → Console → pegar `schema.sql`.

### 3. Binding en Pages
- Settings → Bindings → Add → D1 Database
- **Variable name**: `DB` (exactamente así, mayúscula)
- **D1 database**: `pulse_db_`
- Guardar y hacer Retry deployment

### 4. Verificar
```bash
# Submit de prueba
curl -X POST https://cuestionario-pulse.pages.dev/api/submit \
  -H "Content-Type: application/json" \
  -d '{"designer_id":"test","designer":"Test","week_iso":"2026-W01","week_start":"2025-12-30","week_number":1,"week_year":2026,"hours_available":48,"hours_value":10,"hours_standard":8,"hours_projects":18,"hours_operation":10,"hours_coordination":8,"hours_rework":6,"hours_other":6,"hours_assigned":48}'

# Leer respuestas
curl https://cuestionario-pulse.pages.dev/api/responses
```

---

## 📝 Historial de versiones

| Versión | Cambio principal |
|---|---|
| v1 | Horas como texto, sin validación de cierre, guardaba en Google Sheets |
| v2 | Horas como REAL, invariante de cierre, D1, validación servidor, UPSERT |

---

## 🔐 Variables de entorno necesarias (Cloudflare Pages → Settings → Variables)

Para la Fase 2, agregar:

| Variable | Descripción |
|---|---|
| `NOTION_TOKEN` | Token de la integration de Notion (`secret_...`) |
| `NOTION_DB_ID` | ID de la base de datos de Notion para reportes |

> ⚠️ Nunca commitear tokens en el código. Siempre usar Variables de entorno en Cloudflare.

---

*Proyecto activo desde agosto 2026 · Equipo Diseño Industrial y 3D · Disenocorptpc*
