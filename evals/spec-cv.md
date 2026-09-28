# Especificación del CV adaptado — Postulai (spec-cv v10.4)

**Fecha:** 2026-09-27 (v10.1 a v10.4: ver §13)
**Base:** auditoría `evals/auditoria-v9.md` + decisiones de diseño de la Fase 2
**Fuente única de verdad.** El SYSTEM_PROMPT v10 (`app/api/process-cv/route.ts`), el mensaje de usuario que arma la misma ruta y la rúbrica del crítico (`evals/critico-reclutador.md`) se derivan de este documento. Si alguno de ellos contradice esta spec, el error está en ese archivo, no aquí.

---

## 0. Cómo leer esta spec

Cada regla tiene un ID (`R-xx`) y declara quién la hace cumplir:

- **Prompt:** instrucción al modelo generador.
- **Rúbrica:** cómo la evalúa el crítico y con qué severidad.
- **Código:** verificación o corrección post-generación que ya existe en `app/lib/cv-postprocess.ts` o `route.ts`.

Una regla que el código ya hace cumplir aparece en el prompt como un principio de una línea, nunca repetida ni en el checklist.

Restricciones de redacción del prompt (decisión 8):
- Se permiten listas cortas de palabras (verbos recomendados, palabras y frases prohibidas).
- **No** se permiten frases de ejemplo completas (bullets, perfiles, frases de perfil, puentes) que el modelo pueda copiar como plantilla.
- Cada regla se enuncia **una sola vez**, en la sección que le corresponde.

---

## 1. Principios rectores

**P1 — Respaldo.** Toda afirmación del CV adaptado (hecho, responsabilidad, resultado, cifra, herramienta, competencia, alcance) debe poder señalarse en una línea del CV original. Reescribir cambia el lenguaje, nunca los hechos. El nombre de una carrera o mención académica no respalda por sí solo competencias técnicas específicas; solo cuentan un curso o ramo nombrado, un proyecto descrito, una herramienta mencionada por su nombre o experiencia laboral directa.

**P2 — Cero cifras inventadas, sin excepción.** Ninguna cifra (cantidad, porcentaje, monto, plazo, tamaño de equipo, rango) puede aparecer en el CV adaptado si no está en el CV original. No se inventa, no se estima, no se infiere, no se redondea (240 no puede pasar a "más de 200"), no se dan rangos. Si el original no tiene cifras para un cargo o bullet, se describe el alcance o la escala de forma cualitativa, y ese descriptor cualitativo también debe tener respaldo (P1).

**P3 — Ninguna cifra se pierde.** Toda cifra presente en el CV original que sea relevante para la oferta se conserva en el CV adaptado al reescribir.

**P4 — El CV muestra fortalezas, no carencias.** El CV no destaca lo que el candidato no tiene. Lo que la oferta pide y el candidato no tiene va a las sugerencias (como acción a empezar), nunca al perfil ni a los bullets. No se enuncia como regla en el prompt (R-28); se implementa a través de R-04, R-26 y R-72.

**P5 — La nota mide la ejecución, no el fit.** El crítico evalúa qué tan bien se adaptó el material disponible. Las brechas del candidato frente a la oferta se reportan en `gap_de_perfil` y nunca bajan la nota.

**P6 — Fuente en modo crear.** En modo crear (con o sin oferta), los datos del formulario cumplen el rol del "CV original" para todos los principios y reglas de respaldo (P1, P2, P3, R-26, R-37, R-61, R-63). Nada puede afirmarse si no está en esos datos. En el código, esa fuente ya es la que reciben los filtros (`fuenteOriginal` = `datos_personales` en modo crear).

---

## 2. Análisis previo (interno, no se muestra)

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-01 | Determinar el nivel del candidato: estudiante/practicante/recién egresado (<1 año de experiencia laboral), junior (1–4), mid (5–10), senior/ejecutivo (>10). | Sí | Base de C7 | — |
| R-02 | Determinar el sector y el tono de la oferta (corporativo, técnico, comercial, startup, ejecutivo). | Sí | Base de C7 y C8 | — |
| R-03 | Extraer de la oferta 8–10 palabras clave (herramientas, metodologías, certificaciones, conocimientos, carreras requeridas, términos técnicos). Solo términos mencionados literalmente en la oferta, nunca inferidos, generalizados ni parafraseados; cada uno de 1 a 3 palabras, separando habilidades compuestas; tomados en el orden en que aparecen, priorizando las secciones de requisitos, conocimientos y funciones; excluyendo el tipo de cargo o modalidad ("Práctica profesional", "part-time", "híbrido" y similares). Es la misma lista que se entrega en `palabras_clave_oferta`. | Sí | — | `calcularMatch` las usa |
| R-04 | Clasificar cada palabra clave: **con respaldo** en el CV original o **sin respaldo**. Solo las con respaldo se integran al CV. No hay cuota mínima de integración. | Sí (una sola vez, aquí) | Base de C3 | `calcularMatch` reporta integradas / no usadas con evidencia / gap |
| R-05 | Puentes honestos: si una función de la oferta comparte la naturaleza del trabajo con una experiencia real del candidato, se expresa esa experiencia con el vocabulario de la oferta, sin igualar escala, formalidad ni contexto que el original no respalda. | Sí, en 2–3 oraciones, sin frases de ejemplo | C3 (oportunidad perdida) y C5 (puente forzado = afirmación sin respaldo) | — |
| R-06 | Detectar brechas: ordenar los cargos por fecha y calcular los meses entre el fin de uno y el inicio del siguiente. El cálculo de fechas es la única fuente de verdad, se mencione o no la brecha en el original. | Sí | C5 | — |

