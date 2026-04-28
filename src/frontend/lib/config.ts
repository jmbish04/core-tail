export type SiteConfig = {
  name: string;
  description: string;
  url: string;
  author: {
    name: string;
    url: string;
  };
  links: {
    github: string;
  };
  navItems: {
    href: string;
    label: string;
    external?: boolean;
  }[];
};

export const siteConfig: SiteConfig = {
  name: "Core Tail",
  description: "Cloudflare Workers tail event aggregator with AI-powered log analysis",
  url: "https://core-tail.jmbish04.workers.dev",
  author: {
    name: "jmbish04",
    url: "https://github.com/jmbish04",
  },
  links: {
    github: "https://github.com/jmbish04/core-tail",
  },
  navItems: [
    { href: "/", label: "Dashboard" },
    { href: "/logs", label: "Logs" },
    { href: "/realtime", label: "Real-time" },
    { href: "/core-tail-logs", label: "Core-Tail Logs" },
    { href: "https://github.com/jmbish04/core-tail", label: "GitHub", external: true },
  ],
};
