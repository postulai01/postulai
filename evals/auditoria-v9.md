# Auditoría SYSTEM_PROMPT v9 — Postulai

**Fecha:** 2026-09-26  
**Baseline:** tag `cerebro-v9-baseline` (commit 3884457)  
**Resultado línea base:** 6.67/10 promedio (6 casos, crítico haiku, texto, 3 reps)

---

## 1. Inventario de reglas por propósito

### A. Análisis de oferta / keywords

| Regla | Dónde aparece | Estado |
|---|---|---|
| Extraer 8-10 keywords literales de la oferta | PASO 0 (×2), HABILIDADES, CHECKLIST □6 | **Triplicada** |
| Keywords solo con evidencia en CV original | PASO 0, HABILIDADES, CHECKLIST □11 | **Triplicada** |
| "Conocimientos en desarrollo" solo con indicio real | PASO 0, HABILIDADES | **Duplicada** |
| Lenguaje espejo exacto de la oferta | PASO 0 | Normal |
| Puentes honestos (conectar sin igualar contexto) | PASO 0 (~400 palabras) | Normal, pero excesivamente largo |

### B. Honestidad / anti-fabricación

| Regla | Dónde aparece | Estado |
|---|---|---|
| Nunca inventar experiencias/logros/empresas/fechas | REGLAS ATS, EXPERIENCIA, CHECKLIST □10, CHECKLIST □11 | **Cuadruplicada** |
| Solo reencuadrar lo que existe en el CV | EXPERIENCIA (TRANSFORMACIÓN ACTIVA) | Normal |
| Preservar métricas del original al reencuadrar | EXPERIENCIA (PRESERVACIÓN DE MÉTRICAS) | Normal |
| **Excepción: "inventar rangos creíbles"** para cargo actual reciente | EXPERIENCIA (cargo actual, línea ~126) | **Contradice todas las anteriores** |

### C. Perfil profesional

| Regla | Estado |
|---|---|
| 50–100 palabras | **Contradice rúbrica C4 (50–70 palabras)** |
| Máximo 4 líneas | Normal |
| Estructura obligatoria 3 líneas: rol+años / especializaciones / logro+disponibilidad | Normal |
| Mencionar rol del cargo pero nunca el nombre de la empresa | Normal — pero enterrada en 30 líneas de prohibiciones |
| ~14 prohibiciones específicas + frases de ejemplo | Varias redundantes entre sí |
| TONO según nivel (practicante vs senior) | Normal |
| Checklist □9: contar palabras del perfil | **Redundante: el código ya recorta perfiles >100 palabras** |
| Checklist □3: ¿El perfil conecta con empresa y cargo? | Demasiado vago para ser accionable |

### D. Experiencia laboral — bullets

| Regla | Estado |
|---|---|
| Verbo 1ª persona pasado + qué + resultado/escala | Normal |
| Lista de ~30 verbos permitidos | Normal, aunque genera dependencia de enumeración |
| "Ejecuté demostraciones" — nunca "demostré producto" | Regla de caso específico que el modelo igualmente viola |
| Lista de ~20 frases/palabras prohibidas | Normal, aunque larga |
| Presente para cargo actual | **Contradice checklist □1** (que dice pasado sin excepción) |
| Al menos 1 bullet con número por cargo | Normal |
| TEST FINAL de cada bullet | Repite la regla principal |
| TRANSFORMACIÓN ACTIVA: reencuadrar hacia lenguaje de oferta | Normal |
| PRESERVACIÓN DE MÉTRICAS: nunca eliminar cifras al reencuadrar | Normal |
| Brechas: 3 niveles (<3m, 3–12m, >12m) con formato exacto | Normal |

### E. Cargo actual — regla especial

| Regla | Estado |
|---|---|
| Cargo actual es lo más importante | Normal |
| Tolerancia cero para verbos de asistente en cargo actual | Normal |
| Si consultoría/freelance, bullets como resultados a clientes | Normal |
| Si no hay métricas, "inventar rangos creíbles" basados en cargos anteriores | **Contradicción directa con principio de honestidad** |

