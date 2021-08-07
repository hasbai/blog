const { config } = require("vuepress-theme-hope");

module.exports = config({
  title: "拾遗录",
  description: "凡是过往，皆为序章",

  dest: "./dist",

  head: [
    [
      "script",
      { src: "https://cdn.jsdelivr.net/npm/react/umd/react.production.min.js" },
    ],
    [
      "script",
      {
        src: "https://cdn.jsdelivr.net/npm/react-dom/umd/react-dom.production.min.js",
      },
    ],
    ["script", { src: "https://cdn.jsdelivr.net/npm/vue/dist/vue.min.js" }],
    [
      "script",
      { src: "https://cdn.jsdelivr.net/npm/@babel/standalone/babel.min.js" },
    ],
  ],

  themeConfig: {
    logo: "/logo.png",
    hostname: "https://blog.hath.top",
    author: "shi2002",
    repo: "https://github.com/hasbai/blog",

    nav: [
      { text: "主页", link: "/", icon: "home" },
    ],

    blog: {
      intro: "/intro/",
      sidebarDisplay: "mobile",
      links: {
        Emial: "mailto:jsclndnz@gmail.com",
        Github: "https://github.com/hasbai",
        Zhihu: "https://www.zhihu.com/people/hath-61",
        Whatsapp: "https://t.me/spqr1453",
        QQ: "https://wpa.qq.com/msgrd?v=3&uin=1839419643&site=qq&menu=yes",
        Steam: "https://steamcommunity.com/profiles/76561199063075004",
      },
    },

    footer: {
      display: true,
      content: "<a href=\"https://icp.gov.moe\" target=\"_blank\">萌ICP备 </a><a href=\"https://icp.gov.moe/?keyword=20210115\" target=\"_blank\"> 20210115 号</a>",
    },

    comment: {
      type: "waline",
      serverURL: "https://blog-backend-omega.vercel.app/",
    },

    copyright: {
      status: "global",
    },

    git: {
      timezone: "Asia/Shanghai",
    },

    mdEnhance: {
      enableAll: true,
      presentation: {
        plugins: [
          "highlight",
          "math",
          "search",
          "notes",
          "zoom",
          "anything",
          "audio",
          "chalkboard",
        ],
      },
    },

    pwa: {
      favicon: "/favicon.ico",
      cachePic: true,
      apple: {
        icon: "/assets/icon/apple-icon-152.png",
        statusBarColor: "black",
      },
      msTile: {
        image: "/assets/icon/ms-icon-144.png",
        color: "#ffffff",
      },
      manifest: {
        icons: [
          {
            src: "/assets/icon/chrome-mask-512.png",
            sizes: "512x512",
            purpose: "maskable",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-mask-192.png",
            sizes: "192x192",
            purpose: "maskable",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/assets/icon/chrome-192.png",
            sizes: "192x192",
            type: "image/png",
          },
        ],
        shortcuts: [
          {
            name: "Guide",
            short_name: "Guide",
            url: "/guide/",
            icons: [
              {
                src: "/assets/icon/guide-maskable.png",
                sizes: "192x192",
                purpose: "maskable",
                type: "image/png",
              },
              {
                src: "/assets/icon/guide-monochrome.png",
                sizes: "192x192",
                purpose: "monochrome",
                type: "image/png",
              },
            ],
          },
        ],
      },
    },
  },
});
