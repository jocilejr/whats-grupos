/** BRT time components to UTC ISO string */
function brtToUtc(y: number, mo: number, d: number, brtH: number, brtMin: number): string {
  return new Date(Date.UTC(y, mo, d, brtH + 3, brtMin, 0, 0)).toISOString();
}

export function calculateNextFutureRun(
  msg: { schedule_type: string; content: any },
  now: Date
): string | null {
  const content = msg.content as any;
  const [brtH, brtM] = (content.runTime || "08:00").split(":").map(Number);

  const shifted = new Date(now.getTime() - 3 * 3600000);
  const bY = shifted.getUTCFullYear();
  const bMo = shifted.getUTCMonth();
  const bD = shifted.getUTCDate();

  if (msg.schedule_type === "daily") {
    // Try today first
    let utc = brtToUtc(bY, bMo, bD, brtH, brtM);
    if (new Date(utc) <= now) {
      utc = brtToUtc(bY, bMo, bD + 1, brtH, brtM);
    }
    return utc;
  }

  if (msg.schedule_type === "weekly") {
    const weekDays: number[] = content.weekDays || [1];
    for (let i = 0; i <= 7; i++) {
      const candidate = new Date(Date.UTC(bY, bMo, bD + i));
      if (weekDays.includes(candidate.getUTCDay())) {
        const utc = brtToUtc(candidate.getUTCFullYear(), candidate.getUTCMonth(), candidate.getUTCDate(), brtH, brtM);
        if (new Date(utc) > now) return utc;
      }
    }
  }

  if (msg.schedule_type === "monthly") {
    const monthDay = content.monthDay || 1;
    let utc = brtToUtc(bY, bMo, monthDay, brtH, brtM);
    if (new Date(utc) <= now) {
      utc = brtToUtc(bY, bMo + 1, monthDay, brtH, brtM);
    }
    return utc;
  }

  if (msg.schedule_type === "custom") {
    const customDays: number[] = (content.customDays || []).sort((a: number, b: number) => a - b);
    if (!customDays.length) return null;
    for (const day of customDays) {
      const utc = brtToUtc(bY, bMo, day, brtH, brtM);
      if (new Date(utc) > now) return utc;
    }
    return brtToUtc(bY, bMo + 1, customDays[0], brtH, brtM);
  }

  return null;
}
