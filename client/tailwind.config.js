/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        radar: {
          bg: '#0B0F19',
          card: '#111827',
        },
      },
    },
  },
  plugins: [],
};
