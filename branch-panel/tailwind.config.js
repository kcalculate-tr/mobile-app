/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#98CD00',
        'brand-secondary': '#82CD47',
        'brand-dark': '#0f172a',
        'brand-bg': '#f0f4f8',
        'brand-card': '#FFFFFF',
        'brand-input': '#f8fafc',
        'brand-border': '#E9EDF7',
        'brand-muted': '#9EA8C7',
      },
      boxShadow: {
        'brand': '0 10px 20px rgba(152,205,0,0.25)',
        'brand-soft': '0 8px 24px rgba(152,205,0,0.15)',
      },
    },
  },
  plugins: [],
}
