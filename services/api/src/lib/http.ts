// Small helpers: typed HTTP errors and an async route wrapper.
import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string, details?: unknown) =>
  new HttpError(400, "BAD_REQUEST", msg, details);
export const unauthorized = (msg = "Authentication required") =>
  new HttpError(401, "UNAUTHORIZED", msg);
export const forbidden = (msg = "Not allowed") =>
  new HttpError(403, "FORBIDDEN", msg);
export const notFound = (msg = "Not found") =>
  new HttpError(404, "NOT_FOUND", msg);
export const paymentRequired = (msg = "Subscription required") =>
  new HttpError(402, "SUBSCRIPTION_REQUIRED", msg);

// Wrap async handlers so thrown errors reach the error middleware.
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
