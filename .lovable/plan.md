

## Problem

The `calculateNextRunAt` function in `send-scheduled-messages/index.ts` uses **local-timezone Date methods** (`setHours`, `setDate`, `getDay`) on a date that was manually shifted to represent BRT. Since Deno edge functions may run in any timezone, these methods produce wrong results. The fix applied via SQL was correct but the function will re-corrupt `next_run_at` on every subsequent run.

## Root Cause

```
brtNow = new Date(now.getTime() - BRT_OFFSET_MS)
candidate.setHours(brtH, brtM, 0, 0)   // ← uses SERVER local tz, not UTC
candidate.getDay()                       // ← same problem
```

All Date manipulation after the offset subtraction must use **UTC methods** (`setUTCHours`, `setUTCDate`, `getUTCDay`, `getUTCFullYear`, `getUTCMonth`) since `brtNow` is a "fake UTC" date representing BRT.

## Fix

Replace `calculateNextRunAt` function (lines 238-291) using UTC methods throughout:

- `setHours` → `setUTCHours`
- `setDate` → `setUTCDate`
- `getDate` → `getUTCDate`
- `getDay` → `getUTCDay`
- `getFullYear` → `getUTCFullYear`
- `getMonth` → `getUTCMonth`
- `new Date(year, month, day, h, m)` → `Date.UTC(year, month, day, h, m)`

All four schedule types (daily, weekly, monthly, custom) need this correction. No other files need changes.

