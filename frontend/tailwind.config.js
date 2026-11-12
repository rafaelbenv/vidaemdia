/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Figtree', 'system-ui', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#F0FDFA',
          600: '#0D9488',
          700: '#0F766E',
          800: '#115E59',
        },
      },
    },
  },
  plugins: [],
};
