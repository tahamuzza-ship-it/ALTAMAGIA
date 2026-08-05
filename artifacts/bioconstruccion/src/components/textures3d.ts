// Texturas procedurales livianas (canvas) para la vista 3D realista.
// Son casi blancas en escala de grises: el color del material las tiñe,
// así conservamos la paleta por sistema constructivo sin cargar imágenes.
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three';

function makeTexture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void, repeat = 1): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx, size);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

let cache: Record<string, CanvasTexture> = {};
function memo(key: string, fn: () => CanvasTexture) {
  return (cache[key] ??= fn());
}

// Revoque de tierra: ruido suave + vetas horizontales (bahareque/adobe/tapia)
export function plasterTexture() {
  return memo('plaster', () => makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e8e2d8';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 2600; i++) {
      const g = 200 + Math.floor(Math.random() * 55);
      ctx.fillStyle = `rgba(${g},${g - 6},${g - 14},0.35)`;
      ctx.fillRect(Math.random() * s, Math.random() * s, 2 + Math.random() * 3, 1 + Math.random() * 2);
    }
    // vetas horizontales tenues (capas de tierra pisada)
    for (let y = 0; y < s; y += 10 + Math.random() * 14) {
      ctx.fillStyle = 'rgba(140,125,105,0.10)';
      ctx.fillRect(0, y, s, 1.5);
    }
  }));
}

// Teja de barro: canales verticales con sombra (se tiñe con el color del techo)
export function tileTexture() {
  return memo('tile', () => makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#e3d5c8';
    ctx.fillRect(0, 0, s, s);
    const w = 32; // ancho de cada teja
    for (let x = 0; x < s; x += w) {
      const grad = ctx.createLinearGradient(x, 0, x + w, 0);
      grad.addColorStop(0, 'rgba(80,50,30,0.45)');
      grad.addColorStop(0.5, 'rgba(255,245,235,0.25)');
      grad.addColorStop(1, 'rgba(80,50,30,0.45)');
      ctx.fillStyle = grad;
      ctx.fillRect(x, 0, w, s);
    }
    // filas de traslape horizontales
    for (let y = 0; y < s; y += 42) {
      ctx.fillStyle = 'rgba(60,35,20,0.35)';
      ctx.fillRect(0, y, s, 3);
    }
  }, 2));
}

// Pasto: puntitos verdes sobre base (se tiñe con el verde del terreno)
export function grassTexture() {
  return memo('grass', () => makeTexture(256, (ctx, s) => {
    ctx.fillStyle = '#dfe6d2';
    ctx.fillRect(0, 0, s, s);
    for (let i = 0; i < 5200; i++) {
      const g = 165 + Math.floor(Math.random() * 80);
      ctx.fillStyle = `rgba(${g - 60},${g},${g - 80},0.5)`;
      const x = Math.random() * s, y = Math.random() * s;
      ctx.fillRect(x, y, 1.4, 2.5 + Math.random() * 2.5);
    }
  }, 60));
}