---

## 3. Estructura y formato (ATS)

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-10 | Orden junior/mid/senior/ejecutivo (experiencia primero): Contacto → Perfil profesional → Experiencia laboral → Educación → Habilidades → Idiomas → Certificaciones (si aplica). | Sí | C7 / D2 | — |
| R-11 | Orden estudiante/practicante/recién egresado con menos de 1 año de experiencia laboral: Contacto → Perfil profesional → Educación → Experiencia laboral → Habilidades → Idiomas. **EDUCACIÓN va antes que EXPERIENCIA LABORAL solo en este nivel;** un junior con 1–4 años de experiencia va con experiencia primero (R-10). | Sí, destacada al inicio de FORMATO y en la revisión final | C7 / D2 | `verificar.ts` (orden); `ordenarEducacionEstudiante` (v10.4) mueve EDUCACIÓN antes de EXPERIENCIA LABORAL si el candidato es estudiante |
| R-12 | Cada título de sección en MAYÚSCULAS seguido de una línea de `———`. El título del perfil es exactamente `PERFIL PROFESIONAL`. | Sí | — | `extraerPerfilProfesional` depende de esto |
| R-13 | Sin tablas, columnas múltiples, íconos, gráficos, encabezados ni pies de página. | Sí | D1 | — |
| R-14 | Fechas `MM/AAAA – MM/AAAA`; cargo actual `MM/AAAA – Presente`. Si el original solo da el año, se usa `AAAA` (no se inventan meses, P1). | Sí | D2 | — |
| R-15 | Extensión: 1 página practicante/junior; 1–2 mid; máximo 2 senior/ejecutivo. | Sí | D3 / C7 | — |
| R-16 | Ninguna mención a "Postulai" dentro del CV. | Sí | — | — |

---

## 4. Perfil profesional

Orden de las reglas en el prompt: R-20 va primero.

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-20 | **Primera regla del perfil:** nombra el cargo al que se postula, tal como lo nombra la oferta, **integrado de forma natural en la primera oración, sin fórmulas como "candidato a" o "postulante a"** (v10.4). Nunca el nombre de la empresa. Sin oferta (modo crear sin oferta): nombra el título o rol profesional del candidato. | Sí, primera | C4 (b): no nombrar el cargo = importante; nombrar la empresa = importante | `verificar.ts` (cargo) y reparación dirigida (v10.4) |
| R-21 | Entre 50 y 100 palabras, en 2 a 4 líneas. | Sí, sin instrucción de contar | C4 (a): fuera de rango = menor | Recorte automático si supera 100 palabras |
| R-22 | Contenido: nivel o etapa profesional + área de especialidad; 2–3 fortalezas o diferenciadores con respaldo en el original (usando el vocabulario de la oferta cuando hay respaldo, R-04); un logro o hecho concreto del original. | Sí, como lista de contenidos, sin estructura-plantilla ni frases modelo | C4 (c) | — |
| R-23 | Si el candidato está sin empleo, **no es estudiante** y la oferta no fija fecha de inicio, se indica disponibilidad inmediata. A un estudiante nunca se le indica disponibilidad: no está en su CV original (v10.4). | Sí | — | `agregarDisponibilidad`: si ningún cargo de EXPERIENCIA LABORAL dice "Presente", ninguna línea de EDUCACIÓN está en curso y el perfil no menciona disponibilidad, agrega "Disponible para incorporación inmediata." al final del perfil. No revisa si la oferta fija fecha de inicio. `verificar.ts` (brechas) marca a un estudiante con disponibilidad. |
| R-24 | Redacción impersonal con frases nominales. Prohibido: primera persona explícita o implícita (yo soy, me considero, busco, busca, busca integrarse, en búsqueda de); tercera persona (ha liderado, ha desarrollado, ha gestionado). | Sí | C4 (d) / C6 | — |
| R-25 | Palabras y frases prohibidas en el perfil: proactivo, apasionado, dinámico, innovador, orientado a resultados, nuevos desafíos, ganas de aprender, soy una persona, me considero, profesional apasionado; verbos de soporte en cualquier conjugación (apoyar, aportar, contribuir, colaborar, asistir); frases de proceso completo (ciclo completo, end-to-end, de principio a fin, desde X hasta Y, productivo-comercial, operativo-comercial). | Sí, como lista | C4 (d) / C6 | — |
| R-26 | Enumeraciones del tipo "X, Y y Z": cada elemento necesita su propio respaldo. Un elemento sin respaldo se elimina; no se rescata como "en formación" ni "en desarrollo" dentro del perfil. | Sí | C5 (afirmación sin respaldo) | — |
| R-27 | El perfil no lista la trayectoria completa (eso vive en Experiencia laboral). | Sí | C4 | — |
| R-28 | El perfil **no** transparenta limitaciones ni brechas del candidato frente a la oferta (P4). | **No se agrega al prompt** | **No se exige.** El crítico no penaliza que el perfil omita carencias. | — |

