/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        nikita: {
          pink: '#E91E63',
          accent: '#FF00CC',
          gray: '#F8F9FA',
          dark: '#1A1A2E',
          darker: '#16162A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
