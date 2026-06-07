# codeanalyzer-typescript (Python distribution)

This directory packages the compiled `codeanalyzer-typescript` binary as a set of
platform-specific Python wheels, published to PyPI as **`codeanalyzer-typescript`**.

The CLDK Python SDK depends on this package and calls `codeanalyzer_typescript.bin_path()`
to locate the analyzer binary — the same way it imports `codeanalyzer-python` for the
Python backend. The binary itself is built from this repo's `src/` with
`bun build --compile`, so it is fully self-contained (no Node/Bun needed at runtime).

## Why platform wheels?

Unlike the Java backend (one cross-platform `.jar`), a `bun --compile` binary is
platform-specific and large (~70 MB). So we ship **one wheel per OS/arch**, tagged
`py3-none-<platform>` (the binary is Python-agnostic — no per-Python-version matrix),
and let pip resolve the correct one at install time. There is intentionally no usable
sdist: the binary cannot be built without Bun.

## Building & publishing

```bash
python -m pip install build wheel twine
./build_wheels.sh            # cross-compiles every target via Bun, emits ./dist/*.whl
twine upload dist/*.whl
```

`build_wheels.sh` loops over the Bun targets, compiles each binary into
`src/codeanalyzer_typescript/_bin/`, builds a pure wheel, and retags it to the platform.
Bun cross-compiles all targets from a single host, so this does not need a CI runner
matrix.

## Versioning

The released version comes from the **git tag**. A push of `vX.Y.Z` triggers the
release workflow, which derives `X.Y.Z` from the tag, verifies it matches this
repo's `package.json` `version` (failing fast on mismatch), and stamps it into
`__init__.py` via `$PKG_VERSION` — hatch reads `__version__` as the wheel version
(`pyproject.toml` declares `dynamic = ["version"]`). So the GitHub Release tag, the
PyPI wheel version, and the npm `package.json` version are always in lockstep.

To cut a release: bump `package.json` `version`, then push the matching tag, e.g.

```bash
npm version 0.2.0 --no-git-tag-version   # or edit package.json
git commit -am "Release v0.2.0" && git tag v0.2.0 && git push --tags
```

For a **local** wheel build, override the fallback version explicitly:
`PKG_VERSION=0.2.0 ./build_wheels.sh`.

One thing still tracked by hand: the python-sdk pin — `[tool.backend-versions]
codeanalyzer-typescript` and the `dependencies` entry
`codeanalyzer-typescript==<version>` — must be bumped to consume a new release.

## SDK integration

In the python-sdk, `TSCodeanalyzer._get_codeanalyzer_exec()` resolves the binary in
this order: `analysis_backend_path` → `$CODEANALYZER_TS_BIN` → **this package** →
in-tree bundled `bin/`. Adding `codeanalyzer-typescript` to the SDK's `dependencies`
makes the binary available automatically on install.
