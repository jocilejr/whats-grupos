

# Fix: Unique Constraint Missing on group_stats

## Problem

The sync button shows this error:
```
Rosana: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

The Edge Function `sync-group-stats` does an upsert with `onConflict: "user_id,group_id,snapshot_date"`, but the `group_stats` table has no unique constraint on those three columns.

## Solution

Add a unique constraint on `(user_id, group_id, snapshot_date)` to the `group_stats` table via a database migration:

```sql
ALTER TABLE public.group_stats
ADD CONSTRAINT group_stats_user_group_date_unique
UNIQUE (user_id, group_id, snapshot_date);
```

No code changes needed -- the Edge Function already references the correct columns.

## Steps

1. Run the migration to add the unique constraint
2. Test by clicking "Sincronizar Agora" on the Groups page

