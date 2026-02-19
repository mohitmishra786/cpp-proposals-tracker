import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        terminal: {
          bg: "#0a0a0a",
          surface: "#121212",
          border: "#1a1a1a",
          hover: "#1f1f1f",
          text: "#c0c0c0",
          muted: "#666666",
        },
        phosphor: {
          amber: "#ffb000",
          amberDim: "#cc8800",
          amberBright: "#ffc833",
          green: "#00ff41",
          greenDim: "#00cc33",
          greenBright: "#33ff66",
          cyan: "#00ffff",
          cyanDim: "#00cccc",
        },
        crt: {
          glow: "rgba(255, 176, 0, 0.15)",
          glowGreen: "rgba(0, 255, 65, 0.15)",
          scanline: "rgba(0, 0, 0, 0.1)",
        },
        retro: {
          panel: "#0d0d0d",
          panelHover: "#151515",
          selected: "#1a1a0a",
          accent: "#ffb000",
          accentHover: "#ffc833",
          success: "#00ff41",
          warning: "#ff6b00",
          error: "#ff3333",
        },
        surface: {
          50: "#1a1a1a",
          100: "#151515",
          200: "#121212",
          300: "#0f0f0f",
          400: "#0c0c0c",
          500: "#0a0a0a",
          600: "#080808",
          700: "#060606",
          800: "#040404",
          900: "#020202",
          950: "#000000",
        },
        brand: {
          50: "#332200",
          100: "#442d00",
          200: "#553800",
          300: "#774f00",
          400: "#996600",
          500: "#ffb000",
          600: "#ffc833",
          700: "#ffd666",
          800: "#ffdd88",
          900: "#ffeebb",
          950: "#fff6dd",
        },
      },
      fontFamily: {
        mono: [
          "JetBrains Mono",
          "Fira Code",
          "SF Mono",
          "Monaco",
          "Inconsolata",
          "Roboto Mono",
          "Source Code Pro",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      fontSize: {
        "2xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      animation: {
        "cursor-blink": "cursorBlink 1s step-end infinite",
        "scanline": "scanline 8s linear infinite",
        "flicker": "flicker 0.15s infinite",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "typing": "typing 3.5s steps(40, end)",
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        cursorBlink: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0" },
        },
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(100%)" },
        },
        flicker: {
          "0%": { opacity: "0.97" },
          "5%": { opacity: "0.95" },
          "10%": { opacity: "0.97" },
          "15%": { opacity: "0.94" },
          "20%": { opacity: "0.98" },
          "25%": { opacity: "0.96" },
          "30%": { opacity: "0.97" },
          "35%": { opacity: "0.95" },
          "40%": { opacity: "0.98" },
          "45%": { opacity: "0.96" },
          "50%": { opacity: "0.97" },
          "55%": { opacity: "0.95" },
          "60%": { opacity: "0.98" },
          "65%": { opacity: "0.96" },
          "70%": { opacity: "0.97" },
          "75%": { opacity: "0.94" },
          "80%": { opacity: "0.98" },
          "85%": { opacity: "0.96" },
          "90%": { opacity: "0.97" },
          "95%": { opacity: "0.95" },
          "100%": { opacity: "0.98" },
        },
        glowPulse: {
          "0%, 100%": { 
            textShadow: "0 0 5px rgba(255, 176, 0, 0.5), 0 0 10px rgba(255, 176, 0, 0.3)" 
          },
          "50%": { 
            textShadow: "0 0 10px rgba(255, 176, 0, 0.8), 0 0 20px rgba(255, 176, 0, 0.5), 0 0 30px rgba(255, 176, 0, 0.3)" 
          },
        },
        typing: {
          "0%": { width: "0" },
          "100%": { width: "100%" },
        },
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      boxShadow: {
        "crt": `
          0 0 60px rgba(255, 176, 0, 0.03),
          inset 0 0 100px rgba(0, 0, 0, 0.3)
        `,
        "glow-amber": "0 0 10px rgba(255, 176, 0, 0.5), 0 0 20px rgba(255, 176, 0, 0.3)",
        "glow-green": "0 0 10px rgba(0, 255, 65, 0.5), 0 0 20px rgba(0, 255, 65, 0.3)",
        "glow-cyan": "0 0 10px rgba(0, 255, 255, 0.5), 0 0 20px rgba(0, 255, 255, 0.3)",
        "border-glow": "inset 0 0 0 1px rgba(255, 176, 0, 0.1)",
      },
      backgroundImage: {
        "scanlines": `
          repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.15),
            rgba(0, 0, 0, 0.15) 1px,
            transparent 1px,
            transparent 2px
          )
        `,
        "crt-gradient": `
          radial-gradient(
            ellipse at center,
            transparent 0%,
            rgba(0, 0, 0, 0.2) 90%,
            rgba(0, 0, 0, 0.4) 100%
          )
        `,
      },
      borderWidth: {
        "1": "1px",
      },
      spacing: {
        "18": "4.5rem",
        "22": "5.5rem",
      },
      screens: {
        "xs": "475px",
      },
      transitionDuration: {
        "400": "400ms",
      },
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