### F. Educación

4 reglas limpias, sin duplicación significativa. Bien.

### G. Habilidades

| Regla | Estado |
|---|---|
| Tres categorías: Técnicas (máx 6), Blandas (máx 5), Conocimientos en desarrollo | Normal |
| Técnicas: solo herramientas con nombre propio | Normal — **el código ya enforcea esto post-generación** |
| Blandas: lista de válidas e inválidas | Normal |
| "Conocimientos en desarrollo": solo con respaldo en CV original, nunca en la oferta | Triplicada con PASO 0 — **el código ya enforcea esto post-generación** |
| Formato: línea única separada por · | Normal |

### H. Carta de presentación

4 reglas limpias (250–350 palabras, 3 párrafos, estructura, prohibiciones de apertura). Sin duplicaciones relevantes.

### I. Sugerencias

2 reglas (exactamente 3 en orden fijo, formato título+2 oraciones). Sin duplicaciones.

### J. Principales cambios

1 regla (exactamente 5, formato "qué había → qué hay ahora"). Sin duplicaciones.

### K. ATS / formato general

| Regla | Estado |
|---|---|
| Sin tablas, columnas múltiples, íconos, gráficos | Normal |
| Fechas MM/AAAA | Normal |
| Extensión según nivel | Normal |
| Sin pie de página ni mención a Postulai | Normal |
| Secciones en MAYÚSCULAS seguidas de ——— | Normal |

### L. Checklist (□1–□11)

De 11 ítems, **9 son repeticiones** de reglas ya enunciadas en secciones anteriores:

| Ítem | Estado |
|---|---|
| □1: Primera persona pasado | Repite regla de EXPERIENCIA |
| □2: Al menos 1 resultado con número por cargo | Repite regla de EXPERIENCIA |
| □3: Perfil conecta con empresa y cargo | Repite (vagamente) regla de PERFIL |
| □4: Educación sin bullets | Repite regla de EDUCACIÓN |
| □5: Habilidades técnicas solo herramientas | Repite regla de HABILIDADES |
| □6: Keywords integradas | Repite regla del PASO 0 |
| □7: Escanear ~20 palabras prohibidas | Repite lista de EXPERIENCIA + variaciones |
| □8: Tono y extensión según nivel | Repite reglas de nivel y ATS |
| □9: Contar palabras del perfil | **Redundante: el código recorta perfiles >100 palabras** |
| □10: ≥50% bullets con número en cargo más reciente | **Nueva regla no mencionada antes** |
| □11: Integridad de afirmaciones (~400 palabras) | **Cuarta copia** de la regla de honestidad |

El checklist completo tiene ~600 palabras y es básicamente un resumen de todas las reglas anteriores. Su mayor riesgo: el modelo recuerda el checklist más que las reglas originales, produciendo comportamiento inconsistente cuando ambos difieren.

---

## 2. Contradicciones prompt ↔ rúbrica del crítico

| # | Tema | SYSTEM_PROMPT dice | Rúbrica dice | Impacto real en línea base |
|---|---|---|---|---|
| **CON-1** | Límite de palabras del perfil | 50–**100** palabras | C4: 50–**70** palabras | Crítico penaliza perfiles de 71–100 palabras que el prompt considera válidos. Causa inconsistencia directa en notas C4. |
| **CON-2** | Fabricar métricas para cargo actual | "inventa rangos creíbles basados en cargos anteriores" | C2: "está estrictamente prohibido penalizar por no inventar números" | El cerebro inventa rangos, el crítico a veces penaliza por inventarlos (honestidad) y a veces por no inventarlos (falta de cuantificación). Estado inconsistente en 5/6 casos con C2. |
| **CON-3** | Verbos en cargo actual | "Para cargos actuales usar presente: gestiono, lidero, coordino" | C1: evalúa verbos de acción sin distinción pasado/presente | Checklist □1 también dice "PRIMERA PERSONA SINGULAR PASADO" sin excepción. El modelo recibe señales contradictorias sobre cómo conjugar el cargo actual. |
| **CON-4** | Lenguaje espejo cuando candidato no tiene experiencia | Sección "puentes honestos" explica cuándo NO usar vocabulario exacto de la oferta | C3 tiene salvaguarda ("evalúa solo keywords donde candidato tiene evidencia"), pero el crítico la ignora | Crítico penalizó C3 como "importante" en 4/6 casos por keywords que el candidato genuinamente no puede demostrar. Penaliza al cerebro por cumplir correctamente la regla de honestidad. |
| **CON-5** | Brechas laborales 3–6 meses | Brechas 3–12m insertar como entrada cronológica obligatoria | C5: brechas de más de 6m deben abordarse; las de 3–6m no son mencionadas | Para brechas de 3–6m: el prompt obliga tratarlas, la rúbrica no las exige. Resultado: el crítico puede penalizar que existan O que no existan según su interpretación. |

