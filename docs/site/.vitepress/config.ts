import { defineConfig } from "vitepress";
import { withMermaid } from "vitepress-plugin-mermaid";

// Static docs site for agent-harness-sdk, served under /agent-harness-sdk/.
export default withMermaid(
  defineConfig({
    base: "/agent-harness-sdk/",
    lang: "en-US",
    title: "Agent Harness SDK",
    description:
      "Primitives for building agent harnesses: guards, checks, and tools for Claude Code.",
    cleanUrls: true,
    lastUpdated: true,
    head: [["meta", { name: "theme-color", content: "#161618" }]],

    themeConfig: {
      logo: "/agent-harness-sdk-icon.svg",
      // Items here populate the MOBILE menu (hamburger drawer). On desktop the
      // top-nav strip (.VPNavBarMenu) is CSS-hidden so navigation lives in the
      // sidebar — see custom.css.
      nav: [
        { text: "Getting Started", link: "/introduction" },
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
        { text: "Getting Started", link: "/introduction" },
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
  }),
);
