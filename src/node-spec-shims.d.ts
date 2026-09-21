/**
 * The minimum of Node's API that the SPEC suite needs, declared here rather than pulled in as
 * `@types/node`.
 *
 * `tsconfig.spec.json` pins `types: ["vitest/globals"]` and `tsconfig.app.json` has its own list,
 * so adding a dependency to read one file in one test would widen the toolchain for every file in
 * the project. This is two function signatures, included only via the spec tsconfig's
 * `src/**‍/*.d.ts` glob, and invisible to the application build.
 *
 * Used by `landing-capture.contract.spec.ts`, which reads `public/landing.html` to check the
 * duplicated capture logic there has not drifted from the Angular services.
 */
declare module 'node:fs' {
  export function readFileSync(path: string, encoding: 'utf8'): string;
}

declare module 'node:path' {
  export function join(...parts: string[]): string;
}

declare const process: { cwd(): string };
