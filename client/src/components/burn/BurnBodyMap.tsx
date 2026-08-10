import { Component, Suspense, useEffect, useMemo, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { Canvas, useLoader, useThree, type ThreeEvent } from "@react-three/fiber";
import { ContactShadows, Environment, Html, Lightformer, OrbitControls } from "@react-three/drei";
import {
  ACESFilmicToneMapping,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DoubleSide,
  Group,
  LinearFilter,
  Mesh,
  MeshPhysicalMaterial,
  PCFSoftShadowMap,
  RepeatWrapping,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  TextureLoader,
  Triangle,
  UnsignedByteType,
  Vector2,
  Vector3,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import { Expand, Rotate3D, ScanSearch, View } from "lucide-react";
import {
  ageBandIndex,
  type BurnDepth,
  type BurnRegionId,
  type BurnRegionInput,
  type BurnSurface,
} from "../../../../shared/burn-coding";

const ADULT_MODEL_PATH = "/models/lund-browder-athletic-male.obj";
const PEDIATRIC_CHILD_MODEL_PATH = "/models/lund-browder-pediatric-child.obj";
const PEDIATRIC_INFANT_MODEL_PATH = "/models/lund-browder-pediatric-infant.obj";
const SKIN_TEXTURE_PATH = "/models/lund-browder-male-skin.png";
const MAX_HIGHLIGHTS = 36;
const DEPTH_COLORS: Record<BurnDepth, string> = { 1: "#f6b94a", 2: "#f36c45", 3: "#9b2c2c" };
const AGE_BANDS = ["Under 1 year", "1–4 years", "5–9 years", "10–14 years", "15–17 years", "Adult (18+ years)"];

const REGION_CODE: Record<BurnRegionId, number> = {
  head: 1,
  neck: 2,
  anterior_trunk: 3,
  posterior_trunk: 4,
  right_buttock: 5,
  left_buttock: 6,
  right_upper_arm: 7,
  left_upper_arm: 8,
  right_lower_arm: 9,
  left_lower_arm: 10,
  right_hand: 11,
  left_hand: 12,
  right_thigh: 13,
  left_thigh: 14,
  right_leg: 15,
  left_leg: 16,
  right_foot: 17,
  left_foot: 18,
  perineum: 19,
};

const REGION_Y_BOUNDS: Record<BurnRegionId, [number, number]> = {
  head: [6.82, 9.35], neck: [6.12, 6.82], anterior_trunk: [1.65, 6.12], posterior_trunk: [2.02, 6.12],
  right_buttock: [1.15, 2.02], left_buttock: [1.15, 2.02], right_upper_arm: [3.9, 5.95], left_upper_arm: [3.9, 5.95],
  right_lower_arm: [2.45, 3.9], left_lower_arm: [2.45, 3.9], right_hand: [0.8, 2.75], left_hand: [0.8, 2.75],
  right_thigh: [-3.09, 1.17], left_thigh: [-3.09, 1.17], right_leg: [-7.35, -3.09], left_leg: [-7.35, -3.09],
  right_foot: [-8.25, -7.35], left_foot: [-8.25, -7.35], perineum: [1.15, 1.65],
};

export function burnMapSelectionKey(regionId: BurnRegionId, surface: BurnSurface) {
  return `${regionId}:${surface}`;
}

function surfacePivotZ(x: number, y: number) {
  if (Math.abs(x) >= 4.45 && y < 2.75) return 2.05;
  if (y >= 6.12) return 0.5;
  if (y >= 1.15) return 0.24;
  if (y <= -7.35) return Math.min(1.22, 0.3 + (-7.35 - y) * 1.05);
  return 0.08;
}

/** Resolve the true clicked mesh point to one Lund–Browder region and surface. */
export function resolveBurnModelPoint(point: [number, number, number], viewerZ = point[2]): { regionId: BurnRegionId; surface: BurnSurface } {
  const [x, y, z] = point;
  const absX = Math.abs(x);
  const pivot = surfacePivotZ(x, y);
  const surface: BurnSurface = Math.abs(z - pivot) < 0.12
    ? (viewerZ >= pivot ? "anterior" : "posterior")
    : (z >= pivot ? "anterior" : "posterior");
  const right = x < 0;

  if (y >= 6.82) return { regionId: "head", surface };
  if (y >= 6.12) return { regionId: "neck", surface };
  if (y >= 3.9 && absX >= 1.72) return { regionId: right ? "right_upper_arm" : "left_upper_arm", surface };
  if (y >= 0.8 && y < 2.75 && absX >= 4.45) return { regionId: right ? "right_hand" : "left_hand", surface };
  if (y >= 2.45 && absX >= 3.05) return { regionId: right ? "right_lower_arm" : "left_lower_arm", surface };
  if (y <= -7.35) return { regionId: right ? "right_foot" : "left_foot", surface };
  if (y <= -3.09) return { regionId: right ? "right_leg" : "left_leg", surface };
  if (y <= 1.17) return { regionId: right ? "right_thigh" : "left_thigh", surface };
  if (surface === "posterior" && y < 2.02) return { regionId: right ? "right_buttock" : "left_buttock", surface };
  if (surface === "anterior" && y < 1.65 && absX < 0.86) return { regionId: "perineum", surface };
  return { regionId: surface === "anterior" ? "anterior_trunk" : "posterior_trunk", surface };
}

export function burnModelFillTop(percentBurned: number) {
  return -1 + 2 * Math.max(0, Math.min(100, percentBurned)) / 100;
}

export function burnModelKindForAge(age: number): "adult" | "pediatric" {
  const safeAge = Number.isFinite(age) ? Math.max(0, age) : 0;
  return safeAge < 18 ? "pediatric" : "adult";
}

export function pediatricModelBlend(age: number) {
  const safeAge = Math.max(0, Math.min(18, Number.isFinite(age) ? age : 18));
  if (safeAge >= 18) return { infant: 0, child: 0, adult: 1 };
  if (safeAge <= 5) {
    const child = safeAge / 5;
    return { infant: 1 - child, child, adult: 0 };
  }
  if (safeAge <= 13) return { infant: 0, child: 1, adult: 0 };
  const adult = (safeAge - 13) / 5;
  return { infant: 0, child: 1 - adult, adult };
}

type DetailTextureKind = "skin" | "fabric";

function materialNoise(x: number, y: number) {
  const value = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
  return value - Math.floor(value);
}

/** Small GPU-friendly PBR maps add pores and fabric weave without another network asset. */
function createMaterialDetailMaps(kind: DetailTextureKind) {
  const size = 192;
  const normalPixels = new Uint8Array(size * size * 4);
  const roughnessPixels = new Uint8Array(size * size * 4);
  const heightAt = (x: number, y: number) => {
    const wrappedX = (x + size) % size;
    const wrappedY = (y + size) % size;
    if (kind === "fabric") {
      const warp = Math.sin(wrappedX * Math.PI / 3) * 0.42;
      const weft = Math.sin(wrappedY * Math.PI / 3) * 0.42;
      return warp + weft + (materialNoise(wrappedX, wrappedY) - 0.5) * 0.12;
    }
    const pore = materialNoise(Math.floor(wrappedX / 2), Math.floor(wrappedY / 2));
    const fine = materialNoise(wrappedX, wrappedY);
    return (pore > 0.82 ? -0.72 : pore * 0.13) + (fine - 0.5) * 0.08;
  };

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const strength = kind === "fabric" ? 1.45 : 0.48;
      const dx = (heightAt(x + 1, y) - heightAt(x - 1, y)) * strength;
      const dy = (heightAt(x, y + 1) - heightAt(x, y - 1)) * strength;
      const normal = new Vector3(-dx, -dy, 2).normalize();
      const offset = (y * size + x) * 4;
      normalPixels[offset] = Math.round((normal.x * 0.5 + 0.5) * 255);
      normalPixels[offset + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      normalPixels[offset + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      normalPixels[offset + 3] = 255;
      const variation = materialNoise(x + 311, y + 719) - 0.5;
      const roughness = Math.round(Math.max(0, Math.min(255, (kind === "fabric" ? 196 : 145) + variation * (kind === "fabric" ? 22 : 18))));
      roughnessPixels[offset] = roughness;
      roughnessPixels[offset + 1] = roughness;
      roughnessPixels[offset + 2] = roughness;
      roughnessPixels[offset + 3] = 255;
    }
  }

  const normalMap = new DataTexture(normalPixels, size, size, RGBAFormat, UnsignedByteType);
  const roughnessMap = new DataTexture(roughnessPixels, size, size, RGBAFormat, UnsignedByteType);
  for (const texture of [normalMap, roughnessMap]) {
    texture.wrapS = RepeatWrapping;
    texture.wrapT = RepeatWrapping;
    texture.minFilter = LinearFilter;
    texture.magFilter = LinearFilter;
    texture.repeat.set(kind === "fabric" ? 42 : 28, kind === "fabric" ? 42 : 28);
    texture.needsUpdate = true;
  }
  return { normalMap, roughnessMap };
}

/** The fitted boxer brief envelope, expressed in the original adult model space. */
export function isClinicalGarmentPoint(point: [number, number, number]) {
  const [x, y] = point;
  const absX = Math.abs(x);
  if (y > 2.08 || absX > 2.05) return false;
  const hemProgress = Math.max(0, Math.min(1, (absX - 0.54) / (1.16 - 0.54)));
  const smoothHemProgress = hemProgress * hemProgress * (3 - 2 * hemProgress);
  const lowerHem = 0.18 + (-0.16 - 0.18) * smoothHemProgress;
  return y >= lowerHem;
}

function createFittedGarmentHitGeometry(bodyGeometry: BufferGeometry) {
  const garment = bodyGeometry.clone();
  const sourceIndex = bodyGeometry.getIndex();
  const original = bodyGeometry.getAttribute("originalPosition") as BufferAttribute;
  const position = garment.getAttribute("position") as BufferAttribute;
  const normal = garment.getAttribute("normal") as BufferAttribute;
  const keptIndices: number[] = [];
  const triangleCount = sourceIndex ? sourceIndex.count / 3 : original.count / 3;

  for (let triangleIndex = 0; triangleIndex < triangleCount; triangleIndex += 1) {
    const a = sourceIndex ? sourceIndex.getX(triangleIndex * 3) : triangleIndex * 3;
    const b = sourceIndex ? sourceIndex.getX(triangleIndex * 3 + 1) : triangleIndex * 3 + 1;
    const c = sourceIndex ? sourceIndex.getX(triangleIndex * 3 + 2) : triangleIndex * 3 + 2;
    const centroid: [number, number, number] = [
      (original.getX(a) + original.getX(b) + original.getX(c)) / 3,
      (original.getY(a) + original.getY(b) + original.getY(c)) / 3,
      (original.getZ(a) + original.getZ(b) + original.getZ(c)) / 3,
    ];
    if (isClinicalGarmentPoint(centroid)) keptIndices.push(a, b, c);
  }

  garment.setIndex(keptIndices);
  garment.computeBoundingBox();
  garment.computeBoundingSphere();
  return garment;
}

function createExpandedBodyShell(bodyGeometry: BufferGeometry, shellOffset: number) {
  const garment = bodyGeometry.clone();
  const position = garment.getAttribute("position") as BufferAttribute;
  const normal = garment.getAttribute("normal") as BufferAttribute;
  for (let index = 0; index < position.count; index += 1) {
    position.setXYZ(
      index,
      position.getX(index) + normal.getX(index) * shellOffset,
      position.getY(index) + normal.getY(index) * shellOffset,
      position.getZ(index) + normal.getZ(index) * shellOffset,
    );
  }
  position.needsUpdate = true;
  garment.computeBoundingBox();
  garment.computeBoundingSphere();
  return garment;
}

function createGarmentMaterial(
  section: "brief" | "waistband",
  maps: ReturnType<typeof createMaterialDetailMaps>,
  selected: boolean,
) {
  const waistband = section === "waistband";
  const material = new MeshPhysicalMaterial({
    color: waistband ? "#102d55" : "#071d3b",
    emissive: selected ? "#153f78" : "#020817",
    emissiveIntensity: selected ? 0.2 : 0.025,
    normalMap: maps.normalMap,
    normalScale: new Vector2(waistband ? 0.12 : 0.2, waistband ? 0.12 : 0.2),
    roughness: waistband ? 0.72 : 0.9,
    roughnessMap: maps.roughnessMap,
    metalness: 0,
    sheen: waistband ? 0.84 : 0.66,
    sheenColor: new Color(waistband ? "#52739a" : "#31577f"),
    sheenRoughness: waistband ? 0.62 : 0.78,
    clearcoat: 0.025,
    side: DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: waistband ? -2 : -1,
  });
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec3 originalPosition;\nvarying vec3 vGarmentPosition;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGarmentPosition = originalPosition;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", `#include <common>
        varying vec3 vGarmentPosition;
        bool insideClinicalGarment(vec3 p) {
          float ax = abs(p.x);
          float lowerHem = mix(0.18, -0.16, smoothstep(0.54, 1.16, ax));
          bool insideBrief = p.y <= 2.08 && p.y >= lowerHem && ax <= 2.05;
          ${waistband ? "return insideBrief && p.y >= 1.86;" : "return insideBrief;"}
        }
      `)
      .replace("#include <clipping_planes_fragment>", "#include <clipping_planes_fragment>\nif (!insideClinicalGarment(vGarmentPosition)) discard;");
  };
  material.customProgramCacheKey = () => `codical-clinical-garment-${section}-v2`;
  return material;
}

function createHighlightMaterial(regions: BurnRegionInput[], clipToGarment = false) {
  const codes = new Float32Array(MAX_HIGHLIGHTS);
  const surfaces = new Float32Array(MAX_HIGHLIGHTS);
  const percentages = new Float32Array(MAX_HIGHLIGHTS);
  const yBounds = Array.from({ length: MAX_HIGHLIGHTS }, () => new Vector2(0, 1));
  const colors = Array.from({ length: MAX_HIGHLIGHTS }, () => new Color("#000000"));
  let count = 0;

  for (const entry of regions) {
    if (entry.percentBurned <= 0) continue;
    const bounds = REGION_Y_BOUNDS[entry.regionId];
    const entrySurfaces = entry.surface === "circumferential" ? [1, -1] : [entry.surface === "posterior" ? -1 : 1];
    for (const surface of entrySurfaces) {
      if (count >= MAX_HIGHLIGHTS) break;
      codes[count] = REGION_CODE[entry.regionId];
      surfaces[count] = surface;
      percentages[count] = Math.max(0, Math.min(1, entry.percentBurned / 100));
      yBounds[count].set(bounds[0], bounds[1]);
      colors[count].set(DEPTH_COLORS[entry.burnDepth]);
      count += 1;
    }
  }

  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    uniforms: {
      uCount: { value: count },
      uCodes: { value: codes },
      uSurfaces: { value: surfaces },
      uPercentages: { value: percentages },
      uYBounds: { value: yBounds },
      uColors: { value: colors },
    },
    vertexShader: `
      attribute vec3 originalPosition;
      varying vec3 vOriginalPosition;
      void main() {
        vOriginalPosition = originalPosition;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      #define MAX_HIGHLIGHTS ${MAX_HIGHLIGHTS}
      uniform int uCount;
      uniform float uCodes[MAX_HIGHLIGHTS];
      uniform float uSurfaces[MAX_HIGHLIGHTS];
      uniform float uPercentages[MAX_HIGHLIGHTS];
      uniform vec2 uYBounds[MAX_HIGHLIGHTS];
      uniform vec3 uColors[MAX_HIGHLIGHTS];
      varying vec3 vOriginalPosition;

      float pivotZ(vec3 p) {
        if (abs(p.x) >= 4.45 && p.y < 2.75) return 2.05;
        if (p.y >= 6.12) return 0.5;
        if (p.y >= 1.15) return 0.24;
        if (p.y <= -7.35) return min(1.22, 0.3 + (-7.35 - p.y) * 1.05);
        return 0.08;
      }
      float surfaceAt(vec3 p) { return p.z >= pivotZ(p) ? 1.0 : -1.0; }
      bool insideClinicalGarment(vec3 p) {
        float ax = abs(p.x);
        float lowerHem = mix(0.18, -0.16, smoothstep(0.54, 1.16, ax));
        return p.y <= 2.08 && p.y >= lowerHem && ax <= 2.05;
      }
      float regionAt(vec3 p, float surface) {
        float ax = abs(p.x);
        float rightOffset = p.x < 0.0 ? 0.0 : 1.0;
        if (p.y >= 6.82) return 1.0;
        if (p.y >= 6.12) return 2.0;
        if (p.y >= 3.9 && ax >= 1.72) return 7.0 + rightOffset;
        if (p.y >= 0.8 && p.y < 2.75 && ax >= 4.45) return 11.0 + rightOffset;
        if (p.y >= 2.45 && ax >= 3.05) return 9.0 + rightOffset;
        if (p.y <= -7.35) return 17.0 + rightOffset;
        if (p.y <= -3.09) return 15.0 + rightOffset;
        if (p.y <= 1.17) return 13.0 + rightOffset;
        if (surface < 0.0 && p.y < 2.02) return 5.0 + rightOffset;
        if (surface > 0.0 && p.y < 1.65 && ax < 0.86) return 19.0;
        return surface > 0.0 ? 3.0 : 4.0;
      }
      void main() {
        ${clipToGarment ? "if (!insideClinicalGarment(vOriginalPosition)) discard;" : ""}
        float actualSurface = surfaceAt(vOriginalPosition);
        float actualRegion = regionAt(vOriginalPosition, actualSurface);
        vec3 finalColor = vec3(0.0);
        float matched = 0.0;
        for (int i = 0; i < MAX_HIGHLIGHTS; i++) {
          if (i >= uCount) break;
          float regionMatch = 1.0 - step(0.1, abs(actualRegion - uCodes[i]));
          float surfaceMatch = 1.0 - step(0.1, abs(actualSurface - uSurfaces[i]));
          float normalizedHeight = clamp((vOriginalPosition.y - uYBounds[i].x) / max(0.001, uYBounds[i].y - uYBounds[i].x), 0.0, 1.0);
          float fillMatch = step(normalizedHeight, uPercentages[i]);
          float hit = regionMatch * surfaceMatch * fillMatch;
          finalColor = mix(finalColor, uColors[i], hit);
          matched = max(matched, hit);
        }
        if (matched < 0.5) discard;
        gl_FragColor = vec4(mix(finalColor, vec3(1.0), 0.06), 0.86);
      }
    `,
  });
}

function LoaderCard() {
  return <Html center><div className="burn-model-loading"><ScanSearch size={18} /><span>Loading anatomical model…</span></div></Html>;
}

class ModelErrorBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error("3D Lund-Browder model failed to render", error, info); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

function CameraControls({ viewRequest }: { viewRequest: { side: "front" | "back"; nonce: number } }) {
  const controls = useRef<any>(null);
  const { camera } = useThree();
  useEffect(() => {
    camera.position.set(0, 0.45, viewRequest.side === "front" ? 29.25 : -29.25);
    camera.up.set(0, 1, 0);
    controls.current?.target.set(0, 0.45, 0.3);
    controls.current?.update();
  }, [camera, viewRequest]);
  return <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.075} rotateSpeed={0.72} minDistance={19} maxDistance={40} minPolarAngle={0.42} maxPolarAngle={2.72} target={[0, 0.45, 0.3]} />;
}

function originalPointFromEvent(event: ThreeEvent<PointerEvent>) {
  const mesh = event.object as Mesh;
  const geometry = mesh.geometry;
  const original = geometry.getAttribute("originalPosition") as BufferAttribute | undefined;
  const position = geometry.getAttribute("position") as BufferAttribute | undefined;
  if (!event.face || !original || !position) return event.point.clone();
  const localPoint = mesh.worldToLocal(event.point.clone());
  const a = new Vector3().fromBufferAttribute(position, event.face.a);
  const b = new Vector3().fromBufferAttribute(position, event.face.b);
  const c = new Vector3().fromBufferAttribute(position, event.face.c);
  const barycentric = Triangle.getBarycoord(localPoint, a, b, c, new Vector3());
  if (!barycentric) return event.point.clone();
  const originalA = new Vector3().fromBufferAttribute(original, event.face.a);
  const originalB = new Vector3().fromBufferAttribute(original, event.face.b);
  const originalC = new Vector3().fromBufferAttribute(original, event.face.c);
  return originalA.multiplyScalar(barycentric.x).add(originalB.multiplyScalar(barycentric.y)).add(originalC.multiplyScalar(barycentric.z));
}

function ClinicalUnderwear({ bodyGeometry, regions, onSelect }: { bodyGeometry: BufferGeometry; regions: BurnRegionInput[]; onSelect: (id: BurnRegionId, surface: BurnSurface) => void }) {
  const garmentGeometry = useMemo(() => createExpandedBodyShell(bodyGeometry, 0.048), [bodyGeometry]);
  const waistbandGeometry = useMemo(() => createExpandedBodyShell(bodyGeometry, 0.075), [bodyGeometry]);
  const hitGeometry = useMemo(() => createFittedGarmentHitGeometry(bodyGeometry), [bodyGeometry]);
  const fabricMaps = useMemo(() => createMaterialDetailMaps("fabric"), []);
  const coveredBurnSelected = regions.some((entry) => ["perineum", "right_buttock", "left_buttock"].includes(entry.regionId) && entry.percentBurned > 0);
  const garmentMaterial = useMemo(() => createGarmentMaterial("brief", fabricMaps, coveredBurnSelected), [coveredBurnSelected, fabricMaps]);
  const waistbandMaterial = useMemo(() => createGarmentMaterial("waistband", fabricMaps, coveredBurnSelected), [coveredBurnSelected, fabricMaps]);
  const garmentHighlightMaterial = useMemo(() => createHighlightMaterial(regions, true), [regions]);
  useEffect(() => () => {
    garmentGeometry.dispose();
    waistbandGeometry.dispose();
    hitGeometry.dispose();
    fabricMaps.normalMap.dispose();
    fabricMaps.roughnessMap.dispose();
  }, [fabricMaps, garmentGeometry, hitGeometry, waistbandGeometry]);
  useEffect(() => () => { garmentMaterial.dispose(); waistbandMaterial.dispose(); garmentHighlightMaterial.dispose(); }, [garmentHighlightMaterial, garmentMaterial, waistbandMaterial]);
  const selectCoveredRegion = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = originalPointFromEvent(event);
    const selection = resolveBurnModelPoint([point.x, point.y, point.z], event.ray.origin.z);
    onSelect(selection.regionId, selection.surface);
  };
  return <group>
    <mesh geometry={garmentGeometry} material={garmentMaterial} castShadow receiveShadow renderOrder={2} raycast={() => undefined} />
    <mesh geometry={waistbandGeometry} material={waistbandMaterial} castShadow renderOrder={3} raycast={() => undefined} />
    <mesh geometry={garmentGeometry} material={garmentHighlightMaterial} renderOrder={6} raycast={() => undefined} />
    <mesh geometry={hitGeometry} onPointerDown={selectCoveredRegion} onPointerOver={() => { document.body.style.cursor = "crosshair"; }} onPointerOut={() => { document.body.style.cursor = "default"; }}>
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  </group>;
}

type HumanModelProps = { age: number; regions: BurnRegionInput[]; onSelect: (id: BurnRegionId, surface: BurnSurface) => void };

function smoothSourceGeometry(source: Group) {
  let sourceMesh: Mesh | undefined;
  source.traverse((child) => { if (!sourceMesh && child instanceof Mesh) sourceMesh = child; });
  if (!sourceMesh) throw new Error("The anatomical mesh did not contain renderable geometry.");
  const sourceGeometry = sourceMesh.geometry.clone();
  sourceGeometry.deleteAttribute("normal");
  return mergeVertices(sourceGeometry, 0.0001);
}

function createAgeSpecificGeometry(adultSource: Group, age: number, pediatricSources?: { child: Group; infant: Group }) {
  const adultGeometry = smoothSourceGeometry(adultSource);
  const outputGeometry = adultGeometry.clone();
  const adultPosition = adultGeometry.getAttribute("position") as BufferAttribute;
  const outputPosition = outputGeometry.getAttribute("position") as BufferAttribute;
  outputGeometry.setAttribute("originalPosition", adultPosition.clone());

  if (pediatricSources) {
    const childGeometry = smoothSourceGeometry(pediatricSources.child);
    const infantGeometry = smoothSourceGeometry(pediatricSources.infant);
    const childPosition = childGeometry.getAttribute("position") as BufferAttribute;
    const infantPosition = infantGeometry.getAttribute("position") as BufferAttribute;
    if (adultPosition.count !== childPosition.count || adultPosition.count !== infantPosition.count) {
      adultGeometry.dispose();
      childGeometry.dispose();
      infantGeometry.dispose();
      outputGeometry.dispose();
      throw new Error("Pediatric and adult anatomical topology did not match.");
    }

    const blend = pediatricModelBlend(age);
    let visibleMinY = Number.POSITIVE_INFINITY;
    let visibleMaxY = Number.NEGATIVE_INFINITY;
    const blended = new Float32Array(adultPosition.count * 3);
    for (let index = 0; index < adultPosition.count; index += 1) {
      const offset = index * 3;
      const x = infantPosition.getX(index) * blend.infant + childPosition.getX(index) * blend.child + adultPosition.getX(index) * blend.adult;
      const y = infantPosition.getY(index) * blend.infant + childPosition.getY(index) * blend.child + adultPosition.getY(index) * blend.adult;
      const z = infantPosition.getZ(index) * blend.infant + childPosition.getZ(index) * blend.child + adultPosition.getZ(index) * blend.adult;
      blended[offset] = x;
      blended[offset + 1] = y;
      blended[offset + 2] = z;
      visibleMinY = Math.min(visibleMinY, y);
      visibleMaxY = Math.max(visibleMaxY, y);
    }
    adultGeometry.computeBoundingBox();
    const adultMinY = adultGeometry.boundingBox?.min.y ?? -8.4488;
    const adultMaxY = adultGeometry.boundingBox?.max.y ?? 9.4086;
    const displayScale = (adultMaxY - adultMinY) / Math.max(0.001, visibleMaxY - visibleMinY);
    for (let index = 0; index < adultPosition.count; index += 1) {
      const offset = index * 3;
      outputPosition.setXYZ(
        index,
        blended[offset] * displayScale,
        adultMinY + (blended[offset + 1] - visibleMinY) * displayScale,
        blended[offset + 2] * displayScale,
      );
    }
    childGeometry.dispose();
    infantGeometry.dispose();
  }

  adultGeometry.dispose();
  outputPosition.needsUpdate = true;
  outputGeometry.computeVertexNormals();
  outputGeometry.computeBoundingBox();
  outputGeometry.computeBoundingSphere();
  return outputGeometry;
}

function RenderedHumanModel({ age, regions, onSelect, adultSource, pediatricSources }: HumanModelProps & { adultSource: Group; pediatricSources?: { child: Group; infant: Group } }) {
  const skinTexture = useLoader(TextureLoader, SKIN_TEXTURE_PATH);
  useEffect(() => {
    skinTexture.colorSpace = SRGBColorSpace;
    skinTexture.anisotropy = 8;
    skinTexture.needsUpdate = true;
  }, [skinTexture]);
  const skinMaps = useMemo(() => createMaterialDetailMaps("skin"), []);
  const geometry = useMemo(() => createAgeSpecificGeometry(adultSource, age, pediatricSources), [adultSource, age, pediatricSources]);
  const highlightMaterial = useMemo(() => createHighlightMaterial(regions), [regions]);
  useEffect(() => () => { geometry.dispose(); highlightMaterial.dispose(); }, [geometry, highlightMaterial]);
  useEffect(() => () => { skinMaps.normalMap.dispose(); skinMaps.roughnessMap.dispose(); }, [skinMaps]);

  const selectBody = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = originalPointFromEvent(event);
    const selection = resolveBurnModelPoint([point.x, point.y, point.z], event.ray.origin.z);
    onSelect(selection.regionId, selection.surface);
  };

  return <group>
    <mesh geometry={geometry} castShadow receiveShadow onPointerDown={selectBody} onPointerOver={() => { document.body.style.cursor = "crosshair"; }} onPointerOut={() => { document.body.style.cursor = "default"; }}>
      <meshPhysicalMaterial map={skinTexture} normalMap={skinMaps.normalMap} normalScale={new Vector2(0.14, 0.14)} roughnessMap={skinMaps.roughnessMap} color="#fff9f5" roughness={0.78} metalness={0} clearcoat={0.055} clearcoatRoughness={0.88} sheen={0.22} sheenColor={new Color("#efb5a7")} sheenRoughness={0.9} specularIntensity={0.25} specularColor={new Color("#ffece4")} />
    </mesh>
    <mesh geometry={geometry} material={highlightMaterial} renderOrder={4} onPointerDown={selectBody} />
    <ClinicalUnderwear bodyGeometry={geometry} regions={regions} onSelect={onSelect} />
  </group>;
}

function LockedAdultHumanModel(props: HumanModelProps) {
  const adultSource = useLoader(OBJLoader, ADULT_MODEL_PATH) as Group;
  return <RenderedHumanModel {...props} adultSource={adultSource} />;
}

function PediatricHumanModel(props: HumanModelProps) {
  const [adultSource, childSource, infantSource] = useLoader(OBJLoader, [ADULT_MODEL_PATH, PEDIATRIC_CHILD_MODEL_PATH, PEDIATRIC_INFANT_MODEL_PATH]) as Group[];
  const pediatricSources = useMemo(() => ({ child: childSource, infant: infantSource }), [childSource, infantSource]);
  return <RenderedHumanModel {...props} adultSource={adultSource} pediatricSources={pediatricSources} />;
}

function HumanModel(props: HumanModelProps) {
  return burnModelKindForAge(props.age) === "pediatric" ? <PediatricHumanModel {...props} /> : <LockedAdultHumanModel {...props} />;
}

function createBrandPlatformTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Unable to create the branded model platform.");
  const center = size / 2;
  const gradient = context.createRadialGradient(center, center - 70, 40, center, center, center);
  gradient.addColorStop(0, "#ffc14d");
  gradient.addColorStop(0.55, "#f79a42");
  gradient.addColorStop(1, "#f47a45");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);
  context.strokeStyle = "rgba(40, 32, 77, .24)";
  context.lineWidth = 8;
  context.beginPath();
  context.arc(center, center, 420, 0, Math.PI * 2);
  context.stroke();
  context.lineWidth = 3;
  context.beginPath();
  context.arc(center, center, 332, 0, Math.PI * 2);
  context.stroke();

  const drawCircularText = (label: string, radius: number, startAngle: number, font: string, color: string) => {
    context.font = font;
    context.fillStyle = color;
    context.textAlign = "center";
    context.textBaseline = "middle";
    const step = (Math.PI * 2) / label.length;
    label.split("").forEach((character, index) => {
      const angle = startAngle + index * step;
      context.save();
      context.translate(center + Math.cos(angle) * radius, center + Math.sin(angle) * radius);
      context.rotate(angle + Math.PI / 2);
      context.fillText(character, 0, 0);
      context.restore();
    });
  };
  drawCircularText("CODICAL HEALTH  •  CODICAL HEALTH  •  ", 378, -Math.PI / 2, "800 48px Arial", "#201747");
  drawCircularText("REVENUE INTELLIGENCE OS  •  MEDICAL CODING  •  ", 284, -Math.PI / 2, "700 25px Arial", "rgba(32, 23, 71, .82)");

  context.fillStyle = "#201747";
  context.beginPath();
  context.arc(center, center, 108, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = "900 76px Arial";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText("CH", center, center - 4);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 8;
  texture.needsUpdate = true;
  return texture;
}

function BrandPlatform() {
  const texture = useMemo(() => createBrandPlatformTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  return <group position={[0, -8.31, 0]}>
    <mesh receiveShadow>
      <cylinderGeometry args={[8.7, 8.92, 0.28, 128, 2]} />
      <meshPhysicalMaterial color="#f47a45" roughness={0.62} metalness={0.03} clearcoat={0.22} clearcoatRoughness={0.68} />
    </mesh>
    <mesh position={[0, 0.145, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <circleGeometry args={[8.68, 128]} />
      <meshPhysicalMaterial map={texture} color="#ffffff" roughness={0.7} metalness={0.01} clearcoat={0.16} clearcoatRoughness={0.74} />
    </mesh>
    <mesh position={[0, 0.17, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[8.61, 0.075, 18, 128]} />
      <meshPhysicalMaterial color="#ffc14d" roughness={0.48} clearcoat={0.32} />
    </mesh>
  </group>;
}

function Scene({ age, regions, onSelect, viewRequest }: { age: number; regions: BurnRegionInput[]; onSelect: (id: BurnRegionId, surface: BurnSurface) => void; viewRequest: { side: "front" | "back"; nonce: number } }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.setClearColor(new Color("#eee8fb"), 1);
    gl.outputColorSpace = SRGBColorSpace;
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = 1.06;
    gl.shadowMap.type = PCFSoftShadowMap;
  }, [gl]);
  return <>
    <CameraControls viewRequest={viewRequest} />
    <Environment resolution={256} background={false}>
      <Lightformer form="rect" intensity={4.2} color="#fff4ec" position={[0, 7, 8]} scale={[8, 4, 1]} />
      <Lightformer form="rect" intensity={2.5} color="#a9c8ff" position={[-7, 4, -5]} rotation={[0, Math.PI / 3, 0]} scale={[5, 8, 1]} />
      <Lightformer form="rect" intensity={2.1} color="#ffd5c2" position={[7, 1, -3]} rotation={[0, -Math.PI / 3, 0]} scale={[4, 7, 1]} />
    </Environment>
    <hemisphereLight args={["#dceaff", "#261b18", 1.25]} />
    <directionalLight position={[7, 12, 13]} intensity={2.85} color="#ffe9df" castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-bias={-0.00025} shadow-normalBias={0.035} />
    <directionalLight position={[-9, 7, -10]} intensity={1.65} color="#9fc7ff" />
    <spotLight position={[-4, 13, 6]} intensity={1.8} color="#fff2e8" angle={0.42} penumbra={0.9} />
    <Suspense fallback={<LoaderCard />}><HumanModel age={age} regions={regions} onSelect={onSelect} /></Suspense>
    <BrandPlatform />
    <ContactShadows position={[0, -8.12, 0]} opacity={0.34} scale={13} blur={3.25} far={7} color="#49305f" />
  </>;
}

function StaticModelFallback({ pediatric, selectedCount }: { pediatric: boolean; selectedCount: number }) {
  return <div className="burn-model-static" role="img" aria-label="3D Lund-Browder model loads in a WebGL-enabled browser">
    <ScanSearch size={26} /><strong>{pediatric ? "Pediatric" : "Adult"} 3D Lund–Browder</strong><span>{selectedCount} selected · Open in a WebGL-enabled browser to rotate and select the model.</span>
  </div>;
}

export function BurnBodyMap({ age, regions, selected: _selected, onSelect }: { age: number; regions: BurnRegionInput[]; selected?: string; onSelect: (id: BurnRegionId, surface: BurnSurface) => void }) {
  const band = ageBandIndex(Number.isFinite(age) ? age : 0);
  const pediatric = burnModelKindForAge(age) === "pediatric";
  const [viewRequest, setViewRequest] = useState<{ side: "front" | "back"; nonce: number }>({ side: "front", nonce: 0 });
  const [expanded, setExpanded] = useState(false);
  const client = typeof window !== "undefined";
  const requestView = (side: "front" | "back") => setViewRequest((current) => ({ side, nonce: current.nonce + 1 }));

  return <div className={`burn-body-map burn-body-map-3d ${pediatric ? "is-pediatric" : "is-adult"} ${expanded ? "is-expanded" : ""}`}>
    <div className="burn-map-toolbar">
      <div><strong>{pediatric ? "Pediatric" : "Adult"} 3D Lund–Browder</strong><small>{AGE_BANDS[band]} · {pediatric ? "age-matched anatomy and weights" : "locked final model and adult weights"}</small></div>
      <span>{regions.length} selected</span>
    </div>
    <div className="burn-model-viewport">
      {client ? <ModelErrorBoundary fallback={<StaticModelFallback pediatric={pediatric} selectedCount={regions.length} />}><Canvas aria-label="Interactive 3D Lund-Browder body model. Drag to rotate, scroll to zoom, and click a body surface to select it." camera={{ position: [0, 0.45, 29.25], fov: 32, near: 0.1, far: 100 }} dpr={[1, 2]} gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }} shadows>
        <Scene age={age} regions={regions} onSelect={onSelect} viewRequest={viewRequest} />
      </Canvas></ModelErrorBoundary> : <StaticModelFallback pediatric={pediatric} selectedCount={regions.length} />}
      <div className="burn-model-instructions"><Rotate3D size={14} /><span>Drag to rotate 360°</span><i /> <span>Scroll to zoom</span><i /> <span>Click the exact surface</span></div>
      <div className="burn-model-controls" aria-label="3D model view controls">
        <button type="button" onClick={() => requestView("front")} title="Show anterior view"><View size={14} /> Front</button>
        <button type="button" onClick={() => requestView("back")} title="Show posterior view"><View size={14} /> Back</button>
        <button type="button" onClick={() => setExpanded((value) => !value)} title={expanded ? "Exit large model view" : "Open large model view"}><Expand size={14} /> {expanded ? "Close" : "Enlarge"}</button>
      </div>
    </div>
    <div className="burn-map-legend" aria-label="Burn depth legend"><span><i className="depth-one" /> Superficial</span><span><i className="depth-two" /> Partial thickness</span><span><i className="depth-three" /> Full thickness</span></div>
    <p className="burn-map-note">Anterior and posterior surfaces are independent. Color follows the exact anatomical mesh and fills the selected percentage from inferior to superior; confirm the documented wound boundary and depth.</p>
  </div>;
}
