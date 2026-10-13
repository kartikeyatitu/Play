import { NextResponse } from "next/server";
import { sendOtp } from "@/app/actions/auth";

// Delegates to the real OTP sender. It only reports success when an SMS was actually
// dispatched (Twilio configured); otherwise it returns a helpful error.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { phone } = body;

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Phone number is required" },
        { status: 400 }
      );
    }

    const cleanDigits = String(phone).replace(/[^0-9]/g, "");
    if (cleanDigits.length < 10) {
      return NextResponse.json(
        { success: false, error: "Please enter a valid 10-digit mobile number" },
        { status: 400 }
      );
    }

    const res = await sendOtp(cleanDigits);
    if (res?.error) {
      return NextResponse.json({ success: false, error: res.error }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "OTP sent via SMS" });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to dispatch OTP" },
      { status: 500 }
    );
  }
}
