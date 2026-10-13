import { NextResponse } from "next/server";
import { verifyOtpAndLogin } from "@/app/actions/auth";

// Previously this route accepted the hard-coded OTP "123456" for ANY phone number and
// created/logged in that user. It now delegates to the real OTP verification, which
// checks a stored, expiring code and only signs in users an academy admin already added.
export async function POST(req: Request) {
  try {
    const { phone, otp } = await req.json();

    if (!phone || !otp) {
      return NextResponse.json({ success: false, message: "Missing fields" }, { status: 400 });
    }

    const res = await verifyOtpAndLogin(String(phone), String(otp));
    if (res?.error) {
      return NextResponse.json({ success: false, message: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, role: res.role });
  } catch (error) {
    console.error("OTP verification error:", error);
    return NextResponse.json({ success: false, message: "Internal error" }, { status: 500 });
  }
}
