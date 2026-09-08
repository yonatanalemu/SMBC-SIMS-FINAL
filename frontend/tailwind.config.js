/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        navy: { 950: "#0B1526", 900: "#0F1B30", 800: "#16233D", 700: "#1E2F4D" },
        teal: { 600: "#0E7C6B", 500: "#159A85", 100: "#DCF4EF" },
        gold: { 600: "#B8901E", 500: "#C9A227", 100: "#FBF1D6" },
        paper: { DEFAULT: "#F7F5EF", dark: "#0F151F" },
        ink: { DEFAULT: "#1B2430", muted: "#6B7280" },
      },
      fontFamily: {
        display: ["Newsreader", "serif"],
        sans: ["Public Sans", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
