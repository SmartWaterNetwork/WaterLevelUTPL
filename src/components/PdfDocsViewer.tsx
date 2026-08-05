import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { series } from '../theme';

type DocTab = 'SPECS' | 'INSTALLATION' | 'WIRING' | 'APP';

const TABS: { id: DocTab; label: string }[] = [
  { id: 'SPECS', label: 'Especificaciones' },
  { id: 'INSTALLATION', label: 'Instalación' },
  { id: 'WIRING', label: 'Cableado' },
  { id: 'APP', label: 'App Radar Tools' },
];

const PARTS: [string, string][] = [
  ['Puerto de entrada de cable', 'Prensaestopas sellado IP68 para cable de 10 m.'],
  ['Nivel de burbuja (gradienter)', 'Permite verificar la alineación perpendicular exacta.'],
  ['Cuerpo (hull)', 'Cubierta estanca antichoque en polipropileno IP68.'],
  ['Rosca de montaje', 'Polipropileno, rosca G1-1/2.'],
  ['Lente de antena integrada', 'Emite un haz radar enfocado de 6° sin contacto con el agua.'],
];

const SPEC_ROWS: [string, string, string][] = [
  ['Frecuencia radar', '76–81 GHz FMCW', '76–81 GHz FMCW'],
  ['Rango de medición', 'Hasta 65 m', 'Hasta 65 m'],
  ['Incertidumbre', '±1 mm', '±1 mm'],
  ['Comunicación', '4-20 mA / HART', 'RS485 / MODBUS RTU'],
  ['Alimentación', '18–28 V DC (rec. 24 V)', '9–28 V DC (rec. 12 V)'],
  ['Ángulo del haz', '6°', '6°'],
  ['Protección', 'IP68 sumergible', 'IP68 sumergible'],
  ['Zona ciega', '0.1 m – 12 m', '0.3 m – 65 m'],
  ['Inalámbrico', 'Bluetooth 5.0 (12 m)', 'Bluetooth 5.0 (12 m)'],
];

const WIRING_4_20: [string, string][] = [
  ['Amarillo', 'Tierra / landing'],
  ['Rojo', 'Alimentación + (18–28 V DC)'],
  ['Azul', 'Alimentación − / retorno de señal'],
];

const WIRING_RS485: [string, string][] = [
  ['Verde', 'Señal RS485-A (+)'],
  ['Amarillo', 'Señal RS485-B (−)'],
  ['Rojo', 'Alimentación + (9–28 V DC)'],
  ['Azul', 'GND / alimentación −'],
];

const Block: React.FC<{ title: string; source?: string; children: React.ReactNode }> = ({
  title,
  source,
  children,
}) => (
  <section className="border border-hairline rounded-lg">
    <div className="flex items-baseline justify-between gap-3 px-4 py-2.5 border-b border-hairline">
      <h3 className="text-[12px] font-semibold text-ink">{title}</h3>
      {source && <span className="text-[10px] text-ink-3 shrink-0">{source}</span>}
    </div>
    <div className="p-4">{children}</div>
  </section>
);

