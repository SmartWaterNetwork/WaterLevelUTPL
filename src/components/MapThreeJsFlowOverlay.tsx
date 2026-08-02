import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { Station } from '../types';

interface MapThreeJsFlowOverlayProps {
  stations: Station[];
  activeStationId: string;
  is3dOverlayActive: boolean;
}

export const MapThreeJsFlowOverlay: React.FC<MapThreeJsFlowOverlayProps> = ({
  stations,
  activeStationId,
  is3dOverlayActive,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);

  useEffect(() => {
    if (!containerRef.current || !is3dOverlayActive) return;

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-width / 2, width / 2, height / 2, -height / 2, 1, 1000);
    camera.position.z = 100;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rendererRef.current = renderer;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(renderer.domElement);
    }

    // 2. Create Flow Streamlines Particle System
    const particleCount = 120;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);
    const speeds = new Float32Array(particleCount);

    // Get active station flow rate
    const activeSt = stations.find((s) => s.id === activeStationId) || stations[0];
    const flowLps = activeSt.currentFlowLps || 120;
    const normalizedSpeed = Math.max(0.5, Math.min(4.0, flowLps / 50));

    // Color based on status
    let baseColor = new THREE.Color(0x38bdf8); // Blue normal
    if (activeSt.status === 'PRECAUCION') {
      baseColor = new THREE.Color(0xf59e0b); // Amber
    } else if (activeSt.status === 'ALERTA') {
      baseColor = new THREE.Color(0xef4444); // Red
    }

    for (let i = 0; i < particleCount; i++) {
      // Scatter particles along diagonal river channel paths
      const x = (Math.random() - 0.5) * width;
      const y = (Math.random() - 0.5) * height;
      const z = 0;

      positions[i * 3] = x;
      positions[i * 3 + 1] = y;
      positions[i * 3 + 2] = z;

      colors[i * 3] = baseColor.r;
      colors[i * 3 + 1] = baseColor.g;
      colors[i * 3 + 2] = baseColor.b;

      speeds[i] = (Math.random() * 1.5 + 0.8) * normalizedSpeed;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    // Particle texture
    const pMaterial = new THREE.PointsMaterial({
      size: 8,
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      blending: THREE.AdditiveBlending,
    });

    const particleSystem = new THREE.Points(geometry, pMaterial);
    scene.add(particleSystem);

    // 3. Animation Loop
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const delta = clock.getDelta();

      const posAttr = geometry.attributes.position;
      const posArray = posAttr.array as Float32Array;

      for (let i = 0; i < particleCount; i++) {
        // Move particles along river flow vector (downwards and left)
        posArray[i * 3] -= speeds[i] * 35 * delta;
        posArray[i * 3 + 1] -= speeds[i] * 50 * delta;

        // Wrap around bounds
        if (posArray[i * 3] < -width / 2) posArray[i * 3] = width / 2;
        if (posArray[i * 3 + 1] < -height / 2) posArray[i * 3 + 1] = height / 2;
      }

      posAttr.needsUpdate = true;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.left = -w / 2;
      camera.right = w / 2;
      camera.top = h / 2;
      camera.bottom = -h / 2;
      camera.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      if (rendererRef.current) {
        rendererRef.current.dispose();
      }
    };
  }, [stations, activeStationId, is3dOverlayActive]);

  if (!is3dOverlayActive) return null;

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden rounded-2xl"
    />
  );
};
