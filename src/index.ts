#!/usr/bin/env node
import { analyze } from "./core";
import { parseArgs } from "./cli";
import { emit } from "./utils";

function main(): void {
  try {
    const opts = parseArgs(process.argv.slice(2));
    const app = analyze(opts);
    emit(app, opts);
  } catch (e) {
    const err = e as Error;
    process.stderr.write(`[codeanalyzer-ts] FATAL ${err.stack ?? err.message}\n`);
    process.exit(1);
  }
}

main();
