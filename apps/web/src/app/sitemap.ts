import type { MetadataRoute } from "next";

const baseUrl = "https://loresyncweb.vercel.app";
const updatedAt = new Date("2026-10-04T00:00:00.000Z");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: baseUrl, lastModified: updatedAt, changeFrequency: "weekly", priority: 1 },
    { url: `${baseUrl}/guide`, lastModified: updatedAt, changeFrequency: "monthly", priority: 0.8 },
    { url: `${baseUrl}/privacy`, lastModified: updatedAt, changeFrequency: "yearly", priority: 0.5 },
    { url: `${baseUrl}/terms`, lastModified: updatedAt, changeFrequency: "yearly", priority: 0.3 },
    { url: `${baseUrl}/cookies`, lastModified: updatedAt, changeFrequency: "yearly", priority: 0.3 },
  ];
}
