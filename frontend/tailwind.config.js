/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Neutral, professional developer-tool palette.
        bg: {
          DEFAULT: "#0b0d10",
          soft: "#111418",
          card: "#15191e",
        },
        border: {
          DEFAULT: "#232a31",
        },
        accent: {
          DEFAULT: "#4f8cff",
          soft: "#2b3a55",
        },
        risk: {
          high: "#f26d6d",
          medium: "#e3b341",
          low: "#4ec9a5",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
