import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../../config/env.js";

export interface AccessClaims {
  sub: string; // userId
  mobile: string;
}

export function signAccessToken(claims: AccessClaims): string {
  return jwt.sign(claims, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl as jwt.SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessClaims {
  return jwt.verify(token, env.jwtAccessSecret) as AccessClaims;
}

// Refresh tokens are opaque random strings; only their hash is stored.
export function newRefreshToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(48).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
