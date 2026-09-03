// Genera los PNG de iconos de la PWA a partir de un SVG.
// Uso: npm run gen-icons
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = resolve(root, 'public/icons')
await mkdir(outDir, { recursive: true })

const BG = '#0f172a'
const PAGE = '#38bdf8'
const HEAD = '#0ea5e9'
const INK = '#0f172a'

// Calendario centrado, escalable.
const cal = (scale) => `
  <g transform="translate(256 256) scale(${scale}) translate(-190 -190)">
    <rect x="24" y="20" width="30" height="60" rx="15" fill="#e2e8f0"/>
    <rect x="326" y="20" width="30" height="60" rx="15" fill="#e2e8f0"/>
    <rect x="10" y="48" width="360" height="330" rx="44" fill="${PAGE}"/>
    <rect x="10" y="48" width="360" height="92" rx="44" fill="${HEAD}"/>
    <g fill="${INK}">
      <rect x="60"  y="176" width="66" height="52" rx="12"/>
      <rect x="157" y="176" width="66" height="52" rx="12"/>
      <rect x="254" y="176" width="66" height="52" rx="12" opacity="0.5"/>
      <rect x="60"  y="256" width="66" height="52" rx="12" opacity="0.5"/>
      <rect x="157" y="256" width="66" height="52" rx="12"/>
      <rect x="254" y="256" width="66" height="52" rx="12"/>
    </g>
  </g>`

const svgNormal = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="96" fill="${BG}"/>${cal(0.78)}</svg>`

// Icono "maskable": fondo a sangre completa + logo dentro de la zona segura (~80%).
const svgMaskable = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>${cal(0.62)}</svg>`

async function png(svg, size, name) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer()
  await writeFile(resolve(outDir, name), buf)
  console.log('  ✓', name)
}

console.log('Generando iconos en public/icons/ …')
await png(svgNormal, 192, 'icon-192.png')
await png(svgNormal, 512, 'icon-512.png')
await png(svgNormal, 180, 'apple-touch-icon.png')
await png(svgMaskable, 192, 'icon-maskable-192.png')
await png(svgMaskable, 512, 'icon-maskable-512.png')
console.log('Hecho.')