---

## 3. Clasificación de problemas de la línea base

### C4 — Perfil profesional (6/6 casos)

**andres_senior, camila_junior, roberto_brecha, valentina_cambio_rubro:**  
→ **(a) Error real del cerebro.** La regla "menciona el rol del cargo" existe en el SYSTEM_PROMPT pero está enterrada entre 30+ prohibiciones y 3 estructuras obligatorias. El modelo cumple mecánicamente la estructura de 3 líneas pero no garantiza que el perfil sea suficientemente diferenciador ni que nombre el cargo exacto.

**pedro_cencomalls, pedro_xepelin:**  
→ **(a) Error real + (b) Contradicción prompt/rúbrica.** El prompt no instruye a transparentar las limitaciones de nivel en el perfil para candidatos junior con brecha grande de fit. La rúbrica penaliza la ausencia de esa transparencia (C4 como "importante"), pero el prompt nunca define que los perfiles junior deben reconocer qué habilidades están en desarrollo.

**Causa raíz común C4:** Demasiadas reglas compiten por atención en la misma sección. La regla más importante (nombrar el rol exacto) no tiene prioridad visual sobre las 14 prohibiciones que la rodean.

---

### C1 — Verbos de acción (5/6 casos)

**andres_senior (verbos "definir", "diseñar"):**  
→ **(a) Error real del cerebro.** El modelo eligió verbos del cargo original en lugar de reescribir con verbos más fuertes. La lista de verbos permitidos incluye "definí" y "diseñé", que son más débiles que "implementé" o "estructuré". El prompt no jerarquiza la fuerza de los verbos.

**camila_junior ("gestiono" débil en cargo actual):**  
→ **(b) Contradicción interna del prompt.** El SYSTEM_PROMPT permite "gestiono" para cargos actuales (regla de presente), pero el crítico lo penaliza como verbo débil. La regla de verbos permitidos incluye "gestiono" explícitamente.

**pedro_xepelin ("ejecuté" ×3 consecutivos):**  
→ **(a) Error real del cerebro + hueco de especificación.** El prompt lista "ejecuté" como verbo permitido pero no advierte sobre repetición del mismo verbo en un cargo. No hay regla contra ello.

**pedro_cencomalls, roberto_brecha:**  
→ **(a) Error real del cerebro.** Verbos débiles que el modelo no corrigió pese a existir la regla.

---

### C2 — Logros cuantificados (5/6 casos)

**andres_senior, valentina_cambio_rubro (métricas del original perdidas al reencuadrar):**  
→ **(a) Error real del cerebro.** El modelo viola R28 (PRESERVACIÓN DE MÉTRICAS) al reencuadrar bullets. La regla existe y es específica; el modelo simplemente no la aplica con consistencia.

**pedro_xepelin, camila_junior (CV original sin métricas):**  
→ **(c) Limitación del CV original**, que el crítico igualmente marca C2 como "importante".  
→ **(b) Contradicción prompt/rúbrica (CON-2):** El prompt instruye "inventa rangos creíbles" (R32), la rúbrica prohíbe penalizar por no inventar (C2). Estado inconsistente: si el cerebro inventa, puede ser penalizado por fabricar; si no inventa, puede ser penalizado por falta de cuantificación.

