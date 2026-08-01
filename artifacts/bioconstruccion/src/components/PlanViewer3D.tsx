import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Sky, Text } from '@react-three/drei';
import Scenery3D from './Scenery3D';
import { Room } from '@workspace/api-client-react';
import { Vector3, BufferGeometry, BufferAttribute, DoubleSide } from 'three';
import { Button } from '@/components/ui/button';
import { Footprints, X } from 'lucide-react';

const wallColors: Record<string, string> = {
  bahareque: '#dfc9a4', // revoque de tierra claro
  tapia_pisada: '#b98a5a', // tapia pisada ocre
  adobe: '#a5673f', // adobe tierra
  guadua_vista: '#c9b48f', // guadua tan
};

const roofColors: Record<string, string> = {
  teja_barro: '#c96440',
  palma: '#d4be83',
  zinc: '#9aa0a6',
  techo_verde: '#5c8a45'
};

const PLAYER_RADIUS = 0.3;
const WALK_SPEED = 3.0; // m/s
const WALL_T = 0.2;
const DOOR_WIDTH = 1.2; // opening left in each wall so the player can move between spaces

type Box2D = { minX: number, maxX: number, minZ: number, maxZ: number };

const DOOR_H = 2.05; // door opening height

/**
 * One wall with a VISIBLE centered door opening that matches the collision
 * gaps in buildCollisionBoxes, so what you see is where you can walk.
 * Renders: two side segments (with color bands for mixta), a lintel above
 * the door, guadua door-frame posts, and optional windows.
 */
