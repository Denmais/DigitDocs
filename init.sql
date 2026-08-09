CREATE DATABASE IF NOT EXISTS analytics;

CREATE TABLE IF NOT EXISTS analytics.extract_data
(
    id UInt64,

    upload_id String,
    page UInt32,

    crop_id UInt64,
    field_id UInt64,

    document_type String,
    filename String,

    title String,
    ru_title String,
    unit String,
    value_type String,

    raw_value String,
    value String,
    numeric_value Nullable(Float64),

    timestamp DateTime
)
ENGINE = MergeTree
ORDER BY (
    upload_id,
    page,
    title,
    timestamp,
    id
);


-- Числовые значения для Superset.
CREATE VIEW IF NOT EXISTS analytics.bi_numeric_values AS
SELECT
    upload_id,
    page,

    document_type,
    filename,

    title,
    ru_title,
    unit,
    value_type,

    value,
    numeric_value,

    timestamp
FROM analytics.extract_data
WHERE numeric_value IS NOT NULL;