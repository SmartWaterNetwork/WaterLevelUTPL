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

Alertas, manuales del sensor, configuración y administración se abren en paneles
laterales desde los iconos de la cabecera, para no competir con el mapa.

### Estructura del código

| Ruta | Qué contiene |
|---|---|
| `src/stations.ts` | Lista de reserva de estaciones, solo si no hay base de datos |
| `src/theme.ts` | Tokens de color, umbrales por defecto y ventana de obsolescencia |
| `src/lib/` | Cliente de Supabase, tipos generados y acceso al catálogo |
| `src/hooks/useStationCatalog.ts` | Carga del catálogo de estaciones |
| `src/hooks/useStationNetwork.ts` | Sondeo de los canales y estado derivado de cada estación |
| `src/hooks/useAuth.ts` | Sesión, rol y alta del primer administrador |
| `src/components/` | Vistas y controles |
| `supabase/functions/station-feed/` | Función que resuelve el canal y su clave de lectura |
| `server.ts` | Servidor Express con proxy a ThingSpeak y Vite en desarrollo |

## Ejecutar en local

**Requisitos:** Node.js 20+

1. Instalar dependencias: `npm install`
2. Copiar `.env.example` a `.env` y rellenar:
   - `VITE_MAPBOX_TOKEN` — sin él la aplicación funciona igual, pero usa
     OpenStreetMap como mapa base.
   - `VITE_SUPABASE_URL` y `VITE_SUPABASE_PUBLISHABLE_KEY` — sin ellos la
     aplicación arranca con la lista de `src/stations.ts` y no se pueden
     administrar las estaciones.
3. Arrancar: `npm run dev` → http://localhost:3000

Otros comandos: `npm run build` (producción), `npm start` (servir el build),
`npm run lint` (comprobación de tipos).

## Estaciones y administración

Las estaciones viven en la base de datos, no en el código: un administrador las
da de alta, las edita y las retira desde el panel de **Administración**, y el
mapa, los umbrales y el cálculo del caudal se recargan a partir de ahí.

De cada estación se guarda su posición como punto **PostGIS**, sus umbrales de
precaución y alerta —58 cm no significan lo mismo en una quebrada de 0,4 m que
en el Zamora—, el canal de telemetría y los parámetros hidráulicos con los que
el nivel se convierte en caudal.

### Quién puede cambiar qué

| | Leer estaciones | Leer claves | Escribir |
|---|---|---|---|
| Visitante (`anon`) | sí | no | no |
| Registrado sin rol | sí | no | no |
| `admin` | sí | sí | sí |

Lo decide la base de datos, no la interfaz: cada tabla tiene RLS y los permisos
de escritura están revocados para `anon`. Que el panel esconda un botón es una
cortesía; lo que impide el cambio es la política.

### El primer administrador

No hay ninguno al desplegar, y solo un administrador puede nombrar a otro. Para
salir de ese círculo, `public.claim_admin()` concede el rol una única vez, y
solo si se cumplen las dos condiciones a la vez: que la red todavía no tenga
administrador y que la dirección de quien lo pide esté en la lista de
`private.admin_bootstrap`, fuera del alcance de la API. En la práctica: crea la
cuenta desde el panel de Administración, confirma el correo, y aparecerá el
botón para activarla. A partir de ahí el rol se asigna en `public.user_roles`.

### Dónde están las claves de ThingSpeak

En `station_channel_secrets`, una tabla a la que `anon` no tiene ni permiso de
lectura. El navegador nunca las ve: la telemetría pasa por la función
`station-feed`, que resuelve el canal y su clave del lado del servidor y
devuelve solo las lecturas. Hace falta porque no todos los canales son
públicos — el 3440462 responde `-1` sin su clave.

Sin credenciales de Supabase la aplicación cae en la lista de `src/stations.ts`,
que no lleva claves; en ese modo solo responden los canales públicos.

## La capa de ríos

