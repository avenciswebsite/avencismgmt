/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // Avencis Core Brand Palette
        surface: "#fbf9f4",
        "surface-dim": "#dbdad5",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f5f3ee",
        "surface-container": "#f0eee9",
        "surface-container-high": "#eae8e3",
        "surface-container-highest": "#e4e2dd",
        "on-surface": "#1b1c19",
        "on-surface-variant": "#454651",
        outline: "#757683",
        "outline-variant": "#c5c6d3",
        "on-primary": "#ffffff",
        
        // Brand Primary (Navy)
        primary: {
          DEFAULT: "#000a3f",
          dark: "#001258",
          active: "#001a72",
          container: "#b9c4f7",
          "on-container": "#001258",
          "on-primary": "#ffffff",
        },
        
        // Brand Secondary (Slate / Periwinkle)
        secondary: {
          DEFAULT: "#515c88",
          fixed: "#dce1ff",
          "fixed-dim": "#b9c4f7",
          container: "#dce1ff",
        },
        
        // Brand Accent (Terracotta)
        accent: {
          DEFAULT: "#e4692d",
          hover: "#c8531b",
          light: "#ffb597",
          container: "#ffdbcd",
          "on-container": "#481600",
        },
        
        // Semantic / System
        error: {
          DEFAULT: "#ba1a1a",
          container: "#ffdad6",
        },
        success: {
          DEFAULT: "#1e7e34",
          container: "#d4edda",
        },
        warning: {
          DEFAULT: "#d97706",
          container: "#fef3c7",
        },
        info: {
          DEFAULT: "#0284c7",
          container: "#e0f2fe",
        },
      },
      fontFamily: {
        serif: ['"DM Serif Display"', 'serif'],
        sans: ['Manrope', 'sans-serif'],
      },
      boxShadow: {
        'soft': '0 2px 8px -2px rgba(0, 10, 63, 0.05), 0 4px 16px -4px rgba(0, 10, 63, 0.05)',
        'card': '0 1px 3px 0 rgba(0, 10, 63, 0.04), 0 1px 2px -1px rgba(0, 10, 63, 0.04)',
        'elevated': '0 10px 30px -5px rgba(0, 10, 63, 0.08), 0 4px 12px -2px rgba(0, 10, 63, 0.04)',
      },
    },
  },
  plugins: [],
};
