import * as fs from "node:fs";
import * as path from "node:path";
import { gzipSync } from "node:zlib";
import { encode } from "@msgpack/msgpack";
import type { AnalysisOptions } from "../options";
import type { TSApplication } from "../schema";

/**
 * The only facade-visible artifact. With no -o, print compact JSON to stdout (the SDK reads
 * stdout). With -o, write `<output>/analysis.json` (or `.msgpack`).
 */
export function emit(app: TSApplication, opts: AnalysisOptions): void {
  if (opts.output === null) {
    process.stdout.write(JSON.stringify(app));
    return;
  }
  fs.mkdirSync(opts.output, { recursive: true });
  if (opts.format === "msgpack") {
    const packed = gzipSync(encode(app));
    fs.writeFileSync(path.join(opts.output, "analysis.msgpack"), packed);
  } else {
    fs.writeFileSync(path.join(opts.output, "analysis.json"), JSON.stringify(app));
  }
}
