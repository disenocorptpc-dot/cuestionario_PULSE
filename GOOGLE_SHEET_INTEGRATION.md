# 📊 Cómo conectar Weekly Pulse a Google Sheets / Excel (100% Gratis y 24/7)

Para que las respuestas de tus diseñadores caigan en una hoja de cálculo en la nube aunque tu computadora o n8n estén apagados, sigue estos sencillos pasos:

---

### Paso 1: Crear la Hoja de Google Sheets
1. Abre [Google Sheets](https://sheets.new) y crea una nueva hoja llamada: `Weekly_Pulse_Respuestas`.
2. En la primera fila (Fila 1), coloca estos encabezados:
   * **A1:** `ID`
   * **B1:** `Fecha_Semana`
   * **C1:** `Diseñador`
   * **D1:** `Equipo`
   * **E1:** `Proyecto_Estrella`
   * **F1:** `Valor_Aportado`
   * **G1:** `Tiempo_Proyecto`
   * **H1:** `Ejemplos_Rutina`
   * **I1:** `Tiempo_Rutina`
   * **J1:** `Tiene_Incidencia`
   * **K1:** `Causa_Incidencia`
   * **L1:** `Descripcion_Incidencia`
   * **M1:** `Impacto_Costo`
   * **N1:** `Innovacion_Mejora`
   * **O1:** `Timestamp`

---

### Paso 2: Crear el Webhook con Google Apps Script (1 minuto)
1. En tu Google Sheet, ve al menú superior: **Extensiones** > **Apps Script**.
2. Borra todo el código que aparezca y pega este script:

```javascript
function doPost(e) {
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
    var data = JSON.parse(e.postData.contents);
    
    sheet.appendRow([
      data.id || ("rec_" + new Date().getTime()),
      data.weekDate || "",
      data.designer || "",
      data.teamUnit || "",
      data.starProject || "",
      data.starValue || "",
      data.starTime || "",
      data.routineTasks || "",
      data.routineTime || "",
      data.hasIncident || "",
      data.incidentCause || "",
      data.incidentDescription || "",
      data.costImpact || "",
      data.innovationNotes || "",
      data.submittedAt || new Date().toISOString()
    ]);
    
    return ContentService.createTextOutput(JSON.stringify({ "result": "success" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ "result": "error", "error": error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. Haz clic en **Guardar** (ícono de disquete).
4. Haz clic en el botón azul **Implementar** (arriba a la derecha) > **Nueva implementación**.
5. En el engranaje de configuración elige: **Aplicación web**.
   * **Descripción:** `Weekly Pulse Webhook`
   * **Ejecutar como:** `Yo (tu correo)`
   * **Quién tiene acceso:** `Cualquier usuario` *(Importante para que la web app pueda enviar datos sin pedir login de Google)*.
6. Haz clic en **Implementar**, autoriza los permisos y **copia la URL de la aplicación web**.

---

### Paso 3: Pegar la URL en la Web App
1. Abre tu Web App (`index.html`).
2. Haz clic en el botón superior **"Historial & Exportar"**.
3. En el campo **Webhook URL**, pega la URL que copiaste y dale **Guardar**.

¡Listo! A partir de ese momento, cada vez que un diseñador complete su Weekly Pulse, la información se guardará **en tiempo real en tu Google Sheet** (y también se guardará localmente como respaldo).

---

### 🤖 ¿Y cómo lo jala n8n a fin de mes?
Cuando enciendas tu n8n:
1. Usas el nodo **Google Sheets** (Buscar/Descargar filas del mes).
2. O descargas el archivo en Excel (.xlsx) / CSV con un solo clic.
3. n8n o Claude procesan la tabla y te redactan el reporte ejecutivo final.
