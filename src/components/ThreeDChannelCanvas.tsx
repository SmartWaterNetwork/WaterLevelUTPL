import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Maximize2, RotateCcw } from 'lucide-react';
import { CrossSectionPoint, waterCrossSectionPoints } from '../utils/crossSection';

/** Used only if a station has no cross-section on record — a generic,
 *  gently sloped placeholder so the view still renders something sane. */
const FALLBACK_CROSS_SECTION: CrossSectionPoint[] = [
  [-20, 2.4], [-10, 1.2], [-3, 0.3], [0, 0], [3, 0.3], [10, 1.2], [20, 2.4],
];

// Real channels here are a metre or two deep across 25–30 m of width per
// side — at true 1:1 scale that reads as an almost flat line. The height
// axis is deliberately scaled up relative to the width axis (~4x) so the
// shape stays legible, the same convention cross-section plots in HEC-RAS
// and similar tools use for the same reason — it's disclosed in the UI
// rather than left implicit.
const HORIZONTAL_SCALE = 0.09;
const VERTICAL_SCALE = 0.38;
const VERTICAL_EXAGGERATION = VERTICAL_SCALE / HORIZONTAL_SCALE;

const RIVER_LENGTH = 6.0;
/** Purely visual thickness under the lowest surveyed point, so the terrain
 *  extrudes into a solid block instead of a paper-thin surface. */
const FLOOR_Y = -0.4;

function terrainMaxHeightM(crossSection: CrossSectionPoint[]): number {
  return Math.max(...crossSection.map(([, h]) => h));
}

function terrainHalfWidthM(crossSection: CrossSectionPoint[]): number {
  return Math.max(...crossSection.map(([x]) => Math.abs(x)));
}

/** The real channel shape as a solid block: the surveyed profile on top,
 *  closed off with a flat floor below the invert. */
function buildTerrainGeometry(crossSection: CrossSectionPoint[]): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  const [x0] = crossSection[0];
  shape.moveTo(x0 * HORIZONTAL_SCALE, FLOOR_Y);
  crossSection.forEach(([x, h]) => shape.lineTo(x * HORIZONTAL_SCALE, h * VERTICAL_SCALE));
  const [xLast] = crossSection[crossSection.length - 1];
  shape.lineTo(xLast * HORIZONTAL_SCALE, FLOOR_Y);
  shape.closePath();

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: RIVER_LENGTH, bevelEnabled: false });
  geometry.translate(0, 0, -RIVER_LENGTH / 2);
  return geometry;
}

