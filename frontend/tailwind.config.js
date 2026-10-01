/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Colors are driven by CSS variables (see index.css) so the same tokens
      // work in both light and dark themes. Palette: rose #db5461,
      // sage #8aa29e, light blue #e3f2fd.
      colors: {
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          soft: "rgb(var(--bg-soft) / <alpha-value>)",
          card: "rgb(var(--bg-card) / <alpha-value>)",
          elevated: "rgb(var(--bg-elevated) / <alpha-value>)",
        },
        border: {
          DEFAULT: "rgb(var(--border) / <alpha-value>)",
          strong: "rgb(var(--border-strong) / <alpha-value>)",
        },
        content: {
          DEFAULT: "rgb(var(--content) / <alpha-value>)",
          muted: "rgb(var(--content-muted) / <alpha-value>)",
          faint: "rgb(var(--content-faint) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          strong: "rgb(var(--accent-strong) / <alpha-value>)",
          soft: "rgb(var(--accent-soft) / <alpha-value>)",
          contrast: "rgb(var(--accent-contrast) / <alpha-value>)",
        },
        highlight: "rgb(var(--highlight) / <alpha-value>)",
        sage: {
          DEFAULT: "rgb(var(--sage) / <alpha-value>)",
          soft: "rgb(var(--sage-soft) / <alpha-value>)",
        },
        risk: {
          high: "rgb(var(--risk-high) / <alpha-value>)",
          medium: "rgb(var(--risk-medium) / <alpha-value>)",
          low: "rgb(var(--risk-low) / <alpha-value>)",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
    },
  },
  plugins: [],
};