function WallWithDoor({ axis, cx, cz, span, baseZ, h, hBot, cBot, cTop, withWindows }: {
  axis: 'x' | 'z', cx: number, cz: number, span: number, baseZ: number,
  h: number, hBot: number, cBot: string, cTop: string, withWindows: boolean,
}) {
  const t = WALL_T;
  const gap = Math.min(DOOR_WIDTH, span * 0.5);
  const seg = (span - gap) / 2;
  if (seg <= 0.01) return null;
  const doorH = Math.min(DOOR_H, h - 0.2);
  const offs = [-(gap + seg) / 2, (gap + seg) / 2];
  const hTop = h - hBot;
  const bands = [
    { y: baseZ + hBot / 2, hgt: hBot, c: cBot },
    ...(hTop > 0.01 ? [{ y: baseZ + hBot + hTop / 2, hgt: hTop, c: cTop }] : []),
  ];
  const pos = (o: number): [number, number, number] =>
    axis === 'x' ? [cx + o, 0, cz] : [cx, 0, cz + o];
  const dims = (len: number, hgt: number): [number, number, number] =>
    axis === 'x' ? [len, hgt, t] : [t, hgt, len];
  return (
    <group>
      {offs.map((o, i) =>
        bands.map((b, j) => (
          <mesh key={`${i}-${j}`} castShadow receiveShadow position={[pos(o)[0], b.y, pos(o)[2]]}>
            <boxGeometry args={dims(seg, b.hgt)} />
            <meshStandardMaterial color={b.c} roughness={1} />
          </mesh>
        ))
      )}
      {/* Ventanas en los segmentos laterales */}
      {withWindows && seg > 1.2 && offs.map((o, i) => (
        <mesh key={`win${i}`} position={[pos(o)[0], baseZ + Math.max(hBot + 0.2, h * 0.45) + 0.35, pos(o)[2]]}>
          <boxGeometry args={dims(seg * 0.5, Math.min(0.9, h * 0.3))} />
          <meshStandardMaterial color="#2a3b4c" roughness={0.1} metalness={0.8} />
        </mesh>
      ))}
      {/* Dintel sobre la puerta */}
      {h - doorH > 0.05 && (
        <mesh castShadow position={[cx, baseZ + doorH + (h - doorH) / 2, cz]}>
          <boxGeometry args={dims(gap, h - doorH)} />
          <meshStandardMaterial color={doorH >= hBot ? cTop : cBot} roughness={1} />
        </mesh>
      )}
      {/* Marco de guadua de la puerta */}
      {[-gap / 2, gap / 2].map((g, i) => (
        <mesh key={`frame${i}`} castShadow position={[pos(g)[0], baseZ + doorH / 2, pos(g)[2]]}>
          <cylinderGeometry args={[0.05, 0.06, doorH, 6]} />
          <meshStandardMaterial color="#9aa25c" roughness={0.8} />
        </mesh>
      ))}
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


  return (
    <group>
      {/* Floor slab */}
      <mesh position={[x, floorY, z]} receiveShadow>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#9c8468" roughness={1} />
      </mesh>

      {/* Sobrecimiento de piedra (base) — solo piso 1 */}
      {!isFloor2 && (
        <mesh position={[x, 0.15, z]} receiveShadow castShadow>
          <boxGeometry args={[w + 0.08, 0.3, l + 0.08]} />
          <meshStandardMaterial color="#857c6e" roughness={1} />
        </mesh>
      )}

      {/* Columnas de guadua en las esquinas — solo piso 1 */}
      {!isFloor2 && [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`col${i}`} castShadow position={[x + sx * (w / 2), h / 2 + 0.1, z + sz * (l / 2)]}>
          <cylinderGeometry args={[0.08, 0.1, h + 0.3, 7]} />
          <meshStandardMaterial color="#9aa25c" roughness={0.8} />
        </mesh>
      ))}
      
      {/* Walls — cada pared tiene su vano de puerta visible */}
      <WallWithDoor axis="x" cx={x} cz={z - l / 2 + t / 2} span={w} baseZ={baseZ} h={h} hBot={hBot} cBot={cBot} cTop={cTop} withWindows={w > 2.4} />
      <WallWithDoor axis="x" cx={x} cz={z + l / 2 - t / 2} span={w} baseZ={baseZ} h={h} hBot={hBot} cBot={cBot} cTop={cTop} withWindows={w > 2.4} />
      <WallWithDoor axis="z" cx={x - w / 2 + t / 2} cz={z} span={l} baseZ={baseZ} h={h} hBot={hBot} cBot={cBot} cTop={cTop} withWindows={l > 2.4} />
      <WallWithDoor axis="z" cx={x + w / 2 - t / 2} cz={z} span={l} baseZ={baseZ} h={h} hBot={hBot} cBot={cBot} cTop={cTop} withWindows={l > 2.4} />

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

  // Triángulo que tapa cada culata (extremo del techo) para que no se vea la "X".
  // (Sin useMemo: este componente tiene returns tempranos antes de este punto,
  // y los hooks no pueden ser condicionales. La geometría es diminuta.)
  const gableGeom = (() => {
    const g = new BufferGeometry();
    const v = new Float32Array([
      -roofSpan / 2, 0, 0,
      roofSpan / 2, 0, 0,
      0, actualH, 0,
    ]);
    g.setAttribute('position', new BufferAttribute(v, 3));
    g.computeVertexNormals();
    return g;
  })();

  const gableRot: [number, number, number] = isXLonger ? [0, Math.PI / 2, 0] : [0, 0, 0];
  const gableEnds: [number, number, number][] = isXLonger
    ? [[-(roofLen / 2 - 0.5), 0, 0], [roofLen / 2 - 0.5, 0, 0]]
    : [[0, 0, -(roofLen / 2 - 0.5)], [0, 0, roofLen / 2 - 0.5]];

  return (
    <group position={[cx, totalH, cz]}>
      {/* Culatas (tapas triangulares en los extremos) */}
      {gableEnds.map((p, i) => (
        <mesh key={`gable${i}`} position={p} rotation={gableRot}>
          <primitive object={gableGeom} attach="geometry" />
          <meshStandardMaterial color="#dfc9a4" roughness={1} side={DoubleSide} />
        </mesh>
      ))}

      {/* Caballete de guadua a lo largo de la cumbrera */}
      <mesh castShadow position={[0, actualH, 0]} rotation={isXLonger ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, roofLen + 0.3, 8]} />
        <meshStandardMaterial color="#8a6a44" roughness={0.9} />
      </mesh>
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
function buildCollisionBoxes(rooms: Room[], floor: number): Box2D[] {
  const boxes: Box2D[] = [];
  const t = WALL_T;

  rooms.filter(r => r.floor === floor).forEach(room => {
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

// Detect touch-first devices (no fine pointer / no keyboard expected)
function isTouchDevice(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
}

type TouchInput = { move: { x: number, y: number }, look: { dx: number, dy: number } };

// Personita low-poly que camina por la casa
function Personita() {
  return (
    <group>
      {/* piernas */}
      <mesh castShadow position={[-0.09, 0.2, 0]}>
        <boxGeometry args={[0.13, 0.4, 0.15]} />
        <meshStandardMaterial color="#5b4a3a" roughness={1} />
      </mesh>
      <mesh castShadow position={[0.09, 0.2, 0]}>
        <boxGeometry args={[0.13, 0.4, 0.15]} />
        <meshStandardMaterial color="#5b4a3a" roughness={1} />
      </mesh>
      {/* cuerpo */}
      <mesh castShadow position={[0, 0.68, 0]}>
        <boxGeometry args={[0.42, 0.56, 0.24]} />
        <meshStandardMaterial color="#c2703e" roughness={1} />
      </mesh>
      {/* brazos */}
      <mesh castShadow position={[-0.28, 0.66, 0]}>
        <boxGeometry args={[0.11, 0.5, 0.13]} />
        <meshStandardMaterial color="#c2703e" roughness={1} />
      </mesh>
      <mesh castShadow position={[0.28, 0.66, 0]}>
        <boxGeometry args={[0.11, 0.5, 0.13]} />
        <meshStandardMaterial color="#c2703e" roughness={1} />
      </mesh>
      {/* cabeza */}
      <mesh castShadow position={[0, 1.12, 0]}>
        <sphereGeometry args={[0.17, 12, 12]} />
        <meshStandardMaterial color="#e8b48a" roughness={1} />
      </mesh>
      {/* sombrero campesino */}
      <mesh castShadow position={[0, 1.26, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.04, 12]} />
        <meshStandardMaterial color="#d9c08a" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 1.32, 0]}>
        <cylinderGeometry args={[0.13, 0.15, 0.12, 12]} />
        <meshStandardMaterial color="#d9c08a" roughness={1} />
      </mesh>
    </group>
  );
}

const CAM_DIST = 7; // distancia de la cámara a la personita (45° arriba)

function WalkControls({ boxes, start, floorY, floor, touchInput, rooms, onRoomChange }: { boxes: Box2D[], start: [number, number], floorY: number, floor: number, touchInput: React.MutableRefObject<TouchInput>, rooms: Room[], onRoomChange: (name: string | null) => void }) {
  const { camera } = useThree();
  const keys = useRef<Record<string, boolean>>({});
  const groupRef = useRef<any>(null);
  const pos = useRef({ x: start[0], z: start[1] });
  const yaw = useRef(0); // ángulo de la cámara alrededor de la personita
  const facing = useRef(0); // hacia dónde mira la personita
  const lastRoom = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    pos.current = { x: start[0], z: start[1] };
    yaw.current = 0;
    facing.current = 0;
  }, [start]);

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
    const p = pos.current;
    const dt = Math.min(delta, 0.1);

    // ¿En qué espacio está la personita?
    const room = rooms.find(r => {
      if (r.floor !== floor) return false;
      const rx = r.posX ?? 0;
      const rz = r.posY ?? 0;
      return p.x >= rx && p.x <= rx + r.widthM && p.z >= rz && p.z <= rz + r.lengthM;
    });
    const name = room ? room.name : null;
    if (name !== lastRoom.current) {
      lastRoom.current = name;
      onRoomChange(name);
    }

    const k = keys.current;
    const ti = touchInput.current;

    // Girar la cámara: arrastrar (mouse o dedo) o teclas Q/E
    if (ti.look.dx !== 0 || ti.look.dy !== 0) {
      yaw.current -= ti.look.dx * 0.006;
      ti.look.dx = 0;
      ti.look.dy = 0;
    }
    if (k['KeyQ']) yaw.current += dt * 1.8;
    if (k['KeyE']) yaw.current -= dt * 1.8;

    let fwd = (k['KeyW'] || k['ArrowUp'] ? 1 : 0) - (k['KeyS'] || k['ArrowDown'] ? 1 : 0);
    let strafe = (k['KeyD'] || k['ArrowRight'] ? 1 : 0) - (k['KeyA'] || k['ArrowLeft'] ? 1 : 0);
    if (!fwd && !strafe && (ti.move.x || ti.move.y)) {
      fwd = ti.move.y;
      strafe = ti.move.x;
    }

    if (fwd || strafe) {
      // Adelante = alejarse de la cámara
      const forward = { x: -Math.sin(yaw.current), z: -Math.cos(yaw.current) };
      const right = { x: -forward.z, z: forward.x };
      const dir = {
        x: forward.x * fwd + right.x * strafe,
        z: forward.z * fwd + right.z * strafe,
      };
      const dlen = Math.hypot(dir.x, dir.z) || 1;
      const step = WALK_SPEED * dt;
      const nx = p.x + (dir.x / dlen) * step;
      const nz = p.z + (dir.z / dlen) * step;

      // Colisión por ejes para deslizarse por las paredes
      if (!collides(nx, p.z, boxes)) p.x = nx;
      if (!collides(p.x, nz, boxes)) p.z = nz;

      facing.current = Math.atan2(dir.x / dlen, dir.z / dlen);
    }

    // Personita
    if (groupRef.current) {
      groupRef.current.position.set(p.x, floorY, p.z);
      groupRef.current.rotation.y = facing.current;
    }

    // Cámara a 45° por encima, siguiendo a la personita
    camera.position.set(
      p.x + Math.sin(yaw.current) * CAM_DIST,
      floorY + CAM_DIST,
      p.z + Math.cos(yaw.current) * CAM_DIST,
    );
    camera.lookAt(p.x, floorY + 0.9, p.z);
  });

  return (
    <group ref={groupRef} position={[start[0], floorY, start[1]]}>
      <Personita />
    </group>
  );
}

