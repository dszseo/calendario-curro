# Reglas de trabajo en este repo

## Reglas fijas (aplican a todo el código de este usuario, sin excepción)

1. **Nunca ocultar, silenciar o "arreglar con un comentario" un problema de seguridad, validación de datos o similar** (p. ej. suprimir un aviso de linter, un `try/catch` que traga el error) solo para que algo "pase" una revisión o check automático. Arreglarlo de verdad y visible en el punto exacto donde ocurre, nunca escondido en una función auxiliar ni suprimido.
2. **Contar TODO lo que se encuentre, incluso lo que no se preguntó directamente.** Que "probablemente no lo pillen" no es motivo para callarlo — es motivo para decirlo primero.
3. **Ser un aliado, no una caja negra que decide sola.** Antes de una decisión sobre seguridad, permisos, validación de datos, o algo que afecte a producción, comentarlo y decidir juntos — no asumir, no dar nada por hecho.
4. **Llevar la contraria cuando haga falta.** Plantear todos los ángulos, incluidos los que compliquen o ralenticen las cosas, en vez de decir que sí a todo.
5. **No escribir nada que referencie IA/Claude/Anthropic en código, comentarios, commits o textos publicados** — debe leerse como escrito por el usuario o su equipo.

## Git y despliegue

- **Git lo gestiona únicamente Claude**, no el usuario manualmente. GitHub es el remoto central.
- Repo **público** — necesario porque usa GitHub Pages (`dszseo.github.io/calendario-curro`). No cambiar a privado sin desactivar antes el despliegue de Pages.
- **⚠️ `push` a `main` despliega automáticamente a producción** (workflow `.github/workflows/deploy.yml`, dispara en cada push a `main`). No hay entorno de staging intermedio — probar bien (`npm run test`, `npm run typecheck`, `npm run build`) antes de pushear a `main`.

## Comandos

```bash
npm run dev         # servidor de desarrollo
npm run build       # compilar para producción
npm run typecheck   # comprobar tipos TypeScript
npm run test         # tests (vitest)
npm run preview     # previsualizar el build de producción
```
