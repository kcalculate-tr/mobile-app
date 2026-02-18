/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        'brand-white': '#FFFFFF',
        'brand-bg': '#F0F0F0',
        'brand-primary': '#98CD00',
        'brand-secondary': '#82CD47',
        'brand-dark': '#202020',
        gray: {
          300: '#D1D5DB',
        },
      },
      fontFamily: {
        zalando: ['Zalando', 'sans-serif'],
        google: ['GoogleSans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
