import React, { useState } from 'react';
import { AlertConfig, AlertLogItem, StationState } from '../types';
import { playAlertChime, requestNotificationPermission, triggerPushNotification } from '../utils/flowCalculator';
import { fullDateTime } from '../utils/format';
import { Bell, BellOff, Check, Trash2, Volume2, VolumeX } from 'lucide-react';

interface AlertManagerProps {
  alerts: AlertConfig[];
  onUpdateAlerts: (alerts: AlertConfig[]) => void;
  logs: AlertLogItem[];
  onClearLogs: () => void;
  /** To resolve a rule's stationId into a name worth showing. */
  stations: StationState[];
}

const severityColor = {
  critical: '#d03b3b',
  warning: '#fab219',
  info: '#2a78d6',
} as const;

const severityLabel = {
  critical: 'Crítica',
  warning: 'Advertencia',
  info: 'Informativa',
} as const;

const Toggle: React.FC<{
  checked: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={onChange}
    className={`relative w-8 h-[18px] rounded-full transition-colors shrink-0 disabled:opacity-40 ${
      checked ? 'bg-ink' : 'bg-[#dcdad3]'
    }`}
  >
    {/* left-0 pins the knob: without it the button's centred text alignment
        shifts the absolutely positioned static origin. */}
    <span
      className={`absolute left-0 top-[2px] w-[14px] h-[14px] rounded-full bg-white transition-transform ${
        checked ? 'translate-x-[16px]' : 'translate-x-[2px]'
      }`}
    />
  </button>
);

