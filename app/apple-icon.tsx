import { ImageResponse } from "next/og";

export const size = {
    width: 180,
    height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    fontSize: 72,
                    background: "#0c0c0c",
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#FFB000",
                    fontWeight: 800,
                    fontFamily: "monospace",
                    border: "8px solid #FFB000",
                    borderRadius: "24px",
                }}
            >
                C++
            </div>
        ),
        { ...size }
    );
}
