# DeepSeek Harness Linux usage

The collector returns HTTP 503 until the ForkHub web Worker has a D1 binding named
`DEEPSEEK_USAGE_DB`. When the database is ready, add its binding and ID to the
Worker configuration. From `apps/web`, apply the migrations before deploying the
Worker.

```sh
pnpm exec wrangler d1 migrations apply DEEPSEEK_USAGE_DB --remote
```

Verify a valid POST receives HTTP 204 through the public hostname before enabling
the desktop sender.

Query `deepseek_usage_daily_totals` in the D1 console to get installations per UTC
day. Each installation contributes to the version on its first accepted report
that day.

```sql
SELECT day, SUM(installations) AS active_installations
FROM deepseek_usage_daily_totals
GROUP BY day
ORDER BY day DESC;
```

The insert trigger trims up to 128 older deduplication keys per new installation
report. It keeps keys for the current and previous UTC day. Schedule the following
cleanup daily during rollout so keys also expire when no reports arrive. Run it
again if a batch deletes 128 rows. Daily totals remain after key cleanup.

```sql
DELETE FROM deepseek_usage_daily_keys
WHERE rowid IN (
  SELECT rowid
  FROM deepseek_usage_daily_keys
  WHERE day < date('now', '-1 day')
  ORDER BY day, installation_hash
  LIMIT 128
);
```
