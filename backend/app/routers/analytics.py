import csv
import json
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from io import StringIO

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.deps import require_roles
from app.models import (
    AnalysisVariable,
    AnalyticsDataset,
    BayesianAnalysis,
    BayesianEvidence,
    BayesianResult,
    DatasetObservation,
    DatasetVariable,
    Insight,
    InsightEvidence,
    Report,
    StatisticalAnalysis,
    StatisticalResult,
    User,
)
from app.schemas import (
    AnalyticsDashboardOut,
    BayesianAnalysisIn,
    InsightOut,
    InsightStatusIn,
    ReportExportIn,
    ReportOut,
    StatisticalAnalysisIn,
)
from app.services.analytics import analytics_dashboard, calculate_statistics, insight_candidates

router = APIRouter(prefix="/analytics", tags=["Analítica"])
analytics_user = require_roles("analyst", "manager")


def _date_range(start_date: date | None, end_date: date | None) -> tuple[date, date]:
    end = end_date or datetime.now(timezone.utc).date()
    start = start_date or end - timedelta(days=29)
    if start > end:
        raise HTTPException(status_code=422, detail="La fecha inicial debe ser anterior a la fecha final.")
    if (end - start).days > 365:
        raise HTTPException(status_code=422, detail="El rango máximo permitido es de 366 días.")
    return start, end


