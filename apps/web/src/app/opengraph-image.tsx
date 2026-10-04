import { ImageResponse } from "next/og";

export const alt = "LoreSync — See the shape of your conversations";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "68px 76px", background: "#080808", color: "#f4f1eb", fontFamily: "Arial, sans-serif" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, color: "#f4f1eb", fontSize: 28, fontWeight: 700 }}>
        <div style={{ width: 24, height: 24, borderRadius: 12, background: "#ef233c" }} />
        LoreSync
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <div style={{ color: "#c9c1b5", fontSize: 22, letterSpacing: 5 }}>CONVERSATIONS, WITH CONTEXT</div>
        <div style={{ display: "flex", flexDirection: "column", fontSize: 74, fontWeight: 700, lineHeight: 1.12, letterSpacing: -3 }}><span>See the shape</span><span>of your conversations.</span></div>
        <div style={{ color: "#d5d1ca", fontSize: 26 }}>Interactive timelines · Activity heatmaps · Your chat, on your terms</div>
      </div>
      <div style={{ color: "#ef233c", fontSize: 20, letterSpacing: 3 }}>LORESYNCWEB.VERCEL.APP</div>
    </div>,
    size,
  );
}
