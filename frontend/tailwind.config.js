/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          750: '#2d3748',
        },
        teal: {
          50: '#E1F5EE', 100: '#9FE1CB', 200: '#5DCAA5',
          500: '#1D9E75', 600: '#0F6E56', 700: '#085041',
        },
      },
    },
  },
  plugins: [],
};
