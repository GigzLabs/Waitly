import { mkdirSync, readFileSync, writeFileSync, renameSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import type { State } from "./seed";

export function dataFile(): string {
  const dir = process.env.WAITLY_DATA_DIR || join(process.cwd(), "data");
  return join(dir, "waitly.json");
}

export function loadState(): State | null {
  const file = dataFile();
  if (!existsSync(file)) return null;
  try {
    const raw = readFileSync(file, "utf8");
    const parsed = JSON.parse(raw) as State;
    if (!parsed || !Array.isArray(parsed.tables) || !parsed.settings) return null;
    return parsed;
  } catch (err) {
    console.error("[waitly] could not read saved state, starting fresh:", err);
    return null;
  }
}

export function saveState(state: State): void {
  const file = dataFile();
  try {
    mkdirSync(dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    writeFileSync(tmp, JSON.stringify(state));
    renameSync(tmp, file);
  } catch (err) {
    console.error("[waitly] could not save state:", err);
  }
}
