/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        navy:  { DEFAULT: '#1B2A4A', light: '#2d4070' },
        brand: { DEFAULT: '#2F6FB0', light: '#EAF1FA' },
        gold:  { DEFAULT: '#B8862B' },
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
