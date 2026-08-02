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
