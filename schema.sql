-- ═══════════════════════════════════════════════════════════════════
-- Weekly Pulse · esquema v2 (Cloudflare D1 / SQLite)
--
-- Cambio de fondo respecto a v1: las horas son NUMÉRICAS y cierran
-- contra hours_available. Eso hace que el reporte mensual se pueda
-- calcular con SQL, sin que un LLM tenga que interpretar cadenas
-- como "18 a 30 hrs (Principal)".
--
-- Aplicar con:
--   npx wrangler d1 execute pulse_db --remote --file=./schema.sql
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS weekly_pulse_v2 (
  id                 TEXT PRIMARY KEY,
  submitted_at       TEXT NOT NULL,
  schema_version     INTEGER NOT NULL DEFAULT 2,

  -- ── Identidad y periodo ──
  week_iso           TEXT NOT NULL,          -- "2026-W35" · clave real de agregación
  week_start         TEXT NOT NULL,          -- "2026-08-24" · lunes, hora local de Cancún
  week_number        INTEGER NOT NULL,
  week_year          INTEGER NOT NULL,
  designer           TEXT NOT NULL,
  designer_id        TEXT NOT NULL,
  designer_role      TEXT,
  team_unit          TEXT,

  -- ── Reparto de la semana (horas, REAL) ──
  -- Invariante: hours_value + hours_standard + hours_operation
  --           + hours_coordination + hours_rework + hours_other
  --           = hours_available
  hours_available    REAL NOT NULL,
  hours_value        REAL NOT NULL DEFAULT 0,  -- proyectos donde aportó algo nuevo
  hours_standard     REAL NOT NULL DEFAULT 0,  -- proyectos de ejecución conocida
  hours_projects     REAL NOT NULL DEFAULT 0,  -- value + standard (derivado, para consultas rápidas)
  hours_operation    REAL NOT NULL DEFAULT 0,  -- trabajo suelto sin proyecto propio
  hours_coordination REAL NOT NULL DEFAULT 0,  -- juntas, briefs, revisiones, taller
  hours_rework       REAL NOT NULL DEFAULT 0,  -- rehacer lo ya entregado o en producción
  hours_other        REAL NOT NULL DEFAULT 0,  -- capacitación, permisos, tiempo muerto
  hours_assigned     REAL NOT NULL DEFAULT 0,  -- suma real reportada (auditoría del cierre)

  -- ── Detalle de proyectos ──
  project_count      INTEGER NOT NULL DEFAULT 0,
  projects_json      TEXT NOT NULL DEFAULT '[]',
  -- [{ name, hours, kind: "valor"|"estandar", contribution }]

  -- ── Retrabajo ──
  has_rework         TEXT NOT NULL DEFAULT 'No',
  rework_cause       TEXT,
  rework_description TEXT,
  cost_impact        TEXT,
  cost_amount_mxn    REAL,

  -- ── Cualitativo ──
  innovation_notes   TEXT,
  blockers           TEXT,

  -- Un registro por persona por semana. El segundo envío reemplaza al primero.
  UNIQUE (designer_id, week_iso)
);

CREATE INDEX IF NOT EXISTS idx_pulse_week     ON weekly_pulse_v2 (week_iso);
CREATE INDEX IF NOT EXISTS idx_pulse_designer ON weekly_pulse_v2 (designer_id, week_iso);
CREATE INDEX IF NOT EXISTS idx_pulse_start    ON weekly_pulse_v2 (week_start);


-- ═══════════════════════════════════════════════════════════════════
-- CONSULTAS DEL REPORTE MENSUAL
-- Sustituye '2026-09' por el mes que estés cerrando.
-- ═══════════════════════════════════════════════════════════════════

-- 1 · Mix del mes por diseñador (el corazón del reporte)
--
-- SELECT
--   designer,
--   COUNT(*)                                   AS semanas,
--   SUM(hours_available)                       AS h_disponibles,
--   SUM(hours_value)                           AS h_valor,
--   ROUND(100.0*SUM(hours_value)/SUM(hours_available), 1)        AS pct_valor,
--   SUM(hours_standard)                        AS h_estandar,
--   SUM(hours_operation)                       AS h_operacion,
--   ROUND(100.0*SUM(hours_operation)/SUM(hours_available), 1)    AS pct_operacion,
--   SUM(hours_coordination)                    AS h_coordinacion,
--   SUM(hours_rework)                          AS h_retrabajo,
--   ROUND(100.0*SUM(hours_rework)/SUM(hours_available), 1)       AS tasa_retrabajo,
--   SUM(hours_other)                           AS h_otro,
--   SUM(COALESCE(cost_amount_mxn, 0))          AS costo_extra_mxn
-- FROM weekly_pulse_v2
-- WHERE substr(week_start, 1, 7) = '2026-09'
-- GROUP BY designer_id
-- ORDER BY designer;

-- 2 · Causa raíz dominante del retrabajo
--     Esta es la métrica que convierte el reporte en evidencia de proceso:
--     separa lo que depende del equipo de lo que no.
--
-- SELECT
--   rework_cause,
--   COUNT(*)                          AS incidencias,
--   SUM(hours_rework)                 AS horas_perdidas,
--   SUM(COALESCE(cost_amount_mxn, 0)) AS costo_mxn
-- FROM weekly_pulse_v2
-- WHERE substr(week_start, 1, 7) = '2026-09' AND hours_rework > 0
-- GROUP BY rework_cause
-- ORDER BY horas_perdidas DESC;

-- 3 · Calidad del dato: semanas que no cuadran o que nadie reportó
--
-- SELECT designer, week_iso, hours_available, hours_assigned,
--        ROUND(hours_assigned - hours_available, 1) AS descuadre
-- FROM weekly_pulse_v2
-- WHERE substr(week_start, 1, 7) = '2026-09'
--   AND ABS(hours_assigned - hours_available) > 0.01;
