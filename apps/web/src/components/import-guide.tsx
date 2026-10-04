"use client";

import Link from "next/link";
import { useState } from "react";

const steps = [
  { label: "Choose an export", title: "Bring in the file.", body: "Open New analysis and choose a WhatsApp .txt export or Discord .json export up to 25 MB. You can also drop the file into the import area." },
  { label: "Pick its home", title: "Choose local or cloud.", body: "This device keeps the analysis in this browser. Cloud archive needs an account and a separate confirmation; only parsed messages are sent, never the original export." },
  { label: "Read the shape", title: "Start with the overview.", body: "See the date range, message and participant counts, activity by day, and each participant’s share. These describe the export; they do not rate a relationship." },
  { label: "Keep or clear", title: "Your archive stays yours.", body: "Open saved conversations from the workspace. Delete a local copy there, or remove a cloud analysis from your account archive. Cloud analyses expire after one year." },
];

export function ImportGuide() {
  const [index, setIndex] = useState(0);
  const step = steps[index];
  return <section className="guide-carousel" aria-label="LoreSync quick start">
    <div className="guide-progress"><span>STEP {String(index + 1).padStart(2, "0")} / {String(steps.length).padStart(2, "0")}</span><div role="tablist" aria-label="Guide steps">{steps.map((item, itemIndex) => <button key={item.label} role="tab" aria-selected={itemIndex === index} aria-label={`Step ${itemIndex + 1}: ${item.label}`} onClick={() => setIndex(itemIndex)}><i /></button>)}</div></div>
    <div className="guide-slide" aria-live="polite" aria-atomic="true"><span className="guide-slide-label">{step.label}</span><h2>{step.title}</h2><p>{step.body}</p></div>
    <div className="guide-controls"><button type="button" onClick={() => setIndex((index + steps.length - 1) % steps.length)}>← Previous</button><Link href="/workspace/import">Start an analysis ↗</Link><button type="button" onClick={() => setIndex((index + 1) % steps.length)}>Next →</button></div>
  </section>;
}
