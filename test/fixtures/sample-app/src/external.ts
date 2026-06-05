// Exercises phantom (external) nodes: calls into Node builtins via named + namespace imports.
import { createHash, randomUUID } from "node:crypto";
import * as path from "node:path";

/** Bare named-import calls → phantom node:crypto.randomUUID / node:crypto.createHash. */
export function fingerprint(name: string): string {
  const id = randomUUID();
  return createHash("sha256")
    .update(name + id)
    .digest("hex");
}

/** Namespace-import member call → phantom node:path.extname. */
export function extensionOf(file: string): string {
  return path.extname(file);
}
