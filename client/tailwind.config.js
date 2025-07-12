/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ufc-red': '#24b59f',      // Новый цвет для кнопок
        'ufc-gold': '#f2b90c',     // Оставляем золотой для акцентов
        'ufc-black': '#000000',
        'ufc-primary': '#292a2d',  // Новый основной цвет
        'ufc-gray': {
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#292a2d',     // Заменяем на новый основной цвет
          900: '#212121',     // Новый цвет фона
        }
      },
      fontFamily: {
        'sans': ['Inter', 'system-ui', 'sans-serif'],
        'display': ['Oswald', 'sans-serif'],
      },
      animation: {
        'pulse-fast': 'pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'bounce-slow': 'bounce 2s infinite',
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(100%)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
      },
      boxShadow: {
        'glow': '0 0 20px rgba(36, 181, 159, 0.5)',  // Обновляем для нового цвета
        'glow-gold': '0 0 20px rgba(242, 185, 12, 0.5)',
        'glow-primary': '0 0 15px rgba(41, 42, 45, 0.3)',
      }
    },
  },
  plugins: [],
} 