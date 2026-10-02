/**
 * Reescritura de líneas por contexto de oferta (PED-23).
 * Reescribe el CV LÍNEA POR LÍNEA usando solo keywords que el mapeo (PED-22) ya respaldó en el CV,
 * y deja trazabilidad de cada cambio: qué keyword se agregó y qué fragmento del CV la respalda.
 *
 * Flujo por línea:
 * 1. planificarLinea (sin API): elige las keywords permitidas para esa línea (matches directos o relacionados
 *    que tocan su contenido y que aún no están escritas en ella). Sin ninguna → "sin_cambios", sin llamar a la API.
 * 2. Haiku propone la línea adaptada en JSON.
 * 3. verificarAdaptacion (sin API): palabras nuevas sin respaldo, keywords de brecha, verbos de escalada,
 *    cifras nuevas y la métrica de fuerzo (palabras_nuevas > MAX_PALABRAS_NUEVAS); más la capa de código del
 *    validador de PED-24 (verificarFidelidad, PED-35): palabra_fuera_de_cita contra la línea original y las fuentes de
 *    las keywords efectivamente insertadas, escalada_rol y calificativo_trasladado. Si falla, un reintento
 *    con el motivo; si vuelve a fallar → "rechazada_forzada" y se conserva la original.
 * No está conectado a process-cv todavía (PED-25).
 */
import Anthropic from "@anthropic-ai/sdk";
import { normalizarParaComparar, STOP_WORDS_MATCH } from "./cv-postprocess";
import { esEncabezado, esLineaCargo, raizVerbo, VERBOS_ESCALADA } from "./cv-verificacion";
import { esCarrera, RAICES_GENERICAS, RE_EXPERIENCIA, type KeywordsJD, type ResultadoMapeo } from "./mapeo-semantico";
import { calificativoTrasladado, escaladaRol, palabraFueraDeCita, type OracionAValidar } from "./validador";

export const MODELO_REESCRITOR = "claude-haiku-4-5-20251001";
export const MAX_PALABRAS_NUEVAS = 4;
export const MAX_USOS_KEYWORD = 2; // en reescribirCV, cada keyword se agrega en a lo más 2 líneas
const MIN_PALABRAS_LINEA = 4; // encabezados, nombre y contacto no se reescriben

export type EstadoLinea = "adaptada" | "sin_cambios" | "rechazada_forzada";

export interface ResultadoLinea {
  original: string;
  adaptada: string;             // igual a original si no hay mejora honesta
  keywords_agregadas: string[]; // cada una viene de mapeo.matches_*
  fuente_en_cv: string[];       // fragmento del CV que respalda cada keyword (mismo orden)
  palabras_nuevas: number;      // métrica de fuerzo
  reintentos: 0 | 1;
  estado: EstadoLinea;
  motivo?: string;              // por qué se rechazó (último intento)
  usage?: { input_tokens: number; output_tokens: number }; // suma de los intentos, para el costo real
}

export interface InputLinea {
  lineaOriginal: string;
  cvCompleto: string;
  mapeo: ResultadoMapeo;
  keywordsJD: KeywordsJD;
}

export interface OpcionesReescritor {
  client?: Anthropic;
  maxPalabrasNuevas?: number;
  keywordsAgotadas?: Set<string>; // keywords que ya alcanzaron MAX_USOS_KEYWORD en el CV
}

export interface KeywordPermitida {
  keyword: string;
  competencia_cv: string;
  fuente: string;
  tipo_match: "directo" | "relacionado";
  palabras: string[]; // palabras de la keyword que se pueden insertar (en relacionados, solo las respaldadas en el CV)
}

export interface KeywordDescartada { keyword: string; motivo: string }

// Raíces que no bastan para que una keyword toque una línea: RAICES_GENERICAS, compartida con el mapeo.

// ─── palabras ────────────────────────────────────────────────────────────────

