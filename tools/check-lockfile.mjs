#!/usr/bin/env node
/**
 * Fails if the lockfile resolves anything from a git repository.
 *
 * Git-hosted dependencies need `git clone` at install time, and the ones written
 * in SSH form (`git@github.com:...`) need a key the build container does not
 * have — the install dies with exit code 128. It installs fine on a developer
 * machine and breaks only on deploy, so it is worth catching here.
 *
 * This bit us through `colyseus` (the meta package), whose peer
 * `@colyseus/uwebsockets-transport` pulls uWebSockets.js straight from GitHub.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const lockfile = join(dirname(fileURLToPath(import.meta.url)), "..", "pnpm-lock.yaml");
const lines = readFileSync(lockfile, "utf8").split("\n");

const offenders = lines
  .map((line, i) => ({ line: line.trim(), number: i + 1 }))
  .filter(({ line }) => /type:\s*git|resolution:.*\bgit@|git\+(ssh|https):/.test(line));

if (offenders.length === 0) {
  console.log("lockfile ok: git-зависимостей нет");
  process.exit(0);
}

console.error("В pnpm-lock.yaml есть зависимости из git — установка упадёт в билд-контейнере:\n");
for (const { line, number } of offenders.slice(0, 10)) {
  console.error(`  pnpm-lock.yaml:${number}  ${line.slice(0, 120)}`);
}
console.error(
  "\nНайди, кто их тянет (`pnpm why <пакет>`), и убери — обычно это ненужный\n" +
    "мета-пакет, притаскивающий их через peerDependencies.",
);
process.exit(1);