---

## 5. Experiencia laboral

### 5.1 Verbos

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-30 | Cada bullet empieza con un verbo de acción en primera persona singular: **presente** para el cargo actual (el que termina en "Presente"), **pasado** para los anteriores. | Sí | C1: acepta ambos tiempos según el caso; tiempo cambiado entre cargo actual y anterior = menor | — |
| R-31 | Ningún verbo inicial se repite dentro del mismo cargo, y ninguno inicia más de 3 bullets en todo el CV. Cuenta el verbo base: el presente y el pasado del mismo verbo son el mismo verbo; un verbo con prefijo (rediseñar frente a diseñar) es otro verbo. | Sí | C1: repetición dentro de un cargo o más de 3 en el CV = menor por cada verbo | `verificar.ts` (verbos) |
| R-32 | Verbos recomendados (lista de palabras, en infinitivo para que el modelo conjugue): gestionar, liderar, implementar, reducir, aumentar, coordinar, desarrollar, ejecutar, diseñar, negociar, optimizar, construir, lanzar, estructurar, analizar, capacitar, supervisar, dirigir, administrar, establecer, generar, lograr, impulsar, consolidar, transformar, reestructurar, proponer, pilotear, escalar, comercializar, identificar, evaluar. Se prefiere el verbo más específico a la acción. | Sí, como lista | C1 no penaliza como "débil" un verbo de esta lista | — |
| R-33 | Prohibido como verbo inicial: realizar, participar, apoyar, contribuir, colaborar, ayudar, asistir, estar a cargo de, ser responsable de. Prohibido en cualquier parte: infinitivo como tarea pendiente, tercera persona (gestionó, coordinó, ejecutó), gerundios de soporte (apoyando, contribuyendo, colaborando, aportando, participando), construcciones pasivas y frases nominales ("encargado de…"). | Sí, como lista | C1: importante si afecta al cargo actual; menor en cargos anteriores | — |

### 5.2 Contenido de los bullets

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-34 | Cada bullet = verbo + qué hizo + resultado, cifra o alcance, todo con respaldo (P1). | Sí | C1 / C2 | — |
| R-35 | Cantidad: 3–4 bullets por cargo para practicante/junior; 4–6 para mid/senior/ejecutivo. Si el original no da material para el mínimo sin inventar, se escriben menos bullets. | Sí | C7 | — |
| R-36 | El cargo actual es el que más pesa: sus bullets se reescriben con prioridad. Si es consultoría o freelance, se redactan como resultados entregados a clientes, con respaldo. | Sí | C1 / C7 | — |
| R-37b | **Ningún bullet débil queda casi idéntico al original.** Si la línea del original empieza con un verbo prohibido (R-33) o tiene una construcción débil (gerundio de soporte, pasiva, frase nominal, frase prohibida de R-39), el bullet se reescribe completo, siempre sin agregar hechos: cambiar solo una palabra no basta si la debilidad se mantiene. | Sí | C1 | `verificar.ts` (≈orig) |
| R-37 | **Transformación activa:** cada bullet se reencuadra hacia el lenguaje y los procesos de la oferta cuando existe conexión honesta (R-05). El reencuadre cambia el lenguaje, nunca agrega acciones, responsabilidades ni resultados. | Sí | C3 (oportunidad perdida) / C5 (agregado sin respaldo) | — |
| R-38 | **Cifras:** P2 y P3 aplicados a cada bullet. Si el original no tiene cifras, alcance o escala cualitativa con respaldo (P2). No hay mínimo de bullets con número. | Sí | C2 (ver §9) | — |
| R-39 | Palabras prohibidas en cualquier parte del CV: multifuncional, proactivo, dinámico, sinergia, potenciando, resguardando, gestión integral, ciclo completo, end-to-end, de principio a fin, cubriendo todas las etapas, desde X hasta Y. | Sí, como lista | C6 | `verificar.ts` (frases) |

