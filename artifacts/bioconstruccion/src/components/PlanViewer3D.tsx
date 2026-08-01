import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Text } from '@react-three/drei';
import Scenery3D from './Scenery3D';
import { Room } from '@workspace/api-client-react';
import { Vector3, BufferGeometry, BufferAttribute, DoubleSide } from 'three';
import { Button } from '@/components/ui/button';
import { Footprints, X, Info } from 'lucide-react';

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
      {/* Sobrecimiento de piedra (30 cm) en la base de las paredes del piso 1 */}
      {baseZ < 0.01 && offs.map((o, i) => (
        <mesh key={`base${i}`} castShadow receiveShadow position={[pos(o)[0], 0.15, pos(o)[2]]}>
          <boxGeometry args={axis === 'x' ? [seg, 0.3, t + 0.12] : [t + 0.12, 0.3, seg]} />
          <meshStandardMaterial color="#8b8175" roughness={1} />
        </mesh>
      ))}
      {/* Ventanas en los segmentos laterales: marco de madera + vidrio claro */}
      {withWindows && seg > 1.2 && offs.map((o, i) => {
        const wy = baseZ + Math.max(hBot + 0.2, h * 0.45) + 0.35;
        const ww = seg * 0.5;
        const wh = Math.min(0.9, h * 0.3);
        return (
          <group key={`win${i}`}>
            {/* marco */}
            <mesh castShadow position={[pos(o)[0], wy, pos(o)[2]]}>
              <boxGeometry args={dims(ww + 0.14, wh + 0.14)} />
              <meshStandardMaterial color="#7a5230" roughness={0.9} />
            </mesh>
            {/* vidrio */}
            <mesh position={[pos(o)[0], wy, pos(o)[2]]}>
              <boxGeometry args={axis === 'x' ? [ww, wh, t + 0.06] : [t + 0.06, wh, ww]} />
              <meshStandardMaterial color="#bfe3ee" roughness={0.05} metalness={0.2} transparent opacity={0.55} />
            </mesh>
            {/* travesaño central */}
            <mesh position={[pos(o)[0], wy, pos(o)[2]]}>
              <boxGeometry args={axis === 'x' ? [0.05, wh, t + 0.08] : [t + 0.08, wh, 0.05]} />
              <meshStandardMaterial color="#7a5230" roughness={0.9} />
            </mesh>
          </group>
        );
      })}
      {/* Hoja de puerta de madera, entreabierta (la abertura sigue transitable) */}
      {(() => {
        const hingeO = -gap / 2;
        const [hx, , hz] = pos(hingeO);
        const swing = axis === 'x' ? 1.25 : -1.25;
        return (
          <group position={[hx, baseZ + doorH / 2, hz]} rotation={[0, swing, 0]}>
            <mesh castShadow position={axis === 'x' ? [(gap - 0.08) / 2, 0, 0] : [0, 0, (gap - 0.08) / 2]}>
              <boxGeometry args={axis === 'x' ? [gap - 0.08, doorH - 0.06, 0.05] : [0.05, doorH - 0.06, gap - 0.08]} />
              <meshStandardMaterial color="#7a5230" roughness={0.9} />
            </mesh>
          </group>
        );
      })()}
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

