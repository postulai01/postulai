# Rúbrica de Evaluación — SYSTEM_PROMPT de Postulai

Criterios extraídos directamente de las reglas del SYSTEM_PROMPT en `app/api/process-cv/route.ts`.
No modificar sin actualizar también el SYSTEM_PROMPT o viceversa.

---

## Criterios Universales (aplican a todos los casos)

### 1. perfil_palabras
**Regla**: El perfil profesional no supera 70 palabras (límite estricto del SYSTEM_PROMPT).

- 10: ≤60 palabras, completo y preciso
- 8–9: 61–70 palabras, dentro del límite
- 5–7: 71–80 palabras, leve exceso
- 1–4: >80 palabras, excede claramente el límite

---

### 2. verbos_accion
**Regla**: Todos los bullets usan verbos de acción en primera persona singular pasado o presente. Ninguno empieza con verbos débiles prohibidos (participé, apoyé, contribuí, colaboré, ayudé, asistí, estuve a cargo de, fui responsable de) ni contiene gerundios de soporte (apoyando, contribuyendo, colaborando, participando, aportando, potenciando). No usa "realicé". No usa tercera persona en bullets ni en el perfil.

- 10: Cero verbos prohibidos y cero gerundios débiles en todo el documento
- 7–9: 1–2 bullets con verbo débil o gerundio
- 4–6: 3–5 bullets problemáticos
- 1–3: Múltiples verbos prohibidos o tercera persona generalizada

---

### 3. resultado_medible
**Regla**: Al menos 1 bullet por cada cargo relevante contiene número, porcentaje, monto en $, cantidad de personas/unidades o tiempo concreto.

- 10: Todos los cargos tienen ≥1 bullet con resultado medible
- 7–9: La mayoría de cargos (≥70%) tienen al menos un resultado medible
- 4–6: Menos de la mitad de los cargos tienen resultado medible
- 1–3: Ningún o casi ningún resultado medible en ningún cargo

---

### 4. espejo_lenguaje
**Regla**: Las palabras clave de la oferta aparecen en el CV de forma natural. Meta: ≥70% de las keywords de la oferta integradas (especialmente en el Perfil Profesional y en los bullets del cargo más reciente).

- 10: ≥80% de las keywords de la oferta presentes en el CV
- 7–9: 60–79% de keywords presentes
- 4–6: 40–59% de keywords presentes
- 1–3: <40% de keywords — el CV no habla el mismo idioma que la oferta

---

### 5. formato_ats
**Regla**: CV en una sola columna. Fechas en formato MM/AAAA – MM/AAAA (trabajo actual: MM/AAAA – Presente). Sin tablas, columnas múltiples, íconos ni gráficos. Sin mención a "Postulai" ni pie de página. Secciones en MAYÚSCULAS seguidas de ———.

- 10: Cumple todos los requisitos ATS sin excepción
- 7–9: Un requisito menor incumplido (ej: fecha en formato diferente a MM/AAAA)
- 4–6: Varios incumplimientos o uno crítico (tabla, columnas múltiples)
- 1–3: Múltiples incumplimientos graves o presencia de elementos que rompen parseo ATS

---

### 6. adecuacion_nivel
**Regla**: Estructura, extensión y tono corresponden al nivel detectado del candidato.
- Practicante/Junior: Educación antes de Experiencia, 1 página, énfasis en formación y potencial
- Mid: Experiencia primero, 1–2 páginas
- Senior/Ejecutivo: Experiencia primero con métricas de negocio, 2 páginas máx, educación al final sin bullets, tono estratégico

- 10: Nivel correctamente identificado, estructura y extensión aplicadas exactamente
- 7–9: Nivel identificado pero un error en la aplicación (ej: estructura correcta pero extensión inadecuada)
- 4–6: Nivel identificado pero estructura o extensión incorrectas
- 1–3: Nivel no identificado o completamente ignorado

---

### 7. carta_presentacion
**Regla**: Entre 250 y 350 palabras. Exactamente 3 párrafos: (1) por qué esta empresa y este cargo específico, (2) 2 logros con números directamente relevantes, (3) cierre con disponibilidad y contacto. No empieza con frases prohibidas: "Mi nombre es", "Me dirijo a usted", "Estoy muy interesado", "Por medio de la presente", "A quien corresponda", "Es un honor", "Tengo el agrado".