// Palabras de contenido normalizadas (sin stop words ni palabras de 1–2 letras, salvo cifras).
export function palabrasContenido(texto: string): string[] {
  return normalizarParaComparar(texto).split(" ").filter(p => p && !STOP_WORDS_MATCH.has(p) && (p.length > 2 || /\d/.test(p)));
}

const raiz = (p: string) => p.slice(0, 5);

// La palabra está en el conjunto, tolerando plural y flexión (misma raíz de 5 letras en palabras largas).
export function presente(p: string, conjunto: Set<string>, raices: Set<string>): boolean {
  if (conjunto.has(p) || conjunto.has(p.replace(/s$/, "")) || conjunto.has(p + "s")) return true;
  return p.length >= 6 && !/\d/.test(p) && raices.has(raiz(p));
}

export function indice(texto: string) {
  const ps = palabrasContenido(texto);
  return { set: new Set(ps), raices: new Set(ps.filter(p => p.length >= 6).map(raiz)) };
}

// Presencia estricta: la palabra o su plural, sin tolerar flexión por raíz ("operations" no respalda en "operaciones").
export function presenteEstricto(p: string, conjunto: Set<string>): boolean {
  return conjunto.has(p) || conjunto.has(p.replace(/s$/, "")) || conjunto.has(p + "s");
}

const lineasCV = (cv: string) => cv.split("\n").map(l => l.replace(/^\s*[-•]\s+/, "").trim()).filter(Boolean);

// Primera línea del CV (distinta de la actual si se puede) que contiene todas las palabras del término.
// Con estricto, sin tolerar flexión por raíz ("sindicales" no respalda "sindicatos").
function fuenteDe(termino: string, cv: string, lineaActual: string, estricto = false): string | null {
  const t = palabrasContenido(termino);
  if (t.length === 0) return null;
  const candidatas = lineasCV(cv).filter(l => {
    const ix = indice(l);
    return t.every(p => (estricto ? presenteEstricto(p, ix.set) : presente(p, ix.set, ix.raices)));
  });
  return candidatas.find(l => l !== lineaActual.replace(/^\s*[-•]\s+/, "").trim()) ?? candidatas[0] ?? null;
}

// ─── bloques del CV ──────────────────────────────────────────────────────────

export interface BloqueCV {
  tipo: "resumen" | "puesto" | "otro";
  titulo: string;    // línea de empresa/cargo en los puestos
  lineas: string[];  // sin viñeta; en un puesto incluye su título y el cargo bajo él
  indices: number[]; // índice de cada línea de `lineas` en cv.split("\n")
}

// Resumen: todo lo anterior a la sección de experiencia (perfil, Áreas de Expertise, stack). Dentro de la sección de
// experiencia, un bloque por puesto: la línea con fechas ("Empresa — 2014 – 2017", "Cargo | Empresa    2025") más
// las líneas siguientes (cargo y viñetas) hasta el próximo puesto o encabezado. Las demás secciones (educación,
// habilidades) van en "otro". Si el CV no tiene encabezado de experiencia, un puesto es cualquier línea "— … año".
export function bloquesCV(cv: string): BloqueCV[] {
  const crudas = cv.split("\n");
  const conSeccion = crudas.some(l => esEncabezado(l) && RE_EXPERIENCIA.test(normalizarParaComparar(l)));
  const bloques: BloqueCV[] = [{ tipo: "resumen", titulo: "", lineas: [], indices: [] }];
  let seccion: "resumen" | "experiencia" | "otro" = "resumen";
  crudas.forEach((cruda, i) => {
    const l = cruda.replace(/^\s*[-•]\s+/, "").trim();
    if (!l) return;
    if (esEncabezado(cruda)) {
      if (RE_EXPERIENCIA.test(normalizarParaComparar(l))) seccion = "experiencia";
      else if (seccion !== "resumen" || bloques[bloques.length - 1].tipo !== "resumen") {
        seccion = "otro";
        bloques.push({ tipo: "otro", titulo: l, lineas: [], indices: [] });
      }
      return;
    }
    const esVineta = /^\s*[-•]\s+/.test(cruda);
    const esPuesto = conSeccion
      ? seccion === "experiencia" && !esVineta && (esLineaCargo(cruda) || /\b(19|20)\d{2}\b/.test(l))
      : esLineaCargo(cruda);
    if (esPuesto) { bloques.push({ tipo: "puesto", titulo: l, lineas: [l], indices: [i] }); return; }
    const actual = bloques[bloques.length - 1];
    actual.lineas.push(l);
    actual.indices.push(i);
  });
  return bloques;
}

