import { defineConfig } from 'tinacms'

const branch = process.env.GITHUB_BRANCH || process.env.VERCEL_GIT_COMMIT_REF || 'main'

export default defineConfig({
  branch,
  // Para TinaCloud: añadir NEXT_PUBLIC_TINA_CLIENT_ID y TINA_TOKEN en .env.local
  clientId: process.env.NEXT_PUBLIC_TINA_CLIENT_ID || null,
  token: process.env.TINA_TOKEN || null,

  build: {
    outputFolder: 'admin',
    publicFolder: 'public',
  },
  media: {
    tina: {
      mediaRoot: 'uploads',
      publicFolder: 'public',
    },
  },

  schema: {
    collections: [

      // ─── Hero (singleton) ────────────────────────────────────
      {
        name: 'hero',
        label: 'Hero',
        path: 'content',
        format: 'json',
        match: { include: 'hero' },
        ui: {
          allowedActions: { create: false, delete: false },
          router: () => '/marketing-de-performance',
        },
        fields: [
          { type: 'string', name: 'eyebrow', label: 'Texto eyebrow' },
          { type: 'string', name: 'title', label: 'Título (línea 1)' },
          { type: 'string', name: 'accentBlue', label: 'Acento azul' },
          { type: 'string', name: 'accentRose', label: 'Acento rosa' },
          { type: 'string', name: 'sub1', label: 'Párrafo 1', ui: { component: 'textarea' } },
          { type: 'string', name: 'sub2', label: 'Párrafo 2', ui: { component: 'textarea' } },
          { type: 'string', name: 'ctaPrimary', label: 'Botón primario' },
          { type: 'string', name: 'ctaSecondary', label: 'Botón secundario' },
          {
            type: 'object',
            name: 'stats',
            label: 'Estadísticas',
            list: true,
            ui: { itemProps: (item) => ({ label: item?.label ?? 'Estadística' }) },
            fields: [
              { type: 'string', name: 'number', label: 'Número (ej: 800)' },
              { type: 'string', name: 'suffix', label: 'Sufijo (ej: +, ×, $)' },
              { type: 'string', name: 'label', label: 'Etiqueta' },
            ],
          },
        ],
      },

      // ─── Servicios ───────────────────────────────────────────
      {
        name: 'service',
        label: 'Servicios',
        path: 'content/services',
        format: 'json',
        ui: {
          filename: { slugify: (v) => v?.slug ?? '' },
          router: () => '/',
        },
        fields: [
          { type: 'string', name: 'slug', label: 'Slug URL', required: true },
          { type: 'string', name: 'name', label: 'Nombre', isTitle: true, required: true },
          { type: 'string', name: 'tag', label: 'Tags (separados por ·)' },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          {
            type: 'string', name: 'iconKey', label: 'Ícono',
            options: [
              { value: 'performance', label: 'Performance (gráfica)' },
              { value: 'branding', label: 'Branding (estrella)' },
              { value: 'desarrollo', label: 'Desarrollo web (código)' },
              { value: 'seo', label: 'SEO (lupa)' },
              { value: 'automatizaciones', label: 'Automatizaciones (flechas)' },
              { value: 'trazabilidad', label: 'Trazabilidad (ojo)' },
            ],
          },
          { type: 'number', name: 'order', label: 'Orden de aparición' },
        ],
      },

      // ─── Testimonios ─────────────────────────────────────────
      {
        name: 'testimonial',
        label: 'Testimonios',
        path: 'content/testimonials',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'name', label: 'Nombre del cliente', isTitle: true, required: true },
          { type: 'string', name: 'role', label: 'Cargo' },
          { type: 'string', name: 'metric', label: 'Empresa' },
          { type: 'string', name: 'logo', label: 'URL del logo' },
          { type: 'string', name: 'text', label: 'Testimonio (HTML permitido: <strong>)', ui: { component: 'textarea' } },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Pain Cards ──────────────────────────────────────────
      {
        name: 'painCard',
        label: 'Problemas (Pain Section)',
        path: 'content/pain-cards',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'title', label: 'Título', isTitle: true, required: true },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          {
            type: 'string', name: 'iconKey', label: 'Ícono',
            options: [
              { value: 'alert', label: 'Alerta (círculo)' },
              { value: 'monitor', label: 'Monitor' },
              { value: 'activity', label: 'Actividad (onda)' },
              { value: 'shield', label: 'Escudo' },
              { value: 'document', label: 'Documento' },
              { value: 'team', label: 'Equipo (personas)' },
            ],
          },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Resultados ──────────────────────────────────────────
      {
        name: 'result',
        label: 'Resultados',
        path: 'content/results',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'metricNumber', label: 'Número (ej: 79, 4.5)', isTitle: true, required: true },
          {
            type: 'string', name: 'metricPrefix', label: 'Prefijo',
            options: [
              { value: '', label: 'Ninguno' },
              { value: '+', label: '+ (positivo)' },
              { value: '-', label: '- (reducción)' },
            ],
          },
          {
            type: 'string', name: 'metricSuffix', label: 'Sufijo',
            options: [
              { value: '%', label: '% (porcentaje)' },
              { value: '×', label: '× (multiplicador)' },
              { value: '$', label: '$ (dinero)' },
            ],
          },
          { type: 'string', name: 'label', label: 'Etiqueta del resultado' },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Tech Stack (TechGrid) ───────────────────────────────
      {
        name: 'techCard',
        label: 'Stack Tecnológico',
        path: 'content/tech-cards',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'label', label: 'Categoría', isTitle: true, required: true },
          { type: 'string', name: 'name', label: 'Herramientas' },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          {
            type: 'string', name: 'iconKey', label: 'Ícono',
            options: [
              { value: 'shield', label: 'Escudo' },
              { value: 'activity', label: 'Actividad (onda)' },
              { value: 'broadcast', label: 'Señal (círculos)' },
              { value: 'monitor', label: 'Monitor' },
              { value: 'user', label: 'Usuario' },
              { value: 'star', label: 'Estrella' },
            ],
          },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Sistema Cards (SistemaSection) ─────────────────────
      {
        name: 'sistemaCard',
        label: 'Sistema Manya (Cards)',
        path: 'content/sistema-cards',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'label', label: 'Categoría', isTitle: true, required: true },
          { type: 'string', name: 'name', label: 'Nombre de la capacidad' },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          {
            type: 'string', name: 'iconKey', label: 'Ícono',
            options: [
              { value: 'shield', label: 'Escudo' },
              { value: 'activity', label: 'Actividad (onda)' },
              { value: 'broadcast', label: 'Señal (círculos)' },
              { value: 'monitor', label: 'Monitor' },
              { value: 'user', label: 'Usuario' },
              { value: 'star', label: 'Estrella' },
            ],
          },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Proceso Steps ───────────────────────────────────────
      {
        name: 'procesoStep',
        label: 'Proceso / Metodología',
        path: 'content/proceso-steps',
        format: 'json',
        ui: { router: () => '/marketing-de-performance' },
        fields: [
          { type: 'string', name: 'num', label: 'Número (ej: 01)', isTitle: true, required: true },
          { type: 'string', name: 'title', label: 'Título del paso' },
          { type: 'string', name: 'desc', label: 'Descripción', ui: { component: 'textarea' } },
          { type: 'string', name: 'tag', label: 'Etiqueta de tiempo (ej: Semana 1)' },
          { type: 'boolean', name: 'active', label: 'Paso activo (resaltado)' },
          { type: 'number', name: 'order', label: 'Orden' },
        ],
      },

      // ─── Contacto (singleton) ────────────────────────────────
      {
        name: 'contact',
        label: 'Sección Contacto',
        path: 'content',
        format: 'json',
        match: { include: 'contact' },
        ui: {
          allowedActions: { create: false, delete: false },
          router: () => '/marketing-de-performance',
        },
        fields: [
          { type: 'string', name: 'sectionTitle', label: 'Título de la sección' },
          { type: 'string', name: 'sectionDesc', label: 'Descripción', ui: { component: 'textarea' } },
          { type: 'string', name: 'tagline', label: 'Tagline inferior' },
          {
            type: 'string', name: 'trustItems', label: 'Lista de garantías',
            list: true,
          },
          {
            type: 'string', name: 'objectives', label: 'Objetivos del formulario',
            list: true,
          },
        ],
      },

    ],
  },
})