### 5.3 Brechas laborales

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-40 | Brecha menor a 3 meses: no se menciona. | Sí | C5: no se penaliza su omisión | — |
| R-41 | Brecha de 3 a 12 meses **entre dos cargos**: **entrada cronológica** dentro de la experiencia laboral, con el mismo formato de fechas que un cargo, ubicada entre los dos cargos que la rodean. Título: "Período de búsqueda laboral"; se agrega "y desarrollo profesional" y una descripción breve solo si el original menciona cursos, freelance o voluntariado en ese período. | Sí | C5: brecha de 3–12 meses sin entrada cronológica = importante; tratarla en el perfil en lugar de como entrada = menor | `verificar.ts` (brechas) |
| R-42 | Brecha mayor a 12 meses **entre dos cargos**: misma entrada cronológica que R-41, y además el perfil puede incluir una frase nominal breve sobre a qué se dedicó el período, solo con respaldo en el original. | Sí | C5: brecha >12 meses sin entrada cronológica = importante | — |
| R-43 | Nunca se inventan ni se comprimen fechas para ocultar una brecha. | Sí | C5: crítico | — |
| R-44 | **Brecha abierta hasta hoy** (el último cargo terminó y no hay cargo posterior): no se agrega ninguna entrada por ese período, porque destacaría la cesantía como si fuera el cargo más reciente. El perfil indica disponibilidad inmediata (R-23). Si la brecha abierta supera 12 meses y la fuente menciona cursos, freelance u otra actividad en ese período, el perfil puede mencionarlo en una frase nominal breve. | Sí | C5: entrada de búsqueda para una brecha abierta = menor; no se penaliza la ausencia de entrada | `verificar.ts` (brechas) |

---

## 6. Educación

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-50 | Formato: `Carrera \| Institución — MM/AAAA – MM/AAAA · Ciudad`. | Sí | D2 | — |
| R-51 | Sin bullets. Única excepción: premio nacional, publicación académica, promedio sobre 6.0, beca competitiva. No son excepción: magíster integrado, ramos eximidos, colegio bilingüe, duración de la carrera, lo implícito en el nombre de la institución. | Sí | C6 | `verificar.ts` (educación) y reparación dirigida (v10.4) |
| R-52 | Nivel educativo en nomenclatura formal chilena (Enseñanza Media Completa, CFT, IP, Universidad) cuando es evidente, sin inventar nombres formales. | Sí | — | — |

---

## 7. Habilidades

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-60 | Tres categorías, cada una en una sola línea separada por `·`, con las etiquetas exactas `Habilidades técnicas:`, `Habilidades blandas:`, `Conocimientos en desarrollo:`. | Sí | — | Los filtros dependen de estas etiquetas |
| R-61 | Habilidades técnicas (máx. 6): solo herramientas, software, plataformas, lenguajes o certificaciones con nombre propio mencionados en el CV original. Las funciones o tareas no van aquí aunque la oferta las nombre: selección, reclutamiento, entrevistas, psicometría, análisis, gestión, atención al cliente, negociación, planificación, evaluación, coordinación, capacitación, ventas. | Sí, con la lista de funciones | C6 | `limpiarHabilidadesTecnicas` elimina las que no tienen respaldo |
| R-62 | Habilidades blandas (máx. 5). Prohibidas: disposición al aprendizaje, aprendizaje rápido, multifuncional, dinámico, proactivo, orientación a resultados, orientado a resultados; funciones disfrazadas de habilidad blanda (gestión operativa, análisis de procesos, organización a secas). | Sí, como lista | C6 | `limpiarHabilidadesBlandas` (v10.4) elimina las frases prohibidas de la línea, con `console.warn` |
| R-63 | Conocimientos en desarrollo: solo con un indicio concreto en el CV original (ramo, curso, proyecto, certificación en curso). Que la oferta lo pida nunca es un indicio. Si no hay indicio, se omite la categoría. | Sí, una línea | — | `limpiarConocimientosEnDesarrollo` elimina lo que no tiene respaldo |
| R-64 | Idiomas: el nivel de cada idioma se toma tal cual del CV original, nunca se sube. Un idioma sin nivel declarado se lista sin nivel. | Sí | C5 (afirmación sin respaldo): crítico | — |

---

## 8. Otros entregables

