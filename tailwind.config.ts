import type { Config } from "tailwindcss";
export default {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { ink: "#101828", brand: "#4f46e5", mint: "#0f9d7a", mist: "#f5f6fb", warn: "#c2410c" },
      borderRadius: { "2.5xl": "1.25rem" },
    },
  },
  plugins: [],
} satisfies Config;