// ─── plan (sin API) ──────────────────────────────────────────────────────────

// Keywords del mapeo que tocan esta línea y que todavía no están escritas en ella, con su fuente en el CV,
// y las descartadas con su motivo (para el dry-run).
export function planificarLineaDetalle(input: InputLinea): { permitidas: KeywordPermitida[]; descartadas: KeywordDescartada[] } {
  const { lineaOriginal, cvCompleto, mapeo } = input;
  const permitidas: KeywordPermitida[] = [];
  const descartadas: KeywordDescartada[] = [];
  const pl = palabrasContenido(lineaOriginal);
  if (pl.length < MIN_PALABRAS_LINEA) return { permitidas, descartadas };
  const ixLinea = indice(lineaOriginal);
  const raicesLinea = new Set(pl.map(raiz));
  const cvSet = indice(cvCompleto).set;
  // Viñeta de un puesto: cada palabra insertada debe estar respaldada en el mismo puesto.
  const textoLinea = lineaOriginal.replace(/^\s*[-•]\s+/, "").trim();
  const bloque = bloquesCV(cvCompleto).find(b => b.lineas.includes(textoLinea));
  const respaldo = bloque?.tipo === "puesto" ? bloque.lineas.join("\n") : cvCompleto;
  const ixBloque = indice(respaldo);

  const matches = [
    ...mapeo.matches_directos.map(m => ({ ...m, tipo_match: "directo" as const })),
    ...mapeo.matches_relacionados.map(m => ({ ...m, tipo_match: "relacionado" as const })),
  ];
  for (const m of matches) {
    if (permitidas.some(p => p.keyword === m.keyword_jd)) continue;
    const kw = palabrasContenido(m.keyword_jd);
    if (kw.length === 0) continue;
    const comp = m.competencia_cv === "(texto del CV)" ? [] : palabrasContenido(m.competencia_cv);
    const compartidas = [...kw, ...comp].map(raiz).filter(r => raicesLinea.has(r));
    if (compartidas.length === 0) continue; // no toca la línea: no se reporta
    const descartar = (motivo: string) => descartadas.push({ keyword: m.keyword_jd, motivo });

    if (esCarrera(m.keyword_jd)) { descartar("carrera: va en Educación"); continue; }
    if (kw.every(p => presente(p, ixLinea.set, ixLinea.raices))) { descartar("ya está escrita"); continue; }
    if (compartidas.every(r => RAICES_GENERICAS.has(r))) {
      descartar(`solo comparte raíz genérica (${[...new Set(compartidas)].join(", ")})`);
      continue;
    }
    // En relacionados, solo las palabras de la keyword con respaldo literal en el CV se pueden insertar.
    const palabras = m.tipo_match === "directo" ? kw : kw.filter(p => presenteEstricto(p, cvSet));
    if (palabras.length === 0) { descartar("relacionado sin ninguna palabra respaldada en el CV"); continue; }
    // Si ninguna línea respalda las palabras juntas, se muestra la línea que respalda cada una.
    const estricto = m.tipo_match === "relacionado";
    const insertadas = palabras.filter(w => !presenteEstricto(w, ixLinea.set));
    if (bloque?.tipo === "puesto" && !insertadas.every(w => (estricto ? presenteEstricto(w, ixBloque.set) : presente(w, ixBloque.set, ixBloque.raices)))) {
      descartar("respaldo en otro puesto");
      continue;
    }
    const porPalabra = palabras.map(w => fuenteDe(w, respaldo, lineaOriginal, estricto));
    const fuente = fuenteDe(palabras.join(" "), respaldo, lineaOriginal, estricto)
      ?? (porPalabra.every(Boolean) ? [...new Set(porPalabra)].join(" | ") : null)
      ?? (comp.length > 0 ? fuenteDe(m.competencia_cv, respaldo, lineaOriginal) : null);
    if (!fuente) { descartar("sin fragmento del CV que la respalde"); continue; }
    permitidas.push({ keyword: m.keyword_jd, competencia_cv: m.competencia_cv, fuente, tipo_match: m.tipo_match, palabras });
  }
  return { permitidas, descartadas };
}

