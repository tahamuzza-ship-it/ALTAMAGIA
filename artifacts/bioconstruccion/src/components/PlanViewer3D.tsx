import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PointerLockControls, Sky, Text } from '@react-three/drei';
import { Room } from '@workspace/api-client-react';
import { Vector3 } from 'three';
import { Button } from '@/components/ui/button';
import { Footprints, X } from 'lucide-react';

const wallColors: Record<string, string> = {
  bahareque: '#f5ebd8', // warm cream
  tapia_pisada: '#c2925b', // thick rammed-earth ochre
  adobe: '#b35a3b', // brick-earth
  guadua_vista: '#d4c3ab', // bamboo green-tan
};

const roofColors: Record<string, string> = {
  teja_barro: '#c96440',
  palma: '#d4be83',
  zinc: '#9aa0a6',
  techo_verde: '#5c8a45'
};

const EYE_HEIGHT = 1.6;
const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 3.0; // m/s
const WALL_T = 0.2;
const DOOR_WIDTH = 1.0; // opening left in each wall so the player can move between spaces

type Box2D = { minX: number, maxX: number, minZ: number, maxZ: number };

function Wall({ position, args, color, hasWindow = false }: { position: [number, number, number], args: [number, number, number], color: string, hasWindow?: boolean }) {
  return (
    <group position={position}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={args} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {hasWindow && (
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[args[0] > args[2] ? args[0] * 0.4 : args[0] + 0.05, args[1] * 0.5, args[0] > args[2] ? args[2] + 0.05 : args[2] * 0.4]} />
          <meshStandardMaterial color="#2a3b4c" roughness={0.1} metalness={0.8} />
        </mesh>
      )}
    </group>
  );
}

function Room3D({ room, maxH1, wallSystem }: { room: Room, maxH1: number, wallSystem: string }) {
  const isFloor2 = room.floor === 2;
  const baseZ = isFloor2 ? maxH1 : 0;
  
  const w = room.widthM;
  const l = room.lengthM;
  const h = room.heightM;
  const x = (room.posX ?? 0) + w / 2;
  const z = (room.posY ?? 0) + l / 2;
  
  const t = WALL_T; // wall thickness
  const floorY = baseZ + 0.05;

  const isMixta = wallSystem === 'mixta';
  const cTop = isMixta ? wallColors.bahareque : (wallColors[wallSystem] || wallColors.bahareque);
  const cBot = isMixta ? wallColors.adobe : cTop;

  const hBot = isMixta ? Math.min(1.2, h) : h;
  const hTop = Math.max(0, h - hBot);

  const renderWalls = (height: number, yCenter: number, color: string, addWindows: boolean) => (
    <React.Fragment key={`${height}-${yCenter}`}>
      <Wall position={[x, yCenter, z - l/2 + t/2]} args={[w, height, t]} color={color} hasWindow={addWindows && w > 1.5} />
      <Wall position={[x, yCenter, z + l/2 - t/2]} args={[w, height, t]} color={color} hasWindow={addWindows && w > 1.5} />
      <Wall position={[x - w/2 + t/2, yCenter, z]} args={[t, height, l - t*2]} color={color} hasWindow={addWindows && l > 1.5} />
      <Wall position={[x + w/2 - t/2, yCenter, z]} args={[t, height, l - t*2]} color={color} hasWindow={addWindows && l > 1.5} />
    </React.Fragment>
  );

  return (
    <group>
      {/* Floor slab */}
      <mesh position={[x, floorY, z]} receiveShadow>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#8a837b" />
      </mesh>
      
      {/* Walls */}
      {renderWalls(hBot, baseZ + hBot/2, cBot, false)}
      {hTop > 0 && renderWalls(hTop, baseZ + hBot + hTop/2, cTop, true)}

      {/* Label */}
      <Text 
        position={[x, baseZ + h + 0.2, z]}
        fontSize={0.4}
        color="#1a2e20"
        anchorX="center"
        anchorY="middle"
        rotation={[-Math.PI / 2, 0, 0]}
      >
        {room.name}
      </Text>
    </group>
  );
}

