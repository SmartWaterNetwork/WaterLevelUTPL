import React, { useState } from 'react';
import { ChannelSettings } from '../types';
import { StationDraft } from '../lib/stationsApi';

interface StationFormProps {
  draft: StationDraft;
  isNew: boolean;
  busy: boolean;
  error: string | null;
  /** The rest of the network, used only to sanity-check the position. */
  neighbours?: { lat: number; lng: number }[];
  onSave: (draft: StationDraft) => void | Promise<void>;
  onCancel: () => void;
}

const Field: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({
  label,
  hint,
  children,
}) => (
  <label className="block">
    <span className="block text-[11px] text-ink-2 mb-1">{label}</span>
    {children}
    {hint && <span className="block text-[10px] text-ink-3 mt-1">{hint}</span>}
  </label>
);

const inputClass =
  'w-full border border-hairline rounded-md px-2.5 py-1.5 text-[12px] text-ink bg-surface tabular-nums focus:outline-none focus:border-ink-3 focus:ring-2 focus:ring-ink/15';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="px-5 py-4 border-b border-hairline">
    <h3 className="eyebrow mb-3">{title}</h3>
    {children}
  </section>
);

/** The checks worth catching before the round trip; the database repeats them. */
function validate(d: StationDraft): string | null {
  if (!d.code.trim()) return 'El código de la estación es obligatorio.';
  if (!/^[a-z0-9][a-z0-9-]*$/i.test(d.code.trim()))
    return 'El código solo admite letras, números y guiones.';
  if (!d.name.trim()) return 'El nombre de la estación es obligatorio.';
  if (!Number.isFinite(d.lat) || d.lat < -90 || d.lat > 90) return 'Latitud fuera de rango.';
  if (!Number.isFinite(d.lng) || d.lng < -180 || d.lng > 180) return 'Longitud fuera de rango.';
  if (!d.channelId.trim()) return 'Hace falta el canal de ThingSpeak.';
  if (d.precaucionCm >= d.alertaCm)
    return 'El umbral de precaución tiene que ser menor que el de alerta.';
  if (d.settings.installationHeight <= 0)
    return 'La altura de instalación tiene que ser mayor que cero.';
  if (d.settings.channelWidth <= 0) return 'El ancho del canal tiene que ser mayor que cero.';
  return null;
}

/** Great-circle distance in kilometres. */
function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Far enough from every other station that it is worth a second look. */
const OUTLIER_KM = 50;

/**
 * The whole record of a station, in one form: what it is, where it stands, when
 * it warns, where its readings come from and how they become a flow.
 */
