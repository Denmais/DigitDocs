import clickhouse_connect


clickhouse = clickhouse_connect.get_client(
    host="clickhouse",
    port=8123,
    username="default",
    password="",
    database="default",
)
