import { assetUrl } from './lib/asset';
import { Suspense, useRef, useEffect, useMemo, forwardRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { useGLTF, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { useScrollCamera } from './useScrollCamera';
import DebugCameraPanel from './DebugCameraPanel';

const isDebugMode = () =>
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('debug') === 'true';

// AI-generated GLBs often arrive at an arbitrary scale/origin. Bike
// auto-normalizes to TARGET_HEIGHT world units and re-centers on load so the
// hand-tuned camera keyframes in useScrollCamera.js apply consistently.
const TARGET_HEIGHT = 1.1;
const MODEL_OFFSET = [0, 0, 0];
const MODEL_SCALE = 1;

function Bike({ modelPath }) {
  const { scene } = useGLTF(modelPath);

  useEffect(() => {
    scene.scale.set(1, 1, 1);
    scene.position.set(0, 0, 0);
    scene.updateMatrixWorld(true);

    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);

    const height = size.y || 1;
    const scale = (TARGET_HEIGHT / height) * MODEL_SCALE;

    scene.scale.setScalar(scale);
    scene.position.set(
      -center.x * scale + MODEL_OFFSET[0],
      -box.min.y * scale + MODEL_OFFSET[1],
      -center.z * scale + MODEL_OFFSET[2]
    );

    scene.traverse((obj) => {
      if (obj.isMesh) {
        obj.castShadow = true;
        obj.receiveShadow = true;
      }
    });
  }, [scene]);

  return <primitive object={scene} />;
}

// ContactShadows (drei) multiply-blends its shadow plane, which is
// invisible against a transparent (alpha: true) canvas — there's nothing
// in the WebGL buffer to multiply against yet. A hand-built radial-gradient
// texture with normal alpha blending composites correctly instead.
function useRadialShadowTexture() {
  return useMemo(() => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(0,0,0,0.85)');
    gradient.addColorStop(0.5, 'rgba(0,0,0,0.4)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
    return new THREE.CanvasTexture(canvas);
  }, []);
}

function GroundShadow() {
  const texture = useRadialShadowTexture();
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
      <circleGeometry args={[1.5, 64]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} toneMapped={false} />
    </mesh>
  );
}

function CameraRig({ cameraState, debugMode }) {
  const camRef = useRef();
  const targetVec = useRef(new THREE.Vector3());

  useFrame(() => {
    if (!camRef.current) return;
    const { position, target, fov } = cameraState.current;

    const lerpFactor = debugMode ? 1 : 0.08;

    camRef.current.position.lerp(new THREE.Vector3(position[0], position[1], position[2]), lerpFactor);
    targetVec.current.lerp(new THREE.Vector3(...target), lerpFactor);
    camRef.current.lookAt(targetVec.current);

    if (Math.abs(camRef.current.fov - fov) > 0.01) {
      camRef.current.fov = THREE.MathUtils.lerp(camRef.current.fov, fov, lerpFactor);
      camRef.current.updateProjectionMatrix();
    }
  });

  return (
    <PerspectiveCamera
      ref={camRef}
      makeDefault
      position={cameraState.current.position}
      fov={cameraState.current.fov}
      near={0.1}
      far={100}
    />
  );
}

const Scene = forwardRef(function Scene({ modelPath = assetUrl('/models/bike.glb') }, ref) {
  const debugMode = isDebugMode();
  const cameraState = useScrollCamera(debugMode);

  return (
    <div ref={ref} style={{ position: 'fixed', inset: 0, zIndex: 2 }}>
      <Canvas
        dpr={[1, 2]}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 0.85,
        }}
        shadows
        style={{ width: '100%', height: '100%', background: 'transparent' }}
      >
        <fog attach="fog" args={['#000000', 9, 22]} />

        <CameraRig cameraState={cameraState} debugMode={debugMode} />
        {debugMode && <DebugCameraPanel cameraState={cameraState} />}

        <ambientLight intensity={0.45} />
        <hemisphereLight groundColor="#0a0a0a" color="#ffffff" intensity={0.7} />
        <directionalLight
          position={[4, 6, 4]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0005}
        />
        <directionalLight position={[-4, 1.5, -3]} intensity={0.5} />
        <directionalLight position={[-2, 3, -5]} intensity={0.8} color="#cfe0ff" />
        <directionalLight position={[0, 8, 0]} intensity={0.4} />

        <Suspense fallback={null}>
          <Bike modelPath={modelPath} />
          <GroundShadow />
        </Suspense>
      </Canvas>
    </div>
  );
});

export default Scene;

useGLTF.preload(assetUrl('/models/bike.glb'));
if (typeof window !== 'undefined') {
  setTimeout(() => {
    useGLTF.preload(assetUrl('/models/bike-vortex.glb'));
    useGLTF.preload(assetUrl('/models/bike-spectra.glb'));
  }, 3000);
}
