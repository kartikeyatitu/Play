import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

function getDatabaseUrl(): string {
  // Opt-in only: the direct 5432 host is IPv6-only and unreachable on many networks (P1001),
  // so dev uses the pooled DATABASE_URL by default. Set USE_DIRECT_DB=true to force the direct connection.
  if (process.env.NODE_ENV === "development" && process.env.USE_DIRECT_DB === "true" && process.env.DIRECT_URL) {
    return process.env.DIRECT_URL;
  }

  // If explicitly provided via env (e.g. Postgres, Supabase, Turso), use it
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:.")) {
    return process.env.DATABASE_URL;
  }

  // In Serverless / Vercel environments, /tmp is writable while /var/task is read-only
  if (process.env.VERCEL) {
    const tmpDbPath = path.join("/tmp", "sportsos_dev.db");
    const localDbPath = path.join(process.cwd(), "prisma", "dev.db");
    if (fs.existsSync(localDbPath)) {
      try {
        fs.copyFileSync(localDbPath, tmpDbPath);
      } catch (e) {
        console.warn("Failed to copy dev.db to /tmp:", e);
      }
    }
    if (fs.existsSync(tmpDbPath)) {
      return `file:${tmpDbPath}`;
    }
  }

  const defaultLocalPath = path.join(process.cwd(), "prisma", "dev.db");
  return `file:${defaultLocalPath}`;
}


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const dbUrl = getDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

