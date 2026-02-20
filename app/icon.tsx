import { ImageResponse } from "next/og";

export const size = {
    width: 32,
    height: 32,
};
export const contentType = "image/png";

export default function Icon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 16,
                    background: "#0c0c0c", // terminal-bg
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFB000", // phosphor-amber
                    fontWeight: 800,
                    fontFamily: "monospace",
                    border: "2px solid #FFB000",
                    borderRadius: "4px",
                }}
            >
                C++
            </div>
        ),
        { ...size }
    );
}
