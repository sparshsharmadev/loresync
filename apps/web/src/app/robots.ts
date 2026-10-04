import type { MetadataRoute } from "next";

const privatePaths = ["/account/", "/profile/", "/workspace/", "/api/"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: privatePaths },
      {
        userAgent: ["GPTBot", "ChatGPT-User", "OAI-SearchBot", "ClaudeBot", "anthropic-ai", "PerplexityBot", "Google-Extended", "Applebot-Extended"],
        allow: "/",
        disallow: privatePaths,
      },
    ],
    sitemap: "https://loresyncweb.vercel.app/sitemap.xml",
    host: "https://loresyncweb.vercel.app",
  };
}
