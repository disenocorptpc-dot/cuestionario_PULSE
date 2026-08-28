# Weekly Pulse v2 · Modelo de datos y notas de migración

Documento de referencia para el rediseño del cuestionario semanal del equipo de
Diseño Industrial y 3D. Explica **qué cambió, por qué, y qué falta por decidir**.

---

## 1. El cambio de fondo

v1 capturaba **narrativa**. v2 captura **narrativa + horas que cierran**.

En v1 el tiempo se guardaba como cadena de texto (`"18 a 30 hrs (Principal)"`),
solo cubría dos categorías de una jornada de 48 h, y no había validación cruzada:
un registro podía declarar 60+ horas en una semana de 48 sin que nada lo detuviera.
Eso hace imposible sumar, promediar o comparar meses — y "métricas de Pulse
llevadas a nuestra operación" es exactamente lo que pidió Gerencia.

En v2 las horas son números y existe un **invariante de cierre**:

```
hours_value + hours_standard + hours_operation
+ hours_coordination + hours_rework + hours_other = hours_available
```

Se valida en el cliente (no deja avanzar) **y** en el servidor (responde 400).
La consecuencia práctica: la semana queda reconstruida por completo, no solo
sus dos picos.

---

## 2. Las seis categorías del reparto

| Categoría | Qué entra | Por qué existe |
|---|---|---|
| `hours_value` | Proyectos donde el diseñador aportó algo que no existía | Es el bullet 1 de Gerencia: "proyectos donde realmente aportaron algo nuevo o de valor" |
| `hours_standard` | Proyectos con nombre propio, de ejecución conocida | Separa "trabajé mucho" de "aporté algo" |
| `hours_operation` | Trabajo suelto sin proyecto propio: adaptaciones, ajustes menores, cambios de formato | Es el bullet 3: "tareas de operación" |
| `hours_coordination` | Juntas, levantamiento de briefs, revisiones, taller, seguimiento de producción | **Las ~30 h que v1 no capturaba.** Sin esto la semana no cierra y el tiempo de coordinación se ve como tiempo perdido |
| `hours_rework` | Rehacer algo ya entregado o ya en producción | Es el bullet 4, pero convertido de sí/no a **horas** |
| `hours_other` | Capacitación, permisos, incapacidad, festivos, tiempo muerto por bloqueo | Sinceridad estructural: sin esta casilla, la gente infla las otras |

`hours_available` es 48 por defecto pero **editable**, para no obligar a mentir
en semanas con vacaciones, permiso o día festivo.

---

## 3. Decisiones de diseño del instrumento

**Ningún campo de opinión arranca con valor.** En v1 los tres grupos de chips
llegaban preseleccionados, así que quien no tocaba nada "reportaba" 18–30 h sin
haberlo elegido, y en la base era indistinguible de quien sí las eligió. En v2
todo arranca en `null`. La única excepción es `hours_available = 48`, que es una
constante factual declarada en pantalla, no una respuesta.

**El retrabajo es una salida, no una confesión.** El copy dice explícitamente
"esto no se usa para evaluarte" y el prompt del reporte incluye la instrucción
de no emitir juicios de desempeño individual. Razón: se le está pidiendo a
alguien autodeclarar sus propios errores; sin ese encuadre, la subdeclaración
está garantizada y el dato se vuelve inútil.

**Se eliminó la "meta del 80% de productividad efectiva".** Vivía escondida en
el prompt de v1 sin que el diseñador la conociera. El día que alguien la
encontrara —está en el mismo HTML que él llena— el instrumento perdía
legitimidad. Si Gerencia quiere una meta, tiene que ser pública.

**"Solo operación" es un camino de primera clase.** v1 forzaba a declarar un
"proyecto estrella" siempre. v2 tiene un botón explícito para la semana sin
proyectos, que es el caso que Gerencia contempló por escrito.

**El paso de retrabajo se salta solo** cuando `hours_rework = 0`. No se le
pregunta a nadie por un problema que no tuvo.

---

## 4. Bugs de v1 corregidos