// Virtual joystick for touch movement
function VirtualJoystick({ onChange }: { onChange: (x: number, y: number) => void }) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const activeId = useRef<number | null>(null);
  const RADIUS = 40;

  const update = (clientX: number, clientY: number) => {
    const base = baseRef.current;
    if (!base) return;
    const rect = base.getBoundingClientRect();
    let dx = clientX - (rect.left + rect.width / 2);
    let dy = clientY - (rect.top + rect.height / 2);
    const len = Math.hypot(dx, dy);
    if (len > RADIUS) { dx = (dx / len) * RADIUS; dy = (dy / len) * RADIUS; }
    setKnob({ x: dx, y: dy });
    onChange(dx / RADIUS, -dy / RADIUS); // up = forward
  };

  const reset = () => {
    activeId.current = null;
    setKnob({ x: 0, y: 0 });
    onChange(0, 0);
  };

  return (
    <div
      ref={baseRef}
      className="absolute bottom-6 left-6 z-20 w-28 h-28 rounded-full bg-black/30 backdrop-blur-sm border border-white/30 touch-none select-none"
      onPointerDown={(e) => {
        activeId.current = e.pointerId;
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        update(e.clientX, e.clientY);
      }}
      onPointerMove={(e) => { if (activeId.current === e.pointerId) update(e.clientX, e.clientY); }}
      onPointerUp={(e) => { if (activeId.current === e.pointerId) reset(); }}
      onPointerCancel={(e) => { if (activeId.current === e.pointerId) reset(); }}
    >
      <div
        className="absolute top-1/2 left-1/2 w-12 h-12 rounded-full bg-white/70 shadow-lg"
        style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
      />
    </div>
  );
}

