import { ImageResponse } from "next/og";
import { FOUNDING_OFFER, FREE_PLAN } from "@/lib/pricing";

export const alt = "Triq — Run your sports academy from your phone";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Note: the default OG font has no ₹ glyph, so keep currency symbols out of this image.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "#09090b",
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(163,230,53,0.28), transparent 45%), radial-gradient(circle at 10% 90%, rgba(16,185,129,0.18), transparent 40%)",
          color: "#fafafa",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 18,
              background: "#a3e635",
              color: "#09090b",
              fontSize: 24,
              fontWeight: 900,
              letterSpacing: -1,
            }}
          >
            TRQ
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 700 }}>Triq</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, fontWeight: 800, lineHeight: 1.05, letterSpacing: -2 }}>
            <span>Run your academy</span>
            <span style={{ color: "#a3e635" }}>from your phone.</span>
          </div>
          <div style={{ display: "flex", fontSize: 30, color: "#a1a1aa" }}>
            Attendance, fees and parent updates — built for Indian sports coaches.
          </div>
        </div>

        <div style={{ display: "flex", gap: 16, fontSize: 24 }}>
          <div style={{ display: "flex", padding: "10px 20px", borderRadius: 999, border: "1px solid #3f3f46", color: "#e4e4e7" }}>
            {`Free up to ${FREE_PLAN.maxStudents} students`}
          </div>
          <div
            style={{
              display: "flex",
              padding: "10px 20px",
              borderRadius: 999,
              border: "1px solid rgba(251,191,36,0.5)",
              color: "#fcd34d",
            }}
          >
            {`${FOUNDING_OFFER.city} founding offer: ${FOUNDING_OFFER.discountPercent}% off`}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