// Panel educativo: explica el modelo desde la bioconstrucción y las propiedades de los materiales
function InfoBioconstruccion({ wallSystem, onClose }: { wallSystem: string, onClose: () => void }) {
  const muros: Record<string, { titulo: string, texto: string }> = {
    bahareque: {
      titulo: 'Muros de bahareque',
      texto: 'Esqueleto de guadua relleno y revocado con tierra. Es liviano y flexible: en un temblor la pared se mueve y disipa la energía en vez de agrietarse. La tierra del revoque "respira": absorbe humedad cuando el aire está húmedo y la suelta cuando está seco.',
    },
    adobe: {
      titulo: 'Muros de adobe',
      texto: 'Bloques de tierra cruda secados al sol. Su gran masa guarda el calor del día y lo suelta en la noche (inercia térmica): la casa se mantiene fresca al mediodía y tibia de madrugada, sin aire acondicionado ni calefacción.',
    },
    tapia_pisada: {
      titulo: 'Muros de tapia pisada',
      texto: 'Tierra compactada por capas dentro de un molde, formando muros gruesos y macizos. Son los de mayor inercia térmica y aislamiento acústico: temperatura estable todo el día y mucho silencio adentro.',
    },
    mixta: {
      titulo: 'Muros mixtos (dos franjas)',
      texto: 'La franja baja es de tierra maciza (adobe o tapia): aporta masa térmica y aguanta mejor los golpes y la humedad cerca del piso. La franja alta es de bahareque: liviana, para no cargar de peso la parte superior — clave en zona sísmica.',
    },
  };
  const muro = muros[wallSystem] ?? muros.bahareque;
  const S = ({ t, children }: { t: string, children: React.ReactNode }) => (
    <div className="mb-3">
      <p className="font-semibold text-sm mb-0.5">{t}</p>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
  return (
    <div className="absolute top-14 right-3 bottom-3 z-30 w-[340px] max-w-[85vw] bg-background/95 backdrop-blur rounded-lg shadow-lg border overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="font-bold text-base">Así funciona esta casa</h3>
        <Button size="icon" variant="ghost" onClick={onClose}><X className="w-4 h-4" /></Button>
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed mb-3">
        Este modelo sigue los principios de la bioconstrucción: materiales naturales del lugar, poca energía para producirlos y una casa que regula sola su temperatura y humedad.
      </p>
      <S t="Sobrecimiento de piedra (la base gris)">
        Son las "botas" de la casa: levantan los muros de tierra del suelo para que la humedad y el salpique de la lluvia no los deterioren. La tierra es durable siempre que tenga "buenas botas y buen sombrero".
      </S>
      <S t="Columnas y estructura de guadua">
        La guadua es el "acero vegetal": por su forma de tubo resiste muchísimo en relación a su peso, crece en 4–6 años (madera fina tarda décadas) y es liviana, ideal para zonas sísmicas.
      </S>
      <S t={muro.titulo}>{muro.texto}</S>
      <S t="Entrepiso del altillo en guadua y esterilla">
        En vez de una plancha de concreto (costosa y pesada), el altillo se arma con vigas de guadua y esterilla: mucho más liviano, económico y de rápida construcción.
      </S>
      <S t='El "sombrero": techo a dos aguas con aleros'>
        La pendiente evacúa la lluvia rápido hacia los aleros, que alejan el agua y el sol de los muros de tierra. En los bordes se ponen canaletas para recoger el agua lluvia y reutilizarla.
      </S>
      <S t="Techo cruzado (X): cumbrera ventilada">
        Cuando un agua del techo se pasa por encima de la otra, queda una rendija protegida en la cumbrera: por ahí sale el aire caliente y el humo de la chimenea sin que entre la lluvia. Enfría la casa de forma natural, sin ventiladores.
      </S>
      <S t="Chimenea con hogar de piedra">
        La piedra y la tierra alrededor del fuego acumulan calor y lo van soltando lento durante la noche (masa térmica). El ducto saca el humo por encima del techo para que tire bien.
      </S>
      <S t="Ventanas enfrentadas: ventilación cruzada">
        Al abrir ventanas en paredes opuestas, el viento atraviesa la casa y renueva el aire. Junto con los muros que "respiran", evita moho y sofoco.
      </S>
      <p className="text-xs text-muted-foreground mt-2">
        Con buen mantenimiento (botas y sombrero en buen estado), una casa de tierra y guadua puede durar más de 100 años — y al final de su vida sus materiales vuelven a la tierra sin contaminar.
      </p>
    </div>
  );
}

// Entrada principal: escalón, portón destacado, techito sobre postes de guadua y letrero
function EntradaPrincipal({ x, z }: { x: number, z: number }) {
  return (
    <group position={[x, 0, z]}>
      {/* escalón */}
      <mesh castShadow receiveShadow position={[0, 0.09, -0.55]}>
        <boxGeometry args={[2.2, 0.18, 1.1]} />
        <meshStandardMaterial color="#857c6e" roughness={1} />
      </mesh>
      {/* portón de madera destacado (doble hoja, cerrado a la vista) */}
      {[-0.28, 0.28].map((o, i) => (
        <mesh key={i} castShadow position={[o, DOOR_H / 2, 0.09]}>
          <boxGeometry args={[0.54, DOOR_H - 0.05, 0.07]} />
          <meshStandardMaterial color="#8a3b1f" roughness={0.85} />
        </mesh>
      ))}
      {/* postes de guadua del alero */}
      {[-1, 1].map((s, i) => (
        <mesh key={`po${i}`} castShadow position={[s * 0.95, 1.25, -0.95]}>
          <cylinderGeometry args={[0.06, 0.075, 2.5, 7]} />
          <meshStandardMaterial color="#9aa25c" roughness={0.8} />
        </mesh>
      ))}
      {/* techito inclinado */}
      <mesh castShadow position={[0, 2.62, -0.55]} rotation={[0.35, 0, 0]}>
        <boxGeometry args={[2.5, 0.08, 1.5]} />
        <meshStandardMaterial color="#a0522d" roughness={1} />
      </mesh>
      {/* letrero */}
      <Text position={[0, 3.15, -0.8]} fontSize={0.34} color="#1a2e20" anchorX="center" anchorY="middle" rotation={[0, Math.PI, 0]}>
        Entrada principal
      </Text>
    </group>
  );
}

// Baranda de guadua para el altillo (con abertura centrada, igual que las puertas)
function Baranda({ axis, cx, cz, span, baseZ }: { axis: 'x' | 'z', cx: number, cz: number, span: number, baseZ: number }) {
  const RAIL_H = 0.95;
  // Baranda continua (sin abertura): la personita llega al altillo con los botones "Ir a"
  const seg = span / 2;
  if (seg <= 0.05) return null;
  const offs = [-seg / 2, seg / 2];
  const pos = (o: number): [number, number, number] => axis === 'x' ? [cx + o, 0, cz] : [cx, 0, cz + o];
  const railRot: [number, number, number] = axis === 'x' ? [0, 0, Math.PI / 2] : [Math.PI / 2, 0, 0];

  return (
    <group>
      {offs.map((o, i) => {
        const [px, , pz] = pos(o);
        const nPosts = Math.max(2, Math.round(seg / 0.7) + 1);
        return (
          <group key={i}>
            {/* pasamanos y travesaño */}
            {[RAIL_H, 0.5].map((hy, j) => (
              <mesh key={`r${j}`} castShadow position={[px, baseZ + hy, pz]} rotation={railRot}>
                <cylinderGeometry args={[0.045, 0.045, seg, 6]} />
                <meshStandardMaterial color="#9aa25c" roughness={0.8} />
              </mesh>
            ))}
            {/* parales */}
            {Array.from({ length: nPosts }, (_, j) => {
              const t = nPosts === 1 ? 0 : j / (nPosts - 1) - 0.5;
              const [qx, , qz] = pos(o + t * seg);
              return (
                <mesh key={`p${j}`} castShadow position={[qx, baseZ + RAIL_H / 2, qz]}>
                  <cylinderGeometry args={[0.04, 0.05, RAIL_H, 6]} />
                  <meshStandardMaterial color="#9aa25c" roughness={0.8} />
                </mesh>
              );
            })}
          </group>
        );
      })}
    </group>
  );
}

// Chimenea: hogar de piedra + ducto que sube y sale por el techo
function Chimenea({ x0, zc, maxH1, maxH2 }: { x0: number, zc: number, maxH1: number, maxH2: number }) {
  // El ducto sube por encima del techo cerrado: paredes piso 1 + altillo + margen
  const topY = maxH1 + (maxH2 > 0 ? maxH2 + 1.0 : 1.6);
  const ductH = topY - 1.5; // arranca sobre el hogar (1.5 m)
  return (
    <group position={[x0 + 0.45, 0, zc]}>
      {/* hogar de piedra */}
      <mesh castShadow position={[0, 0.75, 0]}>
        <boxGeometry args={[0.7, 1.5, 1.4]} />
        <meshStandardMaterial color="#857c6e" roughness={1} />
      </mesh>
      {/* boca del hogar */}
      <mesh position={[0.36, 0.55, 0]}>
        <boxGeometry args={[0.02, 0.8, 0.9]} />
        <meshStandardMaterial color="#1c130c" roughness={1} />
      </mesh>
      {/* fuego */}
      <mesh position={[0.3, 0.35, 0]}>
        <boxGeometry args={[0.15, 0.35, 0.6]} />
        <meshStandardMaterial color="#ff7a2f" emissive="#ff5500" emissiveIntensity={1.4} />
      </mesh>
      <pointLight position={[0.5, 0.6, 0]} color="#ff8844" intensity={1.2} distance={4} />
      {/* ducto */}
      <mesh castShadow position={[0, 1.5 + ductH / 2, 0]}>
        <boxGeometry args={[0.55, ductH, 0.7]} />
        <meshStandardMaterial color="#8a7f70" roughness={1} />
      </mesh>
      {/* corona */}
      <mesh castShadow position={[0, 1.5 + ductH + 0.08, 0]}>
        <boxGeometry args={[0.75, 0.16, 0.9]} />
        <meshStandardMaterial color="#6f665a" roughness={1} />
      </mesh>
    </group>
  );
}

// Escalera de madera y guadua que sube al altillo por el lado de la sala
function Escalera({ x, zStart, rise, run }: { x: number, zStart: number, rise: number, run: number }) {
  const n = Math.max(8, Math.round(rise / 0.19));
  const stepR = rise / n;
  const stepD = run / n;
  const railLen = Math.hypot(rise, run) + 0.5;
  const railRotX = Math.atan2(run, rise);
  return (
    <group>
      {Array.from({ length: n }, (_, i) => (
        <mesh key={i} castShadow receiveShadow position={[x, (i + 0.5) * stepR, zStart + (i + 0.5) * stepD]}>
          <boxGeometry args={[0.9, stepR, stepD]} />
          <meshStandardMaterial color="#b08c5f" roughness={1} />
        </mesh>
      ))}
      {/* pasamanos de guadua */}
      {[-0.42, 0.42].map((o, i) => (
        <mesh key={`h${i}`} castShadow position={[x + o, rise / 2 + 0.85, zStart + run / 2]} rotation={[railRotX, 0, 0]}>
          <cylinderGeometry args={[0.045, 0.045, railLen, 6]} />
          <meshStandardMaterial color="#9aa25c" roughness={0.8} />
        </mesh>
      ))}
      {/* parales del pasamanos */}
      {[0.15, 0.5, 0.85].map((t01, i) => (
        [-0.42, 0.42].map((o, j) => (
          <mesh key={`p${i}-${j}`} castShadow position={[x + o, t01 * rise + 0.45, zStart + t01 * run]}>
            <cylinderGeometry args={[0.035, 0.045, 0.9, 6]} />
            <meshStandardMaterial color="#9aa25c" roughness={0.8} />
          </mesh>
        ))
      ))}
    </group>
  );
}

type HoleRect = { minX: number, maxX: number, minZ: number, maxZ: number };

function Room3D({ room, maxH1, maxH2 = 0, wallSystem, stairHole }: { room: Room, maxH1: number, maxH2?: number, wallSystem: string, stairHole?: HoleRect }) {
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


  // Altillo: entrepiso de madera con vigas de guadua y baranda — sin paredes ni plancha
  if (isFloor2) {
    const nBeams = Math.max(2, Math.round(w / 1) + 1);
    return (
      <group>
        {/* Tablero del entrepiso (esterilla/madera) — con hueco para la escalera */}
        {(() => {
          const x0 = room.posX ?? 0;
          const z0 = room.posY ?? 0;
          const x1 = x0 + w;
          const z1 = z0 + l;
          const hle = stairHole && stairHole.minX < x1 && stairHole.maxX > x0 && stairHole.minZ < z1 && stairHole.maxZ > z0
            ? {
                minX: Math.max(stairHole.minX, x0), maxX: Math.min(stairHole.maxX, x1),
                minZ: Math.max(stairHole.minZ, z0), maxZ: Math.min(stairHole.maxZ, z1),
              }
            : null;
          const rects: [number, number, number, number][] = hle
            ? [
                [x0, hle.minX, z0, z1],
                [hle.maxX, x1, z0, z1],
                [hle.minX, hle.maxX, z0, hle.minZ],
                [hle.minX, hle.maxX, hle.maxZ, z1],
              ]
            : [[x0, x1, z0, z1]];
          return rects
            .filter(([a, b, c, d]) => b - a > 0.02 && d - c > 0.02)
            .map(([a, b, c, d], i) => (
              <mesh key={`deck${i}`} position={[(a + b) / 2, floorY, (c + d) / 2]} receiveShadow castShadow>
                <boxGeometry args={[b - a, 0.08, d - c]} />
                <meshStandardMaterial color="#b08c5f" roughness={1} />
              </mesh>
            ));
        })()}
        {/* Vigas de guadua debajo del entrepiso */}
        {Array.from({ length: nBeams }, (_, i) => {
          const t01 = nBeams === 1 ? 0 : i / (nBeams - 1) - 0.5;
          return (
            <mesh key={`beam${i}`} castShadow position={[x + t01 * (w - 0.2), baseZ - 0.07, z]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.07, 0.07, l, 7]} />
              <meshStandardMaterial color="#9aa25c" roughness={0.8} />
            </mesh>
          );
        })}
        {/* Barandas de guadua en el borde (con abertura como acceso) */}
        <Baranda axis="x" cx={x} cz={z - l / 2 + t / 2} span={w} baseZ={baseZ + 0.1} />
        <Baranda axis="x" cx={x} cz={z + l / 2 - t / 2} span={w} baseZ={baseZ + 0.1} />
        <Baranda axis="z" cx={x - w / 2 + t / 2} cz={z} span={l} baseZ={baseZ + 0.1} />
        <Baranda axis="z" cx={x + w / 2 - t / 2} cz={z} span={l} baseZ={baseZ + 0.1} />
        <Text
          position={[x, baseZ + 1.6, z]}
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

      {/* Chimenea en la sala */}
      {(room.kind === 'sala' || /chimenea/i.test(room.name)) && (
        <Chimenea x0={(room.posX ?? 0)} zc={z} maxH1={maxH1} maxH2={maxH2} />
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

function Roof({ rooms, maxH1, maxH2, roofType, crossed = false }: { rooms: Room[], maxH1: number, maxH2: number, roofType: string, crossed?: boolean }) {
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
  
  // El techo arranca sobre las paredes del piso 1; el altillo queda DEBAJO del techo
  const totalH = maxH1;
  const roofCol = roofColors[roofType] || roofColors.teja_barro;

  const isXLonger = w >= l;
  const roofLen = isXLonger ? w : l;
  const roofSpan = isXLonger ? l : w;
  // Pendiente: mínimo 30°, la necesaria para que el altillo quepa bajo la cumbrera,
  // y además que la baranda del altillo (≈1.15 m) libre el techo en sus bordes.
  let angle = Math.PI / 6;
  const f2Rooms = rooms.filter(r => r.floor === 2);
  if (maxH2 > 0 && f2Rooms.length) {
    angle = Math.max(angle, Math.atan((maxH2 + 0.4) / (roofSpan / 2)));
    // Distancia máxima (en el sentido corto) de un borde del altillo a la cumbrera
    let cEdge = 0;
    f2Rooms.forEach(r => {
      const a0 = isXLonger ? (r.posY ?? 0) : (r.posX ?? 0);
      const a1 = a0 + (isXLonger ? r.lengthM : r.widthM);
      const ridge = isXLonger ? cz : cx;
      cEdge = Math.max(cEdge, Math.abs(a0 - ridge), Math.abs(a1 - ridge));
    });
    const clear = roofSpan / 2 - cEdge;
    if (clear > 0.3) {
      angle = Math.max(angle, Math.atan(1.25 / clear));
    }
    angle = Math.min(angle, Math.PI * 0.3); // tope ~54° para que no quede absurdo
  }
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
      {/* Pitch + (cada agua va desde el alero hasta la cumbrera; en modo "cruzado" se pasa de la cumbrera) */}
      {(() => {
        const ext = crossed ? 1.0 : 0; // cuánto se pasa cada agua de la cumbrera (estilo cruzado)
        const len = slopeLen + ext;
        const dOff = roofSpan / 4 - (ext / 2) * Math.cos(angle);
        const yOff = actualH / 2 + (ext / 2) * Math.sin(angle);
        return (
          <>
            <mesh castShadow receiveShadow 
                  position={[isXLonger ? 0 : dOff, yOff, isXLonger ? dOff : 0]} 
                  rotation={[isXLonger ? angle : 0, 0, isXLonger ? 0 : -angle]}>
              <boxGeometry args={[isXLonger ? roofLen : len, 0.1, isXLonger ? len : roofLen]} />
              <meshStandardMaterial color={roofCol} roughness={0.8} />
            </mesh>
            <mesh castShadow receiveShadow 
                  position={[isXLonger ? 0 : -dOff, yOff, isXLonger ? -dOff : 0]} 
                  rotation={[isXLonger ? -angle : 0, 0, isXLonger ? 0 : angle]}>
              <boxGeometry args={[isXLonger ? roofLen : len, 0.1, isXLonger ? len : roofLen]} />
              <meshStandardMaterial color={roofCol} roughness={0.8} />
            </mesh>
          </>
        );
      })()}
    </group>
  );
}

/**
 * Builds 2D collision boxes (top-down) for the ground-floor walls.
 * Each wall gets a centered gap (DOOR_WIDTH) so the walkthrough can pass
 * between rooms and enter from outside — simple collision, not full doors.
 */
function buildCollisionBoxes(rooms: Room[], floor: number, stairHole?: HoleRect): Box2D[] {
  const boxes: Box2D[] = [];
  const t = WALL_T;

  // En el piso 2, el hueco de la escalera no es transitable
  if (floor === 2 && stairHole) {
    boxes.push({ ...stairHole });
  }

  rooms.filter(r => r.floor === floor).forEach(room => {
    const w = room.widthM;
    const l = room.lengthM;
    const x0 = room.posX ?? 0;
    const z0 = room.posY ?? 0;

    // El altillo es una plataforma con baranda continua: sin aberturas,
    // para que la personita no pueda "caerse" del borde.
    if (floor === 2) {
      boxes.push({ minX: x0, maxX: x0 + w, minZ: z0, maxZ: z0 + t });
      boxes.push({ minX: x0, maxX: x0 + w, minZ: z0 + l - t, maxZ: z0 + l });
      boxes.push({ minX: x0, maxX: x0 + t, minZ: z0, maxZ: z0 + l });
      boxes.push({ minX: x0 + w - t, maxX: x0 + w, minZ: z0, maxZ: z0 + l });
      return;
    }

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
  const [roofMode, setRoofMode] = useState<'cerrado' | 'cruzado' | 'abierto'>('cerrado');
  const [showInfo, setShowInfo] = useState(false);
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

  // Escalera al altillo: sube por dentro del espacio del piso 1 que queda debajo,
  // pegada al borde derecho del altillo, con hueco en el entrepiso donde desemboca.
  const stair = useMemo(() => {
    const alt = placedRooms.find(r => r.floor === 2);
    if (!alt) return null;
    const ax0 = alt.posX ?? 0;
    const az0 = alt.posY ?? 0;
    const ax1 = ax0 + alt.widthM;
    const x = ax1 - WALL_T - 0.55; // separada de la pared del piso 1
    const rise = maxH1 + 0.1;
    const run = Math.min(3.6, alt.lengthM - 1.2);
    const zStart = az0 + 0.3;
    const hole: HoleRect = {
      minX: x - 0.5,
      maxX: Math.min(x + 0.5, ax1 - WALL_T),
      minZ: zStart + run - 1.5,
      maxZ: Math.min(zStart + run + 0.3, az0 + alt.lengthM - WALL_T),
    };
    return { x, zStart, rise, run, hole };
  }, [placedRooms, maxH1]);

  const collisionBoxes = useMemo(() => buildCollisionBoxes(placedRooms, walkFloor, stair?.hole), [placedRooms, walkFloor, stair]);

  // Entrada principal: en la pared delantera (menor z) de la sala (o del primer cuarto del piso 1)
  const entrada = useMemo(() => {
    const f1 = placedRooms.filter(r => r.floor === 1);
    if (!f1.length) return null;
    const minZ = Math.min(...f1.map(r => r.posY ?? 0));
    const maxZ = Math.max(...f1.map(r => (r.posY ?? 0) + r.lengthM));
    const salaFront = f1.filter(r => Math.abs((r.posY ?? 0) - minZ) < 0.01);
    const main = salaFront.find(r => r.kind === 'sala') ?? salaFront[0] ?? f1[0];
    const x = (main.posX ?? 0) + main.widthM / 2;
    // Parte trasera: centro de la fachada de mayor z
    const backRooms = f1.filter(r => Math.abs(((r.posY ?? 0) + r.lengthM) - maxZ) < 0.01);
    const back = backRooms[0] ?? f1[0];
    const minX = Math.min(...f1.map(r => r.posX ?? 0));
    const maxX = Math.max(...f1.map(r => (r.posX ?? 0) + r.widthM));
    return {
      x, z: minZ, backX: (back.posX ?? 0) + back.widthM / 2, backZ: maxZ,
      midX: (minX + maxX) / 2, midZ: (minZ + maxZ) / 2, minX, maxX,
    };
  }, [placedRooms]);

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
        {/* Cielo azul sólido para que la casa resalte del fondo */}
        <color attach="background" args={['#3d8de0']} />
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
              <Room3D key={r.id} room={r} maxH1={maxH1} maxH2={maxH2} wallSystem={wallSystem} stairHole={stair?.hole} />
            ))}
          {stair && <Escalera x={stair.x} zStart={stair.zStart} rise={stair.rise} run={stair.run} />}
          {entrada && (
            <>
              <EntradaPrincipal x={entrada.x} z={entrada.z} />
              {/* Letrero de la parte trasera */}
              <Text position={[entrada.backX, 2.4, entrada.backZ + 0.4]} fontSize={0.34} color="#1a2e20" anchorX="center" anchorY="middle">
                Parte trasera
              </Text>
              {/* Letrero del sobrecimiento de piedra: tabla de madera en los cuatro frentes */}
              {[
                { p: [entrada.midX, 0, entrada.z - 0.45] as [number, number, number], rotY: Math.PI },
                { p: [entrada.midX, 0, entrada.backZ + 0.45] as [number, number, number], rotY: 0 },
                { p: [entrada.minX - 0.45, 0, entrada.midZ] as [number, number, number], rotY: -Math.PI / 2 },
                { p: [entrada.maxX + 0.45, 0, entrada.midZ] as [number, number, number], rotY: Math.PI / 2 },
              ].map((l, i) => (
                <group key={`piedra${i}`} position={l.p} rotation={[0, l.rotY, 0]}>
                  {/* estaca */}
                  <mesh castShadow position={[0, 0.35, 0.03]}>
                    <cylinderGeometry args={[0.035, 0.045, 0.7, 6]} />
                    <meshStandardMaterial color="#7a5230" roughness={0.9} />
                  </mesh>
                  {/* tabla */}
                  <mesh castShadow position={[0, 0.72, 0]}>
                    <boxGeometry args={[2.6, 0.5, 0.05]} />
                    <meshStandardMaterial color="#f2e7cf" roughness={0.9} />
                  </mesh>
                  <Text position={[0, 0.72, 0.032]} fontSize={0.3} color="#241a0e" anchorX="center" anchorY="middle">
                    Bases en piedra (30 cm)
                  </Text>
                </group>
              ))}
            </>
          )}
          {/* En el recorrido se quita el techo para ver la casa por dentro desde arriba */}
          {!walkMode && roofMode !== 'abierto' && <Roof rooms={placedRooms} maxH1={maxH1} maxH2={maxH2} roofType={roofType} crossed={roofMode === 'cruzado'} />}
        </group>

        {walkMode ? (
          <WalkControls boxes={collisionBoxes} start={spawn ?? walkStart} floorY={walkFloorY} floor={walkFloor} touchInput={touchInput} rooms={placedRooms} onRoomChange={setCurrentRoom} />
        ) : (
          <OrbitControls target={[center[0], maxH1 / 2, center[2]]} minDistance={5} maxDistance={50} maxPolarAngle={Math.PI / 2 - 0.05} />
        )}
      </Canvas>

      {/* Overlay UI */}
      {!walkMode ? (
        <>
        <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
          {canWalk && (
            <Button size="sm" onClick={() => setWalkMode(true)} className="shadow-md">
              <Footprints className="w-4 h-4 mr-1.5" /> Recorrer
            </Button>
          )}
          <Button size="sm" variant={roofMode === 'cerrado' ? 'default' : 'secondary'} onClick={() => setRoofMode('cerrado')} className="shadow-md">
            Dos aguas
          </Button>
          <Button size="sm" variant={roofMode === 'cruzado' ? 'default' : 'secondary'} onClick={() => setRoofMode('cruzado')} className="shadow-md">
            Cruzado (X)
          </Button>
          <Button size="sm" variant={roofMode === 'abierto' ? 'default' : 'secondary'} onClick={() => setRoofMode('abierto')} className="shadow-md">
            Sin techo
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setShowInfo(v => !v)} className="shadow-md">
            <Info className="w-4 h-4 mr-1.5" /> ¿Por qué así?
          </Button>
        </div>
        {showInfo && <InfoBioconstruccion wallSystem={wallSystem} onClose={() => setShowInfo(false)} />}
        </>
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
