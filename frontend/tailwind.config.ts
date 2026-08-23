import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      borderRadius: {
        none: "0px",
        sm: "4px",
        DEFAULT: "8px",
        md: "8px",
        lg: "8px",
        xl: "12px",
        "2xl": "12px",
        "3xl": "12px",
        card: "12px",
        btn: "8px",
        input: "8px",
        badge: "8px",
        full: "9999px",
      },
      fontSize: {
        "page-title": ["24px", { lineHeight: "32px", fontWeight: "600", letterSpacing: "-0.02em" }],
        "section-label": ["12px", { lineHeight: "16px", letterSpacing: "0.05em", fontWeight: "500" }],
        "body": ["14.5px", { lineHeight: "22px", fontWeight: "400" }],
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
      },
    },
  },
  plugins: [],
};
export default config;
