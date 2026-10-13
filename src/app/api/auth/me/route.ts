import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export async function GET() {
  try {
    const session = await getSession();

    if (!session || !session.id) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.id },
      select: { id: true, name: true, email: true, phone: true, role: true, orgId: true, verified: true, createdAt: true },
    });

    if (user) {
      return NextResponse.json({
        success: true,
        authenticated: true,
        user: user,
        data: { user, authenticated: true }
      });
    }

    return NextResponse.json({ authenticated: false }, { status: 401 });
  } catch (error) {
    console.error("Auth me error:", error);
    return NextResponse.json({ authenticated: false }, { status: 500 });
  }
}
