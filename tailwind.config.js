/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta ORVE (extraída del diseño)
        brand: {
          darkest: "#0f2e22", // sidebar más oscuro
          dark: "#1e4d3b", // verde primario
          green: "#2e7d5b", // acento
          moss: "#3b7a5e",
          leaf: "#3fa57a", // acento brillante
        },
        ink: "#2a2e2c",
        muted: "#6b7570",
        muted2: "#9aa39e",
        line: "#e3e7e5",
        canvas: "#f1f4f2", // fondo de la app
        soft: "#e9f0ec", // verde claro (chips/banners)
        softer: "#f4f6f5",
        danger: "#b4554e",
        amber: "#a6772a",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Sora", "Inter", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 2px rgba(16,46,34,0.04), 0 4px 16px rgba(16,46,34,0.05)",
        modal: "0 20px 60px rgba(16,46,34,0.25)",
      },
      borderRadius: { xl2: "1.1rem" },
    },
  },
  plugins: [],
};