| ID | Regla | Prompt | Rúbrica | Código |
|---|---|---|---|---|
| R-70 | Carta: 250–350 palabras, 3 párrafos. P1: por qué esta empresa y este cargo, con algo concreto de la empresa. P2: dos logros relevantes del candidato, con cifras solo si existen en el original. P3: cierre con disponibilidad y contacto. | Sí | C8 | — |
| R-71 | Aperturas prohibidas de la carta: "Mi nombre es", "Me dirijo a usted", "Estoy muy interesado", "Por medio de la presente", "A quien corresponda", "Es un honor", "Tengo el agrado". | Sí, como lista | C8 | — |
| R-72 | Sugerencias: exactamente 3, en orden: visibilidad digital (LinkedIn), contacto directo, mejora de perfil o habilidad. Formato "Título breve: acción concreta", título de 2–4 palabras, total ≤ 20 palabras. Al menos una apunta a lo más relevante de la oferta que el candidato no tiene, como acción que puede empezar. Nunca sugerir decir en la entrevista que ya sabe o está aprendiendo algo. | Sí | — | — |
| R-73 | Principales cambios: exactamente 5, formato "qué había → qué hay ahora". Escritos para el candidato: nunca usan términos internos del prompt ("LA FUENTE", nombres de principios o reglas); se refieren al CV original (en modo crear, a los datos entregados). | Sí | — | `reemplazarTerminosInternos` (v10.4) cambia "LA FUENTE" por "tu CV original" |
| R-74 | Contrato JSON de salida sin cambios respecto a v9: `cv_adaptado`, `carta_presentacion`, `sugerencias`, `principales_cambios`, `titulo_postulacion`, `palabras_clave_oferta` (mismos tipos y reglas de formato de v9). | Sí | — | `route.ts` y `calcularMatch` dependen de estos campos |
| R-75 | Formato de texto de `cv_adaptado` del que depende el código, que se mantiene exactamente: (a) la primera línea es el nombre completo del candidato; (b) encabezados de sección en MAYÚSCULAS, de menos de 60 caracteres, seguidos de una línea `———————————————`: `PERFIL PROFESIONAL`, `EXPERIENCIA LABORAL`, `EDUCACIÓN`, `HABILIDADES`, `IDIOMAS`, `CERTIFICACIONES`; (c) línea de cargo `Cargo \| Empresa — fechas · Ciudad`, con " — " antes de las fechas; (d) bullets que empiezan con "- "; (e) etiquetas de habilidades exactas `Habilidades técnicas:`, `Habilidades blandas:`, `Conocimientos en desarrollo:`. | Sí | — | `extraerPerfilProfesional` (a, b), verificación de identidad (a), `parseCvText`/`splitJobLine` de los templates PDF (b, c, d), `limpiarHabilidadesTecnicas`/`limpiarConocimientosEnDesarrollo` (e) |

Nota sobre R-75 (e): v9 no fijaba la etiqueta y el modelo a veces escribe `Técnicas:` (ej. `evals/resultados/camila_junior-2026-09-26T23-01-17.json`). Con esa etiqueta el filtro `limpiarHabilidadesTecnicas` no se aplica. v10 la fija de forma explícita.

---

## 9. Rúbrica del crítico — cambios derivados

La rúbrica conserva su estructura (Reglas 1–8, C1–C8, D1–D4, formato JSON). Cambios:

**Proceso obligatorio antes de evaluar C3 (decisión 6).** El crítico primero lista las palabras clave de la oferta y separa las que tienen respaldo en el CV original de las que no. Esa lista se entrega en un campo nuevo del JSON: `keywords_con_respaldo: string[]`. C3 se evalúa **solo** sobre esa lista. Las palabras clave sin respaldo van a `gap_de_perfil` y nunca generan un problema ni bajan la nota.

**C1 — Verbos.** Cambia "infinitivo o pasado simple" por: primera persona, presente en el cargo actual y pasado en los anteriores (R-30). Incorpora R-31 (repetición: dentro de un cargo o más de 3 en el CV) y R-33 (prohibidos). No penaliza como débil un verbo de la lista R-32.

**C2 — Cifras.** Tres penalizaciones, en este orden de severidad:
- Cifra en el adaptado que no está en el original (P2): **crítico**.
- Cifra del original relevante para la oferta que el adaptado perdió (P3): **importante**.
- Bullet sin cifra en el original y sin alcance cualitativo en el adaptado: **menor**.
Se mantiene la prohibición de penalizar por no inventar números.

**C3 — Lenguaje espejo.** Solo sobre `keywords_con_respaldo`. Oportunidad perdida (palabra clave con respaldo escrita con otro vocabulario o ausente): importante si afecta al perfil o al cargo actual, menor en el resto.

**C4 — Perfil.** (a) 50–100 palabras (antes 50–70); (b) nombra el cargo al que se postula y no la empresa; (c) 2–3 diferenciadores con respaldo; (d) sin frases genéricas. Se elimina toda exigencia de transparentar limitaciones, nivel o brechas frente a la oferta (R-28).

**C5 — Coherencia y brechas.** Reemplaza "brechas de más de 6 meses abordadas en el perfil" por R-40 a R-44. Mantiene: fechas consistentes, sin información inventada ni contradictoria. Afirmación sin respaldo en el original (P1) = crítico.

**Regla 6.** Se mantiene la aclaración de que la nota mide ejecución, no fit (P5).

---

## 10. Checklist final del prompt (decisión 9)