export function planificarLinea(input: InputLinea): KeywordPermitida[] {
  return planificarLineaDetalle(input).permitidas;
}

// ─── verificación local (sin API) ────────────────────────────────────────────

export interface Verificacion {
  ok: boolean;
  palabras_nuevas: number;
  problemas: string[];
}

export function verificarAdaptacion(
  original: string,
  adaptada: string,
  palabrasPermitidas: string[], // palabras de las keywords agregadas que se pueden insertar (KeywordPermitida.palabras)
  cvCompleto: string,
  mapeo: ResultadoMapeo,
  maxPalabrasNuevas = MAX_PALABRAS_NUEVAS,
): Verificacion {
  const problemas: string[] = [];
  const ixOrig = indice(original);
  const ixCV = indice(cvCompleto);
  const ixKw = indice(palabrasPermitidas.join(" "));
  const nuevas = palabrasContenido(adaptada).filter(p => !presente(p, ixOrig.set, ixOrig.raices));
  const nuevasUnicas = [...new Set(nuevas)];

  const sinRespaldo = nuevasUnicas.filter(p => !presente(p, ixCV.set, ixCV.raices) && !presente(p, ixKw.set, ixKw.raices));
  if (sinRespaldo.length > 0) problemas.push(`palabras sin respaldo en el CV: ${sinRespaldo.join(", ")}`);

  // Palabras de keywords relacionadas sin respaldo literal en el CV ("people" de "people operations").
  const cvSet = ixCV.set;
  const kwSinRespaldo = [...new Set(mapeo.matches_relacionados.flatMap(m => palabrasContenido(m.keyword_jd)))]
    .filter(p => !presenteEstricto(p, cvSet) && !presenteEstricto(p, ixKw.set) && nuevasUnicas.includes(p));
  if (kwSinRespaldo.length > 0) problemas.push(`palabras de keyword relacionada sin respaldo: ${kwSinRespaldo.join(", ")}`);

  // Términos del original que desaparecen (reordenar está bien: se compara por conjunto de palabras).
  const ixAdaptada = indice(adaptada);
  // Presencia estricta: "estrategia" no queda cubierta por "estratégicos".
  const borradas = [...new Set(palabrasContenido(original))].filter(p => !presenteEstricto(p, ixAdaptada.set));
  if (borradas.length > 0) problemas.push(`borra términos del original: ${borradas.join(", ")}`);

  const cifras = nuevasUnicas.filter(p => /\d/.test(p));
  if (cifras.length > 0) problemas.push(`cifras nuevas: ${cifras.join(", ")}`);

  const ixAdapt = indice(adaptada);
  const gaps = mapeo.gap_keywords.filter(g => {
    const k = palabrasContenido(g.keyword);
    return k.length > 0 && k.every(p => presente(p, ixAdapt.set, ixAdapt.raices)) && !k.every(p => presente(p, ixOrig.set, ixOrig.raices));
  });
  if (gaps.length > 0) problemas.push(`keywords de brecha: ${gaps.map(g => g.keyword).join(", ")}`);

  const raicesOrig = new Set(palabrasContenido(original).map(raizVerbo));
  const escaladas = nuevasUnicas.filter(p => VERBOS_ESCALADA.test(raizVerbo(p)) && !raicesOrig.has(raizVerbo(p)) && !ixKw.set.has(p));
  const primera = palabrasContenido(adaptada)[0];
  if (primera && VERBOS_ESCALADA.test(raizVerbo(primera)) && !raicesOrig.has(raizVerbo(primera)) && !escaladas.includes(primera)) {
    escaladas.push(primera); // un verbo de escalada al inicio nunca se justifica por la keyword
  }
  if (escaladas.length > 0) problemas.push(`verbos de escalada: ${escaladas.join(", ")}`);

  if (nuevas.length > maxPalabrasNuevas) problemas.push(`fuerzo: ${nuevas.length} palabras nuevas (máx. ${maxPalabrasNuevas})`);

  return { ok: problemas.length === 0, palabras_nuevas: nuevas.length, problemas };
}

