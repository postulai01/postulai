# Postulai — Instrucciones para Claude Code

Lee postulai.md para el contexto completo del proyecto.

---

## Reglas de costo — API de Anthropic

El proyecto tiene ~$3 USD de créditos en la API. Aplicar siempre:

1. **Costo estimado antes de cada llamada.** Nunca crear ni ejecutar scripts ad-hoc que llamen a la API de Anthropic sin mostrar primero el costo estimado y recibir confirmación explícita.

2. **Reutilizar fixtures antes de llamar a la API.** Probar cambios de lógica (parsers, extracción de perfil, comparación de nombres, filtros de habilidades, etc.) con textos ya guardados en `evals/resultados/` o con fixtures locales. Solo llamar a la API cuando la prueba offline no sea posible.

3. **No usar `--forzar-regen` si el SYSTEM_PROMPT no cambió.** La herramienta detecta automáticamente si el prompt cambió. Reutilizar siempre las adaptaciones guardadas.

4. **Máximo un reintento por llamada.** Si una llamada a la API falla, reintentar una sola vez. Si vuelve a fallar, detenerse y reportar el error; no seguir intentando.

5. **Reportar costo real al terminar.** Toda corrida de evals muestra el costo estimado antes de ejecutarse y el costo real al terminar, calculado con los campos `input_tokens`, `output_tokens`, `cache_creation_input_tokens` y `cache_read_input_tokens` de la respuesta.

6. **Confirmación si supera $0.10 USD.** Si una corrida estimada supera $0.10 USD por invocación, pedir confirmación antes de ejecutarla.
