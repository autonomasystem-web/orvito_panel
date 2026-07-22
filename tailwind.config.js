/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        // Paleta oficial ORVE (junio 2026), mapeada por rol y contraste
        brand: {
          DEFAULT: "#38D030", // verde vivo (acento) — solo con texto oscuro encima
          darkest: "#033600", // gradiente del sidebar (fondo)
          dark: "#064F00", // sidebar, encabezados, botones primarios (texto blanco ✓)
          strong: "#108707", // fondos verdes con texto blanco
          green: "#108707", // verdes sobre blanco (contraste correcto)
          moss: "#157a10",
          leaf: "#38D030", // acento brillante: puntos, focus, estados activos
          lime: "#83BC4A", // badges suaves / series de gráficas
          tint: "#EAF9E8", // hovers y zonas destacadas
        },
        // Neutros oficiales del Manual de Marca ORVE 2026
        ink: "#282828", // texto principal (oficial)
        muted: "#636363", // texto secundario (oficial)
        muted2: "#9A9B9A", // texto terciario / placeholders (oficial)
        line: "#E6E7E6", // bordes (oficial)
        canvas: "#F7F8F7", // fondo de la app (oficial)
        soft: "#EAF9E8", // verde claro (chips/banners) = tint oficial
        softer: "#f2f8f1",
        danger: "#b4554e",
        amber: "#a6772a",
      },
      fontFamily: {
        // "Avenir" primero (cuando haya licencia toma el control); mientras,
        // "Nunito Sans" (gratis, muy cercana a Avenir).
        sans: ["Avenir", "Nunito Sans", "system-ui", "sans-serif"],
        display: ["Avenir", "Nunito Sans", "system-ui", "sans-serif"],
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