- 10: 250–350 palabras, 3 párrafos correctos, apertura no prohibida, contenido específico a la oferta
- 7–9: Dentro del rango de palabras pero apertura débil o un párrafo fuera de la estructura esperada
- 4–6: Fuera del rango (±30 palabras) o apertura prohibida
- 1–3: Muy fuera del rango o estructura totalmente incorrecta o genérica

---

### 8. sugerencias
**Regla**: Exactamente 3 sugerencias en el orden correcto: (1) Visibilidad Digital — LinkedIn con palabras clave específicas de la oferta, (2) Contacto Directo — mensaje al reclutador con frase de ejemplo lista para copiar, (3) Mejora de Perfil o Skill — curso concreto con plataforma y tiempo estimado.

- 10: 3 sugerencias en orden exacto, cada una con contenido específico y accionable (frase de ejemplo en la 2, plataforma+tiempo en la 3)
- 7–9: 3 sugerencias pero una sin el detalle requerido (falta frase de ejemplo o falta nombre de plataforma)
- 4–6: Orden incorrecto, menos de 3 sugerencias, o sin contenido específico
- 1–3: Sugerencias genéricas o inaplicables para este cargo y empresa concretos

---

## Criterios Específicos por Caso

### 9. trayectoria_senior *(solo para andres_senior)*
**Regla**: El CV mantiene el peso ejecutivo de 18 años de trayectoria. Los bullets del cargo actual y cargos recientes reflejan responsabilidad C-suite/Gerencial (presupuestos MM$, negociaciones colectivas, dotaciones de cientos de colaboradores, impacto financiero). El tono es estratégico, no operativo ni de asistente. La extensión aprovecha las 2 páginas permitidas para senior sin desperdicio.

- 10: Bullets con métricas de negocio (MM$, dotaciones, porcentajes de reducción de costos), tono ejecutivo consistente en todos los cargos, 2 páginas bien utilizadas
- 7–9: Tono ejecutivo en la mayoría, pero 2–3 bullets bajaron de nivel o extensión insuficiente para 18 años de carrera
- 4–6: Varios bullets suenan operativos/junior, o se perdieron cargos importantes, o extensión claramente insuficiente
- 1–3: El CV no comunica el nivel senior del candidato — podría pasar por un profesional de 3–5 años

---

### 10. manejo_brecha *(solo para roberto_brecha)*
**Regla**: La brecha de 9 meses entre enero 2025 y el momento actual debe declararse según el protocolo del SYSTEM_PROMPT: agregar una línea en la sección de experiencia que diga "Período de búsqueda laboral y desarrollo profesional (mes año – mes año)". No se oculta, no se comprimen fechas para disimularla, no se destaca negativamente. Si hubo actividad durante el período (cursos, freelance, voluntariado), se menciona brevemente.

- 10: Brecha declarada honestamente con la frase estándar o equivalente directa, visible en la sección de experiencia
- 7–9: Brecha mencionada pero con fraseo ligeramente diferente al estándar o en sección incorrecta
- 4–6: Brecha mencionada pero minimizada, vaga o difícil de encontrar
- 1–3: Brecha ocultada, fechas comprimidas para disimularla, o directamente ignorada

---

## Tabla de Aplicación por Caso

| Criterio           | andres_senior | camila_junior | roberto_brecha | valentina_cambio_rubro |
|--------------------|:---:|:---:|:---:|:---:|
| perfil_palabras    | ✓ | ✓ | ✓ | ✓ |
| verbos_accion      | ✓ | ✓ | ✓ | ✓ |
| resultado_medible  | ✓ | ✓ | ✓ | ✓ |
| espejo_lenguaje    | ✓ | ✓ | ✓ | ✓ |
| formato_ats        | ✓ | ✓ | ✓ | ✓ |
| adecuacion_nivel   | ✓ | ✓ | ✓ | ✓ |
| carta_presentacion | ✓ | ✓ | ✓ | ✓ |
| sugerencias        | ✓ | ✓ | ✓ | ✓ |
| trayectoria_senior | ✓ | — | — | — |
| manejo_brecha      | — | — | ✓ | — |
