import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, RotateCcw, Sparkles, Sliders, Play, Pause, RefreshCw, AlertTriangle, Waves } from 'lucide-react';

// Channel cross-section geometry: a trapezoid that widens with height,
// matching the bank meshes' own slope below. Shared as module constants
// (not per-effect locals) so the water geometry — rebuilt in a separate
// effect whenever the level changes — can never drift from the banks it
// needs to stay inside.
const RIVER_LENGTH = 6.0;
const RIVER_BOTTOM_Y = 0.0;
const BANK_TOP_Y = 1.6;
const BOTTOM_WIDTH = 1.8;
const TOP_WIDTH = 3.2;

/**
 * The water body as a trapezoidal prism tapering from BOTTOM_WIDTH at its
 * base to whatever width the channel actually is at `waterHeight` — the same
 * slope the banks use — instead of a uniform-width box. A box's straight
 * vertical sides would sit wider than the channel near the bed (since the
 * banks are narrower there) and narrower than it higher up, so the water
 * would visibly cut through the grass bank at any level above the lowest.
 */
function buildChannelWaterGeometry(waterHeight: number): THREE.ExtrudeGeometry {
  const clampedHeight = Math.min(Math.max(waterHeight, 0.01), BANK_TOP_Y);
  const widthAtHeight = BOTTOM_WIDTH + (clampedHeight / BANK_TOP_Y) * (TOP_WIDTH - BOTTOM_WIDTH);

  const shape = new THREE.Shape();
  shape.moveTo(-BOTTOM_WIDTH / 2, 0);
  shape.lineTo(BOTTOM_WIDTH / 2, 0);
  shape.lineTo(widthAtHeight / 2, clampedHeight);
  shape.lineTo(-widthAtHeight / 2, clampedHeight);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: RIVER_LENGTH, bevelEnabled: false });
  geometry.translate(0, 0, -RIVER_LENGTH / 2);
  return geometry;
}

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
    const riverLength = RIVER_LENGTH;
    const riverBottomY = RIVER_BOTTOM_Y;
    const bankTopY = BANK_TOP_Y;
    const bottomWidth = BOTTOM_WIDTH;
    const topWidth = TOP_WIDTH;

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

    const waterMesh = new THREE.Mesh(buildChannelWaterGeometry(0.08), waterMat);
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
          const waterY = waterSurfaceRef.current ? waterSurfaceRef.current.position.y : 0.5;
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

    const waterHeight = Math.max(0.08, Math.min(BANK_TOP_Y, fillRatio * BANK_TOP_Y));
    const waterSurfaceY = RIVER_BOTTOM_Y + waterHeight;

    // Interpolate width of the water's own top edge as it rises up the sloped
    // banks (from BOTTOM_WIDTH to TOP_WIDTH) — used for the surface sheet below;
    // the water volume itself is rebuilt to the same slope, not scaled.
    const currentWidth = BOTTOM_WIDTH + (waterHeight / BANK_TOP_Y) * (TOP_WIDTH - BOTTOM_WIDTH);

    // 1. Rebuild the water volume to the channel's exact slope at this height
    //    (see buildChannelWaterGeometry) instead of scaling a uniform-width
    //    box, which would poke past the bank's grass lower down and leave a
    //    gap higher up — the "water spilling past the channel" look.
    const previousWaterGeometry = waterMeshRef.current.geometry;
    waterMeshRef.current.geometry = buildChannelWaterGeometry(waterHeight);
    previousWaterGeometry.dispose();

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
      {/* 3D canvas */}
      <div className="relative w-full h-[340px] bg-[#f2f5f7] rounded-md border border-hairline overflow-hidden">
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Live values for the rendered scene */}
        <div className="absolute top-2.5 left-2.5 bg-surface/95 border border-hairline rounded-md px-3 py-2 pointer-events-none max-w-[210px]">
          <div className="text-[11px] font-semibold text-ink truncate">{riverName}</div>
          <div className="text-[10px] text-ink-3 truncate">{locationName}</div>
          <dl className="mt-2 pt-2 border-t border-hairline space-y-1 text-[11px] tabular-nums">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Nivel</dt>
              <dd className="text-ink font-semibold">
                {activeLevelCm.toFixed(1)} {levelUnit}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Vacío (OF)</dt>
              <dd className="text-ink-2">{emptyHeightCm.toFixed(1)} cm</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Coord.</dt>
              <dd className="text-ink-2">
                {coordinates.lat.toFixed(4)}, {coordinates.lng.toFixed(4)}
              </dd>
            </div>
          </dl>
        </div>

        <button
          type="button"
          onClick={handleResetCamera}
          className="absolute top-2.5 right-2.5 flex items-center gap-1.5 bg-surface/95 border border-hairline rounded-md px-2.5 py-1.5 text-[11px] text-ink-2 hover:text-ink"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Centrar vista
        </button>

        {showKeyPoints && (
          <div className="absolute bottom-2.5 left-2.5 bg-surface/95 border border-hairline rounded-md px-2.5 py-1.5 flex items-center gap-3 text-[10px] text-ink-2 pointer-events-none">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-crit" aria-hidden="true" />O · sensor
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-level" aria-hidden="true" />F · espejo de agua
            </span>
          </div>
        )}

        <div className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[10px] text-ink-3 bg-surface/90 border border-hairline rounded-md px-2 py-1 pointer-events-none">
          <Maximize2 className="w-3 h-3" aria-hidden="true" />
          Arrastre para rotar
        </div>
      </div>

      {/* What-if slider. Clearly separated from the measured value. */}
      <div className="border border-hairline rounded-md p-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h4 className="text-[12px] font-semibold text-ink">Simulación de crecida</h4>
            <p className="text-[10px] text-ink-3 mt-0.5">
              Solo afecta a esta vista 3D; no altera los datos medidos.
            </p>
          </div>

          <div className="flex items-center border border-hairline rounded-md overflow-hidden text-[11px]">
            <button
              type="button"
              onClick={() => {
                setIsSimulating(false);
                setSimulatedLevelCm(currentRawLevelCm);
              }}
              aria-pressed={!isSimulating}
              className={`px-2.5 py-1.5 ${!isSimulating ? 'bg-ink text-white' : 'text-ink-2 hover:bg-[#f7f7f5]'}`}
            >
              Medido
            </button>
            <button
              type="button"
              onClick={() => setIsSimulating(true)}
              aria-pressed={isSimulating}
              className={`px-2.5 py-1.5 ${isSimulating ? 'bg-ink text-white' : 'text-ink-2 hover:bg-[#f7f7f5]'}`}
            >
              Simulado
            </button>
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center justify-between text-[11px] mb-1.5">
            <label htmlFor="sim-level" className="text-ink-2">
              Nivel simulado
            </label>
            <span className="text-ink font-semibold tabular-nums">
              {simulatedLevelCm.toFixed(1)} cm ·{' '}
              {((simulatedLevelCm / installationHeightCm) * 100).toFixed(0)}%
            </span>
          </div>

          <input
            id="sim-level"
            type="range"
            min="5"
            max={installationHeightCm}
            step="0.5"
            value={simulatedLevelCm}
            onChange={(e) => {
              setIsSimulating(true);
              setSimulatedLevelCm(Number(e.target.value));
            }}
            className="w-full accent-ink h-1 cursor-pointer"
          />

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-[11px]">
            {[
              { label: 'Caudal bajo', cm: 15 },
              { label: 'Nivel normal', cm: 45 },
              { label: 'Crecida', cm: 75 },
              { label: 'Inundación', cm: 95 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() => {
                  setIsSimulating(true);
                  setSimulatedLevelCm(preset.cm);
                }}
                className="px-2 py-1.5 rounded-md border border-hairline text-ink-2 hover:text-ink hover:bg-[#f7f7f5]"
              >
                {preset.label}
                <span className="block text-[10px] text-ink-3 tabular-nums">{preset.cm} cm</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