// Capa de código del validador (PED-24) sobre una línea adaptada (PED-35). Las líneas citadas son la línea original y
// las fuentes de las keywords que la adaptada de verdad contiene: cada palabra nueva debe estar en alguna de ellas
// (no basta otra viñeta del mismo puesto, por eso no se pasa el CV). Una fuente compuesta ("a | b") solo cuenta si una
// de sus partes tiene todas las palabras de la keyword: juntar "indicadores de dotación" y "reclutamiento y selección"
// no respalda "indicadores de selección".
export function verificarFidelidad(
  original: string, adaptada: string, kws: Pick<KeywordPermitida, "keyword" | "palabras" | "fuente">[], cvCompleto?: string,
): string[] {
  const ix = indice(adaptada);
  const tiene = (texto: string, w: string) => { const t = indice(texto); return presente(w, t.set, t.raices); };
  const usadas = kws
    .filter(k => k.palabras.length > 0 && k.palabras.every(w => tiene(adaptada, w)))
    .map(k => ({ ...k, partes: k.fuente.split(" | ").filter(parte => k.palabras.every(w => tiene(parte, w))) }));
  const o: OracionAValidar = { oracion: adaptada, lineas_citadas: [original, ...usadas.flatMap(k => k.partes)].map(texto => ({ linea: 0, texto })) };
  const problemas = [escaladaRol(o), palabraFueraDeCita(o), calificativoTrasladado(o)].filter(h => h !== null).map(h => `${h!.tipo}: ${h!.detalle}`);

  // Líneas de resumen (perfil, Áreas de Expertise, Habilidades: todo lo que no es viñeta de un puesto): no se agrega
  // un ítem cuya única fuente en el CV es de apoyo ("Apoyo en … auditorías laborales" no da "Auditorías Laborales").
  if (cvCompleto) {
    const texto = original.replace(/^\s*[-•]\s+/, "").trim();
    const enPuesto = bloquesCV(cvCompleto).some(b => b.tipo === "puesto" && b.lineas.includes(texto));
    if (!enPuesto) {
      const deApoyo = usadas.filter(k => k.partes.length > 0 && k.partes.every(parte => palabrasContenido(parte).some(w => RE_VERBO_APOYO.test(w))));
      if (deApoyo.length > 0) problemas.push(`item_de_apoyo: ${deApoyo.map(k => k.keyword).join(", ")} solo tiene fuente con verbo de apoyo`);
    }
  }
  return problemas;
}

// Formas verbales (y "apoyo"), no sustantivos: "colaboradores" o "asistente" no cuentan.
const RE_VERBO_APOYO = /^(apoy(o|e|a|ar|ando|aba|ado)|particip(o|e|a|ar|ando|aba|ado)|colabor(o|e|a|ar|ando|aba|ado)|asist(i|o|e|a|ir|iendo|ia|ido))$/;