function buildChannelWaterGeometry(crossSection: CrossSectionPoint[], waterHeightM: number): THREE.ExtrudeGeometry {
  const pts = waterCrossSectionPoints(crossSection, waterHeightM);
  const shape = new THREE.Shape();
  pts.forEach(([x, h], i) => {
    const sx = x * HORIZONTAL_SCALE;
    const sy = h * VERTICAL_SCALE;
    if (i === 0) shape.moveTo(sx, sy);
    else shape.lineTo(sx, sy);
  });
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
  /** Real surveyed cross-section for this station — see data/stationCrossSections.ts. */
  crossSection?: CrossSectionPoint[];
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
  crossSection = FALLBACK_CROSS_SECTION,
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
  /** Set once at scene setup from this station's real terrain — the level
   *  effect and the radar-pulse animation both need it and neither rebuilds
   *  the terrain, so it's cheaper to cache than to recompute every frame. */
  const sensorOriginYRef = useRef<number>(1.37);
  const resetTargetRef = useRef(new THREE.Vector3(0, 0.8, 0));

  // Calculations
  const emptyHeightCm = Math.max(0, installationHeightCm - activeLevelCm);
  const fillRatio = Math.min(1, Math.max(0, activeLevelCm / (installationHeightCm || 100)));

  // Setup Three.js outdoor river scene
  useEffect(() => {
    if (!containerRef.current) return;

    const width = containerRef.current.clientWidth || 600;
    const height = containerRef.current.clientHeight || 400;

    const halfWidth = terrainHalfWidthM(crossSection) * HORIZONTAL_SCALE;
    const terrainMaxY = terrainMaxHeightM(crossSection) * VERTICAL_SCALE;

    // 1. Scene setup with soft sky color and gentle fog
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#e0f2fe'); // Sky blue light background
    scene.fog = new THREE.FogExp2('#e0f2fe', 0.08);
    sceneRef.current = scene;

    // 2. Camera setup
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.set(3.8, terrainMaxY + 1.0, 4.6);
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
    const target = new THREE.Vector3(0, terrainMaxY * 0.45, 0);
    resetTargetRef.current = target;
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.target.copy(target);
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

    // 6. Real Channel Terrain (one solid block, following the DEM transect)
    const riverGroup = new THREE.Group();

    const grassMat = new THREE.MeshStandardMaterial({
      color: 0x4d7c0f, // Lush natural green grass
      roughness: 0.85,
    });
    const terrainMesh = new THREE.Mesh(buildTerrainGeometry(crossSection), grassMat);
    terrainMesh.receiveShadow = true;
    terrainMesh.castShadow = true;
    riverGroup.add(terrainMesh);

    // Add River Rocks along banks, spaced from the terrain's own real extent
    // rather than fixed coordinates that assumed the old generic width.
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
    const rockX = Math.max(0.4, halfWidth * 0.55);
    createRock(-rockX, 0.08, -1.5, 0.14);
    createRock(-rockX * 1.1, 0.22, 0.8, 0.18);
    createRock(rockX, 0.06, -0.4, 0.15);
    createRock(rockX * 1.2, 0.35, 1.2, 0.22);
    createRock(-rockX * 1.4, 0.5, 1.8, 0.25);
    createRock(rockX * 1.3, 0.45, -2.1, 0.2);

    scene.add(riverGroup);

    // 7. Cantilevered radar mount — anchored on one bank only, like the real
    //    installations at every station: a footing and post rooted in the
    //    bank, with a braced arm reaching out over the channel to the
    //    invert. Nothing spans to the far bank.
    const mountGroup = new THREE.Group();
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.4, metalness: 0.85 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.7 });

    const leftEdgeXM = crossSection[0][0];
    const leftEdgeHeightM = crossSection[0][1];
    const armY = terrainMaxY + 0.15;
    const postX = leftEdgeXM * HORIZONTAL_SCALE - 0.15;
    const postGroundY = leftEdgeHeightM * VERTICAL_SCALE;
    const postBaseY = postGroundY - 0.1; // footing set slightly into the bank, not perched on top
    const postHeight = armY - postBaseY;
    const armLength = Math.abs(postX); // reaches out to x=0, above the invert

    // Concrete footing set into the bank
    const footing = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.3, 0.45), concreteMat);
    footing.position.set(postX, postBaseY, 0);
    footing.castShadow = true;
    mountGroup.add(footing);

    // Vertical post rising from the footing to the arm
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.07, postHeight, 16), steelMat);
    post.position.set(postX, postBaseY + postHeight / 2, 0);
    post.castShadow = true;
    mountGroup.add(post);

    // Horizontal cantilever arm — the only thing crossing the water, held
    // up from one side only (see the brace below), never resting on the
    // far bank.
    const arm = new THREE.Mesh(new THREE.BoxGeometry(armLength, 0.1, 0.12), steelMat);
    arm.position.set(postX + armLength / 2, armY, 0);
    arm.castShadow = true;
    mountGroup.add(arm);

    // Diagonal brace so the arm reads as structurally supported, not
    // floating unsupported over the channel.
    const braceStart = new THREE.Vector3(postX, armY - 0.4, 0);
    const braceEnd = new THREE.Vector3(postX + armLength * 0.45, armY - 0.02, 0);
    const braceVec = new THREE.Vector3().subVectors(braceEnd, braceStart);
    const brace = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, braceVec.length(), 12), steelMat);
    brace.position.copy(braceStart).addScaledVector(braceVec, 0.5);
    brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), braceVec.clone().normalize());
    brace.castShadow = true;
    mountGroup.add(brace);

    scene.add(mountGroup);

    // 8. FMCW Radar 80GHz Sensor Housing — hung from the end of the cantilever arm
    const sensorGroup = new THREE.Group();
    const sensorY = armY + 0.1;
    sensorGroup.position.set(0, sensorY, 0);
    sensorOriginYRef.current = sensorY - 0.48; // matches the lens/origin marker's local offset below

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

    const waterMesh = new THREE.Mesh(buildChannelWaterGeometry(crossSection, 0.05), waterMat);
    waterMeshRef.current = waterMesh;
    waterGroup.add(waterMesh);

    // Animated River Surface Mesh with Vertices for Wave Motion
    const surfaceGeo = new THREE.PlaneGeometry(1, RIVER_LENGTH, 32, 48);
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

          const topY = sensorOriginYRef.current;
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
    // crossSection is only ever swapped by remounting the component (see the
    // `key={station.config.id}` on the call site in SensorSchematic) — a
    // scene built for one station's terrain has no sane way to morph into
    // another's, so this effect intentionally doesn't react to it changing
    // in place.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dynamically update river water height & radar beam when level changes
  useEffect(() => {
    if (!waterMeshRef.current || !waterSurfaceRef.current || !beamConeRef.current || !pointFMeshRef.current) return;

    const terrainMaxM = terrainMaxHeightM(crossSection);
    // Real depth from the sensor reading, clamped just under the modelled
    // terrain so a misconfigured installation height can't poke the water
    // through the bank.
    const waterHeightM = Math.max(0.03, Math.min(activeLevelCm / 100, terrainMaxM - 0.05));
    const waterSurfaceY = waterHeightM * VERTICAL_SCALE;

    // 1. Rebuild the water volume to the real channel's exact shape at this
    //    height (see buildChannelWaterGeometry) instead of a placeholder
    //    slope, so it always meets the true bank instead of poking through
    //    it lower down or leaving a gap higher up.
    const previousWaterGeometry = waterMeshRef.current.geometry;
    waterMeshRef.current.geometry = buildChannelWaterGeometry(crossSection, waterHeightM);
    previousWaterGeometry.dispose();

    // 2. Update Water Surface Sheet — width from where the real profile
    //    crosses this height on each bank.
    const crossing = waterCrossSectionPoints(crossSection, waterHeightM);
    const xs = crossing.map(([x]) => x);
    const currentWidth = (Math.max(...xs) - Math.min(...xs)) * HORIZONTAL_SCALE;
    waterSurfaceRef.current.scale.set(Math.max(0.05, currentWidth), 1, 1);
    waterSurfaceRef.current.position.set(0, waterSurfaceY + 0.002, 0);

    // 3. Update Point F Marker
    pointFMeshRef.current.position.set(0, waterSurfaceY + 0.01, 1.2);

    // 4. Update Radar Beam Cone geometry scale & position
    const sensorOriginY = sensorOriginYRef.current;
    const beamHeight = Math.max(0.05, sensorOriginY - waterSurfaceY);
    const beamCenterY = sensorOriginY - beamHeight / 2;
    const bottomRadius = Math.tan(THREE.MathUtils.degToRad(3)) * beamHeight * 2.5 + 0.12;

    beamConeRef.current.scale.set(bottomRadius, beamHeight, bottomRadius);
    beamConeRef.current.position.set(0, beamCenterY, 0);
  }, [activeLevelCm, crossSection]);

  // Reset Camera angle
  const handleResetCamera = () => {
    if (controlsRef.current && cameraRef.current) {
      const targetY = resetTargetRef.current.y;
      cameraRef.current.position.set(3.8, targetY + 1.0, 4.6);
      controlsRef.current.target.set(0, targetY, 0);
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
          <div className="text-[9px] text-ink-3 mt-1">
            Corte real del DEM · exageración vertical ≈{VERTICAL_EXAGGERATION.toFixed(1)}×
          </div>
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
              className={`px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${!isSimulating ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'}`}
            >
              Medido
            </button>
            <button
              type="button"
              onClick={() => setIsSimulating(true)}
              aria-pressed={isSimulating}
              className={`px-2.5 py-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 ${isSimulating ? 'bg-ink text-white' : 'text-ink-2 hover:bg-hover'}`}
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
                className="px-2 py-1.5 rounded-md border border-hairline text-ink-2 hover:text-ink hover:bg-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
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
