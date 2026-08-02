import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, RotateCcw, Sparkles, Sliders, Play, Pause, RefreshCw, AlertTriangle, Waves } from 'lucide-react';

interface ThreeDChannelCanvasProps {
  currentRawLevelCm: number;
  installationHeightCm: number;
  levelUnit: string;
  showKeyPoints?: boolean;
  stationName?: string;
  riverName?: string;
  locationName?: string;
  coordinates?: { lat: number; lng: number };
}

export const ThreeDChannelCanvas: React.FC<ThreeDChannelCanvasProps> = ({
  currentRawLevelCm,
  installationHeightCm,
  levelUnit,
  showKeyPoints = true,
  stationName = 'Estación 01 - Río Malacatos',
  riverName = 'Río Malacatos',
  locationName = 'Centro Loja',
  coordinates = { lat: -4.025112, lng: -79.200527 },
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);

  // Simulation state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulatedLevelCm, setSimulatedLevelCm] = useState<number>(currentRawLevelCm);
  const [autoWaveAnimation, setAutoWaveAnimation] = useState<boolean>(true);

  // Active level to display (either real-time or simulated)
  const activeLevelCm = isSimulating ? simulatedLevelCm : currentRawLevelCm;

  // Sync simulated level when live level changes if not manually simulating
  useEffect(() => {
    if (!isSimulating) {
      setSimulatedLevelCm(currentRawLevelCm);
    }
  }, [currentRawLevelCm, isSimulating]);

  // References to dynamic 3D objects
  const waterMeshRef = useRef<THREE.Mesh | null>(null);
  const waterSurfaceRef = useRef<THREE.Mesh | null>(null);
  const beamConeRef = useRef<THREE.Mesh | null>(null);
  const pointFMeshRef = useRef<THREE.Mesh | null>(null);
  const pulseRingsGroupRef = useRef<THREE.Group | null>(null);
  const waterGeometryRef = useRef<THREE.PlaneGeometry | null>(null);

  // Calculations
  const emptyHeightCm = Math.max(0, installationHeightCm - activeLevelCm);
  const fillRatio = Math.min(1, Math.max(0, activeLevelCm / (installationHeightCm || 100)));

  // Setup Three.js outdoor river scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;

    // 1. Scene setup with soft sky color and gentle fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e0f2fe'); // Sky blue light background
    scene.fog = new THREE.FogExp2('#e0f2fe', 0.08);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.8, 2.6, 4.6);
    cameraRef.current = camera;

    // 3. WebGL Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    while (containerRef.current.firstChild) {
      containerRef.current.removeChild(containerRef.current.firstChild);
    }
    containerRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.set(0, 0.8, 0);
    controls.maxPolarAngle = Math.PI / 2 - 0.05; // Restrict under-ground camera
    controls.minDistance = 1.8;
    controls.maxDistance = 9.0;
    controlsRef.current = controls;

    // 5. Outdoor Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    // Sun light
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.4);
    sunLight.position.set(6, 10, 4);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    scene.add(sunLight);

    // Water bounce fill light
    const bounceLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
    bounceLight.position.set(-4, -2, -4);
    scene.add(bounceLight);

    // 6. Natural River Channel & Bank Terrain
    const riverGroup = new THREE.Group();
    const riverLength = 6.0;
    const riverBottomY = 0.0;
    const bankTopY = 1.6;
    const bottomWidth = 1.8;
    const topWidth = 3.2;

    // River Bed Material (Gravel / Sand)
    const bedGeo = new THREE.BoxGeometry(bottomWidth + 0.2, 0.12, riverLength);
    const bedMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      roughness: 0.95,
      metalness: 0.05,
    });
    const bedMesh = new THREE.Mesh(bedGeo, bedMat);
    bedMesh.position.set(0, riverBottomY - 0.06, 0);
    bedMesh.receiveShadow = true;
    riverGroup.add(bedMesh);

    // Left River Bank (Grassy Earth Slope with Stone riprap)
    const leftBankShape = new THREE.Shape();
    leftBankShape.moveTo(-topWidth / 2 - 1.2, bankTopY + 0.2);
    leftBankShape.lineTo(-bottomWidth / 2, riverBottomY);
    leftBankShape.lineTo(-topWidth / 2, bankTopY);
    leftBankShape.closePath();

    const extrudeSettings = { depth: riverLength, bevelEnabled: false };
    const bankGeoLeft = new THREE.ExtrudeGeometry(leftBankShape, extrudeSettings);
    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f, // Lush natural green grass
      roughness: 0.85,
    });
    const leftBankMesh = new THREE.Mesh(bankGeoLeft, grassMat);
    leftBankMesh.position.z = -riverLength / 2;
    leftBankMesh.receiveShadow = true;
    leftBankMesh.castShadow = true;
    riverGroup.add(leftBankMesh);

    // Right River Bank
    const rightBankShape = new THREE.Shape();
    rightBankShape.moveTo(topWidth / 2 + 1.2, bankTopY + 0.2);
    rightBankShape.lineTo(bottomWidth / 2, riverBottomY);
    rightBankShape.lineTo(topWidth / 2, bankTopY);
    rightBankShape.closePath();

    const bankGeoRight = new THREE.ExtrudeGeometry(rightBankShape, extrudeSettings);
    const rightBankMesh = new THREE.Mesh(bankGeoRight, grassMat);
    rightBankMesh.position.z = -riverLength / 2;
    rightBankMesh.receiveShadow = true;
    rightBankMesh.castShadow = true;
    riverGroup.add(rightBankMesh);

    // Add River Rocks along banks
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.9 });
    const createRock = (x: number, y: number, z: number, scale: number) => {
      const rockGeo = new THREE.DodecahedronGeometry(scale, 1);
      const rock = new THREE.Mesh(rockGeo, rockMat);
      rock.position.set(x, y, z);
      rock.rotation.set(Math.random(), Math.random(), Math.random());
      rock.castShadow = true;
      rock.receiveShadow = true;
      riverGroup.add(rock);
    };

    // Scatter rocks on river edges
    createRock(-0.95, 0.08, -1.5, 0.14);
    createRock(-1.05, 0.22, 0.8, 0.18);
    createRock(0.98, 0.06, -0.4, 0.15);
    createRock(1.15, 0.35, 1.2, 0.22);
    createRock(-1.3, 0.5, 1.8, 0.25);
    createRock(1.25, 0.45, -2.1, 0.2);

    scene.add(riverGroup);

    // 7. Steel Bridge Gantry crossing the river for Radar Mounting
    const bridgeGroup = new THREE.Group();
    const bridgeY = 1.75;

    // Concrete Abutments on left & right banks
    const abutmentMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });
    const leftAbutment = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), abutmentMat);
    leftAbutment.position.set(-topWidth / 2 - 0.2, bankTopY + 0.1, 0);
    leftAbutment.castShadow = true;
    bridgeGroup.add(leftAbutment);

    const rightAbutment = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.6, 0.8), abutmentMat);
    rightAbutment.position.set(topWidth / 2 + 0.2, bankTopY + 0.1, 0);
    rightAbutment.castShadow = true;
    bridgeGroup.add(rightAbutment);

    // Steel Beam Bridge Gantry across river
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.85 });
    const mainBeam = new THREE.Mesh(new THREE.BoxGeometry(topWidth + 1.2, 0.14, 0.35), steelMat);
    mainBeam.position.set(0, bridgeY + 0.1, 0);
    mainBeam.castShadow = true;
    bridgeGroup.add(mainBeam);

    // Safety Railing
    const railMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.5 }); // Safety yellow/red
    const railing = new THREE.Mesh(new THREE.BoxGeometry(topWidth + 1.2, 0.15, 0.04), railMat);
    railing.position.set(0, bridgeY + 0.28, 0.16);
    bridgeGroup.add(railing);

    scene.add(bridgeGroup);

    // 8. FMCW Radar 80GHz Sensor Housing Mounted on Bridge Center
    const sensorGroup = new THREE.Group();
    const sensorY = 1.85;
    sensorGroup.position.set(0, sensorY, 0);

    // Mounting Bracket Arm extending downward from bridge beam
    const bracketMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.3, 16), steelMat);
    bracketMesh.position.set(0, -0.05, 0);
    sensorGroup.add(bracketMesh);

    // Sensor Body (PP Black IP68)
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.2, metalness: 0.1 });
    const sensorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.28, 24), bodyMat);
    sensorBody.position.set(0, -0.22, 0);
    sensorBody.castShadow = true;
    sensorGroup.add(sensorBody);

    // Cable Gland Top
    const glandMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 16), steelMat);
    glandMesh.position.set(0, -0.05, 0);
    sensorGroup.add(glandMesh);

    // Antenna Lens Cone
    const lensMat = new THREE.MeshStandardMaterial({ color: 0x38bdf8, roughness: 0.3 }); // Translucent blue radar lens
    const lensMesh = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.15, 24), lensMat);
    lensMesh.rotation.x = Math.PI;
    lensMesh.position.set(0, -0.42, 0);
    sensorGroup.add(lensMesh);

    // Origin Marker O (Red Dot)
    const pointOMesh = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    pointOMesh.position.set(0, -0.48, 0);
    sensorGroup.add(pointOMesh);

    scene.add(sensorGroup);

    // 9. River Water Volume & Flowing Surface Plane
    const waterGroup = new THREE.Group();

    // River Water Material (Realistic Translucent Blue-Green)
    const waterMat = new THREE.MeshPhysicalMaterial({
      color: 0x0284c7, // Deep river blue
      transparent: true,
      opacity: 0.8,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.5,
      ior: 1.333,
    });

    const waterBoxGeo = new THREE.BoxGeometry(1, 1, riverLength);
    const waterMesh = new THREE.Mesh(waterBoxGeo, waterMat);
    waterMeshRef.current = waterMesh;
    waterGroup.add(waterMesh);

    // Animated River Surface Mesh with Vertices for Wave Motion
    const surfaceGeo = new THREE.PlaneGeometry(1, riverLength, 32, 48);
    waterGeometryRef.current = surfaceGeo;

    const surfaceMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.88,
      roughness: 0.1,
      metalness: 0.3,
      side: THREE.DoubleSide,
    });
    const surfaceMesh = new THREE.Mesh(surfaceGeo, surfaceMat);
    surfaceMesh.rotation.x = -Math.PI / 2;
    waterSurfaceRef.current = surfaceMesh;
    waterGroup.add(surfaceMesh);

    // Point F Marker (Reflecting Water Surface Center)
    const pointFMesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.045, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x2563eb })
    );
    pointFMeshRef.current = pointFMesh;
    waterGroup.add(pointFMesh);

    scene.add(waterGroup);

    // 10. Radar Cone Beam Geometry (6 Degree FMCW Beam)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x0284c7,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.8, 1, 32, 1, true), beamMat);
    beamConeRef.current = beamCone;
    scene.add(beamCone);

    // FMCW Wave Emission Pulse Rings
    const pulseRingsGroup = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const ringMesh = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.7, side: THREE.DoubleSide })
      );
      ringMesh.rotation.x = Math.PI / 2;
      ringMesh.userData = { offset: i * 0.33 };
      pulseRingsGroup.add(ringMesh);
    }
    pulseRingsGroupRef.current = pulseRingsGroup;
    scene.add(pulseRingsGroup);

    // 11. Animation Loop with River Flow Simulation
    let animationFrameId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Animate river surface wave vertices for dynamic current flow
      if (waterGeometryRef.current && autoWaveAnimation) {
        const positionAttribute = waterGeometryRef.current.attributes.position;
        for (let i = 0; i < positionAttribute.count; i++) {
          const x = positionAttribute.getX(i);
          const y = positionAttribute.getY(i);
          // Wave equation propagating along z axis (downstream river flow)
          const zWave = Math.sin(x * 4 + elapsedTime * 3) * 0.015 + Math.cos(y * 3 + elapsedTime * 2) * 0.02;
          positionAttribute.setZ(i, zWave);
        }
        positionAttribute.needsUpdate = true;
      }

      // Animate downward pulsing FMCW radar waves
      if (pulseRingsGroupRef.current) {
        pulseRingsGroupRef.current.children.forEach((ring) => {
          const mesh = ring as THREE.Mesh;
          let progress = (elapsedTime * 0.9 + mesh.userData.offset) % 1;

          const topY = 1.37; // Sensor lens origin
          const waterY = waterMeshRef.current ? waterMeshRef.current.position.y + (waterMeshRef.current.scale.y / 2) : 0.5;
          const currentY = topY - progress * (topY - waterY);

          mesh.position.y = currentY;

          // Scale ring outward matching 6° beam angle expansion
          const radiusScale = 0.6 + progress * 2.4;
          mesh.scale.set(radiusScale, radiusScale, 1);

          // Fade opacity near target water surface
          (mesh.material as THREE.MeshBasicMaterial).opacity = (1 - progress) * 0.65;
        });
      }

      controls.update();
      renderer.render(scene, camera);
    };

    animate();

    // Handle Resize
    const handleResize = () => {
      if (!containerRef.current || !rendererRef.current || !cameraRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(() => handleResize());
    resizeObserver.observe(containerRef.current);

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
      renderer.dispose();
    };
  }, []);

  // Dynamically update river water height & radar beam when level changes
  useEffect(() => {
    if (!waterMeshRef.current || !waterSurfaceRef.current || !beamConeRef.current || !pointFMeshRef.current) return;

    const riverBottomY = 0.0;
    const maxRiverHeight = 1.6; // Max bank height

    const waterHeight = Math.max(0.08, Math.min(maxRiverHeight, fillRatio * maxRiverHeight));
    const waterCenterY = riverBottomY + waterHeight / 2;
    const waterSurfaceY = riverBottomY + waterHeight;

    // Interpolate width of water surface as river rises up sloped banks (from 1.8m to 3.2m)
    const currentWidth = 1.8 + (waterHeight / maxRiverHeight) * (3.2 - 1.8);

    // 1. Update Water Volume Mesh
    waterMeshRef.current.scale.set(currentWidth, waterHeight, 1);
    waterMeshRef.current.position.set(0, waterCenterY, 0);

    // 2. Update Water Surface Sheet
    waterSurfaceRef.current.scale.set(currentWidth, 1, 1);
    waterSurfaceRef.current.position.set(0, waterSurfaceY + 0.002, 0);

    // 3. Update Point F Marker
    pointFMeshRef.current.position.set(0, waterSurfaceY + 0.01, 1.2);

    // 4. Update Radar Beam Cone geometry scale & position
    const sensorOriginY = 1.37;
    const beamHeight = Math.max(0.05, sensorOriginY - waterSurfaceY);
    const beamCenterY = sensorOriginY - beamHeight / 2;
    const bottomRadius = Math.tan(THREE.MathUtils.degToRad(3)) * beamHeight * 2.5 + 0.12;

    beamConeRef.current.scale.set(bottomRadius, beamHeight, bottomRadius);
    beamConeRef.current.position.set(0, beamCenterY, 0);
  }, [activeLevelCm, installationHeightCm, fillRatio]);

  // Reset Camera angle
  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      cameraRef.current.position.set(3.8, 2.6, 4.6);
      controlsRef.current.target.set(0, 0.8, 0);
      controlsRef.current.update();
    }
  };

  return (
    <div className="space-y-3">
      {/* 3D Canvas Box */}
      <div className="relative w-full h-[380px] bg-sky-50 rounded-2xl border border-sky-200 overflow-hidden shadow-inner group">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Top Left Badge & Live Telemetry Overlay */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-slate-200 shadow-md text-xs space-y-1.5 pointer-events-none max-w-[230px]">
          <div>
            <div className="flex items-center gap-1.5 font-bold text-blue-700">
              <Waves className="w-4 h-4 text-blue-600 animate-pulse shrink-0" />
              <span className="truncate">{riverName}</span>
            </div>
            <p className="text-[10px] text-slate-500 font-medium truncate">{locationName}</p>
          </div>
          <div className="font-mono text-[11px] text-slate-700 space-y-1 pt-1 border-t border-slate-100">
            <div className="flex justify-between gap-3 bg-blue-50 p-1.5 rounded-lg border border-blue-100">
              <span className="text-slate-600 font-medium">Nivel Río:</span>
              <strong className="text-blue-700 font-bold">{activeLevelCm.toFixed(1)} cm</strong>
            </div>
            <div className="flex justify-between gap-3 bg-emerald-50 p-1.5 rounded-lg border border-emerald-100">
              <span className="text-slate-600 font-medium">Caudal (Q):</span>
              <strong className="text-emerald-700 font-bold">{(activeLevelCm * 2.5).toFixed(1)} L/s</strong>
            </div>
            <div className="flex justify-between gap-3 px-1 text-[10px]">
              <span className="text-slate-500">Coordenadas:</span>
              <strong className="text-slate-700 font-semibold">{coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}</strong>
            </div>
            <div className="flex justify-between gap-3 px-1 text-[10px]">
              <span className="text-slate-500">Dist. Vacío (OF):</span>
              <strong className="text-purple-700 font-bold">{emptyHeightCm.toFixed(1)} cm</strong>
            </div>
          </div>
        </div>

        {/* Top Right Controls Overlay */}
        <div className="absolute top-3 right-3 flex items-center gap-2">
          <button
            onClick={handleResetCamera}
            className="flex items-center gap-1.5 bg-white/95 hover:bg-white text-slate-700 text-xs font-semibold px-3 py-1.5 rounded-xl border border-slate-200 shadow-sm transition-all"
            title="Restablecer Vista 3D"
          >
            <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
            <span>Centrar Vista</span>
          </button>
        </div>

        {/* Bottom Left Key Points Legend Overlay */}
        {showKeyPoints && (
          <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-200 shadow-sm text-[11px] font-semibold flex items-center gap-3 text-slate-700 pointer-events-none">
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
              <span>O: Sensor Telemétrico</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span>F: Espejo de Agua</span>
            </div>
            <div className="flex items-center gap-1 text-sky-700 font-bold ml-1">
              <span>Ángulo de Emisión Radar</span>
            </div>
          </div>
        )}

        {/* Hint Overlay */}
        <div className="absolute bottom-3 right-3 bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-medium px-2.5 py-1 rounded-lg pointer-events-none flex items-center gap-1 opacity-80">
          <Maximize2 className="w-3 h-3 text-sky-400" />
          <span>Arrastre para rotar 3D &bull; Zoom</span>
        </div>
      </div>

      {/* Interactive Level Simulation Widget */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-blue-600" />
            <h4 className="text-xs font-bold text-slate-900">Simulación interactiva de Crecida / Nivel de Río</h4>
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => {
                setIsSimulating(false);
                setSimulatedLevelCm(currentRawLevelCm);
              }}
              className={`px-3 py-1 rounded-lg transition-all ${
                !isSimulating
                  ? 'bg-blue-600 text-white font-bold shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Telemetría en Tiempo Real
            </button>
            <button
              onClick={() => setIsSimulating(true)}
              className={`px-3 py-1 rounded-lg transition-all ${
                isSimulating
                  ? 'bg-amber-500 text-white font-bold shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Modo Simulación
            </button>
          </div>
        </div>

        {/* Slider & Presets */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="text-slate-600 font-medium">Ajustar Nivel Simulado (cm):</span>
            <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-100">
              {simulatedLevelCm.toFixed(1)} cm ({((simulatedLevelCm / installationHeightCm) * 100).toFixed(0)}%)
            </span>
          </div>

          <input
            type="range"
            min="5"
            max={installationHeightCm}
            step="0.5"
            value={simulatedLevelCm}
            onChange={(e) => {
              setIsSimulating(true);
              setSimulatedLevelCm(Number(e.target.value));
            }}
            className="w-full accent-blue-600 cursor-pointer h-2 bg-slate-200 rounded-lg"
          />

          {/* Quick Presets Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-semibold pt-1">
            <button
              onClick={() => {
                setIsSimulating(true);
                setSimulatedLevelCm(15);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-all text-center"
            >
              💧 Caudal Bajo (15 cm)
            </button>
            <button
              onClick={() => {
                setIsSimulating(true);
                setSimulatedLevelCm(45);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-blue-50 hover:text-blue-700 text-slate-700 border border-slate-200 transition-all text-center"
            >
              🌊 Nivel Normal (45 cm)
            </button>
            <button
              onClick={() => {
                setIsSimulating(true);
                setSimulatedLevelCm(75);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 transition-all text-center"
            >
              ⚠️ Alerta Crecida (75 cm)
            </button>
            <button
              onClick={() => {
                setIsSimulating(true);
                setSimulatedLevelCm(95);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-800 border border-red-200 transition-all text-center"
            >
              🚨 Inundación Crítica (95 cm)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

