# Despliegue Produccion - Ferias Virtuales

## Arquitectura recomendada

- Frontend Next.js: Vercel
- Backend Express/Node: EasyPanel en VPS Hostinger
- Base de datos/Auth/Storage/Realtime: Supabase en EasyPanel
- IA: OpenAI API

## Backend en EasyPanel

Crear una app Node.js para la API.

Configuracion:

- App name: `ferias-api`
- Root directory: `backend`
- Install command: `npm ci`
- Build command: `npm run build`
- Start command: `npm run start`
- Health check path: `/health`
- Puerto interno: usar variable `PORT`, por ejemplo `3001`

Variables de entorno:

```env
PORT=3001
SUPABASE_URL=https://tu-supabase.example.com
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
CORS_ORIGINS=https://tudominio.com,https://www.tudominio.com,https://tu-proyecto.vercel.app
```

Dominio recomendado para backend:

```text
api.tudominio.com
```

La API debe responder:

```text
https://api.tudominio.com/health
```

## Frontend en Vercel

Crear proyecto desde GitHub apuntando al directorio `frontend`.

Configuracion:

- Framework: Next.js
- Root directory: `frontend`
- Install command: `npm ci`
- Build command: `npm run build`
- Output: automatico de Next.js

Variables de entorno:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tu-supabase.example.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
NEXT_PUBLIC_API_URL=https://api.tudominio.com/api
```

Dominio recomendado para frontend:

```text
tudominio.com
www.tudominio.com
```

## DNS

En el proveedor del dominio:

- `www` o dominio raiz hacia Vercel.
- `api` hacia EasyPanel/Hostinger.

## Checklist antes de abrir beta

- Frontend build pasa: `npm run build` dentro de `frontend`.
- Backend build pasa: `npm run build` dentro de `backend`.
- `https://api.tudominio.com/health` responde `ok: true`.
- Login funciona en produccion.
- Entrar a `/expo/[slug]` funciona.
- Panel admin carga ferias, pabellones y stands.
- Subida de imagen/PDF funciona en Storage.
- IA responde desde frontend con `NEXT_PUBLIC_API_URL`.
- CORS solo permite dominio final y URL Vercel.
- Supabase Auth tiene configurada la URL publica y redirects.

## Accesos que se necesitan

- Invitacion a GitHub o repositorio subido por el propietario.
- Acceso a Vercel como miembro del proyecto/equipo.
- Acceso a EasyPanel para crear/configurar la app backend.
- Acceso al panel DNS del dominio.
- Claves de Supabase/OpenAI introducidas en paneles de entorno, no pegadas en chats publicos.
