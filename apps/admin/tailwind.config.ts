import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#ff8a1e",
        "brand-dark": "#e5760f",
        ink: "#0f172a",
        sidebar: "#111827",
      },
    },
  },
  plugins: [],
};

export default config;
