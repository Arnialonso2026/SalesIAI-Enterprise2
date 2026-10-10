import re
from pathlib import Path

from alembic import command
from alembic.config import Config
import os

from fastapi.testclient import TestClient
from sqlalchemy import inspect

from app.database import Base, engine
from app.main import app
from app.services.analytics import calculate_bivariate_statistics, calculate_statistics


def test_postgres_sql_scripts_cover_every_model_table() -> None:
    repository_root = Path(__file__).resolve().parents[2]
    sql = "\n".join(
        (repository_root / "database" / filename).read_text(encoding="utf-8")
        for filename in ("01_core.sql", "02_sales_inventory.sql", "03_analytics.sql")
    )
    declared_tables = set(re.findall(r"CREATE TABLE (\w+)", sql))

    assert len(declared_tables) == 29
    assert declared_tables == set(Base.metadata.tables)


def test_calculate_statistics_returns_descriptive_metrics_and_probability() -> None:
    result = calculate_statistics([1, 3, 3, 5], threshold=3)

    assert result["count"] == 4
    assert result["mean"] == 3
    assert result["median"] == 3
    assert result["mode"] == [3]
    assert result["probability_at_or_above_threshold"] == 0.75


def test_calculate_bivariate_statistics_returns_correlation_and_vector_operations() -> None:
    result = calculate_bivariate_statistics([1, 2, 3], [2, 4, 6])

    assert result["count"] == 3
    assert result["pearson_correlation"] == 1
    assert result["covariance_population"] == 4 / 3
    assert result["linear_regression_slope"] == 2
    assert result["linear_regression_intercept"] == 0
    assert result["vector_dot_product"] == 28
    assert result["vector_sum"] == [3, 6, 9]
    assert result["vector_difference"] == [-1, -2, -3]


def test_calculate_bivariate_statistics_marks_correlation_undefined_for_constant_series() -> None:
    result = calculate_bivariate_statistics([2, 2], [1, 3])

    assert result["pearson_correlation"] is None
    assert result["linear_regression_slope"] is None


def test_analytics_migration_upgrades_existing_version_3_schema() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
        existing_tables = [
            Base.metadata.tables[name]
            for name in (
                "companies", "users", "customers", "categories", "products", "employees",
                "sales", "sale_details", "payments", "inventory_movements",
            )
        ]
        Base.metadata.create_all(bind=connection, tables=existing_tables)
        connection.exec_driver_sql(
            "CREATE TABLE alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"
        )
        connection.exec_driver_sql("INSERT INTO alembic_version VALUES ('20261003_0003')")

    backend_dir = Path(__file__).resolve().parents[1]
    migration_config = Config(str(backend_dir / "alembic.ini"))
    migration_config.set_main_option("script_location", str(backend_dir / "migrations"))
    command.upgrade(migration_config, "head")

    with engine.connect() as connection:
        table_names = set(inspect(connection).get_table_names())
    assert {
        "analytics_datasets", "dataset_variables", "dataset_observations", "statistical_analyses",
        "analysis_variables", "statistical_results", "bayesian_analyses", "bayesian_evidence",
        "bayesian_results", "insights", "insight_evidence", "reports",
    }.issubset(table_names)

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")


def test_analytics_api_persists_analyses_insights_and_reports() -> None:
    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")

    with TestClient(app) as client:
        login = client.post("/api/v1/auth/login", json={
            "dni": os.environ["ADMIN_DNI"], "password": os.environ["ADMIN_PASSWORD"],
        })
        assert login.status_code == 200, login.text
        headers = {"Authorization": f"Bearer {login.json()['access_token']}"}

        statistics = client.post("/api/v1/analytics/statistics", headers=headers, json={
            "name": "Ventas de prueba",
            "variable_name": "ingresos",
            "values": [1, 3, 3, 5],
            "threshold": 3,
        })
        assert statistics.status_code == 201, statistics.text
        assert statistics.json()["results"]["median"] == 3
        assert statistics.json()["results"]["probability_at_or_above_threshold"] == 0.75

        linear_analysis = client.post("/api/v1/analytics/statistics/linear", headers=headers, json={
            "name": "Ventas e ingresos",
            "variable_x": "Cantidad",
            "values_x": [1, 2, 3],
            "variable_y": "Importe",
            "values_y": [2, 4, 6],
        })
        assert linear_analysis.status_code == 201, linear_analysis.text
        assert linear_analysis.json()["results"]["pearson_correlation"] == 1
        assert linear_analysis.json()["results"]["vector_dot_product"] == 28

        mismatched_linear = client.post("/api/v1/analytics/statistics/linear", headers=headers, json={
            "name": "Series incompatibles",
            "variable_x": "X",
            "values_x": [1, 2],
            "variable_y": "Y",
            "values_y": [1, 2, 3],
        })
        assert mismatched_linear.status_code == 422

        bayes = client.post("/api/v1/analytics/bayes", headers=headers, json={
            "name": "Conversión",
            "question": "La campaña genera compra",
            "prior_probability": 0.25,
            "likelihood_if_true": 0.8,
            "likelihood_if_false": 0.2,
        })
        assert bayes.status_code == 201, bayes.text
        assert round(bayes.json()["posterior_probability"], 4) == 0.5714

        dashboard = client.get("/api/v1/analytics/dashboard", headers=headers)
        assert dashboard.status_code == 200, dashboard.text
        assert dashboard.json()["sales_count"] == 0

        insights = client.post("/api/v1/analytics/insights/generate", headers=headers)
        assert insights.status_code == 201, insights.text
        assert insights.json()[0]["evidence"]
        insight_id = insights.json()[0]["id"]
        updated = client.patch(f"/api/v1/analytics/insights/{insight_id}", headers=headers, json={"status": "read"})
        assert updated.status_code == 200, updated.text
        assert updated.json()["status"] == "read"

        report = client.post("/api/v1/analytics/reports/export", headers=headers, json={"format": "csv"})
        assert report.status_code == 200, report.text
        assert report.headers["content-type"].startswith("text/csv")
        assert "Ingresos" in report.text
        assert "Ventas de prueba" in report.text
        assert "Ventas e ingresos" in report.text
        assert "Conversión" in report.text
        reports = client.get("/api/v1/analytics/reports", headers=headers)
        assert reports.status_code == 200, reports.text
        assert len(reports.json()) == 1

        history = client.get("/api/v1/analytics/statistics", headers=headers)
        assert history.status_code == 200, history.text
        assert {item["name"] for item in history.json()} == {"Ventas de prueba", "Ventas e ingresos"}

    Base.metadata.drop_all(bind=engine)
    with engine.begin() as connection:
        connection.exec_driver_sql("DROP TABLE IF EXISTS alembic_version")
