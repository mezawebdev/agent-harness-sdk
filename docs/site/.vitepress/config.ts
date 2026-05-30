import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// Static docs site for agent-harness-sdk, served at the root of the
// agent-harness-sdk.alexmeza.io custom domain.
export default withMermaid(
  defineConfig({
    base: "/",
    lang: "en-US",
    title: "Agent Harness SDK",
    description:
      "Primitives for building agent harnesses: guards, checks, and tools for Claude Code.",
    cleanUrls: true,
    lastUpdated: true,
    head: [
      ["meta", { name: "theme-color", content: "#161618" }],
      [
        "link",
        {
          rel: "icon",
          type: "image/svg+xml",
          href: "/agent-harness-sdk-icon.svg",
        },
      ],
    ],

    themeConfig: {
      logo: "/agent-harness-sdk-icon.svg",
      // Items here populate the MOBILE menu (hamburger drawer). On desktop the
      // top-nav strip (.VPNavBarMenu) is CSS-hidden so navigation lives in the
      // sidebar — see custom.css.
      nav: [
        { text: "Getting Started", link: "/getting-started" },
        { text: "How it works", link: "/concepts/how-it-works" },
        { text: "Guards", link: "/guides/guards" },
        { text: "Checks", link: "/guides/checks" },
        { text: "Tools", link: "/guides/tools" },
        { text: "Examples", link: "/examples" },
        { text: "Testing", link: "/testing" },
        { text: "CLI", link: "/cli" },
        {
          text: "npm",
          link: "https://www.npmjs.com/package/agent-harness-sdk",
        },
      ],

      sidebar: [
        { text: "Getting Started", link: "/getting-started" },
        { text: "How it works", link: "/concepts/how-it-works" },
        { text: "Guards", link: "/guides/guards" },
        { text: "Checks", link: "/guides/checks" },
        { text: "Tools", link: "/guides/tools" },
        { text: "Examples", link: "/examples" },
        { text: "Testing", link: "/testing" },
        { text: "CLI", link: "/cli" },
      ],

      socialLinks: [
        {
          icon: "github",
          link: "https://github.com/mezawebdev/agent-harness-sdk",
        },
      ],

      search: { provider: "local" },

      editLink: {
        pattern:
          "https://github.com/mezawebdev/agent-harness-sdk/edit/main/docs/site/:path",
        text: "Edit this page on GitHub",
      },

      footer: {
        message: "Released under the MIT License.",
        copyright: "© Alex Meza",
      },
    },

    // TypeDoc-generated reference is built into ./reference before this runs.
    // Ignore dead links there if a partial generation occurs locally.
    ignoreDeadLinks: [/^\/reference\//],

    // Mermaid render defaults — larger base font and roomier spacing so the
    // agentic-loop diagram stays legible. Layout/legibility CSS is in custom.css.
    mermaid: {
      theme: "dark",
      themeVariables: {
        fontSize: "19px",
        fontFamily:
          "var(--vp-font-family-base), -apple-system, sans-serif",
        lineColor: "#7a7a85",
        edgeLabelBackground: "#1b1b1f",
      },
      flowchart: {
        // The diagram fits the prose column inline (compact) and is
        // click-to-zoom into a full-size modal — see custom.css + index.ts.
        useMaxWidth: true,
        htmlLabels: true,
        padding: 12,
        nodeSpacing: 28,
        rankSpacing: 40,
        curve: "basis",
      },
    },
  }),
);
