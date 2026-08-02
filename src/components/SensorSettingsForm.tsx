import React, { useEffect, useState } from 'react';
import { ChannelSettings } from '../types';

interface SensorSettingsFormProps {
  settings: ChannelSettings;
  onSave: (settings: ChannelSettings) => void;
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
  'w-full border border-hairline rounded-md px-2.5 py-1.5 text-[12px] text-ink bg-surface tabular-nums focus:outline-none focus:border-ink-3';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <section className="px-5 py-4 border-b border-hairline">
    <h3 className="eyebrow mb-3">{title}</h3>
    {children}
  </section>
);

/**
 * Per-station configuration. Lives in a drawer rather than a modal so the map
 * stays visible while you change the hydraulic parameters behind the numbers.
 */
export const SensorSettingsForm: React.FC<SensorSettingsFormProps> = ({
  settings,
  onSave,
  onCancel,
}) => {
  const [form, setForm] = useState<ChannelSettings>(settings);

  // Re-sync when the drawer is reopened on a different station.
  useEffect(() => setForm(settings), [settings]);

  const set = <K extends keyof ChannelSettings>(key: K, value: ChannelSettings[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave(form);
      }}
      className="flex flex-col h-full"
    >
      <div className="flex-1">
        <Section title="Canal de telemetría">
          <div className="grid grid-cols-2 gap-4">
            <Field label="ID del canal">
              <input
                type="number"
                value={form.channelId}
                onChange={(e) => set('channelId', Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <Field label="Read API key" hint="Opcional si el canal es público">
              <input
                type="text"
                value={form.apiKey ?? ''}
                onChange={(e) => set('apiKey', e.target.value)}
                className={inputClass}
              />
            </Field>

            <Field label="Intervalo de refresco">
              <select
                value={form.autoRefreshInterval}
                onChange={(e) => set('autoRefreshInterval', Number(e.target.value))}
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
                value={form.resultsCount}
                onChange={(e) => set('resultsCount', Number(e.target.value))}
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

        <Section title="Geometría del cauce">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Altura de instalación OC (cm)" hint="Del sensor al fondo del canal">
              <input
                type="number"
                step="0.1"
                value={form.installationHeight}
                onChange={(e) => set('installationHeight', Number(e.target.value))}
                className={inputClass}
              />
            </Field>

            <Field label="Ancho del canal B (m)">
              <input
                type="number"
                step="0.05"
                value={form.channelWidth}
                onChange={(e) => set('channelWidth', Number(e.target.value))}
                className={inputClass}
              />
            </Field>
          </div>
        </Section>

        <Section title="Cálculo del caudal">
          <div className="space-y-4">
            <Field label="Ecuación de conversión">
              <select
                value={form.conversionMode}
                onChange={(e) => set('conversionMode', e.target.value as ChannelSettings['conversionMode'])}
                className={inputClass}
              >
                <option value="MANNING">Manning · canal abierto rectangular</option>
                <option value="WEIR">Vertedero rectangular de cresta delgada</option>
                <option value="LINEAR">Factor lineal proporcional (Q = k · H)</option>
              </select>
            </Field>

            {form.conversionMode === 'MANNING' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Pendiente S (m/m)">
                  <input
                    type="number"
                    step="0.0005"
                    value={form.channelSlope}
                    onChange={(e) => set('channelSlope', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
                <Field label="Rugosidad n" hint="0.013 para hormigón liso">
                  <input
                    type="number"
                    step="0.001"
                    value={form.manningN}
                    onChange={(e) => set('manningN', Number(e.target.value))}
                    className={inputClass}
                  />
                </Field>
              </div>
            )}

            {form.conversionMode === 'LINEAR' && (
              <Field label="Factor k (L/s por cm)">
                <input
                  type="number"
                  step="0.1"
                  value={form.linearFactor}
                  onChange={(e) => set('linearFactor', Number(e.target.value))}
                  className={inputClass}
                />
              </Field>
            )}
          </div>
        </Section>

        <Section title="Unidades">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Nivel">
              <select
                value={form.levelUnit}
                onChange={(e) => set('levelUnit', e.target.value as ChannelSettings['levelUnit'])}
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
                value={form.flowUnit}
                onChange={(e) => set('flowUnit', e.target.value as ChannelSettings['flowUnit'])}
                className={inputClass}
              >
                <option value="L/s">Litros por segundo (L/s)</option>
                <option value="m3/s">Metros cúbicos por segundo (m³/s)</option>
                <option value="m3/h">Metros cúbicos por hora (m³/h)</option>
                <option value="GPM">Galones por minuto (GPM)</option>
              </select>
            </Field>
          </div>
        </Section>
      </div>

      <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-hairline bg-surface sticky bottom-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-3.5 py-1.5 text-[12px] text-ink-2 border border-hairline rounded-md hover:text-ink hover:bg-[#f7f7f5]"
        >
          Cancelar
        </button>
        <button
          type="submit"
          className="px-3.5 py-1.5 text-[12px] font-medium text-white bg-ink rounded-md hover:opacity-90"
        >
          Guardar
        </button>
      </div>
    </form>
  );
};
