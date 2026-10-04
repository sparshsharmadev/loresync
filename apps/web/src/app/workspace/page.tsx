import type { Metadata } from "next";
import { WorkspaceClient } from "./workspace-client";

export const metadata: Metadata = { title: "Your conversations", robots: { index: false, follow: false } };

export default function WorkspaceHomePage() {
  return <WorkspaceClient initialView="home" />;
}
