import { useMemo } from 'react';

/**
 * Paisaje decorativo alrededor de la casa: montañas, árboles, terneritos,
 * flores y un caminito de tierra. Todo low-poly y liviano.
 * Se monta dentro del <Canvas> de PlanViewer3D.
 */

// Pseudo-aleatorio determinista (misma escena en cada render)
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function Tree({ position, scale = 1 }: { position: [number, number, number]; scale?: number }) {
  return (
    <group position={position} scale={scale}>
      <mesh castShadow position={[0, 1, 0]}>
        <cylinderGeometry args={[0.15, 0.22, 2, 6]} />
        <meshStandardMaterial color="#6b4a2b" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 2.4, 0]}>
        <coneGeometry args={[1.1, 2.2, 7]} />
        <meshStandardMaterial color="#3e7a3a" roughness={1} />
      </mesh>
      <mesh castShadow position={[0, 3.3, 0]}>
        <coneGeometry args={[0.75, 1.6, 7]} />
        <meshStandardMaterial color="#4c8f45" roughness={1} />
      </mesh>
    </group>
  );
}

function Guadua({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      {[-0.25, 0, 0.28].map((dx, i) => (
        <mesh key={i} castShadow position={[dx, 2.2, i * 0.2 - 0.15]} rotation={[0, 0, (i - 1) * 0.06]}>
          <cylinderGeometry args={[0.07, 0.09, 4.4, 6]} />
          <meshStandardMaterial color="#7da34c" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]}>
        <sphereGeometry args={[0.9, 6, 5]} />
        <meshStandardMaterial color="#8fb45e" roughness={1} />
      </mesh>
    </group>
  );
}

/** Ternerito low-poly: cuerpo, cabeza, orejas, patas, manchas y colita */
function Calf({ position, rotationY = 0, tone = '#b98a5f' }: { position: [number, number, number]; rotationY?: number; tone?: string }) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* cuerpo */}
      <mesh castShadow position={[0, 0.55, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.45]} />
        <meshStandardMaterial color={tone} roughness={1} />
      </mesh>
      {/* mancha blanca */}
      <mesh position={[0.1, 0.56, 0]}>
        <boxGeometry args={[0.35, 0.52, 0.47]} />
        <meshStandardMaterial color="#f4ede2" roughness={1} />
      </mesh>
      {/* cabeza */}
      <mesh castShadow position={[0.62, 0.75, 0]}>
        <boxGeometry args={[0.32, 0.3, 0.3]} />
        <meshStandardMaterial color={tone} roughness={1} />
      </mesh>
      {/* hocico */}
      <mesh position={[0.8, 0.68, 0]}>
        <boxGeometry args={[0.14, 0.16, 0.22]} />
        <meshStandardMaterial color="#e8d8c6" roughness={1} />
      </mesh>
      {/* orejas */}
      <mesh position={[0.58, 0.92, 0.2]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color={tone} roughness={1} />
      </mesh>
      <mesh position={[0.58, 0.92, -0.2]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.16, 0.06, 0.1]} />
        <meshStandardMaterial color={tone} roughness={1} />
      </mesh>
      {/* patas */}
      {[[-0.32, 0.15], [-0.32, -0.15], [0.3, 0.15], [0.3, -0.15]].map(([x, z], i) => (
        <mesh key={i} castShadow position={[x, 0.15, z]}>
          <boxGeometry args={[0.11, 0.3, 0.11]} />
          <meshStandardMaterial color="#8a6647" roughness={1} />
        </mesh>
      ))}
      {/* colita */}
      <mesh position={[-0.48, 0.62, 0]} rotation={[0, 0, 0.5]}>
        <boxGeometry args={[0.06, 0.3, 0.06]} />
        <meshStandardMaterial color={tone} roughness={1} />
      </mesh>
    </group>
  );
}

