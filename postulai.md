# Postulai — Guía para Claude Code

## Qué es Postulai

Herramienta web SaaS chilena que usa IA (API de Anthropic, modelo claude-sonnet-4-6) para:
- Adaptar currículums existentes a una oferta de trabajo específica
- Crear currículums desde cero con o sin oferta
- Generar carta de presentación optimizada para ATS (250–350 palabras)
- Entregar en formato ATS 2026: una columna, sin tablas ni gráficos, máx. 2 páginas
- Descargar en PDF y Word

Mercado: exclusivamente chileno, en español. Frase marca: "Postulai y listo. 🇨🇱"
Tono de marca: profesional pero con chispa chilena, directo, sin rodeos. Usa "pega" (sin garabatos).

---

## Quién trabaja en qué

- Pedro: cerebro de IA — prompts del modelo, lógica de procesamiento de CV, extracción de texto. Owner de app/api/process-cv/route.ts.
- Max: frontend — landing, experiencia de usuario, diseño de páginas, componentes visuales.

Regla crítica: si una tarea toca app/api/process-cv/route.ts o cualquier lógica de prompts de IA, coordinar con Pedro antes de tocarla. Trabajar siempre en rama separada y Pull Request, nunca directo sobre main.

---

## Stack técnico

- Next.js App Router + TypeScript + Tailwind
- Supabase (auth + DB), proyecto en São Paulo
- Vercel (deploy automático al hacer push a main)
- Resend (correo transaccional)
- Librerías clave: @anthropic-ai/sdk, resend, @supabase/supabase-js, @supabase/ssr, pdf-parse@1.1.1, mammoth, @react-pdf/renderer, docx, jspdf

Producción: https://www.postulai.cl

---

## Estructura de archivos

app/page.tsx                    — Landing pública
app/login/page.tsx              — Login (createBrowserClient de @supabase/ssr + window.location.href)
app/registro/page.tsx           — Registro CERRADO ("Acceso cerrado, escríbenos a contacto@postulai.cl")
app/planes/page.tsx             — Precios
app/terminos/page.tsx           — T&C
app/privacidad/page.tsx         — Privacidad (Ley 19.628)
app/app/page.tsx                — Dashboard
app/app/adaptar/page.tsx        — Adaptar CV
app/app/crear/page.tsx          — Crear CV desde cero
app/app/resultado/page.tsx      — Dashboard resultados
app/app/historial/[id]/page.tsx — Postulación guardada
app/api/process-cv/route.ts     — Cerebro IA (modos adaptar/crear) — NO TOCAR sin avisar a Pedro
app/api/extract-text/route.ts   — Lee PDF (pdf-parse/lib/pdf-parse.js) y Word (mammoth)
app/api/fetch-url/route.ts      — Lee link de oferta
app/api/waitlist/route.ts       — Lista espera → Google Sheets + correo Resend
app/components/CVDocument.tsx   — PDF con @react-pdf/renderer
lib/supabase.ts                 — createBrowserClient
middleware.ts                   — Sesión Supabase producción

---

## Identidad visual (obligatorio respetar)

Colores:
- Fondo principal #0A0A0A · Barra lateral #111 · Cards #141414 / #161616
- Bordes #1e1e1e, #222 · Texto #FFFFFF · Secundario #AAAAAA / #888888
- Acentos: verde #22c55e (positivo), rojo #dc2626 (negativo) — máximo 1-2 palabras por pieza
- Nunca usar texto más oscuro que #888 para contenido importante

Tipografía: Space Grotesk (Google Fonts), font-weight 900 en títulos, letter-spacing negativo (-1 a -8px según tamaño). Referencia estilo: Apple/Nike.

Logo: "Postulai" todo en blanco, una sola pieza.

