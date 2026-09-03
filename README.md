# Calendario Curro

Gestión personal de turnos, horas y días (PWA offline). Calendario mensual donde
cada día admite varias anotaciones —turno (mañana/tarde/noche), horas extra,
libranzas, festivos, bajas, vacaciones, asuntos propios, regulación, permisos,
notas— con resumen del mes y **bolsa de horas** acumulada.

- **Sin conexión**: tras la primera carga funciona offline.
- **Privado**: todos los datos se guardan solo en el dispositivo (IndexedDB). Sin
  servidor ni cuentas.
- **Copias**: automáticas locales (OPFS) en cada cambio + exportar/compartir el
  `.json` cuando quieras.

## Estado

**Fase 1** (seguimiento usable): calendario, anotaciones por día con matriz de
incompatibilidades, turnos con autorelleno de 5 días, libranzas, bajas por rango,
bolsa de horas derivada, resumen mensual y copias de seguridad.

Pendiente (fases 2 y 3): motor de complementos de sábado/domingo/festivo, medios
festivos en turno de noche, previsión de nómina, configuración anual de días
disponibles, acumulación de vacaciones y avisos de caducidad. Ver
`.claude/plans/`.

## Desarrollo

```bash
npm install
npm run gen-icons      # genera public/icons/*.png (una vez, o al cambiar el logo)
npm run dev            # http://localhost:5173
npm test               # lógica de fechas, turnos, bolsa, compatibilidades
npm run typecheck
npm run build          # genera dist/ (app + service worker)
npm run preview         # sirve dist/ en http://localhost:4173
```

Stack: Preact + Vite + TypeScript · Dexie (IndexedDB) · date-fns · vite-plugin-pwa
(Workbox).

## Estructura

| Carpeta | Contenido |
|---|---|
| `src/db/` | Esquema Dexie, modelo de día/entradas, CRUD, bolsa de horas |
| `src/lib/` | Fechas y semana, etiquetas en español, matriz de incompatibilidades, constantes del convenio |
| `src/lib/calc/` | Lógica pura: autorelleno de turnos, deltas de bolsa, resumen mensual (aquí crecerá el motor de cálculo) |
| `src/components/` | Calendario, resumen, barra de bolsa, editor de día |
| `src/routes/` | Inicio (calendario + resumen) y Ajustes |
| `src/export/` | Copia JSON completa y copias automáticas en OPFS |

## Copias de seguridad

- **Automáticas locales**: en cada cambio se guarda una copia en el
  almacenamiento privado de la app (OPFS); se conservan las 10 últimas. Se
  pierden si borras los datos del navegador o desinstalas. Restaurar desde
  **Ajustes → Copias automáticas**.
- **Archivo**: **Ajustes → Compartir copia** (Android: mandar a Drive, correo…) o
  **Descargar copia**. Restaurar con **Restaurar desde archivo** (reemplazar o
  fusionar por fecha).

Para copias silenciosas a una carpeta del móvil o a Drive de forma programada
haría falta empaquetar la app con Capacitor (APK). Ver el plan en `.claude/plans/`.

## Publicar en el móvil (GitHub Pages)

1. Crea un repositorio en GitHub llamado **`calendario-curro`** (privado va bien).
   Si usas otro nombre, cámbialo en `vite.config.ts` (`const REPO = ...`).
2. Sube el proyecto:
   ```bash
   git init
   git add .
   git commit -m "Calendario Curro inicial"
   git branch -M main
   git remote add origin https://github.com/<usuario>/calendario-curro.git
   git push -u origin main
   ```
3. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
4. El workflow `.github/workflows/deploy.yml` compila y publica en cada push a
   `main`. La URL será `https://<usuario>.github.io/calendario-curro/`.
5. En el móvil, abre esa URL en **Chrome** → menú **⋮ → Añadir a pantalla de
   inicio** (o "Instalar aplicación"). La primera vez acepta el aviso de
   almacenamiento persistente en Ajustes de la app.

### Plan B: generar un APK

1. Con la app publicada en HTTPS, entra en <https://www.pwabuilder.com/>.
2. Pega la URL de GitHub Pages → **Package for stores → Android**.
3. Descarga el `.apk` (compilación en la nube) e instálalo en el móvil.

El `manifest.webmanifest` ya incluye nombre, iconos 192/512, uno *maskable* y
`display: standalone`.
