export type ErrorCode =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "STATE_CONFLICT"
  | "VERSION_CONFLICT"
  | "LAST_SUPERADMIN"
  | "VALIDATION_ERROR"
  | "RATE_LIMITED";

const STATUS: Record<ErrorCode, number> = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  STATE_CONFLICT: 409,
  VERSION_CONFLICT: 409,
  LAST_SUPERADMIN: 409,
  VALIDATION_ERROR: 422,
  RATE_LIMITED: 429,
};

/** An expected failure with a stable code (docs/06 §1) and an Indonesian message. */
export class AppError extends Error {
  readonly status: number;

  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
    this.status = STATUS[code];
  }
}