function Mountains({ center }: { center: [number, number, number] }) {
  const hills = useMemo(() => {
    const rnd = mulberry32(7);
    const list: { x: number; z: number; r: number; h: number; c: string }[] = [];
    const colors = ['#5d7d55', '#4f6f4b', '#6b8a5e', '#547a50'];
    for (let i = 0; i < 14; i++) {
      const ang = (i / 14) * Math.PI * 2 + rnd() * 0.3;
      const dist = 70 + rnd() * 25;
      list.push({
        x: center[0] + Math.cos(ang) * dist,
        z: center[2] + Math.sin(ang) * dist,
        r: 18 + rnd() * 20,
        h: 12 + rnd() * 18,
        c: colors[i % colors.length],
      });
    }
    return list;
  }, [center]);
  return (
    <group>
      {hills.map((h, i) => (
        <mesh key={i} position={[h.x, 0, h.z]}>
          <coneGeometry args={[h.r, h.h, 8]} />
          <meshStandardMaterial color={h.c} roughness={1} flatShading />
        </mesh>
      ))}
    </group>
  );
}

export default function Scenery3D({ center, clearRadius = 14 }: { center: [number, number, number]; clearRadius?: number }) {
  const { trees, guaduas, flowers } = useMemo(() => {
    const rnd = mulberry32(42);
    const trees: { p: [number, number, number]; s: number }[] = [];
    const guaduas: [number, number, number][] = [];
    const flowers: { p: [number, number, number]; c: string }[] = [];
    const flowerColors = ['#e0607e', '#e8b23f', '#f0f0e0', '#c05fd0'];
    for (let i = 0; i < 26; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = clearRadius + 4 + rnd() * 35;
      const p: [number, number, number] = [center[0] + Math.cos(ang) * dist, 0, center[2] + Math.sin(ang) * dist];
      if (i % 5 === 0) guaduas.push(p);
      else trees.push({ p, s: 0.7 + rnd() * 0.9 });
    }
    for (let i = 0; i < 40; i++) {
      const ang = rnd() * Math.PI * 2;
      const dist = clearRadius * 0.5 + rnd() * 30;
      flowers.push({
        p: [center[0] + Math.cos(ang) * dist, 0.08, center[2] + Math.sin(ang) * dist],
        c: flowerColors[i % flowerColors.length],
      });
    }
    return { trees, guaduas, flowers };
  }, [center, clearRadius]);

  return (
    <group>
      <Mountains center={center} />

      {trees.map((t, i) => (
        <Tree key={`t${i}`} position={t.p} scale={t.s} />
      ))}
      {guaduas.map((p, i) => (
        <Guadua key={`g${i}`} position={p} />
      ))}

      {/* Terneritos pastando a un lado de la casa */}
      <Calf position={[center[0] + clearRadius + 3, 0, center[2] + 4]} rotationY={-0.6} />
      <Calf position={[center[0] + clearRadius + 5.5, 0, center[2] + 6.5]} rotationY={2.4} tone="#8a5a3b" />
      <Calf position={[center[0] + clearRadius + 4.2, 0, center[2] + 9]} rotationY={1.1} tone="#c9a06e" />

      {/* Caminito de tierra hacia la casa */}
      <mesh rotation={[-Math.PI / 2, 0, 0.15]} position={[center[0] + clearRadius * 0.9, 0.005, center[2] - 2]}>
        <planeGeometry args={[2.2, clearRadius * 2.2]} />
        <meshStandardMaterial color="#b09468" roughness={1} />
      </mesh>

      {/* Flores */}
      {flowers.map((f, i) => (
        <group key={`f${i}`} position={f.p}>
          <mesh>
            <sphereGeometry args={[0.09, 5, 4]} />
            <meshStandardMaterial color={f.c} roughness={1} />
          </mesh>
        </group>
      ))}

      {/* Cerquita de madera cerca de los terneritos */}
      <group position={[center[0] + clearRadius + 1.5, 0, center[2] + 6.5]}>
        {[0, 2, 4, 6].map((dz, i) => (
          <mesh key={i} castShadow position={[0, 0.5, dz - 3]}>
            <boxGeometry args={[0.12, 1, 0.12]} />
            <meshStandardMaterial color="#7a5c3a" roughness={1} />
          </mesh>
        ))}
        {[0.35, 0.75].map((y, i) => (
          <mesh key={`r${i}`} position={[0, y, 0]}>
            <boxGeometry args={[0.08, 0.08, 6.6]} />
            <meshStandardMaterial color="#8a6a44" roughness={1} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
