import { ImageResponse } from "next/og";

export const alt = "Cachex Arena: play the COMP30024 minimax agent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function hexPoints(cx: number, cy: number, r: number) {
  return Array.from({ length: 6 }, (_, k) => {
    const a = (Math.PI / 180) * (60 * k - 90);
    return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
  }).join(" ");
}

export default function OpengraphImage() {
  const n = 6;
  const R = 34;
  const w = Math.sqrt(3) * R;
  const red = new Set(["0,2", "1,2", "2,1", "3,1", "4,1", "5,0"]);
  const blue = new Set(["2,3", "3,2", "1,4", "4,3", "2,0"]);
  const hexes = [];
  for (let r = 0; r < n; r++) {
    for (let q = 0; q < n; q++) {
      const key = `${r},${q}`;
      const fill = red.has(key) ? "#f0524f" : blue.has(key) ? "#4f9cf0" : "#2a2940";
      hexes.push(
        <polygon
          key={key}
          points={hexPoints(60 + w / 2 + w * (q + r / 2), 60 + R + 1.5 * R * (n - 1 - r), R * 0.93)}
          fill={fill}
        />,
      );
    }
  }
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "linear-gradient(135deg, #17162a 0%, #1d1b33 60%, #141320 100%)",
        color: "#efeef8",
        padding: "0 80px",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 560 }}>
        <div style={{ fontSize: 26, letterSpacing: 6, color: "#a9a6c4" }}>
          COMP30024 · UNIMELB · 2022
        </div>
        <div style={{ fontSize: 104, fontWeight: 700, lineHeight: 1, marginTop: 24 }}>
          Cachex Arena
        </div>
        <div style={{ fontSize: 34, marginTop: 28, color: "#c9c6e0" }}>
          Play our minimax agent, watch AI vs AI, and step through A* search.
        </div>
      </div>
      <svg width="560" height="460" viewBox="0 0 560 460">
        {hexes}
      </svg>
    </div>,
    size,
  );
}