| Bug | Consecuencia | Estado |
|---|---|---|
| El `POST` no revisaba `res.ok`; el `catch` solo hacía `console.warn` | Confetti y "Registro guardado" aunque el dato nunca llegara. Los huecos se descubrían a fin de mes | Corregido: pantalla de error real, con reintento y aviso de que el respaldo local existe |
| `weekDate` con `toISOString()` (UTC) | En Cancún (UTC−5), después de las 19:00 del viernes la fecha saltaba al sábado. Justo la franja del check-in | Corregido: todas las fechas de calendario en hora local. Verificado con `TZ=America/Cancun` |
| `weekDate` no editable, y era un día, no una semana | Imposible reportar una semana pasada; agregación mensual sobre fechas sueltas | Corregido: selector de fecha + `week_iso` (`2026-W35`) como clave real de agregación |
| `resetForm()` no limpiaba `starTime`, `routineTime`, `costImpact`, `incidentCause` | El segundo registro heredaba los tiempos del primero | Corregido por arquitectura: un solo objeto `state` y `render()`. Reiniciar es `blankState()` |
| `innerHTML` sin escapar en el historial | XSS almacenado | Corregido: `escapeHtml()` en todo el render. Verificado con payloads reales |
| Historial sin autenticación | Cualquiera con la URL veía todos los errores del equipo con nombre | **Pendiente** — ver sección 6 |
| Sin control de duplicados | Nada impedía cinco envíos de la misma semana | Corregido: `UNIQUE (designer_id, week_iso)` + UPSERT + aviso en pantalla |
| Sin borrador | Cerrar la pestaña perdía los 3 minutos | Corregido: autoguardado y oferta de retomar |
| Etiquetas de % calculadas sobre 40 h con jornada declarada de 48 h | Las horas y los porcentajes describían jornadas distintas | Ya no aplica: los porcentajes se derivan de `hours_available` |
| Todos los campos opcionales, rellenados en silencio con texto genérico | Datos inventados analizados como reales | Corregido: validación por paso, en cliente y servidor. Cero relleno silencioso |

---

## 5. Migración

```bash
# 1 · Crear la tabla v2 (no toca la v1, conviven)
npx wrangler d1 execute pulse_db --remote --file=./schema.sql

# 2 · Desplegar
#    index.html               → raíz del proyecto
#    submit.js                → functions/api/submit.js
#    responses.js             → functions/api/responses.js
#    export-csv.js            → functions/api/export-csv.js
```

La tabla v1 (`weekly_pulse_responses`) se queda como está. Sus registros no son
convertibles: los rangos en texto no se pueden desagregar a horas sin inventar.
Si hay datos históricos que valga la pena conservar, lo honesto es tratarlos como
una serie distinta y no mezclarlos en el mismo reporte.

---

## 6. Lo que falta decidir (no lo resolví por ti)

1. **Autenticación del historial.** Sigue abierto a cualquiera con la URL. Para
   un instrumento donde la gente autodeclara errores esto importa. Opciones:
   Cloudflare Access con el correo corporativo (lo más limpio), o restringir el
   endpoint `/api/responses` y dejar que solo tú lo consultes.

2. **Nombres del equipo.** El repo decía "Michelle Pous Alarcon"; tu documento de
   contexto dice "Mitchell Pous". Usé **Mitchell Pous Alarcón** y asigné los roles
   reales (Diseñador Industrial / Diseñadora Industrial / Diseñador 3D) en vez del
   genérico "Equipo de Diseño". Verifica la ortografía antes de publicar — aparece
   en un reporte que lee Gerencia.

3. **`team_unit`.** v1 mandaba `"Diseño Gráfico"` fijo. Puse
   `"Diseño Industrial y 3D"`, que es tu coordinación dentro del departamento
   corporativo. Si Gerencia quiere comparar entre coordinaciones, este campo tiene
   que ser consistente con lo que usen los demás coordinadores.

4. **Cómo llega el dato a Claude a fin de mes.** Hoy hay dos rutas y conviene
   quedarse con una:
   - *Copiar el prompt* (implementado): funciona, pero es manual.
   - *Que los registros vivan donde Claude ya puede leerlos* — una hoja en Google
     Drive o SharePoint, ambos ya conectados. Es la que responde a la nota de
     Gerencia ("dejar Pulse vinculado con Claude") sin intervención tuya.

   Si eliges la segunda, el endpoint `/api/submit` puede replicar cada registro a
   la hoja además de escribir en D1, con el mismo Apps Script que ya documentaste
   —solo hay que actualizar los encabezados a las columnas de v2.

5. **Recordatorio del viernes.** El instrumento no sirve si no se llena. Vale la
   pena un recordatorio automático los viernes por la tarde.

---

## 7. Las tres métricas del reporte mensual

Todo lo anterior existe para poder calcular estas tres cosas. Las consultas SQL
están comentadas al final de `schema.sql`.

**1 · Mix del mes** — reparto valor / estándar / operación / coordinación /
retrabajo. Responde "en qué se está invirtiendo el tiempo", que es la pregunta
literal de Gerencia.

**2 · Tasa de retrabajo** — `hours_rework / hours_available`, más el costo
asociado en MXN.

**3 · Causa raíz dominante del retrabajo** — y aquí está el valor estratégico
del instrumento. Si a tres meses los datos muestran que la mayoría del retrabajo
viene de *"cambio de brief con el trabajo ya iniciado (cliente interno)"*, el
reporte deja de ser un examen de tu área y se convierte en evidencia para
negociar proceso corporativo. Por eso el catálogo de causas distingue
explícitamente las internas de las externas al equipo: no es una taxonomía
neutra, está construida para que esa distinción sea visible.
