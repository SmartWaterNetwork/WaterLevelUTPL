import React, { useState } from 'react';
import { BookOpen, Cpu, Shield, Cpu as Wiring, Smartphone, HelpCircle, Check, X, Layers, Activity } from 'lucide-react';

export const PdfDocsViewer: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'SPECS' | 'INSTALLATION' | 'WIRING' | 'BLUETOOTH'>('SPECS');

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm text-slate-800 flex flex-col gap-6">
      {/* Tab Navigation Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-bold tracking-tight text-slate-900">
              Manual de Operación e Imágenes del Sensor Radar (PDF)
            </h2>
          </div>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Manual Técnico de Instalación, Diagramas de Cableado y Mantenimiento
          </p>
        </div>

        {/* Category Tabs */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
          <button
            onClick={() => setActiveTab('SPECS')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'SPECS'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Especificaciones</span>
          </button>

          <button
            onClick={() => setActiveTab('INSTALLATION')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'INSTALLATION'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Instalación</span>
          </button>

          <button
            onClick={() => setActiveTab('WIRING')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'WIRING'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Wiring className="w-3.5 h-3.5" />
            <span>Cableado</span>
          </button>

          <button
            onClick={() => setActiveTab('BLUETOOTH')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition-all ${
              activeTab === 'BLUETOOTH'
                ? 'bg-blue-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Radar Tools (App)</span>
          </button>
        </div>
      </div>

      {/* Tab 1: Product Specifications Table & Appearance (Pages 1, 4, 7) */}
      {activeTab === 'SPECS' && (
        <div className="space-y-6">
          {/* External Structure Diagram & Appearance */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center bg-slate-50 p-5 rounded-xl border border-slate-200">
            {/* Visual Callout Graphic */}
            <div className="md:col-span-5 flex flex-col items-center justify-center p-4 bg-white rounded-xl border border-slate-200 shadow-sm">
              <span className="text-xs font-bold text-blue-600 mb-2">3.2 Estructura Externa del Sensor</span>
              
              {/* SVG Illustration of Sensor with Callouts 1 to 5 */}
              <svg className="w-48 h-56" viewBox="0 0 200 240" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* 1. Cable Entry */}
                <rect x="90" y="10" width="20" height="25" fill="#64748b" rx="2" />
                <circle cx="150" cy="22" r="10" fill="#2563eb" />
                <text x="146" y="26" fill="#ffffff" fontSize="12" fontWeight="bold">1</text>
                <line x1="105" y1="22" x2="140" y2="22" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 2. Gradienter */}
                <rect x="80" y="35" width="40" height="15" fill="#334155" />
                <circle cx="160" cy="42" r="10" fill="#2563eb" />
                <text x="156" y="46" fill="#ffffff" fontSize="12" fontWeight="bold">2</text>
                <line x1="110" y1="42" x2="150" y2="42" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 3. Hull */}
                <rect x="65" y="50" width="70" height="80" fill="#0f172a" rx="4" stroke="#475569" strokeWidth="2" />
                <circle cx="170" cy="90" r="10" fill="#2563eb" />
                <text x="166" y="94" fill="#ffffff" fontSize="12" fontWeight="bold">3</text>
                <line x1="135" y1="90" x2="160" y2="90" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 4. PP Thread (G1-1/2 or G2) */}
                <rect x="75" y="130" width="50" height="35" fill="#334155" />
                <line x1="75" y1="138" x2="125" y2="138" stroke="#64748b" />
                <line x1="75" y1="146" x2="125" y2="146" stroke="#64748b" />
                <line x1="75" y1="154" x2="125" y2="154" stroke="#64748b" />
                <circle cx="160" cy="148" r="10" fill="#2563eb" />
                <text x="156" y="152" fill="#ffffff" fontSize="12" fontWeight="bold">4</text>
                <line x1="125" y1="148" x2="150" y2="148" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 2" />

                {/* 5. Lens Antenna Section */}
                <path d="M75,165 Q100,195 125,165 Z" fill="#64748b" />
                <circle cx="150" cy="180" r="10" fill="#2563eb" />
                <text x="146" y="184" fill="#ffffff" fontSize="12" fontWeight="bold">5</text>
                <line x1="110" y1="180" x2="140" y2="180" stroke="#2563eb" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>

              <span className="text-[11px] text-slate-500 mt-2 text-center font-medium">
                Sensor 76-81GHz FMCW en Polipropileno IP68
              </span>
            </div>

            {/* Structure Callouts List */}
            <div className="md:col-span-7 space-y-2 text-xs font-medium text-slate-700">
              <div className="font-bold text-slate-900 border-b border-slate-200 pb-1.5 text-sm">
                Partes de la Estructura Externa (Página 7)
              </div>
              <ul className="space-y-2">
                <li className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">1</span>
                  <span><strong>Puerto de entrada de cable:</strong> Prensaestopas sellado IP68 para cable de 10m.</span>
                </li>
                <li className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">2</span>
                  <span><strong>Nivel de burbuja (Gradienter):</strong> Permite verificar la alineación perpendicular exacta.</span>
                </li>
                <li className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">3</span>
                  <span><strong>Cuerpo (Hull):</strong> Cubierta estanque antichoque en Polipropileno (PP) IP68.</span>
                </li>
                <li className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">4</span>
                  <span><strong>Rosca de montaje:</strong> PP (Rosca G1-1/2).</span>
                </li>
                <li className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 shadow-sm">
                  <span className="w-5 h-5 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-xs">5</span>
                  <span><strong>Lente de Antena Integrada:</strong> Emite haz radar enfocado de 6° sin contacto directo.</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Technical Specs Comparison Table (Page 4) */}
          <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-blue-600" />
              1. Ficha Técnica Comparativa de Modelos (Página 4 del Manual)
            </h3>
            <table className="w-full text-xs text-left text-slate-700">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-bold uppercase">
                <tr>
                  <th className="p-3">Parámetro</th>
                  <th className="p-3 text-blue-600">Modelo 4-20mA / HART</th>
                  <th className="p-3 text-blue-800">Modelo RS485 / MODBUS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Frecuencia Radar</td>
                  <td className="p-2.5 text-slate-900 font-bold">76GHz - 81GHz FMCW</td>
                  <td className="p-2.5 text-slate-900 font-bold">76GHz - 81GHz FMCW</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Rango de Medición</td>
                  <td className="p-2.5">Hasta 65 m</td>
                  <td className="p-2.5">Hasta 65 m</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Precisión (Incertidumbre)</td>
                  <td className="p-2.5 text-blue-600 font-bold">±1 mm</td>
                  <td className="p-2.5 text-blue-600 font-bold">±1 mm</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Modo de Comunicación</td>
                  <td className="p-2.5">4-20mA / HART</td>
                  <td className="p-2.5">RS485 / MODBUS RTU</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Voltaje de Alimentación</td>
                  <td className="p-2.5">18 - 28V DC (Rec. 24VDC)</td>
                  <td className="p-2.5">9 - 28V DC (Rec. 12VDC)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Ángulo del Haz (Beam Angle)</td>
                  <td className="p-2.5">6°</td>
                  <td className="p-2.5">6°</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Grado de Protección</td>
                  <td className="p-2.5 text-emerald-700 font-bold">IP68 (Sumergible)</td>
                  <td className="p-2.5 text-emerald-700 font-bold">IP68 (Sumergible)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Zona Ciega (Blind Spot)</td>
                  <td className="p-2.5">0.1 m - 12 m</td>
                  <td className="p-2.5">0.3 m - 65 m</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Inalámbrico Integrado</td>
                  <td className="p-2.5">Bluetooth 5.0 (Alcance 12m)</td>
                  <td className="p-2.5">Bluetooth 5.0 (Alcance 12m)</td>
                </tr>
                <tr>
                  <td className="p-2.5 font-sans font-semibold text-slate-600">Aplicaciones Recomendadas</td>
                  <td className="p-2.5 font-sans text-slate-600">Ríos, lagos, embalses, pozos, canales de riego y alcantarillado.</td>
                  <td className="p-2.5 font-sans text-slate-600">Monitoreo continuo industrial y telemetría IoT.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Installation Rules & Spatial Geometry (Pages 11, 12, 22) */}
      {activeTab === 'INSTALLATION' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Rule 1: Perpendicular Mounting */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>1. Alineación Perpendicular</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                Página 11
              </span>
            </h3>

            {/* Visual comparison of Correct vs Incorrect */}
            <div className="grid grid-cols-2 gap-3 text-center text-xs">
              <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-sm">
                <div className="flex justify-center mb-1 text-emerald-700 font-bold items-center gap-1">
                  <Check className="w-4 h-4 text-emerald-600" /> Correcto
                </div>
                <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100">
                  <rect x="10" y="80" width="80" height="15" fill="#2563eb" />
                  <line x1="50" y1="10" x2="50" y2="80" stroke="#3b82f6" strokeWidth="2" />
                  <rect x="42" y="10" width="16" height="15" fill="#475569" />
                </svg>
                <p className="text-slate-600 text-[11px] mt-1 font-medium">Instrumento perpendicular al agua. Eco máximo reflejado.</p>
              </div>

              <div className="bg-white p-3 rounded-xl border border-red-200 shadow-sm">
                <div className="flex justify-center mb-1 text-red-700 font-bold items-center gap-1">
                  <X className="w-4 h-4 text-red-600" /> Incorrecto
                </div>
                <svg className="w-24 h-24 mx-auto" viewBox="0 0 100 100">
                  <rect x="10" y="80" width="80" height="15" fill="#2563eb" />
                  <line x1="50" y1="10" x2="70" y2="80" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 2" />
                  <rect x="42" y="10" width="16" height="15" fill="#475569" transform="rotate(20 50 15)" />
                </svg>
                <p className="text-slate-600 text-[11px] mt-1 font-medium">Inclinado. Debilita la amplitud de la señal recibida.</p>
              </div>
            </div>
          </div>

          {/* Rule 2: Wall Distance (>30cm) */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center justify-between">
              <span>2. Distancia a la Pared (&gt; 30 cm)</span>
              <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-semibold">
                Página 12
              </span>
            </h3>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-center gap-4">
              <svg className="w-28 h-28 flex-shrink-0" viewBox="0 0 100 100">
                <rect x="10" y="10" width="10" height="80" fill="#cbd5e1" />
                <line x1="20" y1="20" x2="60" y2="20" stroke="#64748b" strokeWidth="2" />
                <rect x="52" y="20" width="16" height="15" fill="#0f172a" />
                <polygon points="60,35 45,80 75,80" fill="#2563eb" opacity="0.3" />
                <line x1="20" y1="25" x2="52" y2="25" stroke="#ef4444" strokeWidth="1.5" strokeDasharray="2 2" />
                <text x="22" y="22" fill="#ef4444" fontSize="8" fontWeight="bold">&gt;30cm</text>
              </svg>
              <div className="text-xs text-slate-700 space-y-1 font-medium">
                <p className="font-bold text-blue-600">Evite Falsos Ecos:</p>
                <p>El sensor debe montarse a mínimo <strong>30 cm</strong> de las paredes laterales del estanque o tubería.</p>
                <p className="text-slate-500 text-[11px]">Esto evita que rugosidades o accesorios en las paredes distorsionen el haz de 6°.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 3: Wiring Diagrams (Page 13) */}
      {activeTab === 'WIRING' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 4-20mA Wiring */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-blue-600 text-sm border-b border-slate-200 pb-2">
              Diagrama de Cableado 4-20mA / HART (Página 13)
            </h3>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between items-center bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800">
                <span className="font-bold">Cable Amarillo (Huang):</span>
                <span>Landing / Tierra</span>
              </div>
              <div className="flex justify-between items-center bg-red-50 border border-red-200 p-2.5 rounded-lg text-red-800">
                <span className="font-bold">Cable Rojo (Red):</span>
                <span>Alimentación + (18-28 VDC, Rec. 24V)</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-blue-800">
                <span className="font-bold">Cable Azul (Lan):</span>
                <span>Alimentación - / Retorno Signal</span>
              </div>
            </div>
          </div>

          {/* RS485 Wiring */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-blue-700 text-sm border-b border-slate-200 pb-2">
              Diagrama de Cableado RS485 / MODBUS (Página 13)
            </h3>
            <div className="space-y-2 text-xs font-medium">
              <div className="flex justify-between items-center bg-emerald-50 border border-emerald-200 p-2.5 rounded-lg text-emerald-800">
                <span className="font-bold">Cable Verde (Hispid):</span>
                <span>Señal RS485-A (+)</span>
              </div>
              <div className="flex justify-between items-center bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-amber-800">
                <span className="font-bold">Cable Amarillo (Huang):</span>
                <span>Señal RS485-B (-)</span>
              </div>
              <div className="flex justify-between items-center bg-red-50 border border-red-200 p-2.5 rounded-lg text-red-800">
                <span className="font-bold">Cable Rojo (Red):</span>
                <span>Alimentación + (9-28 VDC, Rec. 12V)</span>
              </div>
              <div className="flex justify-between items-center bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-blue-800">
                <span className="font-bold">Cable Azul (Lan):</span>
                <span>GND / Alimentación -</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Bluetooth App & Signal Echo Threshold (Pages 14 & 19) */}
      {activeTab === 'BLUETOOTH' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-3">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Smartphone className="w-4 h-4 text-blue-600" />
              App Móvil "Radar Tools" (Página 14)
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              El sensor integra Bluetooth 5.0 (cobertura 12 metros) para diagnóstico local en teléfono Android o iOS sin necesidad de cables ni apertura física del gabinete en campo.
            </p>
            <ul className="text-xs text-slate-700 space-y-1.5 list-disc list-inside font-mono font-medium">
              <li>Lectura directa de Vacío (m) y Nivel de Agua (m)</li>
              <li>Corriente de salida (4-20mA) y Temperatura (°C)</li>
              <li>Ajuste de ciego (Fade zone) y Offset de distancia</li>
            </ul>
          </div>

          {/* False Echo Learning Threshold Curve Diagram */}
          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 space-y-2">
            <h3 className="font-bold text-blue-600 text-sm flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Curva de Aprendizaje de Falso Eco (Página 19/20)
            </h3>
            <svg className="w-full h-32" viewBox="0 0 300 120" fill="none">
              <line x1="30" y1="100" x2="280" y2="100" stroke="#94a3b8" strokeWidth="1.5" />
              <line x1="30" y1="20" x2="30" y2="100" stroke="#94a3b8" strokeWidth="1.5" />
              {/* Threshold Curve */}
              <path d="M30,30 Q60,80 120,80 Q180,85 280,85" stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
              {/* Signal Echo Peak */}
              <path d="M30,95 Q100,95 130,40 Q160,95 220,95 Q240,30 260,95 Q280,95 280,95" stroke="#2563eb" strokeWidth="2" />
              <text x="135" y="32" fill="#2563eb" fontSize="9" fontWeight="bold">Eco Real</text>
              <text x="210" y="22" fill="#ef4444" fontSize="9" fontWeight="bold">Umbral de Corte</text>
            </svg>
            <p className="text-[11px] text-slate-500 text-center font-medium">
              Aprende y suprime picos de falso eco producidos por tuberías u obstáculos internos.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
