import { fetchJson } from "../http";
import { normalizeMetars, normalizeTafs } from "../normalize";
import type { Metar, Taf } from "../types";

const BASE = "https://aviationweather.gov/api/data";

export async function fetchMetars(ids: string[]): Promise<Metar[]> {
  if (!ids.length) return [];
  const url = `${BASE}/metar?ids=${encodeURIComponent(ids.join(","))}&format=json`;
  const raw = await fetchJson<unknown[]>(url, { timeoutMs: 8000 });
  return normalizeMetars(raw as never[]);
}

export async function fetchTafs(ids: string[]): Promise<Taf[]> {
  if (!ids.length) return [];
  const url = `${BASE}/taf?ids=${encodeURIComponent(ids.join(","))}&format=json`;
  const raw = await fetchJson<unknown[]>(url, { timeoutMs: 8000 });
  return normalizeTafs(raw as never[]);
}
