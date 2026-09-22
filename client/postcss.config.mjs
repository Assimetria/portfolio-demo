import path from "node:path";
import { fileURLToPath } from "node:url";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import scopeImported from "./postcss/scope-imported.cjs";

const here = path.dirname(fileURLToPath(import.meta.url));

// Point Tailwind at the ESM config explicitly. Without this, Tailwind resolves
// the stale tailwind.config.js first, which lacks the touch/safe-area/fluid
// theme extensions used by src/index.css, and the production build fails
// ("The min-h-touch class does not exist").
export default {
  plugins: [
    // Confines the cloner's stylesheet (styles/@custom/imported/*.css) to
    // <div data-imported-root>; a no-op for every other file. Runs first so the
    // rewritten selectors are what Tailwind/autoprefixer see.
    scopeImported(),
    tailwindcss({ config: path.join(here, "tailwind.config.mjs") }),
    autoprefixer(),
  ],
};