Solo lo que el código no verifica. Cuatro ítems, sin repetir reglas con otras palabras:

1. **Respaldo.** Cada afirmación del perfil y de los bullets —incluidas cifras y descriptores de alcance— se puede señalar en una línea del CV original. Si no, se elimina.
2. **Verbos.** Presente en el cargo actual, pasado en los anteriores; ningún bullet empieza con un verbo prohibido; ningún verbo inicial se repite dentro de un cargo ni aparece más de 3 veces en todo el CV.
3. **Cargo en el perfil.** El perfil nombra el cargo al que se postula y no nombra la empresa.
4. **Cifras del original.** Ninguna cifra relevante del CV original se perdió al reescribir.
5. **Orden de secciones (v10.1, corregido en v10.2).** EDUCACIÓN antes que EXPERIENCIA LABORAL solo para estudiante, practicante o recién egresado con menos de 1 año de experiencia laboral.

En v10.1 el ítem 2 también exige que ningún bullet empiece con un verbo prohibido, y se agrega el ítem 5. Es una excepción a la decisión 9 (solo lo que el código no verifica): `verificar.ts` es una herramienta de evals, no corrige nada en producción, y la Fase 4 mostró que el modelo no aplica estas reglas si solo están en su sección.

---

## 11. Qué se elimina de v9 (y por qué)

| Elemento de v9 | Motivo |
|---|---|
| "Logros numéricos: inferir datos conservadores y razonables" (REGLAS ATS) | P2 |
| "Inventa rangos creíbles basados en cargos anteriores" (cargo actual) | P2 (CON-2) |
| "Si el candidato no lo mencionó, inferir un dato conservador" (RESULTADO MEDIBLE) | P2 |
| Checklist □2 (≥1 número por cargo) y □10 (≥50 % de bullets con número) | Empujan a fabricar cifras; reemplazado por P2/P3 |
| Ejemplo de consultoría con "más de 500 colaboradores" y "X %" | Frase-plantilla con cifras inventadas |
| Descriptores cualitativos de ejemplo ("a escala nacional", "con impacto directo en la línea financiera") | Plantillas copiables y sin respaldo garantizado |
| Estructura obligatoria de 3 líneas con frases modelo del perfil | Decisión 8 |
| Frase modelo para brechas >12 meses ("Profesional con experiencia en… que ha dedicado…") | Decisión 8; además usa la tercera persona prohibida en el perfil |
| "Las 8–10 keywords deben aparecer en el perfil y en el cargo más reciente" | Contradice R-04 |
| Ejemplos de puentes válidos y forzados con frases completas | Decisión 8 |
| Reglas específicas de un caso ("Ejecuté demostraciones de producto", "Coordiné mi desempeño") | Sobreajuste a un caso de prueba |
| Checklist □1 ("pasado sin excepción") | CON-3; reemplazado por R-30 |
| Checklist □3–□9, □11 | Repeticiones de reglas ya enunciadas o verificadas por código |
| Instrucción de contar palabras del perfil | El código ya recorta sobre 100 palabras |
| Copias duplicadas de las reglas de keywords, honestidad y conocimientos en desarrollo | Cada regla se enuncia una vez |
| "Contacto directo: incluir una frase de ejemplo lista para copiar" | Incompatible con el límite de 20 palabras del contrato JSON (R-72) |

**Mensaje de usuario (modo adaptar) en `route.ts`.** También forma parte del cerebro y hoy contradice esta spec: pide que el contenido del original sea "IGNORADO", "no copiar frases del CV original" y "transformar cada bullet en una acción con resultado medible". En v10 debe decir que el CV original es la única fuente de hechos y cifras, y que se reescribe el lenguaje, no el contenido.

---

## 12. Decisiones que tomé al redactar (para tu revisión)

Estas no venían en tus 9 decisiones; las derivé para cerrar huecos:

1. **R-26:** en el perfil, un elemento sin respaldo se elimina en vez de reformularse como "en formación". Lo derivé de la decisión 5: "en formación" en el perfil es transparentar una brecha. "Conocimientos en desarrollo" queda solo en Habilidades.
2. **R-41/R-42:** el título de la entrada de brecha dice "y desarrollo profesional" solo si hay actividades con respaldo en ese período. Las brechas mayores a 12 meses también van como entrada cronológica (antes iban solo en el perfil), por coherencia con la decisión 7.
3. **R-72:** entre las dos definiciones de sugerencias que convivían en v9, me quedé con la del contrato JSON (≤ 20 palabras), que es la del último commit (`2b8d198`).
4. **§9, severidades:** asigné severidades concretas a cada violación para que el crítico sea más consistente entre corridas.
5. **`evals/rubrica.md`** (rúbrica antigua de `correr-evals.ts`) contradice esta spec (perfil ≤ 70 palabras, ≥ 1 número por cargo, ≥ 70 % de keywords). Propongo marcarla como obsoleta en la Fase 3, no alinearla, porque la Fase 4 usa `critico-reclutador.ts`.
6. **R-14 (agregado en el ajuste de Fase 2):** si el original solo da el año, se usa el año; no se inventan meses para cumplir el formato MM/AAAA.
7. **Candidato a código:** P2 y P3 ya se verifican en evals con `evals/verificar.ts` (v10.1). En producción siguen sin verificarse.

