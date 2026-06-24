/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2563EB',
          hover: '#1D4ED8',
          dark: '#3B82F6',
          'dark-hover': '#60A5FA',
        },
        secondary: {
          DEFAULT: '#64748B',
          dark: '#94A3B8',
        },
        accent: {
          DEFAULT: '#10B981',
          dark: '#34D399',
        },
        surface: {
          light: '#FFFFFF',
          dark: '#1E293B',
        },
        background: {
          light: '#F8FAFC',
          dark: '#0F172A',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