function Roof({ rooms, maxH1, maxH2, roofType }: { rooms: Room[], maxH1: number, maxH2: number, roofType: string }) {
  if (!rooms.length) return null;

  const f1Rooms = rooms.filter(r => r.floor === 1);
  if (!f1Rooms.length) return null;

  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  f1Rooms.forEach((r, i) => {
    const rx = r.posX ?? (i * 5);
    const rz = r.posY ?? 0;
    minX = Math.min(minX, rx);
    maxX = Math.max(maxX, rx + r.widthM);
    minZ = Math.min(minZ, rz);
    maxZ = Math.max(maxZ, rz + r.lengthM);
  });

  const w = maxX - minX + 1; // overhang
  const l = maxZ - minZ + 1;
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  
  const totalH = maxH1 + maxH2;
  const roofCol = roofColors[roofType] || roofColors.teja_barro;

  const isXLonger = w >= l;
  const angle = Math.PI / 6; // 30 degrees pitch
  const roofLen = isXLonger ? w : l;
  const roofSpan = isXLonger ? l : w;
  const slopeLen = (roofSpan / 2) / Math.cos(angle);
  const actualH = (roofSpan / 2) * Math.tan(angle);

  return (
    <group position={[cx, totalH, cz]}>
      {/* Pitch + */}
      <mesh castShadow receiveShadow 
            position={[0, actualH / 2, isXLonger ? roofSpan / 4 : 0]} 
            rotation={[isXLonger ? angle : 0, 0, isXLonger ? 0 : -angle]}>
        <boxGeometry args={[isXLonger ? roofLen : slopeLen, 0.1, isXLonger ? slopeLen : roofLen]} />
        <meshStandardMaterial color={roofCol} roughness={0.8} />
      </mesh>
      
      {/* Pitch - */}
      <mesh castShadow receiveShadow 
            position={[0, actualH / 2, isXLonger ? -roofSpan / 4 : 0]} 
            rotation={[isXLonger ? -angle : 0, 0, isXLonger ? 0 : angle]}>
        <boxGeometry args={[isXLonger ? roofLen : slopeLen, 0.1, isXLonger ? slopeLen : roofLen]} />
        <meshStandardMaterial color={roofCol} roughness={0.8} />
      </mesh>
    </group>
  );
}

/**
 * Builds 2D collision boxes (top-down) for the ground-floor walls.
 * Each wall gets a centered gap (DOOR_WIDTH) so the walkthrough can pass
 * between rooms and enter from outside — simple collision, not full doors.
 */
function buildCollisionBoxes(rooms: Room[]): Box2D[] {
  const boxes: Box2D[] = [];
  const t = WALL_T;

  rooms.filter(r => r.floor === 1).forEach(room => {
    const w = room.widthM;
    const l = room.lengthM;
    const x0 = room.posX ?? 0;
    const z0 = room.posY ?? 0;

    // Horizontal walls (along X) at z0 and z0+l, split around a central door gap
    const gapW = Math.min(DOOR_WIDTH, w * 0.5);
    const segW = (w - gapW) / 2;
    if (segW > 0.01) {
      for (const zc of [z0, z0 + l - t]) {
        boxes.push({ minX: x0, maxX: x0 + segW, minZ: zc, maxZ: zc + t });
        boxes.push({ minX: x0 + w - segW, maxX: x0 + w, minZ: zc, maxZ: zc + t });
      }
    }

    // Vertical walls (along Z) at x0 and x0+w, split around a central door gap
    const gapL = Math.min(DOOR_WIDTH, l * 0.5);
    const segL = (l - gapL) / 2;
    if (segL > 0.01) {
      for (const xc of [x0, x0 + w - t]) {
        boxes.push({ minX: xc, maxX: xc + t, minZ: z0, maxZ: z0 + segL });
        boxes.push({ minX: xc, maxX: xc + t, minZ: z0 + l - segL, maxZ: z0 + l });
      }
    }
  });

  return boxes;
}

function collides(x: number, z: number, boxes: Box2D[]): boolean {
  for (const b of boxes) {
    if (
      x + PLAYER_RADIUS > b.minX && x - PLAYER_RADIUS < b.maxX &&
      z + PLAYER_RADIUS > b.minZ && z - PLAYER_RADIUS < b.maxZ
    ) return true;
  }
  return false;
}

function WalkControls({ boxes, start, onExit }: { boxes: Box2D[], start: [number, number], onExit: () => void }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const controlsRef = useRef<any>(null);

  useEffect(() => {
    camera.position.set(start[0], EYE_HEIGHT, start[1]);
    camera.lookAt(start[0], EYE_HEIGHT, start[1] - 5);
  }, [camera, start]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keys.current[e.code] = true; };
    const up = (e: KeyboardEvent) => { keys.current[e.code] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }, []);

  useFrame((_, delta) => {
    const k = keys.current;
    const fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    const strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    if (!fwd && !strafe) return;

    // Direction on the ground plane from camera heading
    camera.getWorldDirection(tmpVec);
    const flen = Math.hypot(tmpVec.x, tmpVec.z) || 1;
    const forward = { x: tmpVec.x / flen, z: tmpVec.z / flen };
    const right = { x: -forward.z, z: forward.x };
    const dir = {
      x: forward.x * fwd + right.x * strafe,
      z: forward.z * fwd + right.z * strafe,
    };
    const dlen = Math.hypot(dir.x, dir.z) || 1;

    const step = WALK_SPEED * Math.min(delta, 0.1);
    const nx = camera.position.x + (dir.x / dlen) * step;
    const nz = camera.position.z + (dir.z / dlen) * step;

    // Axis-separated collision for wall sliding
    if (!collides(nx, camera.position.z, boxes)) camera.position.x = nx;
    if (!collides(camera.position.x, nz, boxes)) camera.position.z = nz;
    camera.position.y = EYE_HEIGHT;
  });

  return <PointerLockControls ref={controlsRef} onUnlock={onExit} />;
}

