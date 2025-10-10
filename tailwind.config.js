/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      animation: {
        'spin-slow': 'spin 20s linear infinite',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, #D600A4 0%, #FF6A00 100%)',
      },
      colors: {
        'off-white': '#F4F4F4',
        'cool-gray': '#AAAAAA',
      },
      fontFamily: {
        'poppins': ['Poppins', 'sans-serif'],
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
