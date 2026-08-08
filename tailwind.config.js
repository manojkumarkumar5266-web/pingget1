/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f7ffe0', 100: '#eefc99', 200: '#e5f855', 300: '#D4F000',
          400: '#D4F000', 500: '#D4F000', 600: '#B8D400', 700: '#8fa300',
          800: '#5e6b00', 900: '#3a4200',
        },
        ink: {
          bg: '#050505',
          surface: '#121212',
          card: '#1A1A1A',
          card2: '#222222',
        },
      },
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
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