Decorativos: círculos de borde fino 0.5px (#131313/#181818) sin relleno, ruido sutil (SVG turbulence opacity .04), línea gradiente inferior. Nunca fondos texturizados ruidosos.

---

## El cerebro de IA — cómo funciona (NO modificar sin coordinar con Pedro)

El cerebro vive en app/api/process-cv/route.ts y tiene tres modos:
- adaptar: recibe CV existente + oferta → adapta el CV a esa oferta
- crear con oferta: construye CV desde cero para una oferta específica
- crear sin oferta: construye CV general sin oferta

### Arquitectura del system prompt (v9)

El prompt está estructurado en bloques en este orden:
1. Rol — quién es el modelo y cómo piensa
2. Paso 0 — análisis interno previo: nivel del candidato, sector, palabras clave, tono
3. Estructura y orden — secciones según nivel del candidato
4. Reglas ATS — formato obligatorio para pasar filtros automáticos
5. Perfil profesional — reglas de escritura + prohibiciones
6. Experiencia laboral — verbo + acción + resultado, verbos permitidos, prohibiciones
7. Educación — sin bullets salvo logro concreto verificable
8. Habilidades — test de nombre propio para técnicas, máximo 5 blandas
9. Carta de presentación — 250–350 palabras, 3 párrafos, prohibiciones de apertura
10. Sugerencias — 3 acciones fuera del CV, específicas por sector
11. Principales cambios — 5 cambios en formato "qué había → qué hay ahora"
12. Checklist final — 8 puntos que el modelo verifica antes de entregar

### Reglas del cerebro que NO pueden cambiar sin discusión previa

Verbos prohibidos en bullets de experiencia:
participé, apoyé, contribuí, colaboré, ayudé, asistí, estuve a cargo de, fui responsable de — y sus gerundios: apoyando, contribuyendo, colaborando, participando, aportando.

Palabras prohibidas en todo el CV:
apoyando, contribuyendo, colaborando, participando, multifuncional, sinergia, dinámico (sin evidencia), innovador (sin evidencia), apasionado, ciclo completo, disposición al aprendizaje, orientado a resultados (sin evidencia), proactivo (sin evidencia), potenciando, resguardando, generando valor, entorno dinámico, aprendizaje rápido, rápida adaptación, aportar/aportando (como sinónimo de apoyar), proceso end-to-end (salvo que la oferta lo use), de principio a fin.

4 niveles de candidato y cómo cambia el output:
- Practicante / recién egresado: orden Educación → Experiencia, 1 página, énfasis en formación y potencial
- Junior (1–4 años): orden estándar, 1 página, equilibrio educación/experiencia
- Mid (5–10 años): experiencia primero, 1–2 páginas
- Senior / ejecutivo (+10 años): experiencia con métricas de negocio, 2 páginas máximo, educación al final sin bullets

Carta de presentación: 250–350 palabras. Rango óptimo para pasar ATS y ser leída por reclutadores. 3 párrafos: empresa/cargo específico → 2 logros con números → cierre con disponibilidad.

Resultado medible obligatorio: al menos 1 bullet por cargo debe tener número, porcentaje, monto o cantidad. Si el candidato no lo mencionó, inferir un dato conservador y razonable. Nunca inventar cifras absurdas.

---

## Reglas de producto / negocio que el código debe respetar

- La IA NO inventa información — el usuario es responsable de la veracidad de sus datos.
- Formato ATS 2026 estricto: una columna, sin tablas ni gráficos, máx. 2 páginas.
- El título bajo el nombre en el CV = título profesional real del candidato, nunca el cargo de la oferta.
- Sin pie "Generado por Postulai" en los documentos exportados.
- Ortografía perfecta en todo output generado.
- Sin columnas múltiples, íconos decorativos ni gráficos en el CV — los ATS no los leen.

---

## Reglas de contenido / copy (si se toca texto visible al usuario)

- No prometer "30 segundos" ni "7 días gratis" como si fuera política fija — no está definido aún.
- No usar nombres de empresas reales ni de personas famosas en ejemplos dentro de la UI.
- No usar el dato "75% de CVs rechazados por ATS" — es un mito sin fuente válida. Si se necesita un dato de respaldo, usar la cita de Adecco Chile o el estudio "Hidden Workers" de Harvard (2021), siempre citando la fuente.

---

## Variables de entorno necesarias (.env.local)

Nunca subir estas claves a GitHub. Pedirlas directamente a Pedro.

ANTHROPIC_API_KEY=              # API de Anthropic para el cerebro IA
NEXT_PUBLIC_SUPABASE_URL=       # URL del proyecto Supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=  # Clave anon de Supabase
SUPABASE_SERVICE_ROLE_KEY=      # Clave service role (solo backend)
RESEND_API_KEY=                 # API de Resend para correos transaccionales

---

## Estado actual del producto (julio 2025)

Funcionando:
- Flujo completo: subir CV + pegar oferta → CV adaptado → descarga PDF y Word
- Tres modos: adaptar, crear con oferta, crear sin oferta
- Auth con Supabase (login, sesión, middleware)
- Historial de postulaciones por usuario
- Landing pública + página de planes

En desarrollo / pendiente:
- Mejoras de formato visual del PDF generado
- Optimización del cerebro (prompt en iteración activa)
- Sistema de pagos / planes
- Registro abierto al público (hoy está cerrado)

---

## Flujo de trabajo esperado

1. git pull origin main
2. git checkout -b nombre-de-tu-rama
3. Trabajar con Claude Code
4. Probar local con npm run dev (localhost:3000)
5. git add . → revisar con git status que no se suba nada sensible
6. git commit -m "mensaje descriptivo"
7. git push origin nombre-de-tu-rama
8. Abrir Pull Request en GitHub hacia main

---

## Qué NO hacer

- No modificar app/api/process-cv/route.ts sin coordinar con Pedro.
- No commitear .env.local ni ninguna clave. Verificar git status antes de cada commit.
- No trabajar directo sobre main — siempre rama + Pull Request.
- No cambiar la paleta de colores, tipografía o estilo visual sin discutirlo antes.
- No agregar dependencias nuevas sin avisar (afecta el bundle y el deploy en Vercel).
- No usar el dato del 75% de CVs rechazados por ATS — no tiene fuente válida.

---

## Reglas de Git (obligatorio respetar, sin excepciones)

- Nunca hacer commit ni push directo sobre main, bajo ninguna circunstancia, aunque técnicamente se pueda.
- Nunca copiar archivos "por encima" de otra rama como solución alternativa a conflictos o desincronización. Si una rama está atrasada respecto a main o hay conflictos, explicar la situación y esperar instrucciones.
- El flujo correcto es siempre: git pull origin main → trabajar en una rama → git push de esa rama → abrir Pull Request en GitHub hacia main. El merge a main lo hace una persona, no Claude Code.
- Si aparece un bloqueo técnico, detenerse y explicar el problema con opciones claras — no buscar atajos.
- Antes de cualquier commit, correr git status y confirmar con el usuario si hay archivos inesperados.
- Antes de cualquier push, mostrar el resumen de qué se va a subir y a qué rama, y esperar confirmación explícita.
- No declarar un cambio como "resuelto" o "funcionando en producción" sin haber verificado el resultado real, no solo que el comando no dio error.
