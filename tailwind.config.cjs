/** @type {import('tailwindcss').Config} */
// Los valores reales viven en css/tokens.css; aquí solo se exponen como utilidades.
const v = (name) => `var(--${name})`;
const gold = Object.fromEntries(
  [50, 100, 200, 300, 400, 500, 600, 700, 800, 900].map((n) => [n, v(`gold-${n}`)])
);

module.exports = {
  content: [
    './index.html',
    './js/**/*.js',
    './tests/manual/**/*.{html,js}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '375px',
        // Cabecera con navegación en línea (PC) desde 1024px; por debajo, barra inferior.
        desktopNav: '1024px',
      },
      colors: {
        gold: { ...gold, DEFAULT: v('gold-500'), text: v('gold-text') },
        brand: {
          red: v('red'),
          'red-600': v('red-600'),
          'red-50': v('red-50'),
        },
        ink: { DEFAULT: v('ink'), soft: v('ink-soft') },
        warm: {
          gray: v('gray'),
          300: v('gray-300'),
          line: v('line'),
          bg: v('bg'),
        },
        surface: v('surface'),
      },
      fontFamily: {
        display: ['"LaLiga Headline"', 'Roboto', 'system-ui', 'sans-serif'],
        text: ['"LaLiga Text"', 'Roboto', 'system-ui', 'sans-serif'],
        body: ['Roboto', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        sm: v('radius-sm'),
        card: v('radius'),
        lg: v('radius-lg'),
      },
      boxShadow: {
        1: v('shadow-1'),
        2: v('shadow-2'),
        3: v('shadow-3'),
        gold: v('shadow-gold'),
      },
      backgroundImage: {
        'grad-gold': v('grad-gold'),
        'grad-hero': v('grad-hero'),
        'grad-deep': v('grad-deep'),
      },
      transitionTimingFunction: {
        out: v('ease-out'),
      },
      maxWidth: {
        site: v('max-w'),
      },
    },
  },
  plugins: [],
};
