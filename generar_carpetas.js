import fs from 'fs';
import path from 'path';

// 1. La estructura de carpetas exacta que definiste
const directories = [
  'public',
  'src/api',
  'src/components/ui',
  'src/components/contacts',
  'src/components/interactions',
  'src/components/email',
  'src/components/institutions',
  'src/components/layout',
  'src/config',
  'src/hooks',
  'src/lib',
  'src/pages',
  'src/store',
  'src/styles',
  'src/utils',
];

// 2. Los archivos que irán dentro (paths relativos)
const files = [
  'public/favicon.ico',
  'public/logo.svg',
  'src/api/anthropic.js',
  'src/api/resend.js',
  'src/components/ui/Button.jsx',
  'src/components/ui/Card.jsx',
  'src/components/ui/Input.jsx',
  'src/components/ui/Modal.jsx',
  'src/components/ui/Badge.jsx',
  'src/components/ui/Dropdown.jsx',
  'src/components/ui/Avatar.jsx',
  'src/components/ui/Spinner.jsx',
  'src/components/contacts/ContactCard.jsx',
  'src/components/contacts/ContactList.jsx',
  'src/components/contacts/ContactForm.jsx',
  'src/components/contacts/ContactFilters.jsx',
  'src/components/contacts/InterestBadge.jsx',
  'src/components/interactions/InteractionTimeline.jsx',
  'src/components/interactions/InteractionItem.jsx',
  'src/components/interactions/AddInteractionModal.jsx',
  'src/components/email/EmailDraftModal.jsx',
  'src/components/email/EmailPreview.jsx',
  'src/components/email/GenerateEmailButton.jsx',
  'src/components/institutions/InstitutionCard.jsx',
  'src/components/institutions/InstitutionSelect.jsx',
  'src/components/layout/Sidebar.jsx',
  'src/components/layout/Header.jsx',
  'src/components/layout/MainLayout.jsx',
  'src/config/aiPrompts.js',
  'src/config/constants.js',
  'src/hooks/useContacts.js',
  'src/hooks/useInteractions.js',
  'src/hooks/useEmailGeneration.js',
  'src/hooks/useSupabase.js',
  'src/lib/supabase.js',
  'src/pages/Dashboard.jsx',
  'src/pages/Contacts.jsx',
  'src/pages/ContactDetail.jsx',
  'src/pages/Institutions.jsx',
  'src/pages/Settings.jsx',
  'src/pages/Login.jsx',
  'src/store/useStore.js',
  'src/styles/index.css',
  'src/utils/formatters.js',
  'src/utils/validators.js',
  'src/App.jsx',
  'src/main.jsx',
  '.env.example',
  'index.html',
  'tailwind.config.js',
  'vite.config.js',
  'README.md'
];

// 3. Contenido pre-llenado para package.json
const packageJsonContent = {
  "name": "digpatho-crm",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.20.0",
    "@supabase/supabase-js": "^2.39.0",
    "zustand": "^4.4.0",
    "date-fns": "^2.30.0",
    "lucide-react": "^0.294.0",
    "@anthropic-ai/sdk": "^0.10.0"
  },
  "devDependencies": {
    "vite": "^5.0.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0"
  }
};

// 4. Contenido para .env.local
const envContent = `# Supabase
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Anthropic (para el agente de email)
VITE_ANTHROPIC_API_KEY=sk-ant-...

# App
VITE_APP_NAME=Digpatho CRM`;

// --- FUNCIÓN PRINCIPAL ---
async function init() {
  console.log('🚀 Iniciando construcción de Digpatho CRM...');

  // Crear directorios
  directories.forEach(dir => {
    const fullPath = path.join('.', dir);
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
  });
  console.log('✅ Carpetas creadas.');

  // Crear archivos vacíos
  files.forEach(filePath => {
    const fullPath = path.join('.', filePath);
    if (!fs.existsSync(fullPath)) {
      fs.writeFileSync(fullPath, '// TODO: Implementar lógica\n');
    }
  });
  console.log('✅ Archivos base creados.');

  // Escribir package.json real
  fs.writeFileSync('package.json', JSON.stringify(packageJsonContent, null, 2));
  console.log('📦 package.json configurado.');

  // Escribir .env.local real
  fs.writeFileSync('.env.local', envContent);
  console.log('🔑 .env.local configurado.');

  console.log('\n✨ ¡ESTRUCTURA LISTA! Siguientes pasos:');
  console.log('1. Ejecuta: npm install');
  console.log('2. Ejecuta: npm run dev');
}

init();