// ─── llamada a modelo ────────────────────────────────────────────────────────

export const SYSTEM_REESCRITOR = `Adaptas UNA línea de un CV en español a una oferta de trabajo, sin inventar nada.
Reglas:
- Solo puedes reordenar, resaltar o usar sinónimos verdaderos de lo que la línea y los fragmentos del CV ya dicen.
- Puedes incorporar SOLO keywords de la lista permitida, y solo si el fragmento del CV que la respalda lo justifica para esta línea.
- Prohibido agregar habilidades, herramientas, cifras, logros o responsabilidades que no estén en el CV.
- Prohibido cambiar el verbo por uno de mayor responsabilidad (coordiné, lideré, dirigí, gestioné, supervisé, administré).
- No borres ninguna palabra de la línea original: solo agrega o reordena.
- Cambia lo mínimo: a lo más 4 palabras nuevas. Mantén el tiempo verbal y el largo aproximado.
- Si no hay una mejora honesta, devuelve la línea igual y keywords_agregadas vacío.
Responde SOLO con JSON: {"adaptada": "...", "keywords_agregadas": ["..."]}`;

function promptLinea(linea: string, permitidas: KeywordPermitida[], motivo?: string): string {
  const kws = permitidas.map(p => p.tipo_match === "directo"
    ? `- "${p.keyword}" — respaldo en el CV: "${p.fuente}"`
    : `- "${p.keyword}" (relacionada: solo puedes usar las palabras ${p.palabras.map(w => `"${w}"`).join(", ")}) — respaldo en el CV: "${p.fuente}"`,
  ).join("\n");
  const reintento = motivo ? `\n\nTu intento anterior fue rechazado (${motivo}). Cambia menos y usa solo lo respaldado.` : "";
  return `LÍNEA:\n${linea}\n\nKEYWORDS PERMITIDAS:\n${kws}${reintento}`;
}

async function pedirAdaptacion(
  client: Anthropic,
  linea: string,
  permitidas: KeywordPermitida[],
  motivo: string | undefined,
  usage: { input_tokens: number; output_tokens: number },
): Promise<{ adaptada: string; keywords_agregadas: string[] } | null> {
  try {
    const res = await client.messages.create(
      {
        model: MODELO_REESCRITOR,
        max_tokens: 400,
        temperature: 0,
        system: SYSTEM_REESCRITOR,
        messages: [{ role: "user", content: promptLinea(linea, permitidas, motivo) }],
      },
      { timeout: 20_000, maxRetries: 1 },
    );
    usage.input_tokens += res.usage.input_tokens;
    usage.output_tokens += res.usage.output_tokens;
    const raw = res.content[0]?.type === "text" ? res.content[0].text : "";
    const m = raw.match(/\{[\s\S]*\}/);
    if (!m) return null;
    const j = JSON.parse(m[0]);
    if (typeof j.adaptada !== "string") return null;
    const kws = Array.isArray(j.keywords_agregadas) ? j.keywords_agregadas.filter((k: unknown) => typeof k === "string") : [];
    return { adaptada: j.adaptada.trim(), keywords_agregadas: kws };
  } catch (err) {
    console.warn("[postulai] Reescritor: respuesta inválida o error de API:", err instanceof Error ? err.message : err);
    return null;
  }
}

// ─── funciones principales ───────────────────────────────────────────────────

