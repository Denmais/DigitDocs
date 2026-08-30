import json
import os
from urllib.parse import quote

import requests

from mongo_forms import get_form


SUPERSET_URL = os.getenv(
    "SUPERSET_URL",
    "http://superset:8088",
).rstrip("/")

SUPERSET_PUBLIC_URL = os.getenv(
    "SUPERSET_PUBLIC_URL",
    "http://localhost:8088",
).rstrip("/")

SUPERSET_USERNAME = os.getenv(
    "SUPERSET_USERNAME",
    "admin",
)

SUPERSET_PASSWORD = os.environ.get(
    "SUPERSET_PASSWORD",
    "",
)

CLICKHOUSE_HOST = os.getenv(
    "SUPERSET_CLICKHOUSE_HOST",
    "clickhouse",
)

CLICKHOUSE_PORT = int(
    os.getenv(
        "SUPERSET_CLICKHOUSE_PORT",
        "8123",
    )
)

CLICKHOUSE_DATABASE = os.getenv(
    "SUPERSET_CLICKHOUSE_DATABASE",
    "analytics",
)

CLICKHOUSE_USER = os.getenv(
    "SUPERSET_CLICKHOUSE_USER",
    "invoice_app",
)

CLICKHOUSE_PASSWORD = os.environ.get(
    "SUPERSET_CLICKHOUSE_PASSWORD",
    "",
)

DATABASE_NAME = "Invoice ClickHouse"
DATASET_TABLE = "bi_numeric_values"
DATASET_SCHEMA = "analytics"


class SupersetClient:
    def __init__(self):
        self.session = requests.Session()

    # Авторизуется в Superset и получает CSRF token.
    def login(self):
        data = self.request(
            "POST",
            "/api/v1/security/login",
            json={
                "username": SUPERSET_USERNAME,
                "password": SUPERSET_PASSWORD,
                "provider": "db",
                "refresh": True,
            },
            use_auth=False,
        )

        self.session.headers["Authorization"] = (
            f"Bearer {data['access_token']}"
        )

        csrf = self.request(
            "GET",
            "/api/v1/security/csrf_token/",
        )

        self.session.headers.update(
            {
                "X-CSRFToken": csrf["result"],
                "Referer": SUPERSET_URL,
                "Content-Type": "application/json",
            }
        )

    # Выполняет запрос к Superset API.
    def request(
        self,
        method,
        path,
        use_auth=True,
        **kwargs,
    ):
        if (
            use_auth
            and not self.session.headers.get("Authorization")
        ):
            raise RuntimeError(
                "Superset client is not authorized"
            )

        response = self.session.request(
            method,
            f"{SUPERSET_URL}{path}",
            timeout=30,
            **kwargs,
        )

        if not response.ok:
            raise RuntimeError(
                f"Superset {method} {path}: "
                f"{response.status_code} "
                f"{response.text}"
            )

        if not response.text:
            return {}

        return response.json()

    # Возвращает список объектов REST API.
    def list_items(self, path):
        data = self.request(
            "GET",
            path,
            params={
                "q": "(page:0,page_size:100)",
            },
        )

        return data.get("result", [])


# Берёт числовые поля текущего документа.
def get_document_fields(
    clickhouse,
    task_id: str,
) -> tuple[str, list[dict]]:
    result = clickhouse.query(
        """
        SELECT
            document_type,
            title,
            any(ru_title) AS ru_title,
            any(unit) AS unit
        FROM analytics.bi_numeric_values
        WHERE upload_id = {upload_id:String}
        GROUP BY
            document_type,
            title
        ORDER BY title
        """,
        parameters={
            "upload_id": task_id,
        },
    )

    rows = [
        dict(
            zip(
                result.column_names,
                row,
            )
        )
        for row in result.result_rows
    ]

    if not rows:
        raise ValueError(
            "Для этого документа нет числовых данных для BI"
        )

    document_types = {
        row["document_type"]
        for row in rows
    }

    if len(document_types) != 1:
        raise ValueError(
            "Не удалось однозначно определить тип документа"
        )

    return rows[0]["document_type"], rows


# Берёт правило группировки из MongoDB.
def get_group_by(document_type: str) -> str:
    form = get_form(document_type)
    bi = form.get("bi")

    if not isinstance(bi, dict):
        raise ValueError(
            f"Для {document_type} не настроен блок bi"
        )

    group_by = bi.get("group_by")

    if not group_by:
        raise ValueError(
            f"Для {document_type} не настроен bi.group_by"
        )

    field_ids = {
        field.get("id")
        for field in form.get("fields", [])
    }

    if group_by not in field_ids:
        raise ValueError(
            f"Поле группировки {group_by!r} "
            f"не найдено в форме {document_type}"
        )

    return group_by


