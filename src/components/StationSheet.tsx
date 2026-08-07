import React, { useLayoutEffect, useRef, useState } from 'react';
import { motion, MotionConfig, useDragControls } from 'motion/react';
import type { PanInfo } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { StationState } from '../types';
import { StationList, sharedThresholds } from './StationPanel';
import { num } from '../utils/format';

interface StationSheetProps {
  stations: StationState[];
  activeId: string;
  onSelect: (id: string) => void;
}

const LIST_ID = 'station-sheet-list';

/**
 * Mobile counterpart to the desktop rail: the station roster lives as a sheet
 * anchored to the bottom of the screen instead of pushing the map or the
 * telemetry view down the page. Collapsed, it peeks just enough to show the
 * selected station's reading; dragging the handle (or tapping it) reveals
 * the full list without leaving the map.
 */
export const StationSheet: React.FC<StationSheetProps> = ({ stations, activeId, onSelect }) => {
  const [expanded, setExpanded] = useState(false);
  // Seeded from the viewport so the sheet doesn't flash full-height before
  // the first measurement lands; refined immediately after mount.
  const [collapsedOffset, setCollapsedOffset] = useState(() =>
    typeof window !== 'undefined' ? Math.max(window.innerHeight * 0.72 - 88, 0) : 400
  );

  const sheetRef = useRef<HTMLDivElement>(null);
  const peekRef = useRef<HTMLDivElement>(null);
  const draggedRef = useRef(false);
  const dragControls = useDragControls();

  useLayoutEffect(() => {
    const measure = () => {
      if (sheetRef.current && peekRef.current) {
        setCollapsedOffset(Math.max(sheetRef.current.offsetHeight - peekRef.current.offsetHeight, 0));
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (sheetRef.current) observer.observe(sheetRef.current);
    if (peekRef.current) observer.observe(peekRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);

  if (stations.length === 0) return null;

  const withData = stations.filter((s) => s.latest !== null).length;
  const shared = sharedThresholds(stations);
  const activeStation = stations.find((s) => s.config.id === activeId) ?? null;
  const ChevronIcon = expanded ? ChevronDown : ChevronUp;

  const handleSelect = (id: string) => {
    onSelect(id);
    setExpanded(false);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    draggedRef.current = false;
    dragControls.start(e);
  };

  const handleDragEnd = (_: unknown, info: PanInfo) => {
    const threshold = collapsedOffset / 3;
    if (expanded && (info.offset.y > threshold || info.velocity.y > 500)) {
      setExpanded(false);
    } else if (!expanded && (info.offset.y < -threshold || info.velocity.y < -500)) {
      setExpanded(true);
    }
  };

  const handleToggleClick = () => {
    // A drag that ended is followed by a synthetic click on release; without
    // this guard it would immediately undo whatever handleDragEnd decided.
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    setExpanded((v) => !v);
  };

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        ref={sheetRef}
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragConstraints={{ top: 0, bottom: collapsedOffset }}
        dragElastic={0.06}
        dragMomentum={false}
        onDragStart={() => {
          draggedRef.current = true;
        }}
        onDragEnd={handleDragEnd}
        animate={{ y: expanded ? 0 : collapsedOffset }}
        transition={{ type: 'spring', stiffness: 420, damping: 42 }}
        initial={false}
        role="region"
        aria-label="Estaciones de la red"
        className="lg:hidden fixed inset-x-0 bottom-0 z-40 h-[min(72vh,560px)] max-h-[85vh] bg-surface border-t border-hairline rounded-t-2xl shadow-[0_-4px_16px_rgba(11,11,11,0.16)] flex flex-col"
      >
        <div ref={peekRef}>
          <button
            type="button"
            onPointerDown={handlePointerDown}
            onClick={handleToggleClick}
            aria-expanded={expanded}
            aria-controls={LIST_ID}
            aria-label={expanded ? 'Contraer lista de estaciones' : 'Expandir lista de estaciones'}
            className="w-full touch-none select-none flex flex-col items-center rounded-t-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ink/30"
          >
            <span className="w-9 h-1 rounded-full bg-hairline mt-2" aria-hidden="true" />

            <div className="w-full px-4 pt-2 pb-3 flex items-center justify-between gap-3">
              <div className="min-w-0 text-left">
                <h2 className="text-[13px] font-semibold text-ink">Estaciones</h2>
                <p className="text-[11px] text-ink-3 mt-0.5">
                  {withData} de {stations.length} transmitiendo
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {activeStation?.latest && (
                  <div className="text-right">
                    <div className="text-[15px] leading-none font-semibold tabular-nums text-ink">
                      {num(activeStation.latest.level, 1)}
                      <span className="text-[11px] font-normal text-ink-3 ml-1">
                        {activeStation.config.settings.levelUnit}
                      </span>
                    </div>
                    <div className="text-[10px] text-ink-3 truncate max-w-[120px] mt-1">
                      {activeStation.config.riverName}
                    </div>
                  </div>
                )}
                <ChevronIcon className="w-4 h-4 text-ink-3 shrink-0" aria-hidden="true" />
              </div>
            </div>
          </button>
        </div>

        <div
          id={LIST_ID}
          aria-hidden={!expanded}
          className={`flex-1 min-h-0 overflow-y-auto thin-scroll border-t border-hairline ${
            expanded ? '' : 'pointer-events-none'
          }`}
        >
          <StationList stations={stations} activeId={activeId} onSelect={handleSelect} />
          <div className="px-4 py-3 border-t border-hairline text-[10px] text-ink-3 leading-relaxed">
            {shared
              ? `Umbrales de nivel · Precaución ${shared.precaucion} cm · Alerta ${shared.alerta} cm`
              : 'Umbrales de nivel propios de cada estación'}
          </div>
        </div>
      </motion.div>
    </MotionConfig>
  );
};
