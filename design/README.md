# Diseño — ordering-dashboard

La interfaz utiliza el tema del proyecto y componentes compartidos. La integración pública de marca está documentada en [docs/BRAND.md](../docs/BRAND.md).

## Organización

- Los controladores y la UI viven en `src/@/components-dashboard`; consulta la [guía de componentes](../src/@/components-dashboard/README.md).
- Los estilos de cada componente están junto a su UI. Reutiliza los tokens del tema y los controles compartidos antes de añadir valores locales.
- El adaptador de marca mantiene su propio alcance para evitar cambios implícitos en las pantallas existentes.

## Referencias de implementación

- [Marca y tema](../docs/BRAND.md): tokens, fuentes, adaptadores y límites de estilos.
- [Settings](../docs/SETTINGS.md): organización del editor único y excepciones.
- [Paleta de comandos](../docs/COMMAND_PALETTE.md): navegación, permisos y contratos de búsqueda.

Los cambios visuales deben respetar la marca configurada por el proyecto, el foco de teclado y la accesibilidad de los componentes compartidos.
