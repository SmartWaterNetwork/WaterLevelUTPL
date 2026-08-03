# Nivel y caudal de ríos — Red hidrológica de Loja

Visualización en tiempo real del nivel del agua y el caudal estimado en cuatro
estaciones telemétricas de Loja (Ecuador). Los datos llegan desde canales de
ThingSpeak; el caudal se deriva del nivel con Manning, vertedero o un factor
lineal, configurable por estación.

## Cómo está organizado

La interfaz tiene dos vistas y un panel fijo de estaciones:

- **Mapa** — mapa a altura completa con la red hidrográfica y un marcador por
  estación coloreado según su estado.
- **Telemetría** — hidrograma de la estación seleccionada (nivel y caudal en
  gráficos separados, cada uno con su propio eje) y el esquema del sensor sobre
  el canal, en corte 2D o en 3D.
- **Panel lateral** — las cuatro estaciones con su última lectura, tendencia y
  una sparkline. Siempre visible; es también el selector de estación.

Alertas, manuales del sensor y configuración se abren en paneles laterales desde
los iconos de la cabecera, para no competir con el mapa.

### Estructura del código

| Ruta | Qué contiene |
|---|---|
| `src/stations.ts` | Definición de las cuatro estaciones y sus canales |
| `src/theme.ts` | Tokens de color, umbrales de nivel y ventana de obsolescencia |
| `src/hooks/useStationNetwork.ts` | Sondeo de los canales y estado derivado de cada estación |
| `src/components/` | Vistas y controles |
| `server.ts` | Servidor Express con proxy a ThingSpeak y Vite en desarrollo |

## Ejecutar en local

**Requisitos:** Node.js 20+

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env` y rellenar `VITE_MAPBOX_TOKEN`.
   Sin token la aplicación funciona igual, pero usa OpenStreetMap como mapa base.
3. Arrancar: `npm run dev` → http://localhost:3000

Otros comandos: `npm run build` (producción), `npm start` (servir el build),
`npm run lint` (comprobación de tipos).

## La capa de ríos

Se dibuja dos veces a partir de las mismas teselas vectoriales, sin geometría
añadida: una capa base con la línea continua del cauce y, encima, una capa de
flujo que restrea esos mismos tramos con un patrón discontinuo animado.

- **Sentido.** SVG recorre cada trazado en el orden de sus vértices, así que
  animar `stroke-dashoffset` a la baja lleva las marcas del primer vértice al
  último. Se comprobó decodificando las teselas: ponderado por longitud, el
  orden de vértices de esta capa apunta al norte (Río Malacatos −0.99, Río
  Zamora −0.86), y el norte es aguas abajo para los ríos de Loja. La constante
  `VERTEX_ORDER_IS_DOWNSTREAM` permite invertirlo si cambia el origen de datos.
- **Velocidad.** Sale de la velocidad del agua que implican las lecturas
  (`calculateVelocity`, el término v de Manning) y de la escala del mapa en el
  zoom actual, con un factor de exageración: a escala real el arrastre sería de
  0.03 px/s e imperceptible. Las velocidades relativas entre tramos y entre
  niveles de zoom sí son fieles.
- **Qué se anima.** Solo los cauces `Permanente` de más de 250 m. Los
  intermitentes pueden estar secos y se dibujan discontinuos; los tramos
  embaulados van bajo tierra y se dibujan punteados. Ninguno de los dos fluye.
- Se puede desactivar desde *Capas*, y se retira por completo con
  `prefers-reduced-motion`.

## Notas

- Las lecturas nunca se inventan: si un canal responde sin datos, la estación se
  muestra como «Sin datos» en lugar de mostrar un valor de ejemplo. Una lectura
  con más de una hora se marca como obsoleta.
- Los umbrales de estado (precaución 58 cm, alerta 70 cm) viven en `src/theme.ts`
  y los comparten el mapa, el panel y los gráficos. Las reglas de alerta con
  notificación y sonido se configuran aparte, desde el panel de alertas.
- Las claves de lectura de ThingSpeak están en `src/stations.ts`. Son claves de
  solo lectura de canales públicos; si alguno pasa a ser privado, conviene
  moverlas a variables de entorno.