@router.get("/dashboard", response_model=AnalyticsDashboardOut)
def get_analytics_dashboard(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> dict[str, object]:
    start, end = _date_range(start_date, end_date)
    return analytics_dashboard(db, user.company_id, start, end)


@router.post("/statistics", status_code=status.HTTP_201_CREATED)
def create_statistical_analysis(
    payload: StatisticalAnalysisIn,
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> dict[str, object]:
    results = calculate_statistics(payload.values, payload.threshold)
    dataset = AnalyticsDataset(
        company_id=user.company_id,
        name=f"Análisis: {payload.name}",
        description="Dataset numérico generado desde el formulario de análisis.",
        source_type="manual",
        created_by_id=user.id,
    )
    db.add(dataset)
    db.flush()
    variable = DatasetVariable(
        dataset_id=dataset.id,
        name=payload.variable_name,
        display_name=payload.variable_name,
        data_type="numeric",
        variable_role="measure",
        position=0,
    )
    db.add(variable)
    db.flush()
    db.add_all([
        DatasetObservation(dataset_id=dataset.id, observation_data={"value": value})
        for value in payload.values
    ])
    analysis = StatisticalAnalysis(
        company_id=user.company_id,
        dataset_id=dataset.id,
        name=payload.name,
        analysis_type="descriptive",
        status="completed",
        parameters={"threshold": payload.threshold, "count": len(payload.values)},
        created_by_id=user.id,
    )
    db.add(analysis)
    db.flush()
    db.add(AnalysisVariable(analysis_id=analysis.id, variable_id=variable.id, analysis_role="measure"))
    db.add(StatisticalResult(
        analysis_id=analysis.id,
        variable_id=variable.id,
        metric="descriptive_statistics",
        result=results,
    ))
    db.commit()
    return {"id": analysis.id, "dataset_id": dataset.id, "name": analysis.name, "results": results}


@router.get("/statistics")
def list_statistical_analyses(
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> list[dict[str, object]]:
    analyses = db.scalars(select(StatisticalAnalysis).where(
        StatisticalAnalysis.company_id == user.company_id,
    ).order_by(StatisticalAnalysis.created_at.desc()).limit(50)).all()
    output = []
    for analysis in analyses:
        result = db.scalar(select(StatisticalResult).where(
            StatisticalResult.analysis_id == analysis.id,
        ).order_by(StatisticalResult.id.desc()).limit(1))
        output.append({
            "id": analysis.id,
            "name": analysis.name,
            "analysis_type": analysis.analysis_type,
            "created_at": analysis.created_at,
            "results": result.result if result else {},
        })
    return output


@router.post("/bayes", status_code=status.HTTP_201_CREATED)
def create_bayesian_analysis(
    payload: BayesianAnalysisIn,
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> dict[str, object]:
    evidence_probability = (
        payload.prior_probability * payload.likelihood_if_true
        + (1 - payload.prior_probability) * payload.likelihood_if_false
    )
    if evidence_probability == 0:
        raise HTTPException(status_code=422, detail="La evidencia tiene probabilidad nula bajo ambas hipótesis.")
    posterior = payload.prior_probability * payload.likelihood_if_true / evidence_probability
    analysis = BayesianAnalysis(
        company_id=user.company_id,
        name=payload.name,
        question=payload.question,
        status="completed",
        parameters={
            "likelihood_if_true": payload.likelihood_if_true,
            "likelihood_if_false": payload.likelihood_if_false,
        },
        created_by_id=user.id,
    )
    db.add(analysis)
    db.flush()
    db.add(BayesianEvidence(
        analysis_id=analysis.id,
        name="Evidencia observada",
        evidence_type="binary_likelihood",
        observed_value={
            "likelihood_if_true": payload.likelihood_if_true,
            "likelihood_if_false": payload.likelihood_if_false,
        },
        likelihood=Decimal(str(evidence_probability)),
    ))
    db.add(BayesianResult(
        analysis_id=analysis.id,
        hypothesis=payload.question,
        prior_probability=Decimal(str(payload.prior_probability)),
        posterior_probability=Decimal(str(posterior)),
        calculation={
            "evidence_probability": evidence_probability,
            "likelihood_if_true": payload.likelihood_if_true,
            "likelihood_if_false": payload.likelihood_if_false,
        },
    ))
    db.commit()
    return {
        "id": analysis.id,
        "name": analysis.name,
        "question": analysis.question,
        "prior_probability": payload.prior_probability,
        "posterior_probability": posterior,
        "evidence_probability": evidence_probability,
    }


@router.get("/bayes")
def list_bayesian_analyses(
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> list[dict[str, object]]:
    analyses = db.scalars(select(BayesianAnalysis).where(
        BayesianAnalysis.company_id == user.company_id,
    ).order_by(BayesianAnalysis.created_at.desc()).limit(50)).all()
    output = []
    for analysis in analyses:
        result = db.scalar(select(BayesianResult).where(
            BayesianResult.analysis_id == analysis.id,
        ).order_by(BayesianResult.id.desc()).limit(1))
        output.append({
            "id": analysis.id,
            "name": analysis.name,
            "question": analysis.question,
            "prior_probability": float(result.prior_probability) if result else None,
            "posterior_probability": float(result.posterior_probability) if result else None,
            "created_at": analysis.created_at,
        })
    return output


@router.get("/insights", response_model=list[InsightOut])
def list_insights(
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> list[dict[str, object]]:
    insights = db.scalars(select(Insight).where(
        Insight.company_id == user.company_id,
    ).order_by(Insight.created_at.desc()).limit(100)).all()
    evidence_rows = db.scalars(select(InsightEvidence).where(
        InsightEvidence.insight_id.in_([insight.id for insight in insights]),
    )).all() if insights else []
    evidence_by_insight: dict[int, list[dict[str, object]]] = {}
    for evidence in evidence_rows:
        evidence_by_insight.setdefault(evidence.insight_id, []).append({
            "description": evidence.description,
            "evidence": evidence.evidence,
        })
    return [
        {
            "id": insight.id,
            "title": insight.title,
            "description": insight.description,
            "severity": insight.severity,
            "status": insight.status,
            "created_at": insight.created_at,
            "evidence": evidence_by_insight.get(insight.id, []),
        }
        for insight in insights
    ]


@router.post("/insights/generate", response_model=list[InsightOut], status_code=status.HTTP_201_CREATED)
def generate_insights(
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> list[dict[str, object]]:
    start, end = _date_range(start_date, end_date)
    candidates = insight_candidates(db, user.company_id, start, end)
    created = []
    for candidate in candidates:
        insight = Insight(
            company_id=user.company_id,
            title=candidate["title"],
            description=candidate["description"],
            severity=candidate["severity"],
            status="new",
        )
        db.add(insight)
        db.flush()
        evidence = InsightEvidence(
            insight_id=insight.id,
            description="Indicadores usados para generar este hallazgo.",
            evidence=candidate["evidence"],
        )
        db.add(evidence)
        created.append({
            "id": insight.id,
            "title": insight.title,
            "description": insight.description,
            "severity": insight.severity,
            "status": insight.status,
            "created_at": insight.created_at,
            "evidence": [{"description": evidence.description, "evidence": evidence.evidence}],
        })
    db.commit()
    return created


@router.patch("/insights/{insight_id}", response_model=InsightOut)
def update_insight_status(
    insight_id: int,
    payload: InsightStatusIn,
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> dict[str, object]:
    insight = db.scalar(select(Insight).where(
        Insight.id == insight_id,
        Insight.company_id == user.company_id,
    ))
    if insight is None:
        raise HTTPException(status_code=404, detail="No se encontró el insight.")
    insight.status = payload.status
    evidence_rows = db.scalars(select(InsightEvidence).where(InsightEvidence.insight_id == insight.id)).all()
    db.commit()
    return {
        "id": insight.id,
        "title": insight.title,
        "description": insight.description,
        "severity": insight.severity,
        "status": insight.status,
        "created_at": insight.created_at,
        "evidence": [{"description": item.description, "evidence": item.evidence} for item in evidence_rows],
    }


@router.get("/reports", response_model=list[ReportOut])
def list_reports(
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> list[Report]:
    return list(db.scalars(select(Report).where(
        Report.company_id == user.company_id,
    ).order_by(Report.created_at.desc()).limit(50)).all())


@router.post("/reports/export", status_code=status.HTTP_200_OK)
def export_sales_report(
    payload: ReportExportIn,
    db: Session = Depends(get_db),
    user: User = Depends(analytics_user),
) -> Response:
    start, end = _date_range(payload.start_date, payload.end_date)
    dashboard = analytics_dashboard(db, user.company_id, start, end)
    start_at = datetime.combine(start, time.min, tzinfo=timezone.utc)
    end_at = datetime.combine(end + timedelta(days=1), time.min, tzinfo=timezone.utc)
    statistical_rows = db.execute(
        select(StatisticalAnalysis.name, StatisticalAnalysis.created_at, StatisticalResult.metric, StatisticalResult.result)
        .join(StatisticalResult, StatisticalResult.analysis_id == StatisticalAnalysis.id)
        .where(
            StatisticalAnalysis.company_id == user.company_id,
            StatisticalAnalysis.created_at >= start_at,
            StatisticalAnalysis.created_at < end_at,
        )
        .order_by(StatisticalAnalysis.created_at.desc())
        .limit(100)
    ).all()
    bayesian_rows = db.execute(
        select(
            BayesianAnalysis.name,
            BayesianAnalysis.question,
            BayesianAnalysis.created_at,
            BayesianResult.prior_probability,
            BayesianResult.posterior_probability,
        )
        .join(BayesianResult, BayesianResult.analysis_id == BayesianAnalysis.id)
        .where(
            BayesianAnalysis.company_id == user.company_id,
            BayesianAnalysis.created_at >= start_at,
            BayesianAnalysis.created_at < end_at,
        )
        .order_by(BayesianAnalysis.created_at.desc())
        .limit(100)
    ).all()
    statistical_analyses = [
        {"name": name, "created_at": created_at, "metric": metric, "result": result}
        for name, created_at, metric, result in statistical_rows
    ]
    bayesian_analyses = [
        {
            "name": name,
            "question": question,
            "created_at": created_at,
            "prior_probability": float(prior),
            "posterior_probability": float(posterior),
        }
        for name, question, created_at, prior, posterior in bayesian_rows
    ]
    report_data = {
        "dashboard": dashboard,
        "statistical_analyses": statistical_analyses,
        "bayesian_analyses": bayesian_analyses,
    }
    generated_at = datetime.now(timezone.utc)
    report = Report(
        company_id=user.company_id,
        name=f"Analítica {start.isoformat()} a {end.isoformat()}",
        report_type="analytics_summary",
        status="generated",
        parameters={"start_date": start.isoformat(), "end_date": end.isoformat(), "format": payload.format},
        created_by_id=user.id,
        generated_at=generated_at,
    )
    db.add(report)
    db.commit()

    if payload.format == "json":
        content = json.dumps(report_data, ensure_ascii=False, default=str, indent=2)
        media_type = "application/json"
        extension = "json"
    else:
        buffer = StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Indicador", "Valor"])
        writer.writerow(["Ingresos", dashboard["revenue"]])
        writer.writerow(["Ventas", dashboard["sales_count"]])
        writer.writerow(["Ticket promedio", dashboard["average_ticket"]])
        writer.writerow(["Clientes activos", dashboard["active_customers"]])
        writer.writerow(["Productos con stock bajo", dashboard["low_stock_products"]])
        writer.writerow([])
        writer.writerow(["Ventas por día"])
        writer.writerow(["Fecha", "Ingresos"])
        for row in dashboard["daily_sales"]:
            writer.writerow([row["date"], row["total"]])
        writer.writerow([])
        writer.writerow(["Productos principales"])
        writer.writerow(["Producto", "Unidades", "Ingresos"])
        for row in dashboard["top_products"]:
            writer.writerow([row["name"], row["quantity"], row["revenue"]])
        writer.writerow([])
        writer.writerow(["Métodos de pago"])
        writer.writerow(["Método", "Importe"])
        for row in dashboard["payment_methods"]:
            writer.writerow([row["method"], row["amount"]])
        writer.writerow([])
        writer.writerow(["Análisis estadísticos"])
        writer.writerow(["Nombre", "Fecha", "Métrica", "Resultado"])
        for row in statistical_analyses:
            writer.writerow([
                row["name"], row["created_at"], row["metric"],
                json.dumps(row["result"], ensure_ascii=False),
            ])
        writer.writerow([])
        writer.writerow(["Análisis Bayes"])
        writer.writerow(["Nombre", "Hipótesis", "Fecha", "Probabilidad previa", "Probabilidad posterior"])
        for row in bayesian_analyses:
            writer.writerow([
                row["name"], row["question"], row["created_at"],
                row["prior_probability"], row["posterior_probability"],
            ])
        content = "\ufeff" + buffer.getvalue()
        media_type = "text/csv; charset=utf-8"
        extension = "csv"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="ventas-{start}-{end}.{extension}"'},
    )
