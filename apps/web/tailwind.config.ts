import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Masti Malai brand: dark cinematic base + warm "malai/tadka" accent.
        base: "#0b0b0f",
        surface: "#15151d",
        card: "#1c1c26",
        accent: "#ff8a1e", // saffron/tadka orange
        "accent-2": "#ffd15c", // malai cream-gold
        muted: "#9aa0ab",
      },
      fontFamily: {
        sans: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
