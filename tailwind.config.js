/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bengaluru: {
          yellow: '#FFC72C',
          amber: '#F59E0B',
          red: '#DC2626',
          dark: '#0F172A',
          card: '#1E293B',
          accent: '#10B981',
          gold: '#FBBF24',
          subtle: '#334155'
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