/** Reference material distilled from the sensor's PDF manual. */
export const PdfDocsViewer: React.FC = () => {
  const [tab, setTab] = useState<DocTab>('SPECS');

  return (
    <div>
      <div className="flex items-center gap-1 px-5 py-3 border-b border-hairline overflow-x-auto thin-scroll">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`px-3 py-1.5 text-[11px] rounded-md whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${
              tab === t.id ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5 space-y-4">
        {tab === 'SPECS' && (
          <>
            <Block title="Estructura externa del sensor" source="Manual, pág. 7">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-5 items-center">
                <div className="sm:col-span-4 flex flex-col items-center">
                  <svg className="w-32 h-40" viewBox="0 0 140 200" role="img" aria-label="Despiece del sensor radar">
                    <rect x="60" y="8" width="20" height="24" fill="#8a877e" rx="2" />
                    <rect x="50" y="32" width="40" height="14" fill="#4a4841" />
                    <rect x="38" y="46" width="64" height="72" fill="#25241f" rx="4" />
                    <rect x="46" y="118" width="48" height="30" fill="#4a4841" />
                    <line x1="46" y1="126" x2="94" y2="126" stroke="#8a877e" />
                    <line x1="46" y1="134" x2="94" y2="134" stroke="#8a877e" />
                    <line x1="46" y1="142" x2="94" y2="142" stroke="#8a877e" />
                    <path d="M46,148 Q70,178 94,148 Z" fill="#8a877e" />
                    {[
                      [20, '1'],
                      [39, '2'],
                      [82, '3'],
                      [133, '4'],
                      [163, '5'],
                    ].map(([y, n]) => (
                      <g key={n as string}>
                        <line
                          x1="102"
                          y1={y as number}
                          x2="118"
                          y2={y as number}
                          stroke="#c3c2b7"
                          strokeWidth="1"
                        />
                        <circle cx="126" cy={y as number} r="8" fill="var(--color-tint)" stroke="#e4e3dd" />
                        <text
                          x="126"
                          y={(y as number) + 3.5}
                          fill="#52514e"
                          fontSize="10"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {n}
                        </text>
                      </g>
                    ))}
                  </svg>
                  <p className="text-[10px] text-ink-3 mt-2 text-center">
                    Radar FMCW 76–81 GHz en polipropileno IP68
                  </p>
                </div>

                <ol className="sm:col-span-8 space-y-2 text-[11px]">
                  {PARTS.map(([name, description], i) => (
                    <li key={name} className="flex gap-2.5">
                      <span className="w-[18px] h-[18px] shrink-0 rounded-full bg-tint border border-hairline text-ink-2 text-[10px] font-semibold flex items-center justify-center">
                        {i + 1}
                      </span>
                      <span className="text-ink-2">
                        <strong className="text-ink font-medium">{name}.</strong> {description}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            </Block>

            <Block title="Ficha técnica por modelo" source="Manual, pág. 4">
              <table className="w-full text-[11px]">
                <thead className="border-b border-hairline text-ink-3">
                  <tr className="text-left">
                    <th className="py-2 pr-3 font-medium">Parámetro</th>
                    <th className="py-2 px-3 font-medium">4-20 mA / HART</th>
                    <th className="py-2 pl-3 font-medium">RS485 / MODBUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {SPEC_ROWS.map(([param, a, b]) => (
                    <tr key={param}>
                      <td className="py-2 pr-3 text-ink-2">{param}</td>
                      <td className="py-2 px-3 text-ink">{a}</td>
                      <td className="py-2 pl-3 text-ink">{b}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Block>
          </>
        )}

        {tab === 'INSTALLATION' && (
          <>
            <Block title="Alineación perpendicular" source="Manual, pág. 11">
              <div className="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink mb-2">
                    <Check className="w-3.5 h-3.5 text-ok" aria-hidden="true" />
                    Correcto
                  </div>
                  <svg className="w-20 h-20 mx-auto" viewBox="0 0 100 100" role="img" aria-label="Sensor perpendicular al agua">
                    <rect x="10" y="80" width="80" height="14" fill={series.level} opacity="0.6" />
                    <line x1="50" y1="26" x2="50" y2="80" stroke="#c3c2b7" strokeWidth="1.5" />
                    <rect x="42" y="12" width="16" height="14" fill="#4a4841" />
                  </svg>
                  <p className="text-[10px] text-ink-3 mt-2">Eco máximo reflejado.</p>
                </div>
                <div>
                  <div className="flex items-center justify-center gap-1.5 text-[11px] font-medium text-ink mb-2">
                    <X className="w-3.5 h-3.5 text-crit" aria-hidden="true" />
                    Incorrecto
                  </div>
                  <svg className="w-20 h-20 mx-auto" viewBox="0 0 100 100" role="img" aria-label="Sensor inclinado sobre el agua">
                    <rect x="10" y="80" width="80" height="14" fill={series.level} opacity="0.6" />
                    <line x1="50" y1="26" x2="70" y2="80" stroke="#d03b3b" strokeWidth="1.5" strokeDasharray="3 2" />
                    <rect x="42" y="12" width="16" height="14" fill="#4a4841" transform="rotate(20 50 19)" />
                  </svg>
                  <p className="text-[10px] text-ink-3 mt-2">Debilita la señal recibida.</p>
                </div>
              </div>
            </Block>

            <Block title="Distancia mínima a la pared: 30 cm" source="Manual, pág. 12">
              <div className="flex items-center gap-4">
                <svg className="w-24 h-24 shrink-0" viewBox="0 0 100 100" role="img" aria-label="Separación mínima entre el sensor y la pared">
                  <rect x="10" y="10" width="9" height="80" fill="#ddd9cf" />
                  <line x1="19" y1="20" x2="60" y2="20" stroke="#c3c2b7" strokeWidth="1.5" />
                  <rect x="52" y="20" width="16" height="14" fill="#25241f" />
                  <polygon points="60,34 45,80 75,80" fill={series.level} opacity="0.18" />
                  <line x1="19" y1="46" x2="52" y2="46" stroke="#d03b3b" strokeWidth="1" strokeDasharray="2 2" />
                  <text x="22" y="43" fill="#d03b3b" fontSize="8">
                    &gt; 30 cm
                  </text>
                </svg>
                <p className="text-[11px] text-ink-2 leading-relaxed">
                  Monte el sensor a un mínimo de <strong className="text-ink font-medium">30 cm</strong> de
                  las paredes laterales del canal o pozo. Así se evita que rugosidades y accesorios
                  distorsionen el haz de 6° y generen falsos ecos.
                </p>
              </div>
            </Block>
          </>
        )}

        {tab === 'WIRING' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Block title="4-20 mA / HART" source="Manual, pág. 13">
              <dl className="text-[11px] divide-y divide-hairline">
                {WIRING_4_20.map(([wire, role]) => (
                  <div key={wire} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <dt className="text-ink font-medium">Cable {wire.toLowerCase()}</dt>
                    <dd className="text-ink-2 text-right">{role}</dd>
                  </div>
                ))}
              </dl>
            </Block>

            <Block title="RS485 / MODBUS" source="Manual, pág. 13">
              <dl className="text-[11px] divide-y divide-hairline">
                {WIRING_RS485.map(([wire, role]) => (
                  <div key={wire} className="flex justify-between gap-3 py-2 first:pt-0 last:pb-0">
                    <dt className="text-ink font-medium">Cable {wire.toLowerCase()}</dt>
                    <dd className="text-ink-2 text-right">{role}</dd>
                  </div>
                ))}
              </dl>
            </Block>
          </div>
        )}

        {tab === 'APP' && (
          <>
            <Block title="App móvil Radar Tools" source="Manual, pág. 14">
              <p className="text-[11px] text-ink-2 leading-relaxed">
                El sensor integra Bluetooth 5.0 con 12 m de alcance para diagnóstico local desde
                Android o iOS, sin cables ni apertura del gabinete en campo.
              </p>
              <ul className="mt-3 space-y-1.5 text-[11px] text-ink-2 list-disc list-inside">
                <li>Lectura directa de distancia al vacío (m) y nivel de agua (m)</li>
                <li>Corriente de salida (4-20 mA) y temperatura (°C)</li>
                <li>Ajuste de zona ciega y offset de distancia</li>
              </ul>
            </Block>

            <Block title="Curva de aprendizaje de falso eco" source="Manual, pág. 19-20">
              <svg className="w-full h-32" viewBox="0 0 300 120" role="img" aria-label="Curva de umbral frente al eco real">
                <line x1="30" y1="100" x2="285" y2="100" stroke="#c3c2b7" strokeWidth="1" />
                <line x1="30" y1="16" x2="30" y2="100" stroke="#c3c2b7" strokeWidth="1" />
                <path d="M30,30 Q60,80 120,80 Q180,85 285,85" stroke="#d03b3b" strokeWidth="1.5" strokeDasharray="4 3" fill="none" />
                <path
                  d="M30,95 Q100,95 130,40 Q160,95 220,95 Q240,30 260,95 Q280,95 285,95"
                  stroke={series.level}
                  strokeWidth="2"
                  fill="none"
                />
                <text x="134" y="34" fill={series.level} fontSize="9" fontWeight="600">
                  Eco real
                </text>
                <text x="200" y="20" fill="#d03b3b" fontSize="9" fontWeight="600">
                  Umbral de corte
                </text>
              </svg>
              <p className="text-[10px] text-ink-3 text-center mt-1">
                El sensor aprende y suprime los picos de falso eco de tuberías u obstáculos.
              </p>
            </Block>
          </>
        )}
      </div>
    </div>
  );
};