# Проверяет, что OCR распознал поле группировки.
def validate_group_value(
    clickhouse,
    task_id: str,
    group_by: str,
) -> None:
    result = clickhouse.query(
        """
        SELECT count()
        FROM analytics.extract_data
        WHERE
            upload_id = {upload_id:String}
            AND title = {group_by:String}
            AND value != ''
        """,
        parameters={
            "upload_id": task_id,
            "group_by": group_by,
        },
    )

    count = result.result_rows[0][0]

    if count == 0:
        raise ValueError(
            f"Не найдено значение поля группировки: "
            f"{group_by}"
        )


# Собирает SQLAlchemy URI ClickHouse для Superset.
def clickhouse_uri() -> str:
    user = quote(
        CLICKHOUSE_USER,
        safe="",
    )

    password = quote(
        CLICKHOUSE_PASSWORD,
        safe="",
    )

    return (
        f"clickhousedb://{user}:{password}"
        f"@{CLICKHOUSE_HOST}:{CLICKHOUSE_PORT}"
        f"/{CLICKHOUSE_DATABASE}"
    )


# Ищет или создаёт подключение ClickHouse в Superset.
def ensure_database(
    client: SupersetClient,
) -> int:
    for item in client.list_items(
        "/api/v1/database/"
    ):
        if item.get("database_name") == DATABASE_NAME:
            return item["id"]

    data = client.request(
        "POST",
        "/api/v1/database/",
        json={
            "database_name": DATABASE_NAME,
            "sqlalchemy_uri": clickhouse_uri(),
            "expose_in_sqllab": True,
            "allow_ctas": False,
            "allow_cvas": False,
            "allow_dml": False,
        },
    )

    return data["id"]


# Ищет или создаёт Dataset для ClickHouse VIEW.
def ensure_dataset(
    client: SupersetClient,
    database_id: int,
) -> int:
    for item in client.list_items(
        "/api/v1/dataset/"
    ):
        database = item.get("database")

        if isinstance(database, dict):
            item_database_id = database.get("id")
        else:
            item_database_id = database

        if (
            item.get("table_name") == DATASET_TABLE
            and item_database_id == database_id
        ):
            dataset_id = item["id"]
            break
    else:
        data = client.request(
            "POST",
            "/api/v1/dataset/",
            json={
                "database": database_id,
                "schema": DATASET_SCHEMA,
                "table_name": DATASET_TABLE,
            },
        )

        dataset_id = data["id"]

    client.request(
        "PUT",
        f"/api/v1/dataset/{dataset_id}/refresh",
        json={},
    )

    configure_group_date(
        client,
        dataset_id,
        database_id,
    )

    return dataset_id


# Помечает group_date как временную колонку.
def configure_group_date(
    client: SupersetClient,
    dataset_id: int,
    database_id: int,
):
    info = client.request(
        "GET",
        f"/api/v1/dataset/{dataset_id}",
    ).get(
        "result",
        {},
    )

    columns = []

    for column in info.get("columns", []):
        column_name = column["column_name"]

        columns.append(
            {
                "id": column["id"],
                "column_name": column_name,
                "type": column.get("type"),
                "is_dttm": column_name == "group_date",
                "filterable": True,
                "groupby": True,
            }
        )

    client.request(
        "PUT",
        f"/api/v1/dataset/{dataset_id}",
        json={
            "database_id": database_id,
            "table_name": DATASET_TABLE,
            "schema": DATASET_SCHEMA,
            "main_dttm_col": "group_date",
            "columns": columns,
        },
    )


# Ищет или создаёт dashboard по типу документа.
def ensure_dashboard(
    client: SupersetClient,
    document_type: str,
) -> int:
    name = f"BI {document_type}"

    for item in client.list_items(
        "/api/v1/dashboard/"
    ):
        if item.get("dashboard_title") == name:
            return item["id"]

    data = client.request(
        "POST",
        "/api/v1/dashboard/",
        json={
            "dashboard_title": name,
            "published": True,
        },
    )

    return data["id"]


# Настройки одного временного графика.
def chart_params(
    dataset_id: int,
    document_type: str,
    group_by: str,
    field: dict,
) -> dict:
    return {
        "datasource": f"{dataset_id}__table",
        "viz_type": "echarts_timeseries_bar",

        # Ось X теперь берётся из документа.
        "x_axis": "group_date",
        "time_range": "No filter",
        "time_grain_sqla": "P1D",

        # Пока AVG для всех числовых полей.
        "metrics": [
            {
                "expressionType": "SQL",
                "sqlExpression": "AVG(numeric_value)",
                "label": (
                    field["ru_title"]
                    or field["title"]
                ),
            }
        ],

        "adhoc_filters": [
            {
                "expressionType": "SIMPLE",
                "subject": "document_type",
                "operator": "==",
                "comparator": document_type,
                "clause": "WHERE",
            },
            {
                "expressionType": "SIMPLE",
                "subject": "title",
                "operator": "==",
                "comparator": field["title"],
                "clause": "WHERE",
            },

            # Оставляем только строки нужной группировки.
            {
                "expressionType": "SIMPLE",
                "subject": "group_title",
                "operator": "==",
                "comparator": group_by,
                "clause": "WHERE",
            },
        ],

        "row_limit": 10000,
        "show_value": True,
        "show_legend": False,
        "orientation": "vertical",
    }


