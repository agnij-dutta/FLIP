/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        flare: {
          primary: '#FF6B35',
          secondary: '#F7931E',
          dark: '#1A1A1A',
        },
      },
    },
  },
  plugins: [],
};



