import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import L from 'leaflet';
import { Station } from '../types';

interface MapD3FlowOverlayProps {
  stations: Station[];
  activeStationId: string;
  isD3FlowActive: boolean;
  mapInstance: L.Map | null;
  onSelectStation?: (id: string) => void;
}

export const MapD3FlowOverlay: React.FC<MapD3FlowOverlayProps> = ({
  stations,
  activeStationId,
  isD3FlowActive,
  mapInstance,
  onSelectStation,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);

  useEffect(() => {
    if (!svgRef.current || !isD3FlowActive) return;

    const svgElement = svgRef.current;
    const svg = d3.select(svgElement);

    const updatePositions = () => {
      if (!svgRef.current) return;
      svg.selectAll('*').interrupt().remove();
      if (!isD3FlowActive) return;

      const currentZoom = mapInstance ? mapInstance.getZoom() : 13;
      const isFarAway = currentZoom < 13.8;

      // Defs & Filters for Glow
      const defs = svg.append('defs');

      // Glow Filter
      const filter = defs.append('filter').attr('id', 'd3-glow');
      filter.append('feGaussianBlur').attr('stdDeviation', '3.5').attr('result', 'coloredBlur');
      const feMerge = filter.append('feMerge');
      feMerge.append('feMergeNode').attr('in', 'coloredBlur');
      feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

      // Gradient for River Flow Line
      const riverGradient = defs
        .append('linearGradient')
        .attr('id', 'river-flow-gradient')
        .attr('x1', '0%')
        .attr('y1', '100%')
        .attr('x2', '0%')
        .attr('y2', '0%');

      riverGradient.append('stop').attr('offset', '0%').attr('stop-color', '#10b981').attr('stop-opacity', 0.8);
      riverGradient.append('stop').attr('offset', '50%').attr('stop-color', '#0284c7').attr('stop-opacity', 0.9);
      riverGradient.append('stop').attr('offset', '100%').attr('stop-color', '#38bdf8').attr('stop-opacity', 0.95);

      // Clean up overlay gradients & previous subtramos
      svg.selectAll('defs').remove();
      svg.selectAll('.d3-animated-subtramos').remove();

      // Render each station at its mapped lat/lng container point
      stations.forEach((st) => {
        let x = 0;
        let y = 0;

        if (mapInstance) {
          const pt = mapInstance.latLngToContainerPoint([st.lat, st.lng]);
          x = pt.x;
          y = pt.y;
        } else {
          if (st.id === 'st-1') { x = 180; y = 340; }
          else if (st.id === 'st-2') { x = 260; y = 170; }
          else if (st.id === 'st-3') { x = 420; y = 180; }
          else { x = 350; y = 40; }
        }

        const isSelected = st.id === activeStationId;
        const levelCm = st.currentLevelCm || 0;
        const flowLps = st.currentFlowLps || 0;
        const flowM3s = (flowLps / 1000).toFixed(3);

        const maxScaleCm = 100;
        const gaugeHeight = 56;
        const gaugeWidth = 14;
        const levelRatio = Math.min(1, Math.max(0.05, levelCm / maxScaleCm));
        const fillHeight = gaugeHeight * levelRatio;

        let statusColor = '#10b981'; // Emerald
        if (st.status === 'PRECAUCION') statusColor = '#f59e0b';
        if (st.status === 'ALERTA') statusColor = '#ef4444';

        const g = svg
          .append('g')
          .attr('transform', `translate(${x}, ${y})`)
          .style('cursor', 'pointer')
          .style('pointer-events', 'all')
          .on('click', () => {
            if (onSelectStation) {
              onSelectStation(st.id);
            }
            if (mapInstance) {
              mapInstance.flyTo([st.lat, st.lng], 15, { duration: 1.2 });
            }
          });

        // Pulsing Ring Indicator
        g.append('circle')
          .attr('r', isSelected ? 20 : 14)
          .attr('fill', 'none')
          .attr('stroke', statusColor)
          .attr('stroke-width', isSelected ? 2.5 : 1.5)
          .attr('opacity', 0.6);

        // Station Base Anchor Dot
        g.append('circle')
          .attr('r', isSelected ? 7 : 5)
          .attr('fill', statusColor)
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 2);

        if (isFarAway) {
          // Compact Caudal Badge (Lejana)
          const compactG = g.append('g').attr('transform', 'translate(10, -14)');

          compactG
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', 155)
            .attr('height', 28)
            .attr('rx', 8)
            .attr('fill', '#020617')
            .attr('fill-opacity', 0.95)
            .attr('stroke', statusColor)
            .attr('stroke-width', 1.2);

          compactG
            .append('text')
            .attr('x', 8)
            .attr('y', 12)
            .attr('fill', '#94a3b8')
            .attr('font-size', '9px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'sans-serif')
            .text(st.riverName);

          compactG
            .append('text')
            .attr('x', 8)
            .attr('y', 23)
            .attr('fill', '#38bdf8')
            .attr('font-size', '11px')
            .attr('font-weight', '900')
            .attr('font-family', 'monospace')
            .text(`Caudal Q: ${flowLps.toFixed(1)} L/s`);
        } else {
          // Detailed Gauge & Telemetry (Cercana/Seleccionada)
          const gaugeG = g.append('g').attr('transform', `translate(-25, -${gaugeHeight + 20})`);

          gaugeG
            .append('rect')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', gaugeWidth)
            .attr('height', gaugeHeight)
            .attr('rx', 7)
            .attr('fill', '#0f172a')
            .attr('fill-opacity', 0.95)
            .attr('stroke', statusColor)
            .attr('stroke-width', isSelected ? 2 : 1.2);

          gaugeG
            .append('rect')
            .attr('x', 2)
            .attr('y', gaugeHeight - fillHeight)
            .attr('width', gaugeWidth - 4)
            .attr('height', fillHeight)
            .attr('rx', 4)
            .attr('fill', statusColor)
            .attr('opacity', 0.9);

          [0.25, 0.5, 0.75].forEach((tick) => {
            gaugeG
              .append('line')
              .attr('x1', 2)
              .attr('x2', gaugeWidth - 2)
              .attr('y1', gaugeHeight * tick)
              .attr('y2', gaugeHeight * tick)
              .attr('stroke', '#ffffff')
              .attr('stroke-width', 0.8)
              .attr('opacity', 0.4);
          });

          const textG = gaugeG.append('g').attr('transform', `translate(${gaugeWidth + 8}, 4)`);

          const badgeWidth = isSelected ? 185 : 172;
          const badgeHeight = isSelected ? 52 : 48;

          textG
            .append('rect')
            .attr('x', 0)
            .attr('y', -10)
            .attr('width', badgeWidth)
            .attr('height', badgeHeight)
            .attr('rx', 10)
            .attr('fill', '#020617')
            .attr('fill-opacity', 0.95)
            .attr('stroke', isSelected ? '#38bdf8' : statusColor)
            .attr('stroke-width', isSelected ? 2 : 1.2)
            .attr('filter', 'url(#d3-glow)');

          textG
            .append('text')
            .attr('x', 8)
            .attr('y', 4)
            .attr('fill', '#f8fafc')
            .attr('font-size', '11px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'sans-serif')
            .text(st.riverName);

          textG
            .append('text')
            .attr('x', 8)
            .attr('y', 19)
            .attr('fill', statusColor)
            .attr('font-size', '12px')
            .attr('font-weight', '900')
            .attr('font-family', 'monospace')
            .text(`h: ${levelCm.toFixed(1)} cm`);

          textG
            .append('text')
            .attr('x', 8)
            .attr('y', 33)
            .attr('fill', '#38bdf8')
            .attr('font-size', '10px')
            .attr('font-weight', 'bold')
            .attr('font-family', 'monospace')
            .text(`Q: ${flowLps.toFixed(1)} L/s (${flowM3s} m³/s)`);
        }
      });
    };

    updatePositions();

    if (mapInstance) {
      mapInstance.on('move', updatePositions);
      mapInstance.on('zoom', updatePositions);
      mapInstance.on('viewreset', updatePositions);
    }

    return () => {
      if (mapInstance) {
        mapInstance.off('move', updatePositions);
        mapInstance.off('zoom', updatePositions);
        mapInstance.off('viewreset', updatePositions);
      }
      if (svgElement) {
        d3.select(svgElement).selectAll('*').interrupt().remove();
      }
    };
  }, [stations, activeStationId, isD3FlowActive, mapInstance, onSelectStation]);

  if (!isD3FlowActive) return null;

  return (
    <div className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl">
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
};