// Reusable scratch vector (avoids per-frame allocation)
const tmpVec = new Vector3();

export default function PlanViewer3DScene({ rooms, wallSystem, roofType }: { rooms: Room[], wallSystem: string, roofType: string }) {
  const [walkMode, setWalkMode] = useState(false);
  const maxH1 = Math.max(0, ...rooms.filter(r => r.floor === 1).map(r => r.heightM));
  const maxH2 = Math.max(0, ...rooms.filter(r => r.floor === 2).map(r => r.heightM));

  const placedRooms = useMemo(
    () => rooms.map((r, i) => ({ ...r, posX: r.posX ?? (i * 5) })),
    [rooms]
  );

  const center = useMemo(() => {
    if (!placedRooms.length) return [0, 0, 0];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    placedRooms.forEach((r) => {
      const rx = r.posX ?? 0;
      const rz = r.posY ?? 0;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx + r.widthM);
      minZ = Math.min(minZ, rz);
      maxZ = Math.max(maxZ, rz + r.lengthM);
    });
    return [(minX + maxX) / 2, 0, (minZ + maxZ) / 2];
  }, [placedRooms]);

  const collisionBoxes = useMemo(() => buildCollisionBoxes(placedRooms), [placedRooms]);

  // Start the walkthrough at the center of the first ground-floor room
  const walkStart = useMemo<[number, number]>(() => {
    const first = placedRooms.find(r => r.floor === 1);
    if (!first) return [center[0], center[2]];
    return [(first.posX ?? 0) + first.widthM / 2, (first.posY ?? 0) + first.lengthM / 2];
  }, [placedRooms, center]);

  const canWalk = placedRooms.some(r => r.floor === 1);

  return (
    <div className="relative w-full h-full min-h-[500px]">
      <Canvas shadows camera={{ position: [center[0] + 15, 15, center[2] + 15], fov: 45 }} className="!absolute inset-0">
        <Sky sunPosition={[10, 20, 10]} turbidity={0.1} rayleigh={0.5} />
        <ambientLight intensity={0.6} />
        <directionalLight 
          castShadow 
          position={[10, 20, 10]} 
          intensity={1.2} 
          shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-20}
          shadow-camera-right={20}
          shadow-camera-top={20}
          shadow-camera-bottom={-20}
        />
        
        {/* Ground plane */}
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} position={[center[0], -0.01, center[2]]}>
          <planeGeometry args={[200, 200]} />
          <meshStandardMaterial color="#8b9c7b" roughness={1} />
        </mesh>

        <group>
          {placedRooms.map((r) => (
            <Room3D key={r.id} room={r} maxH1={maxH1} wallSystem={wallSystem} />
          ))}
          <Roof rooms={placedRooms} maxH1={maxH1} maxH2={maxH2} roofType={roofType} />
        </group>

        {walkMode ? (
          <WalkControls boxes={collisionBoxes} start={walkStart} onExit={() => setWalkMode(false)} />
        ) : (
          <OrbitControls target={[center[0], maxH1 / 2, center[2]]} minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2 - 0.05} />
        )}
      </Canvas>

      {/* Overlay UI */}
      {!walkMode ? (
        canWalk && (
          <div className="absolute top-3 left-3 z-10">
            <Button size="sm" onClick={() => setWalkMode(true)} className="shadow-md">
              <Footprints className="w-4 h-4 mr-1.5" /> Recorrer
            </Button>
          </div>
        )
      ) : (
        <>
          <div className="absolute top-3 left-3 z-10">
            <Button size="sm" variant="secondary" onClick={() => setWalkMode(false)} className="shadow-md">
              <X className="w-4 h-4 mr-1.5" /> Salir del recorrido
            </Button>
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-black/60 text-white text-xs rounded-lg px-4 py-2 backdrop-blur-sm">
              Haz clic en la escena para mirar con el mouse · WASD o flechas para caminar · ESC para soltar el mouse
            </div>
          </div>
          {/* Crosshair */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80 shadow" />
          </div>
        </>
      )}
    </div>
  );
}
