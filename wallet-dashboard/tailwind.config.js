/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Poppins', 'sans-serif'],
      },
      colors: {
        sokora: {
          navy: '#0F1B2D',
          'navy-light': '#1A2B45',
          'navy-card': '#162236',
          orange: '#F97316',
          'orange-light': '#FB923C',
          teal: '#0D9488',
          'teal-light': '#14B8A6',
          gold: '#F59E0B',
          'gold-light': '#FCD34D',
        }
      },
      backgroundImage: {
        'gradient-sokora': 'linear-gradient(135deg, #0F1B2D 0%, #1A2B45 100%)',
        'gradient-orange': 'linear-gradient(135deg, #F97316 0%, #FB923C 100%)',
        'gradient-teal': 'linear-gradient(135deg, #0D9488 0%, #14B8A6 100%)',
        'gradient-gold': 'linear-gradient(135deg, #F59E0B 0%, #FCD34D 100%)',
      }
    },
  },
  plugins: [],
}
