import React from 'react';
import { ChannelSettings } from '../types';
import { X, Settings, Sliders, RefreshCw, Cpu, Layers } from 'lucide-react';

interface SensorSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: ChannelSettings;
  onSaveSettings: (newSettings: ChannelSettings) => void;
}

export const SensorSettingsModal: React.FC<SensorSettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
}) => {
  if (!isOpen) return null;

  const [formData, setFormData] = React.useState<ChannelSettings>({ ...settings });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveSettings(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl max-w-xl w-full p-6 shadow-xl text-slate-800 space-y-5 max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-4">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold text-slate-900">Configuración del Sensor y Canal Hidráulico</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 text-xs font-medium">
          
          {/* Section 1: Server Channel & Refresh */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-blue-600 flex items-center gap-1.5 text-sm">
              <RefreshCw className="w-4 h-4" /> Servidor de Datos & Refresco
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 mb-1">ID / Código del Canal de Telemetría</label>
                <input
                  type="number"
                  value={formData.channelId}
                  onChange={(e) => setFormData({ ...formData, channelId: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Clave de Lectura (Read API Key)</label>
                <input
                  type="text"
                  value={formData.apiKey || ''}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="Opcional si es público"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-slate-600 mb-1">Intervalo de Refresco</label>
                <select
                  value={formData.autoRefreshInterval}
                  onChange={(e) => setFormData({ ...formData, autoRefreshInterval: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 focus:outline-none focus:border-blue-600"
                >
                  <option value={10}>Cada 10 segundos</option>
                  <option value={15}>Cada 15 segundos</option>
                  <option value={30}>Cada 30 segundos</option>
                  <option value={60}>Cada 60 segundos</option>
                </select>
              </div>
            </div>
          </div>

          {/* Section 2: Physical Sensor Mounting & Geometry */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-blue-600 flex items-center gap-1.5 text-sm">
              <Layers className="w-4 h-4" /> Geometría y Cotas del Canal
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-600 mb-1">Altura de Instalación OC (cm)</label>
                <input
                  type="number"
                  value={formData.installationHeight}
                  onChange={(e) => setFormData({ ...formData, installationHeight: Number(e.target.value) })}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900 focus:outline-none focus:border-blue-600"
                  step="0.1"
                />
              </div>

              <div>
                <label className="block text-slate-600 mb-1">Protección del Sensor</label>
                <div className="w-full bg-slate-100 border border-slate-200 rounded-lg p-2 text-slate-700 font-semibold">
                  Grado de Protección Intemperie IP68
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Hydraulics & Flow Rate Conversion Formula */}
          <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div className="font-bold text-blue-600 flex items-center gap-1.5 text-sm">
              <Sliders className="w-4 h-4" /> Ecuación de Cálculo de Caudal (Q)
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Fórmula de Conversión</label>
              <select
                value={formData.conversionMode}
                onChange={(e) => setFormData({ ...formData, conversionMode: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-medium focus:outline-none focus:border-blue-600"
              >
                <option value="MANNING">Manning (Canal Abierto Rectangular)</option>
                <option value="WEIR">Vertedero Rectangular de Cresta Delgada</option>
                <option value="LINEAR">Factor Lineal Proporcional (Q = k * H)</option>
              </select>
            </div>

            {formData.conversionMode === 'MANNING' && (
              <div className="grid grid-cols-3 gap-3 pt-1">
                <div>
                  <label className="block text-slate-600 mb-1">Ancho B (m)</label>
                  <input
                    type="number"
                    value={formData.channelWidth}
                    onChange={(e) => setFormData({ ...formData, channelWidth: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                    step="0.05"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Pendiente S (m/m)</label>
                  <input
                    type="number"
                    value={formData.channelSlope}
                    onChange={(e) => setFormData({ ...formData, channelSlope: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                    step="0.0005"
                  />
                </div>
                <div>
                  <label className="block text-slate-600 mb-1">Rugosidad n (Manning)</label>
                  <input
                    type="number"
                    value={formData.manningN}
                    onChange={(e) => setFormData({ ...formData, manningN: Number(e.target.value) })}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 font-mono text-slate-900"
                    step="0.001"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Section 4: Units Selection */}
          <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className="block text-slate-600 mb-1">Unidad de Nivel de Agua</label>
              <select
                value={formData.levelUnit}
                onChange={(e) => setFormData({ ...formData, levelUnit: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
              >
                <option value="cm">Centímetros (cm)</option>
                <option value="m">Metros (m)</option>
                <option value="mm">Milímetros (mm)</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-600 mb-1">Unidad de Caudal</label>
              <select
                value={formData.flowUnit}
                onChange={(e) => setFormData({ ...formData, flowUnit: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-lg p-2 text-slate-900 font-mono"
              >
                <option value="L/s">Litros por Segundo (L/s)</option>
                <option value="m3/s">Metros Cúbicos / Seg (m³/s)</option>
                <option value="m3/h">Metros Cúbicos / Hora (m³/h)</option>
                <option value="GPM">Galones por Minuto (GPM)</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold border border-slate-200 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition-all shadow-sm"
            >
              Guardar Cambios
            </button>
          </div>

        </form>
      </div>
    </div>
  );
};
