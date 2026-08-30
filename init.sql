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

    confidence Nullable(Float64),
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


DROP VIEW IF EXISTS analytics.bi_numeric_values;


CREATE VIEW analytics.bi_numeric_values AS
SELECT
    n.upload_id,
    n.page,

    n.document_type,
    n.filename,

    n.title,
    n.ru_title,
    n.unit,
    n.value_type,

    n.value,
    n.numeric_value,
    n.confidence,

    -- Время фактического распознавания
    n.timestamp,

    -- Поле группировки
    g.title AS group_title,
    g.value AS group_value,

    -- 25.03.2025 -> 2025-03-25
    toDateOrNull(
        concat(
            substring(g.value, 7, 4),
            '-',
            substring(g.value, 4, 2),
            '-',
            substring(g.value, 1, 2)
        )
    ) AS group_date

FROM analytics.extract_data AS n

INNER JOIN analytics.extract_data AS g
    ON n.upload_id = g.upload_id
    AND n.page = g.page

WHERE n.numeric_value IS NOT NULL;