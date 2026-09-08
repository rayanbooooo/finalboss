import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  // Any directory that renders JSX has to be listed here. A missing path
  // fails silently: the classes simply never get generated, so the element
  // renders unstyled rather than erroring.
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./contexts/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: {
          950: "#07070b",
          900: "#0a0a0f",
          850: "#0e0e16",
          800: "#13131d",
          700: "#1c1c29",
          600: "#2a2a3b",
        },
        violet: {
          400: "#a78bfa",
          500: "#8b5cf6",
          600: "#7c3aed",
          700: "#6d28d9",
        },
        emerald: {
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
        },
        rose: {
          400: "#fb7185",
          500: "#f43f5e",
          600: "#e11d48",
        },
      },
      fontFamily: {
        sans: ["var(--font-geist-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-bricolage)", "var(--font-geist-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        "glow-violet": "0 0 24px 0 rgba(139, 92, 246, 0.35)",
        "glow-emerald": "0 0 24px 0 rgba(16, 185, 129, 0.35)",
        "glow-rose": "0 0 24px 0 rgba(244, 63, 94, 0.35)",
        "inner-glass": "inset 0 1px 0 0 rgba(255,255,255,0.06)",
      },
      backgroundImage: {
        "grid-fade":
          "linear-gradient(to bottom, rgba(139,92,246,0.08), transparent)",
        "radial-glow":
          "radial-gradient(circle at 50% 0%, rgba(139,92,246,0.18), transparent 60%)",
      },
      keyframes: {
        "pulse-glow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.5" },
        },
        "flash-green": {
          "0%": { backgroundColor: "rgba(16,185,129,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        "flash-red": {
          "0%": { backgroundColor: "rgba(244,63,94,0.35)" },
          "100%": { backgroundColor: "transparent" },
        },
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "spin-slow": {
          from: { transform: "rotate(0deg)" },
          to: { transform: "rotate(360deg)" },
        },
        "drift-1": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(50px, 40px)" },
        },
        "drift-2": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-60px, 35px)" },
        },
        "drift-3": {
          "0%, 100%": { transform: "translate(0, 0)" },
          "50%": { transform: "translate(-40px, -50px)" },
        },
      },
      animation: {
        "pulse-glow": "pulse-glow 2.5s ease-in-out infinite",
        "flash-green": "flash-green 0.6s ease-out",
        "flash-red": "flash-red 0.6s ease-out",
        "slide-in-right": "slide-in-right 0.25s ease-out",
        "fade-in": "fade-in 0.4s ease-out",
        "spin-slow": "spin-slow 6s linear infinite",
        "drift-1": "drift-1 22s ease-in-out infinite",
        "drift-2": "drift-2 26s ease-in-out infinite",
        "drift-3": "drift-3 30s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
