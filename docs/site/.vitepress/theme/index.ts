import DefaultTheme from "vitepress/theme";
import { onMounted } from "vue";
import "./custom.css";
import { setupMermaidZoom } from "./mermaid-zoom";

// Extends the default theme with a monochrome palette matching the SDK icon,
// plus click-to-zoom for Mermaid diagrams (see mermaid-zoom.ts).
export default {
  extends: DefaultTheme,
  setup() {
    onMounted(setupMermaidZoom);
  },
};
