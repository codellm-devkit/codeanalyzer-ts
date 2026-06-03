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

/**
 * All diagnostics go to stderr so stdout stays a clean JSON channel (the SDK reads stdout when
 * no -o is given).
 */
export class Logger {
  constructor(private level: number) {}
  private emit(min: number, tag: string, msg: string): void {
    if (this.level >= min) process.stderr.write(`[codeanalyzer-ts] ${tag}${msg}\n`);
  }
  info(msg: string): void {
    this.emit(1, "", msg);
  }
  debug(msg: string): void {
    this.emit(2, "debug: ", msg);
  }
  trace(msg: string): void {
    this.emit(3, "trace: ", msg);
  }
  warn(msg: string): void {
    process.stderr.write(`[codeanalyzer-ts] WARN ${msg}\n`);
  }
  error(msg: string): void {
    process.stderr.write(`[codeanalyzer-ts] ERROR ${msg}\n`);
  }
}
