/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#667eea',
          light: '#f0f4ff',
          hover: '#5a67d8',
          text: '#ffffff'
        },
        success: {
          DEFAULT: '#48bb78',
          bg: '#f0fff4',
          text: '#22543d'
        },
        error: {
          DEFAULT: '#f56565',
          bg: '#fed7d7',
          text: '#742a2a'
        },
        warning: {
          DEFAULT: '#ed8936',
          bg: '#fef5e7',
          text: '#7b341e'
        },
        info: {
          DEFAULT: '#4299e1',
          bg: '#ebf8ff',
          text: '#2a69ac'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['Roboto Mono', 'monospace']
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-in': 'slideIn 0.3s ease-out',
        'shake': 'shake 0.5s ease-in-out',
        'shimmer': 'shimmer 1.5s infinite'
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' }
        },
        slideIn: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-4px)' },
          '75%': { transform: 'translateX(4px)' }
        },
        shimmer: {
          '0%': { transform: 'translateX(-20px)' },
          '100%': { transform: 'translateX(20px)' }
        }
      }
    },
  },
  plugins: [],
}