export const AlertManager: React.FC<AlertManagerProps> = ({
  alerts,
  onUpdateAlerts,
  logs,
  onClearLogs,
  stations,
}) => {
  const [pushGranted, setPushGranted] = useState<boolean>(
    typeof Notification !== 'undefined' && Notification.permission === 'granted'
  );
  const [tab, setTab] = useState<'RULES' | 'LOGS'>('RULES');

  const patch = (id: string, changes: Partial<AlertConfig>) =>
    onUpdateAlerts(alerts.map((a) => (a.id === id ? { ...a, ...changes } : a)));

  // Always the same fixed unit a rule is authored and compared in — never a
  // station's own display unit. A rule can apply to every station at once,
  // each with its own levelUnit/flowUnit, so there's no single "right"
  // display unit to convert into here; showing the canonical one keeps the
  // number on screen always meaning what it says, in every station's Config.
  const unitFor = (type: AlertConfig['type']) => {
    if (type.includes('FLOW')) return 'L/s';
    if (type === 'RATE_OF_CHANGE') return 'cm/h';
    return 'cm';
  };

  const scopeLabel = (stationId?: string) => {
    if (!stationId) return 'dispara sobre todas las estaciones';
    const station = stations.find((s) => s.config.id === stationId);
    return `dispara solo sobre ${station ? station.config.riverName : stationId}`;
  };

  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    setPushGranted(granted);
    if (granted) {
      triggerPushNotification(
        'Notificaciones activadas',
        'Recibirás avisos cuando una estación supere un umbral.'
      );
    }
  };

  return (
    <div>
      {/* Browser permission + test, above the rules they apply to. */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-hairline">
        {pushGranted ? (
          <span className="flex items-center gap-1.5 text-[11px] text-ink-2">
            <Check className="w-3.5 h-3.5 text-ok" aria-hidden="true" />
            Notificaciones del navegador activadas
          </span>
        ) : (
          <button
            type="button"
            onClick={handleEnablePush}
            className="flex items-center gap-1.5 text-[11px] font-medium text-white bg-ink px-3 py-1.5 rounded-md hover:opacity-90"
          >
            <Bell className="w-3.5 h-3.5" />
            Activar notificaciones del navegador
          </button>
        )}

        <button
          type="button"
          onClick={() => {
            playAlertChime('critical');
            triggerPushNotification(
              'Alerta de prueba',
              'Nivel simulado de 65 cm sobre el umbral configurado.'
            );
          }}
          className="text-[11px] text-ink-2 hover:text-ink border border-hairline rounded-md px-3 py-1.5"
        >
          Probar aviso
        </button>
      </div>

      <div className="flex items-center justify-between px-5 pt-4">
        <div className="flex items-center border border-hairline rounded-md overflow-hidden">
          <button
            type="button"
            onClick={() => setTab('RULES')}
            aria-pressed={tab === 'RULES'}
            className={`px-3 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              tab === 'RULES' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            Reglas ({alerts.length})
          </button>
          <button
            type="button"
            onClick={() => setTab('LOGS')}
            aria-pressed={tab === 'LOGS'}
            className={`px-3 py-1.5 text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              tab === 'LOGS' ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            Incidentes ({logs.length})
          </button>
        </div>

        {tab === 'LOGS' && logs.length > 0 && (
          <button
            type="button"
            onClick={onClearLogs}
            className="flex items-center gap-1 text-[11px] text-ink-2 hover:text-crit"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Limpiar
          </button>
        )}
      </div>

      {tab === 'RULES' ? (
        <div className="p-5 space-y-3">
          <p className="text-[11px] text-ink-3 -mt-1 mb-1">
            Los umbrales siempre están en cm, L/s o cm/h — independientes de la unidad que cada
            estación use en su visor.
          </p>
          {alerts.map((alert) => {
            const unit = unitFor(alert.type);
            return (
              <div
                key={alert.id}
                className={`border border-hairline rounded-lg p-4 ${alert.enabled ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ background: severityColor[alert.severity] }}
                        aria-hidden="true"
                      />
                      <h3 className="text-[13px] font-semibold text-ink truncate">{alert.name}</h3>
                    </div>
                    <p className="text-[11px] text-ink-3 mt-0.5">
                      {severityLabel[alert.severity]} · {scopeLabel(alert.stationId)}
                    </p>
                  </div>

                  <Toggle
                    checked={alert.enabled}
                    onChange={() => patch(alert.id, { enabled: !alert.enabled })}
                    label={`Activar ${alert.name}`}
                  />
                </div>

                <div className="mt-3.5">
                  <div className="flex items-center justify-between text-[11px] mb-1.5">
                    <span className="text-ink-2">
                      Umbral {alert.type === 'MIN_LEVEL' ? '(por debajo de)' : '(por encima de)'}
                    </span>
                    <span className="text-ink font-semibold tabular-nums">
                      {alert.threshold} {unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    // Río Malacatos alone regularly clears 2 m / 2000+ L/s
                    // since the st-1/st-3 site swap, so the old 200 cm / 500
                    // L/s ceilings could no longer even represent the
                    // defaults (70 cm was fine, but 800 L/s already exceeded
                    // 500) — let alone a threshold raised to reduce false
                    // alarms at that site's now-higher baseline.
                    max={alert.type.includes('FLOW') ? 10000 : 300}
                    step={1}
                    value={alert.threshold}
                    disabled={!alert.enabled}
                    onChange={(e) => patch(alert.id, { threshold: Number(e.target.value) })}
                    aria-label={`Umbral de ${alert.name}`}
                    className="w-full accent-ink h-1 cursor-pointer disabled:cursor-not-allowed"
                  />
                </div>

                <div className="mt-3.5 pt-3 border-t border-hairline flex items-center gap-5 text-[11px] text-ink-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle
                      checked={alert.pushNotification}
                      onChange={() => patch(alert.id, { pushNotification: !alert.pushNotification })}
                      label="Notificación del navegador"
                      disabled={!alert.enabled}
                    />
                    {alert.pushNotification ? (
                      <Bell className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <BellOff className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    Notificación
                  </label>

                  <label className="flex items-center gap-2 cursor-pointer">
                    <Toggle
                      checked={alert.soundAlert}
                      onChange={() => patch(alert.id, { soundAlert: !alert.soundAlert })}
                      label="Aviso sonoro"
                      disabled={!alert.enabled}
                    />
                    {alert.soundAlert ? (
                      <Volume2 className="w-3.5 h-3.5" aria-hidden="true" />
                    ) : (
                      <VolumeX className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    Sonido
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      ) : logs.length === 0 ? (
        <p className="px-5 py-12 text-center text-[12px] text-ink-3">
          Sin incidentes registrados en esta sesión.
        </p>
      ) : (
        <table className="w-full text-[11px] mt-4">
          <thead className="border-y border-hairline text-ink-3">
            <tr className="text-left">
              <th className="px-5 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Estación</th>
              <th className="px-3 py-2 font-medium">Regla</th>
              <th className="px-5 py-2 font-medium text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline">
            {logs.map((log) => (
              <tr key={log.id}>
                <td className="px-5 py-2 text-ink-3 tabular-nums whitespace-nowrap">
                  {fullDateTime(log.timestamp)}
                </td>
                <td className="px-3 py-2 text-ink-2">{log.stationName}</td>
                <td className="px-3 py-2 text-ink">
                  <span className="flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full shrink-0"
                      style={{ background: severityColor[log.severity] }}
                      aria-hidden="true"
                    />
                    {log.title}
                  </span>
                </td>
                <td className="px-5 py-2 text-right text-ink font-semibold tabular-nums whitespace-nowrap">
                  {log.value.toFixed(1)} {log.unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};
