import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Sky, Text } from '@react-three/drei';
import { Room } from '@workspace/api-client-react';

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
  
  const t = 0.2; // wall thickness
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

export default function PlanViewer3DScene({ rooms, wallSystem, roofType }: { rooms: Room[], wallSystem: string, roofType: string }) {
  const maxH1 = Math.max(0, ...rooms.filter(r => r.floor === 1).map(r => r.heightM));
  const maxH2 = Math.max(0, ...rooms.filter(r => r.floor === 2).map(r => r.heightM));

  const center = useMemo(() => {
    if (!rooms.length) return [0, 0, 0];
    let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
    rooms.forEach((r, i) => {
      const rx = r.posX ?? (i * 5);
      const rz = r.posY ?? 0;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx + r.widthM);
      minZ = Math.min(minZ, rz);
      maxZ = Math.max(maxZ, rz + r.lengthM);
    });
    return [(minX + maxX) / 2, 0, (minZ + maxZ) / 2];
  }, [rooms]);

  return (
    <Canvas shadows camera={{ position: [center[0] + 15, 15, center[2] + 15], fov: 45 }}>
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
        {rooms.map((r, i) => (
          <Room3D key={r.id} room={{...r, posX: r.posX ?? (i*5)}} maxH1={maxH1} wallSystem={wallSystem} />
        ))}
        <Roof rooms={rooms.map((r, i) => ({...r, posX: r.posX ?? (i*5)}))} maxH1={maxH1} maxH2={maxH2} roofType={roofType} />
      </group>

      <OrbitControls target={[center[0], maxH1 / 2, center[2]]} minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2 - 0.05} />
    </Canvas>
  );
}
