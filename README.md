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

### Cómo migrar a TinaCloud cuando sea necesario

Crear cuenta en app.tina.io y conectar el repositorio GitHub
Copiar .env.example → .env.local y rellenar los dos tokens
En lib/content.js hay comentarios que muestran exactamente cómo reemplazar cada función con el client de TinaCloud — es un cambio de ~5 líneas por función