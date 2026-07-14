// Copia Monaco y Font Awesome desde node_modules a public/, para servirlos
// localmente (sin CDN). Se ejecuta en `postinstall`; como Wails corre
// `npm install` en su paso `frontend:install`, esto es automático en
// `wails dev` y `wails build`. Node puro (fs.cpSync), multiplataforma.

import { existsSync, mkdirSync, cpSync, copyFileSync, rmSync } from "node:fs";
import { dirname } from "node:path";

const jobs = [
  { name: "Monaco (vs)", src: "node_modules/monaco-editor/min/vs", dest: "public/vs", dir: true },
  { name: "Font Awesome CSS", src: "node_modules/@fortawesome/fontawesome-free/css/all.min.css", dest: "public/fa/css/all.min.css", dir: false },
  { name: "Font Awesome webfonts", src: "node_modules/@fortawesome/fontawesome-free/webfonts", dest: "public/fa/webfonts", dir: true },
];

let failed = false;
for (const { name, src, dest, dir } of jobs) {
  if (!existsSync(src)) {
    console.error(`[vendor-assets] ✗ no encontrado: ${src} (¿faltó 'npm install'?)`);
    failed = true;
    continue;
  }
  if (dir) {
    rmSync(dest, { recursive: true, force: true });
    cpSync(src, dest, { recursive: true });
  } else {
    mkdirSync(dirname(dest), { recursive: true });
    copyFileSync(src, dest);
  }
  console.log(`[vendor-assets] ✓ ${name} → ${dest}`);
}

if (failed) process.exit(1);
