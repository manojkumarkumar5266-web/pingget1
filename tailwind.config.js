/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f6f9e8', 100: '#ebf1cc', 200: '#d6e099', 300: '#bed164',
          400: '#a6b300', 500: '#96a200', 600: '#7a8500', 700: '#5e6600',
          800: '#454b00', 900: '#2e3300', 950: '#181a00',
        },
        accent: {
          50: '#faf7ee', 100: '#f2ebd2', 200: '#e5d5a2', 300: '#d4b96a',
          400: '#c9a245', 500: '#b88a2e', 600: '#9e6e24', 700: '#825420',
          800: '#6c4320', 900: '#5c391f',
        },
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7',
          400: '#34d399', 500: '#22C55E', 600: '#16a34a', 700: '#15803d',
          800: '#166534', 900: '#14532d',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d',
          400: '#fbbf24', 500: '#F59E0B', 600: '#d97706', 700: '#b45309',
          800: '#92400e', 900: '#78350f',
        },
        error: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5',
          400: '#f87171', 500: '#EF4444', 600: '#dc2626', 700: '#b91c1c',
          800: '#991b1b', 900: '#7f1d1d',
        },
        ink: {
          bg:      '#0B0B0B',
          surface: '#181818',
          card:    '#1E1E1E',
          card2:   '#232323',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      boxShadow: {
        'sm':    '0 2px 8px rgba(0,0,0,0.35)',
        'card':  '0 4px 24px rgba(0,0,0,0.45)',
        'float': '0 12px 40px rgba(0,0,0,0.6)',
        'glow':  '0 0 24px rgba(166,179,0,0.35)',
        'accent':'0 6px 24px rgba(166,179,0,0.30)',
        'modal': '0 24px 64px rgba(0,0,0,0.7)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.32, 0.72, 0, 1)',
        spring:  'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-out',
        'fade-in-up': 'fade-in-up 0.4s ease-out both',
        'slide-up': 'slideUp 0.3s ease-out',
        'slide-down': 'slideDown 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-bottom': 'slide-in-bottom 0.4s ease-out both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.34,1.56,0.64,1) both',
        'bounce-in': 'bounceIn 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
        'success-pop': 'successPop 0.5s ease-out both',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
        'float': 'float 3s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 1.4s infinite linear',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        'fade-in-up': { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideUp: { '0%': { opacity: '0', transform: 'translateY(12px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideDown: { '0%': { opacity: '0', transform: 'translateY(-100%))' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        slideInRight: { '0%': { opacity: '0', transform: 'translateX(24px)' }, '100%': { opacity: '1', transform: 'translateX(0)' } },
        'slide-in-bottom': { '0%': { transform: 'translateY(100%)' }, '100%': { transform: 'translateY(0)' } },
        scaleIn: { '0%': { opacity: '0', transform: 'scale(0.94)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        bounceIn: { '0%': { opacity: '0', transform: 'scale(0.5)' }, '60%': { transform: 'scale(1.08)' }, '100%': { opacity: '1', transform: 'scale(1)' } },
        successPop: { '0%': { transform: 'scale(0)', opacity: '0' }, '55%': { transform: 'scale(1.2)', opacity: '1' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        pulseSoft: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.6' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-6px)' } },
        glowPulse: { '0%,100%': { boxShadow: '0 0 12px rgba(166,179,0,0.25)' }, '50%': { boxShadow: '0 0 28px rgba(166,179,0,0.55)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
    },
  },
  plugins: [],
}
