/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "var(--paper)",
        sheet: "var(--sheet)",
        ink: "var(--ink)",
        graphite: "var(--graphite)",
        rule: "var(--rule)",
        coral: "var(--coral)",
        "coral-strong": "var(--coral-strong)",
      },
      fontFamily: {
        sans: ["Jost", "Segoe UI", "Roboto", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "Consolas", "Courier New", "monospace"],
      },
    },
  },
  plugins: [],
};
