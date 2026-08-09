/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FFF8E6', 100: '#FCEEB8', 200: '#F9DD7A', 300: '#F5C542',
          400: '#F5C542', 500: '#F5C542', 600: '#D4A62E', 700: '#A67E1C',
          800: '#6B5012', 900: '#3D2E0A',
        },
        ink: {
          bg: '#07080B',
          surface: '#141821',
          card: '#1C2230',
          card2: '#232A3A',
        },
        pg: {
          lime: '#F5C542',
          panel: '#141821',
          line: 'rgba(255,255,255,0.07)',
        },
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', '"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '1.75rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.35s ease-out both',
        'slide-up': 'fade-in-up 0.3s ease-out both',
        'slide-in-bottom': 'slide-in-bottom 0.35s ease-out both',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        'slide-in-bottom': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
