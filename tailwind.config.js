/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#006d52", 
          light:   "#e6f2e4",
          dark:    "#2e5720",
        },
        primary: "#1692df",
        highlight: "#4659c0",
        gray: {
          50:  "#F9FAFB",
          100: "#F3F4F6",
          200: "#E5E7EB",
          300: "#D1D5DB",
          600: "#4B5563",
          800: "#1F2937",
        },
        blue: {
          50:  '#D3F6FD',  // ~80% lighter than #1692DF
          100: '#A7DDF5',  // ~60% lighter
          200: '#6BBAE9',  // ~40% lighter
          300: '#1692DF',  // your “base” blue
          400: '#008BB9',  // next darker step from the palette
          500: '#007E86',
          600: '#006D52',
        },
      },
      fontFamily: {
        body: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [
    require("@tailwindcss/forms"),
  ],
}
