/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488', // Deep Teal (Core primary)
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
        secondary: {
          DEFAULT: '#F9FAFB',
        },
        accent: {
          DEFAULT: '#F59E0B', // Amber
          hover: '#D97706',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
