import { createHash } from "node:crypto";
import * as path from "node:path";

export function sha256(buf: Buffer | string): string {
  return createHash("sha256").update(buf).digest("hex");
}

export function toPosix(p: string): string {
  return p.split(path.sep).join("/");
}

export function relPosix(root: string, abs: string): string {
  return toPosix(path.relative(root, abs));
}
