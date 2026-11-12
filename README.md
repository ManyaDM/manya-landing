# manya-landing

TinaCMS implementado
Lo que se hizo
34 archivos creados/modificados:


tina/config.js              ← Schema completo de 9 colecciones
lib/content.js              ← Capa de datos (JSON directo, swappable a TinaCloud)
content/
├── hero.json               ← Hero: textos, stats, CTAs
├── contact.json            ← Sección contacto: trust items, objetivos
├── services/               ← 6 servicios (home grid)
├── testimonials/           ← 4 testimonios
├── pain-cards/             ← 6 pain cards
├── results/                ← 4 resultados
├── tech-cards/             ← 6 tech cards
├── sistema-cards/          ← 6 sistema cards
└── proceso-steps/          ← 4 pasos del proceso
.env.example                ← Variables para TinaCloud
Componentes actualizados para recibir datos como props (sin contenido hardcodeado): Hero, PainSection, ResultsSection, TestimonialsSection, TechGrid, TechSection, SistemaSection, ContactSection, ProcesoSection.

### Cómo usar ahora (modo local)

npm run dev
Luego abrir: http://localhost:3000/admin/index.html

El admin te dejará editar cualquier colección. Al guardar, TinaCMS escribe el JSON directamente en content/, que es lo que leen los componentes.

## Contact form → Make → Kommo

Component: `components/ContactSection.jsx` (used on `/marketing-de-performance`).

### Flow

1. **Step 1 – Tus datos:** name, WhatsApp, email, company. Pushes `form_step1_complete` to the dataLayer.
2. **Step 2 – Tu proyecto:** monthly ad spend, objective, terms, Bitácora opt-in.
3. **Submit:** POSTs the payload below to the Make webhook (scenario *Manya_Go_Kommo [Leads Whatsapp - Landing Marketing]*).
   - `segmento: "calificado"` → opens WhatsApp and pushes `whatsapp_form_submit` (Ads conversion).
   - `segmento: "nurture"` → shows a thank-you modal, does **not** open WhatsApp, pushes `lead_nurture_submit` (not a conversion). The form stays editable: only the budget resets, and the modal offers "Cambiar mi respuesta". Picking a nurture budget again does not send another request.
   - A resubmission after a nurture lead sends `presupuestoAnterior` with the first budget, so Make can update the existing lead instead of treating it as unrelated.

### Webhook payload

| Field | Type | Notes |
|---|---|---|
| `nombre` | string | First and last name required |
| `whatsapp` | string | `+51` + 9 digits starting with 9 |
| `email` | string | |
| `emailCorporativo` | boolean | `false` for free providers (gmail, hotmail, outlook, yahoo, live, icloud, msn) |
| `empresa` | string | Junk values ("no tengo", "independiente", "-", …) are rejected client-side |
| `presupuesto` | string | One of the exact values below |
| `presupuestoAnterior` | string? | Only on a resubmission after a nurture lead: the budget sent first |
| `segmento` | `"calificado"` \| `"nurture"` | Derived from `presupuesto` |
| `objetivo` | string | Option from `content/contact.json`, or free text when "Otro" |
| `sitioWeb` | string? | Only for the ecommerce objective |
| `bitacora` | boolean | Newsletter opt-in |
| `timestamp` | ISO string | |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content` | string | `utm_source`/`utm_medium` fall back to gclid / fbclid / ttclid |

### `presupuesto` values (exact strings)

The separator is an **en dash `–` (U+2013)**, not a hyphen `-`. Make filters and Kommo field options must match byte for byte.

| Value | `segmento` |
|---|---|
| `Menos de US$500` | nurture |
| `US$500 – US$1,500` | calificado |
| `US$1,500 – US$3,000` | calificado |
| `US$3,000 – US$9,000` | calificado |
| `Más de US$9,000` | calificado |
| `Todavía no invierto en pauta` | nurture |

Prefer filtering on `segmento` in Make so budget ranges can change without touching the scenario.

### Testing locally

Local submissions hit the **production** webhook and fire real GTM tags. Use obvious test data (e.g. "Manya Prueba") and delete it from Kommo, Sheets, Brevo and Bitácora afterwards.

### Cómo migrar a TinaCloud cuando sea necesario

Crear cuenta en app.tina.io y conectar el repositorio GitHub
Copiar .env.example → .env.local y rellenar los dos tokens
En lib/content.js hay comentarios que muestran exactamente cómo reemplazar cada función con el client de TinaCloud — es un cambio de ~5 líneas por función