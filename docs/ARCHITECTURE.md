# UPAX Dashboard Monday — Architecture Document

> Documento de referencia para auditorias externas. Ultima actualizacion: 2026-05-04.

**URL produccion:** https://upax-dashboard-monday.vercel.app
**Stack:** Next.js 14.2.0 (App Router) · React 18 · CSS-in-JS (sin Tailwind) · Vercel Serverless
**Version UI:** v9.0

---

## Tabla de Contenidos

1. [Que es esta app](#1-que-es-esta-app)
2. [Estructura de archivos](#2-estructura-de-archivos)
3. [Componentes](#3-componentes)
4. [API Routes (endpoints)](#4-api-routes)
5. [Hooks](#5-hooks)
6. [Librerias internas (lib/)](#6-librerias-internas)
7. [Integraciones externas](#7-integraciones-externas)
8. [Flujo de datos](#8-flujo-de-datos)
9. [Autenticacion](#9-autenticacion)
10. [Almacenamiento (Upstash Redis)](#10-almacenamiento-upstash-redis)
11. [Variables de entorno](#11-variables-de-entorno)
12. [Cron Jobs](#12-cron-jobs)
13. [Seguridad](#13-seguridad)
14. [Testing](#14-testing)
15. [Decisiones tecnicas](#15-decisiones-tecnicas)
16. [Notas para el auditor](#16-notas-para-el-auditor)

---

## 1. Que es esta app

Dashboard interno para la weekly de Marketing Corporativo de Grupo UPAX. Coordina la reunion semanal de ~27 personas organizadas en 5 squads. Funciones principales:

- **Agenda con timer:** 9 bloques cronometrados (60 min total) con presenter por bloque
- **Panorama operativo:** Visualiza items de Monday.com por squad, fase y responsable
- **Generacion de Demanda (GdD):** KPIs de funnel (Leads/MQLs/SQLs/Opps) desde HubSpot con split Mkt vs Comercial
- **Focos por squad:** Captura de temas, blockers y necesidades cross-squad
- **Compromisos:** Seguimiento de acuerdos con sync a Monday.com
- **Minutas:** Generacion automatica, historico, envio a Slack, exportacion PDF
- **Audit log:** Registro de todas las acciones relevantes

---

## 2. Estructura de archivos

```
upax-dashboard-monday/
├── app/
│   ├── page.js                    # Root — carga Dashboard sin SSR
│   ├── layout.js                  # Layout raiz (Inter + JetBrains Mono)
│   ├── Dashboard.jsx              # Orquestador principal (~1,500 lineas)
│   ├── globals.css                # Minimal CSS (box-sizing, keyframes)
│   ├── api/
│   │   ├── _auth.js               # Helper de autenticacion compartido
│   │   ├── monday/route.js        # GET: items de Monday.com con paginacion
│   │   ├── monday-write/route.js  # POST: crear item en Monday.com
│   │   ├── slack/route.js         # POST: enviar mensaje a Slack
│   │   ├── storage/route.js       # GET/POST: proxy a Upstash Redis
│   │   ├── commitments/route.js   # GET/POST: compromisos persistentes
│   │   ├── gdd-hubspot/route.js   # GET: KPIs de GdD desde HubSpot
│   │   ├── gdd-targets/route.js   # GET: targets desde Google Sheets
│   │   ├── hubspot-mqls/route.js  # GET: MQLs por origen desde HubSpot
│   │   ├── cron/
│   │   │   └── gdd-weekly-save/route.js  # Cron: snapshot semanal GdD
│   │   └── backfill-gdd-history/route.js # One-shot: backfill historico
│   ├── components/
│   │   ├── ui.jsx                 # Primitivos: Card, Bar, Chip, PersonSelect, etc.
│   │   ├── TimerZone.jsx          # Barra sticky de timer durante reunion
│   │   ├── ErrorBoundary.jsx      # Error boundary por tab
│   │   ├── TabHome.jsx            # Tab: KPIs GdD, funnel, carga, overdue
│   │   ├── TabAgenda.jsx          # Tab: 9 bloques, presenters, tiempos
│   │   ├── TabPanorama.jsx        # Tab: vista por squad + alertas
│   │   ├── TabFocos.jsx           # Tab: focos/blockers/necesito por squad
│   │   ├── TabCompromisos.jsx     # Tab: compromisos con sync a Monday
│   │   ├── TabMinutas.jsx         # Tab: historico de minutas
│   │   ├── MinutaLightbox.jsx     # Modal fullscreen para minutas
│   │   ├── MinutaDetailView.jsx   # Visor/editor de minuta con PDF y Slack
│   │   ├── PhaseModal.jsx         # Modal: items por fase
│   │   └── AuditLogPanel.jsx      # Panel: log de acciones
│   ├── hooks/
│   │   └── useGDDData.js          # Hook unificado para datos de GdD
│   └── lib/
│       ├── api.js                 # Cliente: fetchAllItems, createMondayItem, sendToSlack
│       ├── constants.js           # Squads, fases, agenda, personas, keys
│       ├── server-constants.js    # Monday user IDs (solo server)
│       ├── utils.js               # Utilidades puras (parsers, date math, etc.)
│       ├── storage.js             # Cliente: storeGet/Set/Del/List via /api/storage
│       ├── upstash-server.js      # Server: upstashGet/Set/Command directo
│       ├── css.js                 # CSS-in-JS: design system completo
│       ├── minuta.js              # Generador de minuta en texto plano
│       └── __tests__/
│           ├── css.mobile.test.js         # Tests: breakpoints mobile
│           └── normalizeFocos.test.js     # Tests: migracion de schema focos
├── middleware.js                  # HTTP Basic Auth para paginas
├── next.config.js                 # Headers de seguridad
├── vercel.json                    # Cron config
├── package.json                   # Dependencies
└── .env.local                     # Variables de entorno (NO commitear)
```

---

## 3. Componentes

### `Dashboard.jsx` — Orquestador principal

Componente raiz client-side. Responsabilidades:
- Fetch de datos al montar (Monday items + cache)
- Estado global: `items`, `wd` (weekly data), timer, tabs, modals
- Computo de `analysis` via `useMemo` (items agrupados por squad, fase, persona, overdue)
- Renderiza tabs via `next/dynamic` (code-splitting)
- Keyboard shortcuts (flechas, espacio) durante timer activo
- Guardado automatico de minuta y session a Upstash

### Tabs

| Componente | Tab | Funcion |
|------------|-----|---------|
| `TabHome` | Inicio | KPIs GdD (4 metricas x 4 periodos), funnel, MQL breakdown, trend chart, carga por persona, overdue |
| `TabAgenda` | Agenda | 9 bloques con timer, presenter por bloque, tiempo real vs planeado |
| `TabPanorama` | Panorama | Vista Squads (barra de fases + overdue) y vista Alertas (overdue, detenidos, sin crono, sin responsable) |
| `TabFocos` | Focos | Formulario por squad: foco/blocker/necesito. Tab Cross-Squad agrega todos + formulario directo |
| `TabCompromisos` | Compromisos | Grid de compromisos semanales con % avance, sync a Monday, compromisos previos |
| `TabMinutas` | Minutas | Historico de minutas, visor visual, edicion, copia, envio Slack, PDF |

### Primitivos (`ui.jsx`)

| Componente | Uso |
|------------|-----|
| `Card` | Contenedor con sombra y border-radius |
| `Bar` | Barra horizontal apilada (segmentos con color/ancho) |
| `Chip` | Boton tipo pill toggle |
| `Alerta` | Bloque de alerta con borde lateral coloreado |
| `PersonSelect` | Dropdown searchable con filtro, agrupado por squad |
| `CopyModal` | Modal fullscreen con textarea para copiar |
| `PersonDetailView` | Lista expandible de tareas por persona |
| `NumInput` | Input numerico con commit on blur |
| `SquadInputSection` | Fila de textarea con PersonSelect + date (usado en Focos) |

### Otros

| Componente | Funcion |
|------------|---------|
| `TimerZone` | Barra sticky: reloj, controles, timeline de bloques, progreso |
| `ErrorBoundary` | Wrapper por tab — muestra error + boton reintentar |
| `MinutaLightbox` | Modal fullscreen con blur backdrop |
| `MinutaDetailView` | Visor/editor de minuta: vista visual, texto, Slack, PDF |
| `PhaseModal` | Modal: lista items de una fase especifica |
| `AuditLogPanel` | Panel colapsable: historial de acciones filtrable |

---

## 4. API Routes

### Autenticacion comun

Todos los endpoints (excepto cron) requieren header `Authorization: Bearer <API_SECRET>`.
Validacion via `app/api/_auth.js` → `validateAuth(request)`.
En desarrollo (`NODE_ENV=development`) se puede omitir si `API_SECRET` no esta seteado.

### Endpoints

#### `GET /api/monday`
- **Funcion:** Lee items del board Monday.com con paginacion (hasta 1,500 items)
- **Filtro:** Solo grupo Delivery (`group_mm15cfz2`)
- **Paginacion:** Cursor-based, max 15 paginas de 100
- **Rate limiting:** Retry automatico en HTTP 429 (una vez, con `Retry-After`)
- **Timeout:** 15 segundos por request
- **Respuesta:** `{ items: [...normalizado], groups, total, ts }`
- **Env vars:** `MONDAY_API_KEY`, `MONDAY_BOARD_ID`

#### `POST /api/monday-write`
- **Funcion:** Crea item en grupo Acuerdos Weeklys (`group_mm1mhsd1`)
- **Body:** `{ name, dateStr, personId, personName }`
- **Detalle:** Resuelve `personName → Monday user ID` server-side via `MONDAY_USERS` map
- **Env vars:** `MONDAY_API_KEY`, `MONDAY_BOARD_ID`, `API_SECRET`

#### `POST /api/slack`
- **Funcion:** Envia mensaje a Slack via `chat.postMessage`
- **Body:** `{ text, channel? }`
- **Limite:** Trunca a 39,000 caracteres
- **Env vars:** `SLACK_BOT_TOKEN`, `SLACK_CHANNEL`

#### `GET/POST /api/storage`
- **Funcion:** Proxy a Upstash Redis
- **GET:** `?action=get&key=` o `?action=list&prefix=`
- **POST:** `action: "set"` (TTL 365 dias) o `action: "delete"`
- **Validacion de keys:** Regex `/^(weekly:\d{4}-\d{2}-\d{2}(:.+)?|monday-cache-v\d+|audit_log|gdd_history)$/`
- **Limite:** 5MB max por valor
- **Env vars:** `KV_REST_API_URL`, `KV_REST_API_TOKEN`

#### `GET /api/gdd-hubspot`
- **Funcion:** KPIs de Generacion de Demanda desde HubSpot CRM
- **Metricas:** Leads, MQLs, SQLs, Opps × 4 periodos (semana, anterior, mes, ytd)
- **Split:** Cada metrica separada en Mkt vs Comercial
- **Exclusiones UDN:** Filtra `udn != "Interno"` y `udn != "CF"`
- **Cache:** Upstash 15 min (5 min en fallo parcial). Soporta `?nocache=1`
- **Env vars:** `HUBSPOT_PRIVATE_APP_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

#### `GET /api/hubspot-mqls`
- **Funcion:** Desglose de MQLs por canal/origen para una semana
- **Params:** `semana_desde`, `semana_hasta` (requeridos)
- **Detalle:** Usa `fuente_conversion` primero, fallback a `hs_analytics_source`. Calcula split inbound/outbound y mkt/com
- **Cache:** Upstash 30 min
- **Env vars:** `HUBSPOT_PRIVATE_APP_TOKEN`, `KV_REST_API_URL`, `KV_REST_API_TOKEN`

#### `GET /api/gdd-targets`
- **Funcion:** Lee targets de KPIs desde Google Sheets
- **Auth Google:** JWT manual con `crypto.subtle` (sin SDK). Token cacheado 1 hora en memoria
- **Spreadsheet:** `1Xd1CFY4gwxmKV8OHti9a1XjCmO2Q5NtUlGulfgbxtaE`, tab `KPIs_Weekly`
- **Cache:** Upstash 24 horas
- **Env vars:** `GOOGLE_SERVICE_ACCOUNT_JSON`, `SHEETS_GDD_SPREADSHEET_ID`, `SHEETS_GDD_TAB_NAME`

#### `GET /api/commitments` + `POST /api/commitments`
- **Funcion:** CRUD de compromisos persistentes
- **Key Upstash:** `upax_commitments` (TTL 365 dias)
- **Env vars:** `KV_REST_API_URL`, `KV_REST_API_TOKEN`

#### `GET /api/cron/gdd-weekly-save`
- **Funcion:** Snapshot semanal automatico. Llama internamente a `/api/gdd-hubspot` y `/api/hubspot-mqls`, guarda en `gdd_history`
- **Schedule:** Domingos 18:00 UTC (12:00 PM CDMX)
- **Auth:** `CRON_SECRET` (inyectado por Vercel)
- **Umbral:** No sobreescribe si diferencia <2% en todas las metricas

#### `GET /api/backfill-gdd-history`
- **Funcion:** Utilidad one-shot para completar `por_origen` en entries historicos
- **Auth:** `CRON_SECRET` o `API_SECRET`

---

## 5. Hooks

### `useGDDData()` — `app/hooks/useGDDData.js`

Hook unificado para todos los datos de Generacion de Demanda. Se ejecuta una vez al montar (guard con `fetchedRef`).

**Secuencia:**
1. Fetch `/api/gdd-hubspot` (15s timeout) → `gddData`
2. Fetch `/api/hubspot-mqls` x2 en paralelo (semana actual + anterior) → `mqlBreakdown`, `mqlBreakdownPrev`
3. Fetch `gdd_history` de Upstash + `/api/gdd-targets` en paralelo → `history`, `targets`
4. Auto-guarda semana actual y anterior en `gdd_history` si hay datos nuevos (umbral 5%)

**Retorna:** `{ gddData, mqlBreakdown, mqlBreakdownPrev, targets, history, setHistory, loading, error, refetch }`

---

## 6. Librerias internas

### `lib/api.js` — Cliente HTTP
- `authHeaders()` — headers con `Authorization: Bearer <NEXT_PUBLIC_API_SECRET>`
- `fetchAllItems()` — llama `GET /api/monday`
- `createMondayItem(name, dateStr, personName)` — llama `POST /api/monday-write`
- `sendToSlack(text)` — llama `POST /api/slack`

### `lib/constants.js` — Configuracion cliente
- `SQUADS` — 5 squads con nombres oficiales
- `SQUAD_ALIASES` — mapa de normalizacion de variantes
- `PHASES` — 6 fases con colores hex
- `AGENDA` — 9 bloques con duracion y color
- `PERSONAS` — 27 miembros con squad, rol SDR, estrella
- `TODAY_STR` — fecha en timezone Mexico City
- `STORE_KEY`, `CACHE_KEY` — keys de Upstash
- `emptyWeekly()` — factory de session vacia

### `lib/server-constants.js` — Solo server
- `MONDAY_USERS` — mapa `"Nombre Completo" → Monday user ID` (22 usuarios)

### `lib/utils.js` — Utilidades puras
- `normalizePersonName()` — fuzzy match de nombres Monday → PERSONAS (con cache)
- `parseTL()` — parsea timeline `"YYYY-MM-DD - YYYY-MM-DD"` → `{ start, end }`
- `isOverdue()`, `isActive()`, `overlapsThisWeek()` — clasificacion de items
- `normalizeFocos()` — migracion de schema v7.x (objeto) → v9.x (array)
- `copyToClipboard()`, `shortName()`, `downloadTextFile()`, `pctColor()`

### `lib/storage.js` — Cliente Upstash
- `storeGet(key)`, `storeSet(key, val)`, `storeDel(key)`, `storeList(prefix)`
- `storeList` tiene fallback: si SCAN no retorna resultados, construye keys de las ultimas 8 semanas

### `lib/upstash-server.js` — Server Upstash
- `upstashGet(key)`, `upstashSet(key, value, ttlSeconds)`, `upstashCommand(cmd, ...args)`
- Usa Upstash REST API directamente (no SDK)

### `lib/css.js` — Design system
- Exporta `CSS` como template literal string
- Variables CSS: colores, radios, sombras, fuentes
- Design system: Apple Modern Light
- Responsive: breakpoints 640px y 480px
- Modo presentador: `transform: scale(var(--ps))`

### `lib/minuta.js` — Generador de minutas
- `generateMinuta(wd, analysis, gddData, blockTimes)` → texto plano (~40KB max)
- 5 secciones: GdD, Panorama, Focos, Compromisos, Carga semanal
- Formato optimizado para Slack

---

## 7. Integraciones externas

### Monday.com
| Aspecto | Detalle |
|---------|---------|
| API | GraphQL v2, version `2024-01` |
| Auth | Header `Authorization: <api_key>` (sin Bearer) |
| Board | `18044324200` — Marketing Corporativo |
| Grupo lectura | `group_mm15cfz2` (Delivery) |
| Grupo escritura | `group_mm1mhsd1` (Acuerdos Weeklys) |
| Columnas | person, squad (color_mkz0s203), phase (color_mkz09na), timeline (timerange_mkzcqv0j), dates, subitems |

### HubSpot CRM
| Aspecto | Detalle |
|---------|---------|
| API | CRM v3 REST |
| Auth | `Authorization: Bearer <HUBSPOT_PRIVATE_APP_TOKEN>` |
| Objetos | contacts (leads, MQLs), deals (opps), meetings (SQLs) |
| Propiedades custom | `fecha_lead`, `fecha_mql`, `contacto_marketing`, `conversion`, `udn`, `fuente_mql`, `fuente_conversion`, `reunion_generado_por`, `negocio_marketing`, `tipo_de_venta` |
| Exclusiones | `udn != "Interno"`, `udn != "CF"` |
| Pipelines (opps) | 8 IDs: 646364160, 31468827, 79805840, 53534318, 53534328, 53652407, 31419220, 646793827 |

### Slack
| Aspecto | Detalle |
|---------|---------|
| API | `chat.postMessage` |
| Auth | `Authorization: Bearer <SLACK_BOT_TOKEN>` |
| Canal default | `C081Z8R4ZH9` |
| Limite | 39,000 caracteres (trunca con nota) |

### Google Sheets
| Aspecto | Detalle |
|---------|---------|
| API | Sheets REST v4 |
| Auth | Service Account JWT manual (`crypto.subtle`, sin SDK) |
| Scope | `spreadsheets.readonly` |
| Spreadsheet | `1Xd1CFY4gwxmKV8OHti9a1XjCmO2Q5NtUlGulfgbxtaE` |
| Tab | `KPIs_Weekly` columnas A:C |

### Upstash Redis
| Aspecto | Detalle |
|---------|---------|
| Protocolo | REST API (no Redis nativo — compatible con Vercel Serverless) |
| Auth | `Authorization: Bearer <KV_REST_API_TOKEN>` |
| Comandos | GET, SET (con EX/TTL), DEL, SCAN |

---

## 8. Flujo de datos

```
Browser (SPA)              Next.js API Routes             Servicios Externos
     |                            |                              |
     |  1. Mount Dashboard        |                              |
     |--- storeGet(cache) ------->| /api/storage --------------->| Upstash Redis
     |<--- items (cached) --------|<------------------------------|
     |                            |                              |
     |  2. Si no hay cache:       |                              |
     |--- fetchAllItems() ------->| /api/monday ----------------->| Monday.com GraphQL
     |<--- items (fresh) ---------|<------------------------------|
     |--- storeSet(cache, items)  |                              |
     |                            |                              |
     |  3. useGDDData() hook:     |                              |
     |--- fetch gdd-hubspot ----->| /api/gdd-hubspot ----------->| HubSpot CRM (x8 queries)
     |<--- gddData ---------------|<------------------------------|
     |                            |                              |
     |--- fetch hubspot-mqls x2 ->| /api/hubspot-mqls ---------->| HubSpot CRM
     |<--- mqlBreakdown ----------|<------------------------------|
     |                            |                              |
     |--- storeGet(gdd_history) ->| /api/storage --------------->| Upstash
     |<--- history ---------------|<------------------------------|
     |                            |                              |
     |--- fetch gdd-targets ----->| /api/gdd-targets ----------->| Google Sheets API
     |<--- targets ---------------|<------------------------------|
     |                            |                              |
     |  4. Computo client-side:   |                              |
     |  analysis = useMemo(items) | (no server)                  |
     |                            |                              |
     |  5. Acciones de usuario:   |                              |
     |--- storeSet(weekly, wd) -->| /api/storage POST ---------->| Upstash
     |--- createMondayItem() ---->| /api/monday-write ---------->| Monday.com
     |--- sendToSlack(minuta) --->| /api/slack ----------------->| Slack API
     |                            |                              |
     |  6. Cron (domingo 18 UTC): |                              |
     |                   -------->| /api/cron/gdd-weekly-save    |
     |                            |--- gdd-hubspot (interno) --->| HubSpot
     |                            |--- hubspot-mqls (interno) -->| HubSpot
     |                            |--- save gdd_history -------->| Upstash
```

---

## 9. Autenticacion

Dos capas independientes:

### Capa 1: HTTP Basic Auth (paginas web)
- **Donde:** `middleware.js` (Next.js Edge Middleware)
- **Aplica a:** Todas las rutas de pagina (excluye `api/*`, `_next/static`, `favicon.ico`)
- **Password:** `DASHBOARD_PASSWORD`
- **Mecanismo:** Browser muestra dialogo nativo de login. Solo valida password, ignora username
- **Proposito:** Evitar acceso no autorizado a la interfaz

### Capa 2: Bearer Token (API routes)
- **Donde:** `app/api/_auth.js` → `validateAuth(request)`
- **Aplica a:** Todos los API routes
- **Secret:** `API_SECRET` (server) = `NEXT_PUBLIC_API_SECRET` (cliente, mismo valor)
- **Mecanismo:** Cliente envia `Authorization: Bearer <token>` en cada fetch
- **Proposito:** Proteger endpoints de scraping casual

### Capa Cron
- **Donde:** Inline en rutas cron
- **Secret:** `CRON_SECRET` (inyectado automaticamente por Vercel)

### Nota de seguridad
`NEXT_PUBLIC_API_SECRET` se expone al browser intencionalmente (es un `NEXT_PUBLIC_` var). Cualquier persona con acceso a la pagina (que paso Basic Auth) puede ver el token en el bundle JS o en network requests. Es un trade-off de diseno: la primera capa (Basic Auth) limita quien llega a la pagina.

---

## 10. Almacenamiento (Upstash Redis)

Todos los valores son JSON strings. Keys con TTL de 365 dias salvo que se indique otro.

### Keys del cliente (via `/api/storage` con validacion)

| Key | Contenido | TTL |
|-----|-----------|-----|
| `weekly:YYYY-MM-DD` | Session semanal completa: presenters, focos, compromisos, synced, notas cierre, minuta, gdd_snapshot, analysis_snapshot | 365d |
| `weekly:YYYY-MM-DD:before_reset` | Backup automatico antes de reset | 365d |
| `monday-cache-v3` | Cache de items Monday: `{ items, ts, doneCount }` | 365d |
| `audit_log` | Array de hasta 500 entradas: `{ id, ts, tipo, descripcion, datos, origen }` | 365d |
| `gdd_history` | Array de snapshots semanales GdD ordenado desc | 365d |

### Keys del servidor (via `upstash-server.js`, sin validacion de proxy)

| Key | Contenido | TTL |
|-----|-----------|-----|
| `gdd-hubspot-v2-YYYY-MM-DD` | Cache de `/api/gdd-hubspot` | 15 min |
| `hubspot-mqls-YYYY-MM-DD-YYYY-MM-DD` | Cache de `/api/hubspot-mqls` | 30 min |
| `gdd-targets-v1-YYYY-M` | Cache de `/api/gdd-targets` | 24h |
| `upax_commitments` | Array de compromisos cross-session | 365d |

### Validacion de keys
El proxy `/api/storage` valida keys contra regex:
```
/^(weekly:\d{4}-\d{2}-\d{2}(:.+)?|monday-cache-v\d+|audit_log|gdd_history)$/
```
Keys de cache del server (gdd-hubspot-v2-*, etc.) se escriben directamente sin pasar por el proxy.

---

## 11. Variables de entorno

### Server-side (API routes)

| Variable | Requerida | Usado en | Proposito |
|----------|-----------|----------|-----------|
| `API_SECRET` | Si | `_auth.js`, todos los routes | Secret compartido para Bearer auth |
| `MONDAY_API_KEY` | Si | `/api/monday`, `/api/monday-write` | Personal access token de Monday.com |
| `MONDAY_BOARD_ID` | No | `/api/monday`, `/api/monday-write` | Default: `18044324200` |
| `HUBSPOT_PRIVATE_APP_TOKEN` | Si | `/api/gdd-hubspot`, `/api/hubspot-mqls` | Private App token de HubSpot |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Si | `/api/gdd-targets` | JSON completo del Service Account |
| `SHEETS_GDD_SPREADSHEET_ID` | Si | `/api/gdd-targets` | ID del spreadsheet de targets |
| `SHEETS_GDD_TAB_NAME` | No | `/api/gdd-targets` | Default: `KPIs_Weekly` |
| `SLACK_BOT_TOKEN` | Si | `/api/slack` | OAuth token del bot de Slack |
| `SLACK_CHANNEL` | No | `/api/slack` | Default: `C081Z8R4ZH9` |
| `KV_REST_API_URL` | Si | Storage routes, `upstash-server.js` | Upstash Redis REST URL |
| `KV_REST_API_TOKEN` | Si | Storage routes, `upstash-server.js` | Upstash Redis REST token |
| `DASHBOARD_PASSWORD` | Si | `middleware.js` | Password para Basic Auth de la UI |
| `CRON_SECRET` | Si | Cron routes | Token de autorizacion Vercel Cron |

Aliases aceptados: `UPSTASH_REDIS_REST_URL` (= `KV_REST_API_URL`), `UPSTASH_REDIS_REST_TOKEN` (= `KV_REST_API_TOKEN`)

### Client-side (expuesta al browser)

| Variable | Usado en | Proposito |
|----------|----------|-----------|
| `NEXT_PUBLIC_API_SECRET` | `lib/api.js`, `lib/storage.js`, `hooks/useGDDData.js` | Mismo valor que `API_SECRET`, enviado como Bearer token desde el browser |

---

## 12. Cron Jobs

| Schedule | Ruta | Funcion |
|----------|------|---------|
| Domingos 18:00 UTC (12:00 PM CDMX) | `/api/cron/gdd-weekly-save` | Snapshot semanal de GdD: llama a gdd-hubspot + hubspot-mqls internamente, guarda en gdd_history |

**Interpretacion del schedule:** `0 18 * * 0` = minuto 0, hora 18 UTC, cualquier dia del mes, cualquier mes, domingo (0).
En horario Mexico CDMX (UTC-6): domingos a las 12:00 PM mediodia.
En horario Mexico CDMX con horario de verano (UTC-5): domingos a las 1:00 PM.

Configurado en `vercel.json`:
```json
{ "crons": [{ "path": "/api/cron/gdd-weekly-save", "schedule": "0 18 * * 0" }] }
```

---

## 13. Seguridad

### Headers (next.config.js)
- `X-Frame-Options: SAMEORIGIN` — previene clickjacking
- `X-Content-Type-Options: nosniff` — previene MIME sniffing
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-DNS-Prefetch-Control: on`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

### Otras medidas
- `robots: noindex` en metadata — no indexable por buscadores
- Server-constants (`MONDAY_USERS`) separados del bundle cliente
- Key validation en storage proxy — previene escritura a keys arbitrarias
- 5MB max en storage proxy — previene abuse
- Rate limit handling en Monday API (retry con backoff)
- Timeouts en todos los fetches (10-15s) con AbortController

### Consideraciones
- `NEXT_PUBLIC_API_SECRET` es visible en el bundle JS del browser
- No hay rate limiting propio en los API routes (depende de Vercel)
- No hay CSRF protection explicita (mitigado por Bearer token)
- Credenciales en `.env.local` — verificar que esta en `.gitignore`

---

## 14. Testing

**Framework:** Vitest 4.1.5
**Comando:** `npm test` (`vitest run`)

### Tests existentes

| Archivo | Tests | Que valida |
|---------|-------|------------|
| `lib/__tests__/css.mobile.test.js` | 6 | Breakpoints mobile: compromisos-row 640px/480px, kpi-grid-mobile, presenter mode scale |
| `lib/__tests__/normalizeFocos.test.js` | 10 | Migracion de schema focos v7→v9, edge cases |

**Total:** 16 tests

### Cobertura
- CSS-in-JS: testeado via string assertions sobre el export `CSS`
- Utilidades puras: `normalizeFocos` testeado
- Componentes React: sin tests unitarios (no hay testing-library)
- API routes: sin tests (se prueban manualmente)
- E2E: sin tests automatizados

---

## 15. Decisiones tecnicas

### Por que client-side rendering (sin SSR)
Los datos dependen de timezone Mexico City. SSR generaria hydration mismatches por la diferencia UTC (server) vs CDMX (cliente). `page.js` usa `next/dynamic` con `ssr: false`.

### Por que CSS-in-JS como string (no Tailwind, no CSS Modules)
Un solo archivo `css.js` exporta todo el design system. Ventajas: testeable con vitest (string assertions), zero build config, un solo lugar para todo el sistema visual. Desventaja: no hay tree-shaking de CSS.

### Por que sin SDKs (Monday, HubSpot, Slack, Google, Upstash)
Todas las integraciones usan `fetch()` directo. Mantiene el bundle minimo (<100KB), evita dependencias de terceros, y simplifica updates. Trade-off: compatibilidad de API se mantiene manualmente.

### Por que Upstash REST (no Redis nativo)
Vercel Serverless no soporta conexiones TCP persistentes. Upstash REST funciona sobre HTTP, compatible con el modelo serverless.

### Por que un solo Dashboard.jsx grande
Evolucion organica del proyecto. El estado global (items, wd, timer, analysis) esta centralizado ahi. Los tabs estan separados como componentes con code-splitting.

---

## 16. Notas para el auditor

1. **Credenciales:** `.env.local` contiene credenciales de produccion (Monday, HubSpot, Slack, Google SA key, Upstash). Verificar que esta en `.gitignore`.

2. **Token publico:** `NEXT_PUBLIC_API_SECRET` se expone al browser intencionalmente. La seguridad real depende de HTTP Basic Auth como primera capa. Evaluar si este modelo es aceptable para el nivel de sensibilidad de los datos.

3. **Sin dependencias externas:** El proyecto solo tiene `next`, `react`, `react-dom` como dependencies de produccion. Superficie de ataque minima.

4. **Cobertura de tests:** 16 tests cubren CSS y una utilidad. No hay tests de componentes, API routes, ni E2E. Area de mejora.

5. **Monday API version:** Usa `2024-01`. Verificar si Monday ha deprecado esta version.

6. **Dashboard.jsx monolitico:** ~1,500 lineas. Candidato a refactoring pero funcional.

7. **Cron unico:** Solo hay un job automatizado (domingo GdD). El cache de Monday se refresca on-demand desde el cliente.

8. **Audit log:** La app mantiene su propio log de acciones en Upstash (max 500 entries). Util para trazabilidad.

9. **Sin framework de estado:** No usa Redux, Zustand, ni similar. Todo es `useState` + `useRef` + prop drilling. Funciona para la escala actual.

10. **Archivos de referencia clave:**
    - Orquestador: `app/Dashboard.jsx`
    - Auth: `app/api/_auth.js` + `middleware.js`
    - Datos Monday: `app/api/monday/route.js`
    - Datos HubSpot: `app/api/gdd-hubspot/route.js`
    - Storage: `app/api/storage/route.js` + `app/lib/upstash-server.js`
    - Constantes: `app/lib/constants.js`
    - Design system: `app/lib/css.js`
