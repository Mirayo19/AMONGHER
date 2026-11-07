/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // Button variants are composed at runtime (`btn-${variant}`), so Tailwind cannot see them in the source.
  safelist: ['btn-primary', 'btn-secondary', 'btn-quiet', 'btn-danger', 'btn-sm', 'btn-lg'],
  theme: {
    extend: {
      colors: {
        plum: {
          50: '#faf5f8', 100: '#f3e8ef', 200: '#e6d0df', 300: '#d1a9c3', 400: '#b47ba2',
          500: '#935580', 600: '#763d66', 700: '#5e2c52', 800: '#47213f', 900: '#331830', 950: '#220f20',
        },
        ivory: { DEFAULT: '#fbf7f0', 50: '#fffdf9', 100: '#fbf7f0', 200: '#f4ede1', 300: '#eae0cf', 400: '#d9ccb6' },
        ink: { DEFAULT: '#2a1a26', soft: '#54454e', muted: '#7a6b73', faint: '#a2969c' },
        brass: { 300: '#dcc08a', 500: '#b08a4c', 700: '#7d5f2e' },
        sage: { 100: '#e4ece5', 500: '#5f8068', 700: '#3f5a48' },
        clay: { 100: '#f6e3dd', 500: '#b4533f', 700: '#85352a' },
      },
      fontFamily: {
        display: ['"Fraunces Variable"', 'ui-serif', 'Georgia', 'serif'],
        sans: ['"Manrope Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem', '3xl': '1.5rem' },
      boxShadow: {
        soft: '0 1px 2px rgba(51,24,48,.04), 0 6px 20px -8px rgba(51,24,48,.10)',
        lift: '0 2px 4px rgba(51,24,48,.06), 0 14px 32px -12px rgba(51,24,48,.22)',
      },
      keyframes: {
        rise: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'none' } },
        sheet: { from: { transform: 'translateY(100%)' }, to: { transform: 'none' } },
        fade: { from: { opacity: 0 }, to: { opacity: 1 } },
      },
      animation: { rise: 'rise .35s ease-out both', sheet: 'sheet .28s cubic-bezier(.2,.8,.2,1) both', fade: 'fade .2s ease-out both' },
    },
  },
  plugins: [],
};
