import React, { useState } from 'react';
import { AlertConfig, AlertLogItem, ChannelSettings, AlertSeverity } from '../types';
import { playAlertChime, requestNotificationPermission, triggerPushNotification } from '../utils/flowCalculator';
import { Bell, BellRing, Volume2, VolumeX, ShieldAlert, CheckCircle2, Trash2, Plus, Sliders, AlertTriangle, Send } from 'lucide-react';

interface AlertManagerProps {
  alerts: AlertConfig[];
  onUpdateAlerts: (newAlerts: AlertConfig[]) => void;
  logs: AlertLogItem[];
  onClearLogs: () => void;
  settings: ChannelSettings;
}

export const AlertManager: React.FC<AlertManagerProps> = ({
  alerts,
  onUpdateAlerts,
  logs,
  onClearLogs,
  settings,
}) => {
  const [notificationGranted, setNotificationGranted] = useState<boolean>(
    'Notification' in window && Notification.permission === 'granted'
  );

  const [activeTab, setActiveTab] = useState<'RULES' | 'LOGS'>('RULES');

  // Handle toggling an alert rule
  const handleToggleRule = (id: string, key: 'enabled' | 'pushNotification' | 'soundAlert') => {
    const updated = alerts.map((a) => {
      if (a.id === id) {
        return { ...a, [key]: !a[key] };
      }
      return a;
    });
    onUpdateAlerts(updated);
  };

  // Handle updating threshold value
  const handleThresholdChange = (id: string, val: number) => {
    const updated = alerts.map((a) => {
      if (a.id === id) {
        return { ...a, threshold: val };
      }
      return a;
    });
    onUpdateAlerts(updated);
  };

  // Request Push Permission
  const handleEnablePush = async () => {
    const granted = await requestNotificationPermission();
    setNotificationGranted(granted);
    if (granted) {
      triggerPushNotification(
        "🔔 Notificaciones Push Activadas",
        "Recibirás alertas en tiempo real para niveles críticos del sensor de agua."
      );
    }
  };

  // Test Alert Trigger Button
  const handleTestNotification = () => {
    playAlertChime('critical');
    triggerPushNotification(
      "🚨 ALERTA DE PRUEBA - Nivel Crítico",
      `Nivel de agua simulado de 65.0 ${settings.levelUnit} superó el umbral crítico configurado.`
    );
  };

  const unreadCount = logs.filter((l) => !l.read).length;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-800 flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BellRing className="w-5 h-5 text-amber-600" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Gestión de Alertas y Notificaciones Push
            </h2>
            {unreadCount > 0 && (
              <span className="bg-red-600 text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                {unreadCount} activas
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Alertas automáticas en tiempo real para niveles de agua y caudales críticos
          </p>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2">
          {!notificationGranted ? (
            <button
              onClick={handleEnablePush}
              className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-sm"
            >
              <Bell className="w-4 h-4" />
              <span>Activar Push en Navegador</span>
            </button>
          ) : (
            <span className="flex items-center gap-1.5 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl font-semibold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Push Activado
            </span>
          )}

          <button
            onClick={handleTestNotification}
            className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 transition-all"
            title="Probar notificación sonora y push"
          >
            <Send className="w-3.5 h-3.5 text-blue-600" />
            <span>Probar Notificación</span>
          </button>
        </div>
      </div>

      {/* View Switcher: Rules vs Logs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-2 text-xs">
          <button
            onClick={() => setActiveTab('RULES')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'RULES' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Reglas Configurables ({alerts.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('LOGS')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-medium transition-all ${
              activeTab === 'LOGS' ? 'bg-blue-600 text-white shadow-sm font-semibold' : 'text-slate-600 hover:text-slate-900 bg-slate-100 border border-slate-200'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Historial de Incidentes ({logs.length})</span>
          </button>
        </div>

        {activeTab === 'LOGS' && logs.length > 0 && (
          <button
            onClick={onClearLogs}
            className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700 font-semibold transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpiar Historial</span>
          </button>
        )}
      </div>

      {/* Tab 1: Configurable Rules List */}
      {activeTab === 'RULES' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className={`p-5 rounded-xl border transition-all ${
                alert.enabled
                  ? 'bg-white border-slate-200 shadow-sm'
                  : 'bg-slate-50 border-slate-200 opacity-60'
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        alert.severity === 'critical'
                          ? 'bg-red-500'
                          : alert.severity === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                      }`}
                    />
                    <h3 className="font-bold text-slate-900 text-sm">{alert.name}</h3>
                  </div>
                  <span className="text-[11px] text-slate-500 font-mono font-medium">Tipo: {alert.type}</span>
                </div>

                {/* Enable Switch */}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={alert.enabled}
                    onChange={() => handleToggleRule(alert.id, 'enabled')}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Threshold Slider / Input */}
              <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 mb-3 space-y-1.5">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-medium">Umbral de Disparo:</span>
                  <span className="font-mono font-bold text-blue-600 text-sm">
                    {alert.threshold}{' '}
                    {alert.type.includes('LEVEL')
                      ? settings.levelUnit
                      : alert.type.includes('FLOW')
                      ? settings.flowUnit
                      : 'unidades'}
                  </span>
                </div>

                <input
                  type="range"
                  min={0}
                  max={alert.type.includes('LEVEL') ? 200 : 500}
                  step={1}
                  value={alert.threshold}
                  onChange={(e) => handleThresholdChange(alert.id, Number(e.target.value))}
                  disabled={!alert.enabled}
                  className="w-full accent-blue-600 bg-slate-200 h-1.5 rounded-lg cursor-pointer"
                />
              </div>

              {/* Notification Toggles (Sound & Push) */}
              <div className="flex items-center justify-between text-xs pt-1 border-t border-slate-100 text-slate-600 font-medium">
                <button
                  onClick={() => handleToggleRule(alert.id, 'pushNotification')}
                  disabled={!alert.enabled}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                    alert.pushNotification && alert.enabled
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  <Bell className="w-3.5 h-3.5" />
                  <span>Push Browser</span>
                </button>

                <button
                  onClick={() => handleToggleRule(alert.id, 'soundAlert')}
                  disabled={!alert.enabled}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-colors ${
                    alert.soundAlert && alert.enabled
                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {alert.soundAlert ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
                  <span>Chime Sonoro</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Logs & Incident History Table */}
      {activeTab === 'LOGS' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs flex flex-col items-center gap-2 font-medium">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <span>No se han registrado incidentes de alertas. El canal se encuentra en parámetros normales.</span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left text-slate-700">
                <thead className="bg-slate-50 text-slate-500 font-bold uppercase border-b border-slate-200">
                  <tr>
                    <th className="p-3">Hora / Fecha</th>
                    <th className="p-3">Severidad</th>
                    <th className="p-3">Título Alerta</th>
                    <th className="p-3">Mensaje</th>
                    <th className="p-3 text-right">Valor Leído</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80">
                      <td className="p-3 text-slate-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                            log.severity === 'critical'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : log.severity === 'warning'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {log.severity}
                        </span>
                      </td>
                      <td className="p-3 font-sans font-bold text-slate-900">{log.title}</td>
                      <td className="p-3 font-sans text-slate-600">{log.message}</td>
                      <td className="p-3 text-right font-bold text-blue-600">
                        {log.value} {log.unit}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
