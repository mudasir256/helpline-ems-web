import { isCalendarDate, shiftDatePK, todayPK } from "./datetime";

// Longest range one export may cover, so a request cannot pull the whole database.
export const EXPORT_MAX_DAYS = 92;

type Cell = string | number | boolean | null | undefined;

// Spreadsheet apps run a cell that starts with one of these as a formula. Report text is typed by staff,
// so a leading quote keeps it as plain text.
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: Cell) {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]) {
  return [header, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

export function csvResponse(filename: string, csv: string) {
  // The byte-order mark makes Excel read the file as UTF-8, so Urdu text and names display correctly.
  return new Response(`﻿${csv}\r\n`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Reads ?from=&to= (Pakistan calendar dates). Defaults to the first of this month up to today. */
export function parseExportRange(searchParams: URLSearchParams) {
  const today = todayPK();
  const from = searchParams.get("from") || `${today.slice(0, 7)}-01`;
  const to = searchParams.get("to") || today;
  if (!isCalendarDate(from) || !isCalendarDate(to)) return { error: "Choose valid dates" } as const;
  if (from > to) return { error: "The start date is after the end date" } as const;
  if (shiftDatePK(from, EXPORT_MAX_DAYS - 1) < to) {
    return { error: `Export at most ${EXPORT_MAX_DAYS} days at a time` } as const;
  }
  return { from, to } as const;
}

export function datesBetween(from: string, to: string) {
  const dates: string[] = [];
  for (let d = from; d <= to; d = shiftDatePK(d, 1)) dates.push(d);
  return dates;
}
