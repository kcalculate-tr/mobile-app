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
        geex: {
          bg: '#F4F7FE',
          card: '#FFFFFF',
          sidebar: '#1E2749',
          sidebarSoft: '#2B3560',
          muted: '#9EA8C7',
          text: '#1A2038',
          border: '#E9EDF7',
        },
        kds: {
          bg: '#0B0F14',
          card: '#121821',
          cardDark: '#0B0F14',
        },
        gray: {
          300: '#D1D5DB',
        },
      },
      boxShadow: {
        geex: '0 14px 32px rgba(31, 42, 80, 0.08)',
        'geex-soft': '0 8px 24px rgba(31, 42, 80, 0.06)',
      },
      fontFamily: {
        zalando: ['Zalando', 'sans-serif'],
        google: ['GoogleSans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