export async function reescribirLinea(input: InputLinea, opts: OpcionesReescritor = {}): Promise<ResultadoLinea> {
  const { lineaOriginal, cvCompleto, mapeo } = input;
  const max = opts.maxPalabrasNuevas ?? MAX_PALABRAS_NUEVAS;
  const sinCambios = (estado: EstadoLinea, reintentos: 0 | 1, motivo?: string): ResultadoLinea => ({
    original: lineaOriginal, adaptada: lineaOriginal, keywords_agregadas: [], fuente_en_cv: [],
    palabras_nuevas: 0, reintentos, estado, ...(motivo ? { motivo } : {}),
  });

  const permitidas = planificarLinea(input).filter(p => !opts.keywordsAgotadas?.has(p.keyword));
  if (permitidas.length === 0) return sinCambios("sin_cambios", 0);

  // Viñeta y sangría se conservan fuera del modelo.
  const prefijo = lineaOriginal.match(/^\s*(?:[-•]\s+)?/)?.[0] ?? "";
  const cuerpo = lineaOriginal.slice(prefijo.length);
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const usage = { input_tokens: 0, output_tokens: 0 };
  let motivo: string | undefined;
  for (const intento of [0, 1] as const) {
    const r = await pedirAdaptacion(client, cuerpo, permitidas, motivo, usage);
    if (!r) { motivo = "respuesta sin JSON válido"; continue; }

    // El modelo puede reportar solo la parte permitida ("sindicatos" de "sindicatos industriales"):
    // una keyword reportada corresponde a la permitida si todas sus palabras están en la keyword.
    const corresponde = (k: string, p: KeywordPermitida) => {
      const pk = palabrasContenido(k);
      return pk.length > 0 && pk.every(w => palabrasContenido(p.keyword).includes(w));
    };
    const fuera = r.keywords_agregadas.filter(k => !permitidas.some(p => corresponde(k, p)));
    const kws = permitidas.filter(p => r.keywords_agregadas.some(k => corresponde(k, p)));
    const v = verificarAdaptacion(cuerpo, r.adaptada, kws.flatMap(k => k.palabras), cvCompleto, mapeo, max);
    const problemas = [
      ...v.problemas,
      ...(fuera.length > 0 ? [`keywords no permitidas: ${fuera.join(", ")}`] : []),
      ...verificarFidelidad(cuerpo, r.adaptada, kws, cvCompleto),
    ];

    if (problemas.length === 0) {
      if (normalizarParaComparar(r.adaptada) === normalizarParaComparar(cuerpo)) return { ...sinCambios("sin_cambios", intento), usage };
      return {
        original: lineaOriginal,
        adaptada: prefijo + r.adaptada,
        keywords_agregadas: kws.map(k => k.keyword),
        fuente_en_cv: kws.map(k => k.fuente),
        palabras_nuevas: v.palabras_nuevas,
        reintentos: intento,
        estado: "adaptada",
        usage,
      };
    }
    motivo = problemas.join("; ");
  }
  return { ...sinCambios("rechazada_forzada", 1, motivo), usage };
}

// Las viñetas (experiencia) van primero para que usen las keywords antes que el perfil; cada keyword se agrega
// en a lo más MAX_USOS_KEYWORD líneas. Secuencial, porque cada línea depende de los usos de las anteriores.
export async function reescribirCV(
  lineas: string[],
  ctx: Omit<InputLinea, "lineaOriginal">,
  opts: OpcionesReescritor = {},
): Promise<ResultadoLinea[]> {
  const client = opts.client ?? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const orden = lineas.map((_, i) => i).sort((a, b) => Number(!/^\s*[-•]\s+/.test(lineas[a])) - Number(!/^\s*[-•]\s+/.test(lineas[b])));
  const usos = new Map<string, number>();
  const resultados: ResultadoLinea[] = new Array(lineas.length);
  for (const i of orden) {
    const agotadas = new Set([...usos].filter(([, n]) => n >= MAX_USOS_KEYWORD).map(([k]) => k));
    const r = await reescribirLinea({ ...ctx, lineaOriginal: lineas[i] }, { ...opts, client, keywordsAgotadas: agotadas });
    for (const k of r.keywords_agregadas) usos.set(k, (usos.get(k) ?? 0) + 1);
    resultados[i] = r;
  }
  return resultados;
}