export const StationForm: React.FC<StationFormProps> = ({
  draft,
  isNew,
  busy,
  error,
  neighbours = [],
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState<StationDraft>(draft);
  const [invalid, setInvalid] = useState<string | null>(null);

  const set = <K extends keyof StationDraft>(key: K, value: StationDraft[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const setSetting = <K extends keyof ChannelSettings>(key: K, value: ChannelSettings[K]) =>
    setForm((prev) => ({ ...prev, settings: { ...prev.settings, [key]: value } }));

  // A swapped latitude and longitude is still a valid pair of numbers, so the
  // database cannot refuse it. What gives it away is the distance: Loja's pair
  // reversed lands in the South Atlantic. This warns, it does not block —
  // the network may legitimately grow into another basin one day.
  const here = { lat: form.lat, lng: form.lng };
  const nearestKm = neighbours.length
    ? Math.min(...neighbours.map((n) => distanceKm(here, n)))
    : null;
  const looksMisplaced = nearestKm !== null && nearestKm > OUTLIER_KM;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const problem = validate(form);
        setInvalid(problem);
        if (!problem) void onSave(form);
      }}
      className="flex flex-col h-full"
    >
      <div className="flex-1">
        <Section title={isNew ? 'Nueva estación' : 'Identificación'}>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Código" hint="Identificador estable; no lo cambies a la ligera">
              <input
                type="text"
                value={form.code}
                onChange={(e) => set('code', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Nombre">
              <input
                type="text"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Río o quebrada" hint="El cauce donde está realmente instalada">
              <input
                type="text"
                value={form.riverName}
                onChange={(e) => set('riverName', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="Referencia de ubicación" hint="Coordenada UTM, sector, puente…">
              <input
                type="text"
                value={form.locationLabel}
                onChange={(e) => set('locationLabel', e.target.value)}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Posición">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Latitud" hint="Grados decimales, WGS 84">
              <input
                type="number"
                step="0.000001"
                value={form.lat}
                onChange={(e) => set('lat', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Longitud" hint="Negativa al oeste">
              <input
                type="number"
                step="0.000001"
                value={form.lng}
                onChange={(e) => set('lng', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          {looksMisplaced && (
            <p className="text-[11px] rounded-md px-2.5 py-2 mt-3 bg-[#fdf8ec] text-ink-2">
              Esta posición queda a {Math.round(nearestKm!)} km de la estación más cercana.
              Comprueba que no estén intercambiadas la latitud y la longitud: el par invertido
              sigue siendo válido y la base de datos lo aceptaría sin avisar.
            </p>
          )}

          <p className="text-[10px] text-ink-3 mt-3 leading-relaxed">
            La posición se guarda como un punto PostGIS, y es la que decide qué tramo del río
            corresponde a la estación: la atribución aguas abajo se hace por geometría, no por el
            nombre del cauce.
          </p>
        </Section>

        <Section title="Umbrales de aviso">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Precaución (cm)">
              <input
                type="number"
                step="1"
                value={form.precaucionCm}
                onChange={(e) => set('precaucionCm', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Alerta (cm)">
              <input
                type="number"
                step="1"
                value={form.alertaCm}
                onChange={(e) => set('alertaCm', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
          <p className="text-[10px] text-ink-3 mt-3">
            Propios de esta estación: 58 cm no significan lo mismo en una quebrada de 0,4 m que en
            el Zamora.
          </p>
        </Section>

        <Section title="Canal de telemetría">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Canal de ThingSpeak">
              <input
                type="text"
                inputMode="numeric"
                value={form.channelId}
                onChange={(e) => set('channelId', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field
              label="Read API key"
              hint={
                isNew
                  ? 'Solo si el canal es privado'
                  : 'Nunca vuelve al navegador; en blanco, se conserva la actual'
              }
            >
              <input
                type="password"
                autoComplete="off"
                placeholder={isNew ? '' : '••••••••'}
                value={form.readApiKey}
                onChange={(e) => set('readApiKey', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Intervalo de refresco">
              <select
                value={form.settings.autoRefreshInterval}
                onChange={(e) => setSetting('autoRefreshInterval', Number(e.target.value))}
                className={inputClass}
              >
                {[15, 30, 60, 120, 300].map((s) => (
                  <option key={s} value={s}>
                    {s < 60 ? `${s} segundos` : `${s / 60} minuto${s === 60 ? '' : 's'}`}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Lecturas a descargar">
              <select
                value={form.settings.resultsCount}
                onChange={(e) => setSetting('resultsCount', Number(e.target.value))}
                className={inputClass}
              >
                {[30, 60, 120, 300, 500].map((n) => (
                  <option key={n} value={n}>
                    {n} puntos
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Sensor y cauce">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Altura de instalación OC (cm)" hint="Del sensor al fondo del canal">
              <input
                type="number"
                step="0.1"
                value={form.settings.installationHeight}
                onChange={(e) => setSetting('installationHeight', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Ancho del canal B (m)">
              <input
                type="number"
                step="0.05"
                value={form.settings.channelWidth}
                onChange={(e) => setSetting('channelWidth', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
            <Field label="Material del sensor">
              <select
                value={form.settings.sensorMaterial}
                onChange={(e) =>
                  setSetting('sensorMaterial', e.target.value as ChannelSettings['sensorMaterial'])
                }
                className={inputClass}
              >
                <option value="PP">Polipropileno (PP)</option>
                <option value="STAINLESS">Acero inoxidable</option>
              </select>
            </Field>
            <Field label="Comunicación">
              <select
                value={form.settings.communicationType}
                onChange={(e) =>
                  setSetting(
                    'communicationType',
                    e.target.value as ChannelSettings['communicationType']
                  )
                }
                className={inputClass}
              >
                <option value="4-20mA">4-20 mA</option>
                <option value="RS485_MODBUS">RS485 · Modbus</option>
              </select>
            </Field>
          </div>
        </Section>

        <Section title="Cálculo del caudal">
          <div className="space-y-4">
            <Field label="Ecuación de conversión">
              <select
                value={form.settings.conversionMode}
                onChange={(e) =>
                  setSetting('conversionMode', e.target.value as ChannelSettings['conversionMode'])
                }
                className={inputClass}
              >
                <option value="MANNING">Manning · canal abierto rectangular</option>
                <option value="WEIR">Vertedero rectangular de cresta delgada</option>
                <option value="LINEAR">Factor lineal proporcional (Q = k · H)</option>
                <option value="DIRECT">Directo · el canal ya publica caudal</option>
              </select>
            </Field>

            {form.settings.conversionMode === 'MANNING' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Pendiente S (m/m)">
                  <input
                    type="number"
                    step="0.0005"
                    value={form.settings.channelSlope}
                    onChange={(e) => setSetting('channelSlope', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Rugosidad n" hint="0.013 para hormigón liso">
                  <input
                    type="number"
                    step="0.001"
                    value={form.settings.manningN}
                    onChange={(e) => setSetting('manningN', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {form.settings.conversionMode === 'LINEAR' && (
              <Field label="Factor k (L/s por cm)">
                <input
                  type="number"
                  step="0.1"
                  value={form.settings.linearFactor}
                  onChange={(e) => setSetting('linearFactor', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            )}

            {form.settings.conversionMode === 'WEIR' && (
              <Field
                label="Altura de la cresta (cm)"
                hint="Del cero del sensor a la cresta del vertedero — medida de campo, no de la lámina de agua"
              >
                <input
                  type="number"
                  step="1"
                  value={form.settings.weirCrestHeight ?? 0}
                  onChange={(e) => setSetting('weirCrestHeight', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            )}
          </div>

          {form.settings.conversionMode === 'WEIR' && (form.settings.weirCrestHeight ?? 0) === 0 && (
            <p className="text-[11px] rounded-md px-2.5 py-2 mt-3 bg-[#fdf8ec] text-ink-2">
              Con la cresta en 0, el caudal se calcula con la lámina completa como si toda ella
              estuviera vertiendo — normalmente sobrestima el caudal. Mide en campo la distancia
              entre el cero del sensor y la cresta del vertedero para corregirlo.
            </p>
          )}
        </Section>

        <Section title="Unidades">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nivel">
              <select
                value={form.settings.levelUnit}
                onChange={(e) =>
                  setSetting('levelUnit', e.target.value as ChannelSettings['levelUnit'])
                }
                className={inputClass}
              >
                <option value="cm">Centímetros (cm)</option>
                <option value="m">Metros (m)</option>
                <option value="mm">Milímetros (mm)</option>
                <option value="in">Pulgadas (in)</option>
              </select>
            </Field>
            <Field label="Caudal">
              <select
                value={form.settings.flowUnit}
                onChange={(e) =>
                  setSetting('flowUnit', e.target.value as ChannelSettings['flowUnit'])
                }
                className={inputClass}
              >
                <option value="L/s">Litros por segundo (L/s)</option>
                <option value="m3/s">Metros cúbicos por segundo (m³/s)</option>
                <option value="m3/h">Metros cúbicos por hora (m³/h)</option>
                <option value="GPM">Galones por minuto (GPM)</option>
              </select>
            </Field>
          </div>

          {!isNew && (
            <label className="flex items-center gap-2 mt-4">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(e) => set('isActive', e.target.checked)}
                className="w-3.5 h-3.5 accent-[#0b0b0b]"
              />
              <span className="text-[12px] text-ink-2">En servicio</span>
            </label>
          )}
        </Section>
      </div>

      {(invalid || error) && (
        <div className="px-5 py-3">
          <p className="text-[11px] rounded-md px-2.5 py-2 bg-[#fdf3f3] text-crit" role="alert">
            {invalid ?? error}
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-hairline bg-surface sticky bottom-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 text-[12px] text-ink-2 border border-hairline rounded-md hover:text-ink hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={busy}
          className="px-3.5 py-1.5 text-[12px] font-medium text-white bg-ink rounded-md hover:opacity-90 disabled:opacity-40"
        >
          {busy ? 'Guardando…' : isNew ? 'Crear estación' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
};
