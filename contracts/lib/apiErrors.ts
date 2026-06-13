import { FirebaseError } from "firebase/app";

export function formatCallableError(err: unknown): string {
  if (err instanceof FirebaseError) {
    switch (err.code) {
      case "functions/unauthenticated":
      case "unauthenticated":
        return "Your session expired. Sign in again, then retry.";
      case "functions/permission-denied":
      case "permission-denied":
        return "You do not have permission to view this contract.";
      case "functions/not-found":
      case "not-found":
        return "The server could not find this contract record.";
      default:
        return err.message || "Request failed.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Request failed.";
}
