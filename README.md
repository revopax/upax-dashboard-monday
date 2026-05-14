# UPAX Dashboard Monday

Dashboard semanal para la Weekly de Marketing Corporativo de Grupo UPAX. Coordina la reunion semanal de ~27 personas organizadas en 5 squads.

**URL produccion:** https://upax-dashboard-monday.vercel.app
**Stack:** Next.js 14 (App Router), React 18, CSS-in-JS, Vercel Serverless

---

## Que hace

- **Agenda con timer:** 9 bloques cronometrados (60 min total)
- **Panorama operativo:** Items de Monday.com por squad, fase y responsable
- **Generacion de Demanda (GdD):** KPIs de funnel (Leads/MQLs/SQLs/Opps) desde HubSpot
- **Focos por squad:** Temas, blockers y necesidades cross-squad
- **Compromisos:** Seguimiento de acuerdos con sync a Monday.com
- **Minutas:** Generacion automatica, historico, envio a Slack, exportacion PDF

---

## Prerequisitos

- **Node.js** >= 18.17 (verificar con `node --version`)
- **npm** >= 9 (verificar con `npm --version`)
- Acceso a las APIs: Monday.com, HubSpot, Slack, Google Sheets (tokens en Vercel)

---

## Setup local (paso a paso)

```bash
# 1. Clonar el repositorio
git clone https://github.com/upax-mkt/upax-dashboard-monday.git
cd upax-dashboard-monday

# 2. Copiar variables de entorno
cp .env.example .env.local

# 3. Llenar las variables en .env.local (ver tabla abajo)
#    Pedir valores a Franco o Cesar

# 4. Instalar dependencias
npm install

# 5. Ejecutar en desarrollo
npm run dev

# 6. Abrir en el navegador
# http://localhost:3000 (pedira password: DASHBOARD_PASSWORD)
```

---

## Variables de entorno

| Variable | Requerida | Donde obtenerla | Descripcion |
|----------|-----------|-----------------|-------------|
| `MONDAY_API_KEY` | Si | monday.com > Avatar > Developers > My Access Tokens | Token personal de Monday.com |
| `MONDAY_BOARD_ID` | No | URL del board (default: `18044324200`) | ID del board Marketing Corporativo |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Si | HubSpot > Settings > Integrations > Private Apps | Token de la Private App |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Si | Google Cloud Console > IAM > Service Accounts > Keys | JSON completo de Service Account |
| `SHEETS_GDD_SPREADSHEET_ID` | Si | URL del spreadsheet (entre `/d/` y `/edit`) | ID del Forecast/GDD spreadsheet |
| `SHEETS_GDD_TAB_NAME` | No | Nombre de la tab (default: `KPIs_Weekly`) | Tab con targets semanales |
| `SLACK_BOT_TOKEN` | Si | api.slack.com > Your Apps > OAuth & Permissions | Token del bot de Slack |
| `SLACK_CHANNEL` | No | ID del canal (default: `C081Z8R4ZH9`) | Canal para enviar minutas |
| `KV_REST_API_URL` | Si | Vercel Dashboard > Storage > KV Store | URL de Upstash Redis |
| `KV_REST_API_TOKEN` | Si | Vercel Dashboard > Storage > KV Store | Token de Upstash Redis |
| `DASHBOARD_PASSWORD` | Si | Definir uno (ej: `MktCorp2026!`) | Password del login del dashboard |
| `API_SECRET` | Si | Generar: `openssl rand -hex 32` | Protege las API routes (server) |
| `NEXT_PUBLIC_API_SECRET` | Si | Mismo valor que `API_SECRET` | Mismo secret expuesto al browser |
| `CRON_SECRET` | Auto | Vercel lo inyecta automaticamente | Protege el cron job |

**Nota:** `KV_REST_API_READ_ONLY_TOKEN`, `KV_URL`, `REDIS_URL` son generados automaticamente por Vercel al conectar el KV Store. No necesitas configurarlos manualmente si usas Vercel.

---

## API Routes

| Ruta | Metodo | Descripcion | Servicio |
|------|--------|-------------|----------|
| `/api/monday` | GET | Items del board Monday.com (paginado, max 1500) | Monday.com |
| `/api/monday-write` | POST | Crear item en grupo Acuerdos Weeklys | Monday.com |
| `/api/gdd-hubspot` | GET | KPIs de GdD: Leads, MQLs, SQLs, Opps (x4 periodos) | HubSpot |
| `/api/hubspot-mqls` | GET | Desglose de MQLs por canal/origen | HubSpot |
| `/api/gdd-targets` | GET | Targets mensuales desde Google Sheets | Google Sheets |
| `/api/slack` | POST | Enviar minuta al canal de Slack | Slack |
| `/api/storage` | GET/POST | Proxy a Upstash Redis (sessions, cache, historial) | Upstash |
| `/api/commitments` | GET/POST | CRUD de compromisos persistentes | Upstash |
| `/api/cron/gdd-weekly-save` | GET | Cron: snapshot semanal GdD (domingos 12pm CDMX) | HubSpot + Upstash |
| `/api/backfill-gdd-history` | GET | Utilidad one-shot: backfill historico | HubSpot + Upstash |

Todas las rutas (excepto cron) requieren header `Authorization: Bearer <API_SECRET>`.

---

## Scripts

```bash
npm run dev     # Servidor de desarrollo (http://localhost:3000)
npm run build   # Build de produccion
npm run start   # Servidor de produccion (requiere build previo)
npm test        # Ejecutar tests (vitest)
```

---

## Deploy (Vercel)

1. El proyecto esta conectado a Vercel. Push a `main` dispara deploy automatico.
2. Variables de entorno se configuran en: Vercel Dashboard > Settings > Environment Variables.
3. **Despues de cambiar env vars**: necesitas hacer un nuevo deploy (Vercel no recarga env vars en caliente).
4. El KV Store (Upstash) se conecta desde: Vercel Dashboard > Storage > Connect Store.

---

## Actualizar el equipo (PERSONAS)

Cuando alguien entra o sale del equipo:

1. Editar `app/lib/constants.js` > array `PERSONAS`: agregar/quitar la persona con su squad
2. Editar `app/lib/server-constants.js` > objeto `MONDAY_USERS`: agregar/quitar el Monday user ID
3. Hacer push a `main` para que se despliegue

---

## Troubleshooting

| Problema | Solucion |
|----------|----------|
| "Monday esta lento" en loading | Monday.com a veces tarda. Espera ~30s o recarga la pagina |
| "MONDAY_API_KEY no configurada" | Verificar que la variable existe en Vercel env vars |
| "Unauthorized" en cualquier ruta | Verificar que `API_SECRET` y `NEXT_PUBLIC_API_SECRET` tienen el mismo valor |
| Dashboard no carga datos GdD | Verificar `HUBSPOT_PRIVATE_APP_TOKEN` en Vercel. Si esta vacio, los KPIs mostraran 0 |
| Build falla en Vercel | Correr `npm run build` local primero para ver el error exacto |
| "storage_not_configured" | Conectar un KV Store en Vercel Dashboard > Storage |

---

## Arquitectura

Para documentacion tecnica completa (componentes, flujo de datos, integraciones, seguridad): ver [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).