---

## 13. Cambios v10.1 (2026-09-26)

Motivados por la Fase 4: el crítico Haiku no fue confiable, y la vara principal pasa a ser `evals/verificar.ts` (sin API).

| Cambio | Reglas |
|---|---|
| "desde X hasta Y" prohibido también en los bullets | R-39 |
| Ningún bullet débil queda casi idéntico al original | R-37b (nueva) |
| Orden practicante/junior destacado al inicio de FORMATO y en la revisión final | R-11, §10 ítem 5 |
| Lista explícita de funciones que no van en Habilidades técnicas | R-61 |
| R-31 reescrita como procedimiento de conteo sobre todos los bullets del CV | R-31 |
| "en búsqueda de" agregado a la primera persona implícita del perfil | R-24 |

**Verificación automática (`evals/verificar.ts`):** P2 (cifras+), P3 (cifras−), R-31 (verbos>2), R-33 (prohib), R-24/R-25/R-39 (frases), R-10/R-11/R-75 (orden), R-60/R-61 (etiquetas), R-21 (perfil) y R-37b (≈orig). El nivel de cada caso sale del campo `nivel` de `evals/casos/<caso>.json`.

### Cambios v10.2 (2026-09-26)

| Cambio | Reglas |
|---|---|
| Repetición de verbos: ninguno se repite dentro de un cargo y ninguno inicia más de 3 bullets en todo el CV (reemplaza el límite de 2 en todo el CV) | R-31 |
| Educación primero solo para estudiante, practicante o recién egresado con menos de 1 año de experiencia; junior pasa a experiencia primero (corrige un error de la spec) | R-01, R-10, R-11, §10 ítem 5 |
| Brecha abierta hasta hoy: sin entrada de búsqueda; el perfil indica disponibilidad; mención breve en el perfil solo si supera 12 meses y hay actividad con respaldo | R-41, R-42, R-44 (nueva) |
| P3 exige conservar solo las cifras relevantes para la oferta. `verificar.ts` acepta en `evals/casos/<caso>.json` un campo `cifras_no_relevantes`, que se revisa a mano (ej. el "45" de valentina, reemplazado por el "240" del mismo original) | P3 |

`verificar.ts` agrega la columna **brechas**: brecha de 3 meses o más entre dos cargos sin entrada cronológica, entrada de búsqueda en una brecha abierta hasta hoy, y perfil sin disponibilidad cuando el candidato no tiene cargo actual.

### Cambios v10.3 (2026-09-26)

| Cambio | Reglas |
|---|---|
| P2 prohíbe también redondear cifras (la v10.2 convirtió 240 en "más de 200") | P2, principio 2 del prompt |
| Disponibilidad inmediata agregada por código cuando no hay cargo actual y el perfil no la menciona (`agregarDisponibilidad` en `app/lib/cv-postprocess.ts`, en `route.ts` y en el eval) | R-23, R-44 |
| Vigilancia de cifras en producción: `route.ts` registra con `console.warn` cada cifra del CV adaptado que no está en la fuente (`cifrasSinRespaldo`, misma lógica que `verificar.ts`). No modifica el CV. | P2 |

**Limitación conocida — R-31 en todo el CV:** el modelo cumple "sin repetir verbo dentro de un cargo", pero en CVs largos (senior, ~25 bullets) repite algún verbo más de 3 veces en todo el CV (andres_senior: Lideré ×4, Diseñé ×4 en v10.1 y v10.2). Se acepta así: el verificador lo sigue reportando, pero no bloquea.

### Cambios v10.4 (2026-09-27)

Motivados por un CV real generado en producción con v10.3 (oferta de EY Parthenon): honestidad correcta, pero con "Participo" (R-33), "Orientación a resultados" en blandas (R-62), perfil sin el cargo (R-20), líneas de magíster integrado y exención de inglés bajo EDUCACIÓN (R-51), disponibilidad siendo estudiante (R-23) y "LA FUENTE" en principales_cambios (R-73).

| Cambio | Reglas |
|---|---|
| Sin disponibilidad para estudiantes (prompt, `agregarDisponibilidad` y `quitarDisponibilidadEstudiante`, que elimina del perfil la oración de disponibilidad si el modelo la escribió) | R-23 |
| principales_cambios sin términos internos (prompt + `reemplazarTerminosInternos`) | R-73 |
| Filtro de frases prohibidas en Habilidades blandas (`limpiarHabilidadesBlandas`) | R-62 |
| Reparación dirigida (`app/lib/reparacion.ts`) | R-20, R-31 (dentro del cargo), R-33, R-51 |

