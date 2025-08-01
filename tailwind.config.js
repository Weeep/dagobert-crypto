/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [    
    "./app/**/*.{js,ts,jsx,tsx}",
    "./app/components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        cyan: {
          500: "#22d3ee",
          600: "#06b6d4",
          700: "#0e7490",
        },
        lime: {
          66: "#65a30d",
        },
        purple: {
          44: "#a78bfa",
        },
      },
    },
  },
  plugins: [],
}

