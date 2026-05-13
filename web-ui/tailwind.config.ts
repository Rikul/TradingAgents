import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0B1220",
        surface: "#111827",
        panel: "#1F2937",
        accent: "#22D3EE"
      }
    }
  },
  plugins: [],
};

export default config;