Una sola capa, un trazado por tramo, siempre una línea continua. Lo que se
anima no son marcas corriendo por encima del cauce, sino **el color del propio
tramo**: una cresta lo recorre levantándolo desde su color de reposo hasta un
paso más oscuro del mismo tono, y de vuelta.

**En reposo la red está quieta.** Solo se anima el tramo aguas abajo de una
estación en Precaución o Alerta, así que cualquier movimiento en el mapa
significa un aviso y señala hacia dónde va el agua.

### Qué tramos corresponden a cada estación

Una estación solo habla del agua que ya ha pasado por ella, así que describe el
canal **aguas abajo** de sí misma hasta la siguiente estación. Esa es la regla:
cada tramo lo gobierna la estación más cercana aguas arriba, y un tramo sin
ninguna estación por encima no recibe estado.

Los nombres de las estaciones **no** se usan para esto. La geometría de la capa
muestra que las cuatro no están sobre el cauce que su nombre dice — la
Estación 02, "Río Zamora", está a 10 m de la Quebrada Shushuhuaycu y a cientos
de metros del Zamora — así que la atribución se hace por posición sobre la red.
Conviene revisar esos nombres o esas coordenadas en el origen.

### Cómo se arma la red ([riverNetwork.ts](src/utils/riverNetwork.ts))

Dos hechos de la capa, medidos y no supuestos, obligan al método:

- **El sentido de cada arco es arbitrario.** Está digitalizada para dibujar, no
  para enrutar: solo 57 de 192 tramos enlazan extremo con inicio del siguiente,
  y otros tantos se tocan cabeza con cabeza. El sentido no se lee de la
  geometría, se impone.
- **Las confluencias no caen en los extremos.** Apenas el 42% de los extremos
  coincide con otro: los afluentes desembocan a media línea del cauce
  principal. Por eso los tramos se unen probando cada extremo contra la *línea*
  de los demás, no contra sus extremos.

Con los tramos unidos, cada componente se enraíza en su punto más al norte —
por donde drena, ya que la cuenca de Loja drena al norte — y un barrido desde
esa raíz deja a cada tramo apuntando al que tiene debajo. El barrido va **por
distancia acumulada, no por número de saltos**: en anchura seguiría el camino
con menos confluencias y atajaría por la cuenca, mientras que el agua sigue el
cauce más corto.

### La onda

- **Sentido.** Cada tramo recibe un `animation-delay` igual al tiempo que tarda
  el agua en llegar hasta él desde su estación, así que la cresta sale de la
  estación y avanza aguas abajo.
- **Velocidad.** La que implican las lecturas (`calculateVelocity`, el término v
  de Manning), con un factor de exageración: una onda de crecida tarda horas en
  cruzar la red y a escala real no se vería mover nada. Las velocidades
  relativas entre ríos sí son fieles.
- Seleccionar una estación resalta su tramo aunque no haya aviso, para ver de
  qué responde cada una.
- Se puede desactivar desde *Capas*, y se retira por completo con
  `prefers-reduced-motion` dejando los colores de reposo.

Los cauces se dibujan como los dibuja un mapa hidrográfico: continuos los
permanentes, discontinuos los intermitentes y punteados los tramos embaulados.

## Notas

- Las lecturas nunca se inventan: si un canal responde sin datos, la estación se
  muestra como «Sin datos» en lugar de mostrar un valor de ejemplo. Una lectura
  con más de una hora se marca como obsoleta.
- Los umbrales de estado son propios de cada estación y se editan desde
  administración; `src/theme.ts` solo guarda los de reserva (precaución 58 cm,
  alerta 70 cm). Los comparten el mapa, el panel y los gráficos. Las reglas de
  alerta con notificación y sonido siguen configurándose desde el panel de
  alertas y todavía no se guardan en la base de datos.
- Las claves de lectura de ThingSpeak estuvieron en `src/stations.ts` y por
  tanto en el paquete servido al navegador y en el historial de git. Ahora viven
  solo en la base de datos, pero conviene regenerarlas en ThingSpeak: lo que
  estuvo publicado, publicado está.
