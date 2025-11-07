// @ts-check
import { themes as prismThemes } from "prism-react-renderer";

/** @type {import('@docusaurus/types').Config} */
const config = {
  title: "WisherNotes",
  tagline: "A collection of notes and resources",
  favicon: "img/favicon.ico",
  staticDirectories: ["static"],

  // Site URL setup (for GitHub Pages)
  url: "https://larrywisherman.github.io",
  baseUrl: "/WisherNotes/",
  trailingSlash: false,

  // GitHub Pages deployment info
  organizationName: "LarryWisherMan",
  projectName: "WisherNotes",
  deploymentBranch: "gh-pages",

  onBrokenLinks: "throw",
  onBrokenMarkdownLinks: "warn",

  i18n: {
    defaultLocale: "en",
    locales: ["en"],
  },

  plugins: [
    // --- PWA plugin (you already had this) ---
    [
      "@docusaurus/plugin-pwa",
      {
        debug: true,
        offlineModeActivationStrategies: ["always", "standalone"],
        pwaHead: [
          { tagName: "link", rel: "icon", href: "/img/docusaurus.png" },
          { tagName: "link", rel: "manifest", href: "/manifest.json" },
          {
            tagName: "meta",
            name: "theme-color",
            content: "rgb(37, 194, 160)",
          },
        ],
      },
    ],

    // --- NEW: Playbook plugin instance ---
    [
      "@docusaurus/plugin-content-docs",
      {
        id: "playbook", // unique ID for this docs instance
        path: "docs-playbook", // folder where your playbook Markdown lives
        routeBasePath: "playbook", // URL route => /playbook/
        sidebarPath: "./sidebarsPlaybook.js", // use the new sidebar file
        editUrl: "https://github.com/LarryWisherMan/WisherNotes/edit/main/",
      },
    ],
  ],

  presets: [
    [
      "classic",
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: "./sidebars.js", // your original Axway docs
        },
        blog: {
          showReadingTime: true,
          feedOptions: { type: ["rss", "atom"], xslt: true },
          onInlineTags: "warn",
          onInlineAuthors: "warn",
          onUntruncatedBlogPosts: "warn",
        },
        theme: {
          customCss: "./src/css/custom.css",
        },
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      image: "img/docusaurus-social-card.jpg",
      navbar: {
        title: "WisherNotes",
        logo: { alt: "My Site Logo", src: "img/logo.svg" },
        items: [
          {
            type: "docSidebar",
            sidebarId: "tutorialSidebar",
            position: "left",
            label: "Axway",
          },
          {
            type: "docSidebar",
            sidebarId: "playbookSidebar",
            docsPluginId: "playbook",
            position: "left",
            label: "Playbook",
          },
          {
            href: "https://github.com/LarryWisherMan/WisherNotes",
            label: "GitHub",
            position: "right",
          },
        ],
      },
      prism: {
        theme: prismThemes.github,
        darkTheme: prismThemes.dracula,
        additionalLanguages: ["powershell", "bash", "json", "yaml", "ini"],
      },
    }),
};

export default config;