**Reparación dirigida (R-77).** Después del post-procesamiento determinista (`postprocesarCV`: filtros de habilidades y disponibilidad), `detectarReparables` (`app/lib/cv-verificacion.ts`, la misma lógica de `verificar.ts`) busca cuatro violaciones:
- un bullet que empieza con un verbo prohibido;
- un verbo inicial repetido dentro de un mismo cargo;
- un perfil que no nombra el cargo de la oferta (sacado de `titulo_postulacion`);
- líneas bajo EDUCACIÓN que no son carrera e institución ni una excepción de R-51.

Solo si hay alguna, se envían a Haiku 4.5 **solo esas líneas**, cada una con la regla que incumple, y el CV original como fuente, con la instrucción de no agregar hechos ni cifras. Las líneas se reemplazan (una línea de EDUCACIÓN puede eliminarse) y se vuelve a correr `cifrasSinRespaldo`: si la reparación introdujo una cifra nueva, se descarta completa y queda la versión anterior. Si la API falla, también se descarta. Cada reparación aplicada o descartada se registra con `console.warn`. Límites: timeout de 20 s y un solo reintento.

**Validación línea por línea (agregada tras la prueba con Haiku real).** En la primera prueba, Haiku convirtió "Participo en 3 campañas" en "Coordiné 3 campañas", subió "Manejo de Excel a nivel intermedio" a "Dominio de Excel" y resumió perfiles a menos de 50 palabras. La verificación de cifras no detecta nada de eso. Por eso cada línea reparada se rechaza (y queda la original) si:
- agrega frases prohibidas (R-25, R-39) que no estaban;
- agrega palabras de nivel (dominio, experto, avanzado, sólido, especialista…);
- un bullet sigue empezando con un verbo prohibido, usa un verbo de escalada (coordinar, liderar, dirigir, gestionar, supervisar…) cuya raíz no aparece en la fuente, o repite un verbo de otro bullet del mismo cargo;
- el perfil queda fuera de 50–100 palabras o sigue sin nombrar el cargo.

Si se rechazan todas las líneas, la reparación se descarta.

**Herramientas de evals:**
- `evals/reparar-guardados.ts` aplica el post-procesamiento y la reparación a resultados guardados sin regenerarlos; sin `--ejecutar`, solo estima el costo.
- `verificar.ts` agrega las columnas **cargo** (R-20) y **educación** (R-51), y la regla de blandas (R-62) en frases.
- Los casos tienen el campo `cargo_oferta`, que se usa cuando el resultado guardado no tiene `titulo_postulacion`.

### Ajustes v10.4 tras probar la preview con la oferta de EY (PED-6)

| Cambio | Reglas |
|---|---|
| `ordenarEducacionEstudiante` (en `postprocesarCV`): si el candidato es estudiante (misma detección que `quitarDisponibilidadEstudiante`: una línea de EDUCACIÓN en curso) y EXPERIENCIA LABORAL va antes, mueve el bloque completo de EDUCACIÓN antes de EXPERIENCIA LABORAL, sin tocar su contenido. Determinista, sin API. | R-11 |
| El cargo se integra de forma natural en la primera oración del perfil, sin "candidato a" ni "postulante a" (prompt, instrucción de reparación y nueva frase prohibida "fórmula de postulación" en `FRASES_PERFIL`, que también hace rechazar una reparación que la use) | R-20, R-25 |
| En la reparación de verbos, si el original indica participación, apoyo o colaboración, se ofrecen verbos equivalentes que no suben el nivel (integrar, formar parte de), para que la corrección no se rechace por escalada | R-33, R-77 |
| **Un único reintento** en la reparación, solo para las líneas rechazadas por la validación, con el motivo del rechazo y la propuesta rechazada. Si el reintento también se rechaza o falla, quedan las líneas originales y se mantiene lo aceptado en el primer intento. | R-77 |

Prueba con Haiku real sobre los 3 CVs de estudiante guardados:
- **Resultado:** los 3 perfiles nombran el cargo sin fórmula, y "Participo en 3 campañas" pasa a "Integré 3 campañas".
- **Reintento:** se activó en 2 de 3 casos, por un perfil de 48 palabras y por "orientado a resultados".
- **Costo:** ~$0.0025 por CV reparado sin reintento y ~$0.005 con reintento.

**Hallazgo pendiente:** el modelo principal también infla verbos, y ningún detector lo marca. Por ejemplo, "Participación en 3 campañas" pasó a "Coordiné con distintos equipos de trabajo en 3 campañas" en pedro_cencomalls y pedro_xepelin v10.2. Un detector de verbos de escalada sin respaldo en la fuente (la misma regla `VERBOS_ESCALADA` de la validación) podría sumarse a `detectarReparables`.