// Transparent overlay: drag anywhere (outside the joystick) to look around
function LookPad({ lookRef }: { lookRef: React.MutableRefObject<TouchInput> }) {
  const last = useRef<{ id: number, x: number, y: number } | null>(null);
  return (
    <div
      className="absolute inset-0 z-10 touch-none select-none"
      onPointerDown={(e) => {
        if (last.current) return; // one look-finger at a time
        last.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={(e) => {
        const l = last.current;
        if (!l || l.id !== e.pointerId) return;
        lookRef.current.look.dx += e.clientX - l.x;
        lookRef.current.look.dy += e.clientY - l.y;
        l.x = e.clientX;
        l.y = e.clientY;
      }}
      onPointerUp={(e) => { if (last.current?.id === e.pointerId) last.current = null; }}
      onPointerCancel={(e) => { if (last.current?.id === e.pointerId) last.current = null; }}
    />
  );
}

// Reusable scratch vector (avoids per-frame allocation)

export default function PlanViewer3DScene({ rooms, wallSystem, roofType }: { rooms: Room[], wallSystem: string, roofType: string }) {
  const [walkMode, setWalkMode] = useState(false);
  const [walkFloorState, setWalkFloor] = useState(1);
  const [spawn, setSpawn] = useState<[number, number] | null>(null);
  const [currentRoom, setCurrentRoom] = useState<string | null>(null);
  const touch = useMemo(() => isTouchDevice(), []);
  const touchInput = useRef<TouchInput>({ move: { x: 0, y: 0 }, look: { dx: 0, dy: 0 } });
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

  const hasFloor2 = placedRooms.some(r => r.floor === 2);
  const walkFloor = hasFloor2 ? walkFloorState : 1;

  const collisionBoxes = useMemo(() => buildCollisionBoxes(placedRooms, walkFloor), [placedRooms, walkFloor]);

  // Start the walkthrough at the center of the first room of the selected floor
  const walkStart = useMemo<[number, number]>(() => {
    const first = placedRooms.find(r => r.floor === walkFloor);
    if (!first) return [center[0], center[2]];
    return [(first.posX ?? 0) + first.widthM / 2, (first.posY ?? 0) + first.lengthM / 2];
  }, [placedRooms, center, walkFloor]);

  const canWalk = placedRooms.some(r => r.floor === 1);
  const walkFloorY = walkFloor === 2 ? maxH1 + 0.1 : 0;

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
          <planeGeometry args={[300, 300]} />
          <meshStandardMaterial color="#7fa864" roughness={1} />
        </mesh>

        <Scenery3D center={center as [number, number, number]} />

        <group>
          {placedRooms
            .filter((r) => !walkMode || r.floor <= walkFloor)
            .map((r) => (
              <Room3D key={r.id} room={r} maxH1={maxH1} wallSystem={wallSystem} />
            ))}
          {/* En el recorrido se quita el techo para ver la casa por dentro desde arriba */}
          {!walkMode && <Roof rooms={placedRooms} maxH1={maxH1} maxH2={maxH2} roofType={roofType} />}
        </group>

        {walkMode ? (
          <WalkControls boxes={collisionBoxes} start={spawn ?? walkStart} floorY={walkFloorY} floor={walkFloor} touchInput={touchInput} rooms={placedRooms} onRoomChange={setCurrentRoom} />
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
          <LookPad lookRef={touchInput} />
          {touch && (
            <VirtualJoystick onChange={(x, y) => { touchInput.current.move.x = x; touchInput.current.move.y = y; }} />
          )}
          <div className="absolute top-3 left-3 z-30 flex items-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => { setWalkMode(false); setCurrentRoom(null); setSpawn(null); }} className="shadow-md">
              <X className="w-4 h-4 mr-1.5" /> Salir del recorrido
            </Button>
            {hasFloor2 && (
              <div className="flex rounded-md shadow-md overflow-hidden">
                <Button
                  size="sm"
                  variant={walkFloor === 1 ? 'default' : 'secondary'}
                  className="rounded-none"
                  onClick={() => { setWalkFloor(1); setSpawn(null); }}
                >
                  Piso 1
                </Button>
                <Button
                  size="sm"
                  variant={walkFloor === 2 ? 'default' : 'secondary'}
                  className="rounded-none"
                  onClick={() => { setWalkFloor(2); setSpawn(null); }}
                >
                  Piso 2
                </Button>
              </div>
            )}
          </div>
          {currentRoom && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
              <div className="bg-black/60 text-white text-sm font-medium rounded-lg px-4 py-2 backdrop-blur-sm shadow">
                Estás en: {currentRoom}
              </div>
            </div>
          )}
          {/* Ir directo a un espacio */}
          <div className="absolute top-14 right-3 z-30 flex flex-col items-end gap-1.5 max-w-[45%]">
            <div className="bg-black/60 text-white text-[11px] rounded px-2 py-0.5 backdrop-blur-sm">Ir a:</div>
            {placedRooms.filter(r => r.floor === walkFloor).map(r => (
              <Button
                key={r.id}
                size="sm"
                variant="secondary"
                className="h-7 text-xs shadow-md"
                onClick={() => {
                  setSpawn([(r.posX ?? 0) + r.widthM / 2, (r.posY ?? 0) + r.lengthM / 2]);
                  setCurrentRoom(r.name);
                }}
              >
                {r.name}
              </Button>
            ))}
          </div>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
            <div className="bg-black/60 text-white text-xs rounded-lg px-4 py-2 backdrop-blur-sm">
              {touch
                ? 'Usa el joystick para caminar · Arrastra la pantalla para girar la cámara'
                : 'WASD o flechas para caminar · Arrastra con el mouse o usa Q/E para girar la cámara'}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
