CREATE TABLE deepseek_usage_daily_keys (
  day TEXT NOT NULL,
  installation_hash TEXT NOT NULL,
  version TEXT NOT NULL,
  PRIMARY KEY (day, installation_hash)
);

CREATE TABLE deepseek_usage_daily_totals (
  day TEXT NOT NULL,
  version TEXT NOT NULL,
  installations INTEGER NOT NULL,
  PRIMARY KEY (day, version)
) WITHOUT ROWID;

CREATE TRIGGER count_deepseek_usage AFTER INSERT ON deepseek_usage_daily_keys
BEGIN
  INSERT INTO deepseek_usage_daily_totals (day, version, installations)
  VALUES (NEW.day, NEW.version, 1)
  ON CONFLICT (day, version) DO UPDATE SET installations = installations + 1;

  DELETE FROM deepseek_usage_daily_keys
  WHERE rowid IN (
    SELECT rowid
    FROM deepseek_usage_daily_keys
    WHERE day < date(NEW.day, '-1 day')
    ORDER BY day, installation_hash
    LIMIT 128
  );
END;
