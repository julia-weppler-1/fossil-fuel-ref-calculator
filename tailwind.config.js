/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./public/index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // deep green for headers & primary buttons
        brand: {
          DEFAULT: "#3f6f2a",
          light:   "#e6f2e4",  // for “Advanced Display Settings” background
          dark:    "#2e5720",
        },
        // blue for the “Copy view to new window” button
        accentBlue: "#4659c0",
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
