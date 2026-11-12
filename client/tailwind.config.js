/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1c2b4a',
        mist: '#6d7c93',
        line: '#e6edf5',
        paper: '#f5f8fb',
      },
      fontFamily: {
        sans: ['Manrope', 'sans-serif'],
        display: ['Fraunces', 'serif'],
      },
      boxShadow: {
        card: '0 24px 70px rgba(28, 43, 74, 0.12)',
      },
    },
  },
  plugins: [],
};
