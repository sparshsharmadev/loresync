import type { Metadata } from "next";
import { WorkspaceClient } from "../workspace-client";

export const metadata: Metadata = { title: "Analyze a conversation", robots: { index: false, follow: false } };

export default function WorkspaceImportPage() {
  return <WorkspaceClient initialView="import" />;
}
