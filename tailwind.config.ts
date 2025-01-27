import type { Config } from "tailwindcss";

const config: Config = {
  //module.exports = {
  darkMode: "class",
  content: ["./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cyan: {
          500: "#22d3ee",
          600: "#06b6d4",
          700: "#0e7490",
        },
        lime: {
          66: "#65a30d", // does not work from here, global.css used instead
        },
        purple: {
          44: "#a78bfa", // does not work from here, global.css used instead
        },
      },
    },
  },
  plugins: [],
  //};

  // content: [
  //   "./pages/**/*.{js,ts,jsx,tsx,mdx}",
  //   "./components/**/*.{js,ts,jsx,tsx,mdx}",
  //   "./app/**/*.{js,ts,jsx,tsx,mdx}",
  // ],
  // theme: {
  //   extend: {
  //     backgroundImage: {
  //       "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
  //       "gradient-conic":
  //         "conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))",
  //     },
  //     colors: {
  //       bgGreen100: "#abcdef",
  //       customColor: "#fedcba",
  //     },
  //   },
  // },
  // plugins: [],
};
export default config;