# Ищет или создаёт график для одного числового поля.
def ensure_chart(
    client: SupersetClient,
    dataset_id: int,
    dashboard_id: int,
    document_type: str,
    group_by: str,
    field: dict,
) -> int:
    label = (
        field["ru_title"]
        or field["title"]
    )

    name = (
        f"{label} "
        f"[{document_type}:{field['title']}]"
    )

    params = chart_params(
        dataset_id=dataset_id,
        document_type=document_type,
        group_by=group_by,
        field=field,
    )

    for item in client.list_items(
        "/api/v1/chart/"
    ):
        if item.get("slice_name") != name:
            continue

        chart_id = item["id"]

        client.request(
            "PUT",
            f"/api/v1/chart/{chart_id}",
            json={
                "slice_name": name,
                "viz_type": "echarts_timeseries_bar",
                "datasource_id": dataset_id,
                "datasource_type": "table",
                "dashboards": [
                    dashboard_id,
                ],
                "params": json.dumps(
                    params,
                    ensure_ascii=False,
                ),
            },
        )

        return chart_id

    data = client.request(
        "POST",
        "/api/v1/chart/",
        json={
            "slice_name": name,
            "viz_type": "echarts_timeseries_bar",
            "datasource_id": dataset_id,
            "datasource_type": "table",
            "dashboards": [
                dashboard_id,
            ],
            "params": json.dumps(
                params,
                ensure_ascii=False,
            ),
        },
    )

    return data["id"]


# Собирает простую вертикальную раскладку dashboard.
def build_position(
    chart_ids: list[int],
) -> dict:
    position = {
        "DASHBOARD_VERSION_KEY": "v2",

        "ROOT_ID": {
            "id": "ROOT_ID",
            "type": "ROOT",
            "children": ["GRID_ID"],
            "meta": {},
        },

        "GRID_ID": {
            "id": "GRID_ID",
            "type": "GRID",
            "parents": ["ROOT_ID"],
            "children": [],
            "meta": {},
        },
    }

    for index, chart_id in enumerate(
        chart_ids,
        start=1,
    ):
        row_id = f"ROW-{index}"
        chart_block = (
            f"CHART-{chart_id}"
        )

        position["GRID_ID"]["children"].append(
            row_id
        )

        position[row_id] = {
            "id": row_id,
            "type": "ROW",
            "parents": [
                "ROOT_ID",
                "GRID_ID",
            ],
            "children": [
                chart_block,
            ],
            "meta": {
                "background": (
                    "BACKGROUND_TRANSPARENT"
                ),
            },
        }

        position[chart_block] = {
            "id": chart_block,
            "type": "CHART",
            "parents": [
                "ROOT_ID",
                "GRID_ID",
                row_id,
            ],
            "children": [],
            "meta": {
                "chartId": chart_id,
                "width": 12,
                "height": 40,
            },
        }

    return position


# Публикует набор полей документа в Superset.
def create_mart(
    task_id: str,
    clickhouse,
) -> dict:
    if not task_id:
        raise ValueError(
            "task_id is required"
        )

    document_type, fields = (
        get_document_fields(
            clickhouse,
            task_id,
        )
    )

    # Например document_date.
    group_by = get_group_by(
        document_type
    )

    # Проверяем, что дата была распознана.
    validate_group_value(
        clickhouse,
        task_id,
        group_by,
    )

    client = SupersetClient()
    client.login()

    database_id = ensure_database(
        client
    )

    dataset_id = ensure_dataset(
        client,
        database_id,
    )

    dashboard_id = ensure_dashboard(
        client,
        document_type,
    )

    chart_ids = [
        ensure_chart(
            client=client,
            dataset_id=dataset_id,
            dashboard_id=dashboard_id,
            document_type=document_type,
            group_by=group_by,
            field=field,
        )
        for field in fields
    ]

    position = build_position(
        chart_ids
    )

    client.request(
        "PUT",
        f"/api/v1/dashboard/{dashboard_id}",
        json={
            "dashboard_title": (
                f"BI {document_type}"
            ),
            "published": True,
            "position_json": json.dumps(
                position,
                ensure_ascii=False,
            ),
        },
    )

    return {
        "status": "published",
        "document_type": document_type,
        "group_by": group_by,
        "dataset_id": dataset_id,
        "dashboard_id": dashboard_id,
        "chart_ids": chart_ids,
        "dashboard_url": (
            f"{SUPERSET_PUBLIC_URL}"
            f"/superset/dashboard/"
            f"{dashboard_id}/"
        ),
    }