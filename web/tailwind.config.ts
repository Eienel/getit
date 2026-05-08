import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        paper: "#f4ede4",
        "paper-dark": "#e8dfd0",
        ink: "#1a1a1a",
        "ink-faded": "#4a4a4a",
        "ink-muted": "#7a7a7a",
        rule: "#1a1a1a",
        accent: "#8b1c1c",
      },
      fontFamily: {
        display: ['"Playfair Display"', '"EB Garamond"', "Georgia", "serif"],
        serif: ['"EB Garamond"', '"Cormorant Garamond"', '"Source Serif Pro"', "Times", "serif"],
        engraved: ['"Cinzel"', '"Playfair Display"', "Georgia", "serif"],
        script: ['"Allura"', '"Cormorant Garamond"', "cursive"],
        mono: ['"Courier New"', "monospace"],
      },
      letterSpacing: {
        masthead: "0.15em",
        smallcaps: "0.08em",
      },
    },
  },
  plugins: [],
};

export default config;
