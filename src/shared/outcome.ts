export interface Failure {
  error: string;
  hash?: string;
  ok: false;
  reason: "conflict" | "nothing";
}

export type Outcome<T extends object = object> =
  | ({ ok: true; hash: string } & T)
  | Failure;

export class ConflictError extends Error {
  override readonly name = "ConflictError";
}

export function settle<T extends object>(
  outcome: Outcome<T>
): { hash: string } & T {
  if (!outcome.ok) {
    throw outcome.reason === "conflict"
      ? new ConflictError(outcome.error)
      : new Error(outcome.error);
  }
  return outcome;
}

export function isOutcome(body: unknown): body is Outcome {
  return (
    typeof body === "object" &&
    body !== null &&
    typeof (body as { ok?: unknown }).ok === "boolean"
  );
}
