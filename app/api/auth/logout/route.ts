import { NextResponse } from "next/server";

function logout(request: Request) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.set("cc-auth", "", { maxAge: 0, path: "/" });
  return response;
}

export function GET(request: Request) {
  return logout(request);
}

export function POST(request: Request) {
  return logout(request);
}