**roberto_brecha (bullet pierde "3 líneas" → "líneas simultáneas"):**  
→ **(a) Error real del cerebro.** El reencuadre eliminó una cifra concreta que existía en el CV original.

---

### C3 — Lenguaje espejo (4/6 casos)

**andres_senior, pedro_cencomalls, pedro_xepelin, valentina_cambio_rubro:**  
→ **(b) Contradicción entre prompt y rúbrica (CON-4).**  
El SYSTEM_PROMPT tiene la sección de "puentes honestos" que explica explícitamente cuándo NO usar el vocabulario exacto de la oferta (cuando el candidato no tiene ese contexto). La rúbrica C3 tiene la salvaguarda correcta: "Evalúa este criterio SOLO sobre las keywords para las cuales el candidato tiene evidencia en el CV original." Sin embargo, el crítico ignora esta salvaguarda y penaliza C3 como "importante" por keywords que el candidato genuinamente no puede demostrar tener (p.ej.: "financial storytelling" para pedro_xepelin, "control de cartera con aging" para pedro_cencomalls).

**Resultado:** el cerebro actúa correctamente al no usar vocabulario de oferta que el candidato no puede sostener, y el crítico lo penaliza por ello. Es una falla del crítico, no del cerebro.

---

## 4. Lo que el código ya cubre (reglas redundantes en el prompt)

| Qué hace el código | Ubicación | Reglas del prompt que se vuelven redundantes |
|---|---|---|
| `limpiarHabilidadesTecnicas`: elimina post-generación cualquier herramienta en "Habilidades técnicas" sin respaldo en el CV original | `app/lib/cv-postprocess.ts` | Las 3 copias de la regla "solo herramientas con nombre propio y respaldo" pueden reducirse a 1 principio en el prompt |
| `limpiarConocimientosEnDesarrollo`: misma lógica para "Conocimientos en desarrollo" | `app/lib/cv-postprocess.ts` | Las 2 copias de la regla "indicio en CV original, nunca en la oferta" pueden reducirse a 1 principio |
| `extraerPerfilProfesional` + trimming automático a 100 palabras | `app/lib/cv-postprocess.ts` + `route.ts` | Checklist □9 ("cuenta las palabras del perfil antes de entregar") ya no es necesario como instrucción al modelo |
| `calcularMatch`: reporta keywords integradas vs gap post-generación | `app/lib/cv-postprocess.ts` | No hace falta instruir sobre porcentaje mínimo de keywords a integrar; el código audita qué se integró |
| `nombresCoinciden` / `normalizarNombre`: verificación de identidad | `route.ts` | No es responsabilidad del prompt |

---

## Resumen ejecutivo

El SYSTEM_PROMPT v9 tiene cuatro problemas estructurales que explican el techo de 6.7/10:

**1. Duplicación masiva (~30% del texto es repetición).**  
Las reglas más importantes (honestidad, keywords, perfil) aparecen 2–4 veces con palabras distintas. El modelo no tiene una fuente única de verdad: cuando dos copias de la misma regla difieren sutilmente, produce comportamiento inconsistente.

**2. Contradicción central CON-2 (fabricar vs no fabricar).**  
El prompt instruye explícitamente a "inventar rangos creíbles" para el cargo actual sin métricas. La rúbrica prohíbe penalizar por no inventar. Esta tensión es la causa raíz del problema C2 en 5/6 casos y no puede resolverse con un parche: requiere una decisión de diseño sobre qué es honestidad.

**3. CON-1 (límite del perfil: 50-100 vs 50-70).**  
Una decisión que no se tomó explícitamente genera penalizaciones inconsistentes en todos los casos. El límite real debe fijarse una sola vez, en un solo lugar.

**4. C3 mal calibrado en la rúbrica.**  
El crítico penaliza lenguaje espejo para keywords que el candidato no puede demostrar, ignorando su propia salvaguarda. No es un error del SYSTEM_PROMPT sino de la rúbrica. La salvaguarda existe pero necesita ser la regla principal de C3, no un paréntesis al final.
