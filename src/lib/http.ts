import { NextResponse } from "next/server";
import { getCurrentUser } from "./auth";
import type { User } from "./types";

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export async function requireApiUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) {
    throw new ApiError("请先登录", 401);
  }
  return user;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function handleApiError(error: unknown) {
  if (error instanceof ApiError) {
    return fail(error.message, error.status);
  }
  console.error("[api]", error);
  const message = error instanceof Error ? error.message : "服务器内部错误";
  return fail(message, 500);
}

export function clientIp(req: Request) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    ""
  );
}
