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

Una sola capa, un trazado por tramo, siempre una línea continua. El flujo no se
dibuja con marcas que corren por encima del cauce, sino **recoloreando el propio
tramo**: una cresta recorre el río levantando cada tramo desde su color de
reposo hasta un paso más oscuro del mismo tono, y de vuelta. Así el color sigue
significando lo mismo (el estado del río) y solo su *momento* transporta el
sentido de la corriente.

- **Qué color tiene cada tramo.** El estado que miden las estaciones de su río
  (`reachStateAt` en [reachFlow.ts](src/utils/reachFlow.ts)):
  - Con una sola estación, el tramo hereda su lectura.
  - Con dos en el mismo río — el Zamora tiene una aguas arriba y otra aguas
    abajo — un tramo entre ambas toma el **perfil lineal** de las dos lecturas,
    que es la lectura de primer orden habitual de un río entre estaciones. Así,
    si la de arriba marca 40 cm y la de abajo 80 cm, el cauce vira de Normal a
    Precaución y a Alerta en los umbrales, en el punto donde toca.
  - Fuera del tramo instrumentado se arrastra la lectura más cercana, sin
    extrapolar: nada en los datos justifica prolongar la tendencia.
  - Un río sin estación no recibe estado ni se anima. No se inventa.
- **Hacia dónde va la cresta.** Cada tramo recibe un `animation-delay` igual al
  tiempo que tarda el agua en llegar hasta él, así que los de aguas arriba
  crestan antes y la onda avanza aguas abajo. La posición a lo largo de la red
  se mide como distancia al desagüe, no como latitud: el Jipiro corre casi
  este-oeste y su latitud apenas cambia a lo largo de su curso.
- **A qué velocidad.** La que implican las lecturas (`calculateVelocity`, el
  término v de Manning), con un factor de exageración: una onda de crecida
  tarda horas en cruzar la red y a escala real no se vería mover nada. Las
  velocidades relativas entre ríos sí son fieles.
- **Qué se anima.** Solo los cauces `Permanente` de más de 250 m que además
  tengan estación. Los intermitentes pueden estar secos y se dibujan
  discontinuos; los tramos embaulados van bajo tierra y se dibujan punteados.
- Se puede desactivar desde *Capas*, y se retira por completo con
  `prefers-reduced-motion` dejando los colores de reposo.

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
