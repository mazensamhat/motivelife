import { NextResponse } from "next/server";
import type { SessionUser } from "./session";

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json({ error: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 });
}

export function serverError(message: string) {
  return NextResponse.json({ error: message }, { status: 500 });
}

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

export function premiumRequired(message = "MotiveLife Pro required") {
  return NextResponse.json({ error: message, code: "PREMIUM_REQUIRED" }, { status: 402 });
}

export function json<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function startOfDay(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function startOfWeek(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
}

export function endOfWeek(date = new Date()) {
  const d = startOfWeek(date);
  d.setDate(d.getDate() + 7);
  return d;
}

export function startOfMonth(date = new Date()) {
  const d = startOfDay(date);
  d.setDate(1);
  return d;
}

export function endOfMonth(date = new Date()) {
  const d = startOfMonth(date);
  d.setMonth(d.getMonth() + 1);
  return d;
}

export function startOfQuarter(date = new Date()) {
  const d = startOfDay(date);
  const quarterStartMonth = Math.floor(d.getMonth() / 3) * 3;
  d.setMonth(quarterStartMonth, 1);
  return d;
}

export function endOfQuarter(date = new Date()) {
  const d = startOfQuarter(date);
  d.setMonth(d.getMonth() + 3);
  return d;
}

export function isFirstDayOfQuarter(date = new Date()) {
  const d = startOfDay(date);
  return d.getDate() === 1 && [0, 3, 6, 9].includes(d.getMonth());
}

export function isFirstWeekOfQuarter(date = new Date()) {
  const d = startOfDay(date);
  return [0, 3, 6, 9].includes(d.getMonth()) && d.getDate() <= 7;
}

export function isOverdue(dueDate: Date | null) {
  if (!dueDate) return false;
  return dueDate < startOfDay();
}

export function daysSince(date: Date) {
  return Math.floor((Date.now() - date.getTime()) / (1000 * 60 * 60 * 24));
}

export type { SessionUser };
