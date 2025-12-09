import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        hyundai: {
          blue: "#002C5F",
          sky: "#00AAD2",
          light: "#E4DCD3",
          sand: "#C4BEB9",
        },
      },
    },
  },
  plugins: [],
};
export default config;
