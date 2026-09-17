# Evals — Sistema de evaluación del SYSTEM_PROMPT

Mide objetivamente si un cambio al SYSTEM_PROMPT de `app/api/process-cv/route.ts` mejora o empeora los resultados, sin probar caso a caso en el navegador.

## Cómo correrlo

```bash
# Desde la raíz del proyecto
npx tsx evals/correr-evals.ts
```

Requiere `.env.local` con `ANTHROPIC_API_KEY` válida. El script la lee solo, no es necesario exportarla.

El script corre los 4 casos, hace 2 llamadas a la API por caso (generación + evaluación), e imprime una tabla resumen al final.

Los resultados se guardan en `evals/resultados/` como JSON con timestamp.

## Estructura

```
evals/
  casos/
    andres_senior.json          # Ejecutivo 18 años RRHH → Gerente Capital Humano
    camila_junior.json          # Psicóloga 2 años → Analista Selección
    roberto_brecha.json         # Ing. Industrial 8 años, brecha 9 meses → Mejora Continua
    valentina_cambio_rubro.json # Ops Retail 7 años → People Ops startup
  resultados/                   # Generado al correr (ignorado por git)
  rubrica.md                    # Criterios de evaluación (extraídos del SYSTEM_PROMPT)
  correr-evals.ts               # Script principal
  README.md                     # Este archivo
```

## Criterios evaluados

8 universales (todos los casos):
- `perfil_palabras` — ≤70 palabras
- `verbos_accion` — primera persona, sin verbos débiles prohibidos
- `resultado_medible` — ≥1 bullet con número por cargo
- `espejo_lenguaje` — ≥70% de keywords de la oferta en el CV
- `formato_ats` — una columna, fechas MM/AAAA, sin tablas
- `adecuacion_nivel` — estructura y extensión según nivel (junior/mid/senior)
- `carta_presentacion` — 250–350 palabras, 3 párrafos, apertura no prohibida
- `sugerencias` — exactamente 3 en el orden correcto

2 específicos:
- `trayectoria_senior` — solo `andres_senior`: CV mantiene peso ejecutivo de 18 años
- `manejo_brecha` — solo `roberto_brecha`: brecha de 9 meses declarada honestamente

## Agregar un caso nuevo

1. Crear `evals/casos/nombre_caso.json` con esta estructura:
```json
{
  "nombre": "nombre_caso",
  "cv_texto": "...",
  "oferta_texto": "...",
  "perfil_descripcion": "Descripción en una línea para el evaluador",
  "criterios_extra": []
}
```
2. Si el caso necesita un criterio específico (como `manejo_brecha`), agrégalo a `criterios_extra` y documenta el criterio en `rubrica.md`.
3. Correr el script — el caso nuevo se detecta automáticamente.

## Interpretar los resultados

- Puntaje ≥8: criterio cumplido
- Puntaje 6–7: criterio parcialmente cumplido, revisar
- Puntaje <6: criterio fallando, iterar el SYSTEM_PROMPT

Línea base establecida: ver `evals/resultados/` para el primer run.

## Git

Los archivos de `evals/resultados/` no deben commitearse (están en `.gitignore`).
Los casos en `evals/casos/` y la rúbrica sí se commitean — son el contrato de calidad.
