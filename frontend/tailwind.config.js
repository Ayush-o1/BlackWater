/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#030712', // gray-950
        surface: '#111827', // gray-900
        primary: '#3b82f6', // blue-500
        secondary: '#1f2937', // gray-800
        border: '#374151', // gray-700
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
