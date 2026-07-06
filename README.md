# Orvito Admin Center

Panel del equipo ORVE para administrar los **materiales (brochures)** y **promociones** que el agente **Orvito** comparte por WhatsApp. Los cambios se reflejan en el siguiente mensaje del agente, sin redeploys.

- **Stack:** React + Vite + Tailwind. Auth con Supabase. Datos vía un gateway n8n (`orvito-admin`) que lee/escribe en NocoDB.
- **Ningún secreto en el frontend:** solo el `anon` de Supabase (público) y la URL del gateway. El token de NocoDB y el `service_role` viven en el servidor (n8n).

## Setup

```bash
npm install
cp .env.example .env   # ajusta valores si aplica
npm run dev            # desarrollo (http://localhost:5173)
npm run build          # build de producción -> dist/
npm run preview        # sirve el build (http://localhost:4173)
```

## Variables de entorno (build time)

| Variable | Qué es |
|---|---|
| `VITE_SUPABASE_URL` | URL base de Supabase (Kong/API, **no** la de Studio) |
| `VITE_SUPABASE_ANON_KEY` | anon key **pública** (Studio → Settings → API) |
| `VITE_GATEWAY_URL` | Webhook n8n del gateway: `.../webhook/orvito-admin` |

> ⚠️ Nunca pongas el `service_role` de Supabase ni el token de NocoDB en estas variables.

## Contrato del gateway

```
POST {VITE_GATEWAY_URL}
Headers: { Authorization: Bearer <supabase access_token>, Content-Type: application/json }
Body:    { "accion": <string>, "data": <object> }
```

| accion | data |
|---|---|
| `listar_brochures` | `{}` |
| `crear_brochure` | `{ proyecto, url, activo, notas }` |
| `editar_brochure` | `{ Id, ...campos }` |
| `eliminar_brochure` | `{ Id }` (soft delete → `activo=false`) |
| `listar_promociones` | `{}` |
| `crear_promocion` | `{ titulo, descripcion, proyectos_aplica, vigencia_inicio, vigencia_fin, activo }` |
| `editar_promocion` | `{ Id, ...campos }` |
| `eliminar_promocion` | `{ Id }` |

- Los enlaces de Dropbox se **normalizan a descarga directa** (`dl=0` → `raw=1`) antes de guardar.
- El estado de las promociones (Vigente / Programada / Expirada / Inactiva) se **calcula en el cliente** según fechas y `activo`.

## Deploy en EasyPanel (Docker)

`Dockerfile` multi-stage (build con Node + servido por nginx). Pasa las 3 variables como **build args / env**:

```bash
docker build \
  --build-arg VITE_SUPABASE_URL=... \
  --build-arg VITE_SUPABASE_ANON_KEY=... \
  --build-arg VITE_GATEWAY_URL=... \
  -t orvito-admin .
```

En EasyPanel: app tipo Dockerfile, puerto **80**, y define las 3 variables. `nginx.conf` ya maneja el SPA (todas las rutas → `index.html`).

## Gateway (n8n) — seguridad y variables de entorno

El gateway `orvito-admin` **valida el JWT de Supabase** en cada request (header `Authorization: Bearer <token>`): sin token o con token inválido responde `{ error, status: 401 }` y no ejecuta ninguna acción. El panel ya envía ese header automáticamente.

**Pendiente (migrar secretos a `$env`):** hoy los tokens de NocoDB y Chatwoot están embebidos en el Code node del gateway (server-side; nunca salen al frontend/respuestas). No se pudieron mover a `$env.*` porque la instancia de n8n tiene **`N8N_BLOCK_ENV_ACCESS_IN_NODE=true`** (acceso a env vars bloqueado). Para completarlo:

1. En EasyPanel (servicio n8n): **quitar** `N8N_BLOCK_ENV_ACCESS_IN_NODE` (o ponerlo en `false`) y **agregar** estas env vars:

   | Env var (n8n) | Valor |
   |---|---|
   | `SUPABASE_URL` | URL base de Supabase |
   | `SUPABASE_ANON_KEY` | anon key (pública) |
   | `NOCODB_TOKEN` | token `xc-token` de NocoDB (secreto) |
   | `CHATWOOT_TOKEN` | `api_access_token` de Chatwoot (secreto) |

2. Reiniciar el servicio n8n.
3. En el Code node del gateway, cambiar los literales por `$env.NOCODB_TOKEN`, `$env.CHATWOOT_TOKEN`, `$env.SUPABASE_URL`, `$env.SUPABASE_ANON_KEY` (los `TODO(env)` marcan dónde). Redeploy.

Mientras tanto, los secretos viven solo en n8n (no en este repo ni en el frontend).

## Checklist de humo (E2E)

1. **Login** con un usuario de Supabase (Authentication → Users).
2. **Materiales** carga la lista real (viene del gateway → NocoDB).
3. Crea un **material de prueba** (proyecto + enlace Dropbox) → aparece como Activo.
4. En WhatsApp, pídele a Orvito: **"mándame el brochure de [proyecto de prueba]"** → debe responder con el enlace nuevo.
5. **Borra** el material de prueba (queda inactivo) → Orvito deja de compartirlo.
6. Repite con una **promoción** de prueba dentro de vigencia.
