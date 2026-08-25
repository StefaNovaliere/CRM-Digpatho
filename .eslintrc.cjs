/* eslint-env node */
//
// Configuración de ESLint. El script `npm run lint` existía en package.json
// desde el principio, pero SIN este archivo — así que fallaba al correrlo y
// nadie lo usaba.
//
// POR QUÉ IMPORTA
// `vite build` NO detecta referencias a variables no definidas: `FOO` sin
// declarar es JavaScript válido en tiempo de compilación y sólo explota al
// ejecutarse. En agosto tres ReferenceError (INTEREST_LEVELS, StatusBadge,
// PIPELINE_STAGES) llegaron a producción y dejaron la app en blanco, con el
// build en verde. Las reglas no-undef y react/jsx-no-undef son exactamente
// las que atrapan eso.
//
// CRITERIO
// Estricto en corrección (lo que rompe la app), silencioso en estilo. Si el
// linter grita por cosas cosméticas, el equipo lo empieza a ignorar y deja de
// servir para lo que importa.

module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime', // React 18: no hace falta importar React
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: [
    'dist',
    'node_modules',
    '.eslintrc.cjs',
    'supabase/functions', // Deno, no Node: otro runtime y otros globals
    '*.py',
  ],
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  settings: {
    react: { version: '18.2' },
  },
  plugins: ['react-refresh'],
  rules: {
    // ---- Las que importan: rompen la app en runtime ----
    'no-undef': 'error',
    'react/jsx-no-undef': 'error',
    'no-dupe-keys': 'error',
    'no-unreachable': 'error',
    'no-const-assign': 'error',

    // Variables sin usar: avisan de imports que quedaron colgados después de
    // un refactor. Se permiten los argumentos sin usar y las que empiezan con
    // "_", que suelen ser intencionales.
    'no-unused-vars': ['warn', {
      args: 'none',
      varsIgnorePattern: '^_',
      ignoreRestSiblings: true,
    }],

    // ---- Silenciadas a propósito ----
    // El proyecto no usa PropTypes ni TypeScript. Activarla serían cientos de
    // avisos sin valor.
    'react/prop-types': 'off',
    // Textos en español con apóstrofes y comillas dentro del JSX.
    'react/no-unescaped-entities': 'off',
    // Fast Refresh: útil pero ruidoso en archivos que exportan helpers junto
    // al componente, que es el patrón de este repo.
    'react-refresh/only-export-components': 'off',
  },
  overrides: [
    {
      // Las funciones serverless corren en Node, no en el navegador.
      files: ['api/**/*.js'],
      env: { browser: false, node: true },
    },
  ],
};
