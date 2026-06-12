"""
Transaction Monitoring Engine.

Runs every inbound transaction through:
  1. Built-in AML rules (CTR, structuring, velocity, cross-border, PEP)
  2. Custom no-code rules from the rule builder
  3. Sanctions screening of counterparty
  4. Risk scoring

Returns a list of alerts to be persisted.
"""

import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.customer import Customer
from app.models.transaction import (
    AlertSeverity,
    AlertType,
    Transaction,
    TransactionAlert,
)
from app.services.risk_scoring import (
    CTR_THRESHOLD,
    HIGH_RISK_COUNTRIES,
)
from app.services.sanctions_screening import screen_transaction

VELOCITY_WINDOWS = {
    "1h": timedelta(hours=1),
    "24h": timedelta(hours=24),
    "7d": timedelta(days=7),
    "30d": timedelta(days=30),
}

VELOCITY_THRESHOLDS = {
    "1h": (5, 20_000),
    "24h": (15, 50_000),
    "7d": (50, 200_000),
    "30d": (150, 500_000),
}


def _make_alert_id() -> str:
    return f"ALT-{uuid.uuid4().hex[:10].upper()}"


def _recent_txns(db: Session, customer_id: int, window: timedelta) -> list:
    since = datetime.now(timezone.utc) - window
    return (
        db.query(Transaction)
        .filter(
            Transaction.customer_id == customer_id,
            Transaction.transaction_date >= since,
        )
        .all()
    )


def _build_context(txn: Transaction, customer: Customer) -> dict:
    return {
        "customer.full_name": customer.full_name,
        "customer.country_of_residence": customer.country_of_residence,
        "customer.nationality": customer.nationality,
        "customer.risk_score": customer.risk_score or 0,
        "customer.risk_level": customer.risk_level or "low",
        "customer.is_pep": bool(customer.is_pep),
        "customer.industry": customer.industry,
        "customer.source_of_funds": customer.source_of_funds or "",
        "customer.status": customer.status.value if customer.status else "pending",
        "transaction.amount": txn.amount_aud or txn.amount,
        "transaction.currency": txn.currency,
        "transaction.type": txn.transaction_type.value,
        "transaction.counterparty_country": txn.counterparty_country or "",
        "transaction.is_cross_border": txn.is_cross_border or False,
        "transaction.risk_score": txn.risk_score or 0,
        "screening.sanctions_match": False,
        "screening.pep_match": bool(customer.is_pep),
    }


def run_monitoring(db, txn, customer, industry_id=None):
    alerts = []
    amount_aud = txn.amount_aud or txn.amount

    # 1. CTR threshold
    if amount_aud >= CTR_THRESHOLD:
        alerts.append(
            TransactionAlert(
                alert_id=_make_alert_id(),
                transaction_id=txn.id,
                customer_id=customer.id,
                industry_id=industry_id,
                alert_type=AlertType.large_transaction,
                severity=AlertSeverity.high,
                description=f"Transaction AUD ${amount_aud:,.2f} meets or exceeds the CTR threshold of ${CTR_THRESHOLD:,}. AUSTRAC reporting may be required.",
            )
        )

    # 2. Structuring
    txns_24h = _recent_txns(db, customer.id, VELOCITY_WINDOWS["24h"])
    below_threshold = [
        t for t in txns_24h if 7_000 <= (t.amount_aud or t.amount) < CTR_THRESHOLD
    ]
    if len(below_threshold) >= 3:
        total = sum(t.amount_aud or t.amount for t in below_threshold)
        alerts.append(
            TransactionAlert(
                alert_id=_make_alert_id(),
                transaction_id=txn.id,
                customer_id=customer.id,
                industry_id=industry_id,
                alert_type=AlertType.structuring,
                severity=AlertSeverity.high,
                description=f"{len(below_threshold)} transactions totalling AUD ${total:,.2f} detected near the CTR threshold within 24 hours — possible structuring.",
            )
        )

    # 3. Cross-border / IFTI
    if txn.is_cross_border or (
        txn.counterparty_country
        and txn.counterparty_country.upper() not in ("AU", "AUS", "")
    ):
        sev = (
            AlertSeverity.high
            if (txn.counterparty_country or "").upper() in HIGH_RISK_COUNTRIES
            else AlertSeverity.medium
        )
        alerts.append(
            TransactionAlert(
                alert_id=_make_alert_id(),
                transaction_id=txn.id,
                customer_id=customer.id,
                industry_id=industry_id,
                alert_type=AlertType.cross_border,
                severity=sev,
                description=f"International funds transfer instruction (IFTI) detected to/from {txn.counterparty_country or 'unknown country'}. AUSTRAC IFTI report may be required.",
            )
        )

    # 4. High-risk country
    cc = (txn.counterparty_country or "").upper()
    if cc and cc in HIGH_RISK_COUNTRIES:
        alerts.append(
            TransactionAlert(
                alert_id=_make_alert_id(),
                transaction_id=txn.id,
                customer_id=customer.id,
                industry_id=industry_id,
                alert_type=AlertType.high_risk_country,
                severity=AlertSeverity.high,
                description=f"Counterparty country {cc} is on FATF/AUSTRAC high-risk jurisdiction list.",
            )
        )

    # 5. PEP transaction
    if customer.is_pep and amount_aud >= 5_000:
        alerts.append(
            TransactionAlert(
                alert_id=_make_alert_id(),
                transaction_id=txn.id,
                customer_id=customer.id,
                industry_id=industry_id,
                alert_type=AlertType.pep_transaction,
                severity=AlertSeverity.high,
                description=f"Transaction of AUD ${amount_aud:,.2f} by a Politically Exposed Person (PEP). Enhanced due diligence required.",
            )
        )

    # 6. Velocity checks
    for window_label, window_delta in VELOCITY_WINDOWS.items():
        count_thresh, amount_thresh = VELOCITY_THRESHOLDS[window_label]
        window_txns = _recent_txns(db, customer.id, window_delta)
        count = len(window_txns)
        total = sum(t.amount_aud or t.amount for t in window_txns)
        if count >= count_thresh or total >= amount_thresh:
            alerts.append(
                TransactionAlert(
                    alert_id=_make_alert_id(),
                    transaction_id=txn.id,
                    customer_id=customer.id,
                    industry_id=industry_id,
                    alert_type=AlertType.velocity_breach,
                    severity=AlertSeverity.medium,
                    description=f"Velocity breach ({window_label}): {count} transactions totalling AUD ${total:,.2f} exceed thresholds ({count_thresh} txns / ${amount_thresh:,}).",
                )
            )
            break

    # 7. Sanctions
    if txn.counterparty_name:
        sanctions = screen_transaction(txn.counterparty_name)
        if sanctions["match_found"]:
            alerts.append(
                TransactionAlert(
                    alert_id=_make_alert_id(),
                    transaction_id=txn.id,
                    customer_id=customer.id,
                    industry_id=industry_id,
                    alert_type=AlertType.sanctions_match,
                    severity=AlertSeverity.critical,
                    description=f"Counterparty '{txn.counterparty_name}' matched on sanctions watchlist.",
                )
            )

    # 8. Custom rules
    if industry_id:
        try:
            from app.services.rule_engine import evaluate_all_rules

            context = _build_context(txn, customer)
            matched = evaluate_all_rules("transaction", context, industry_id, db)
            for rule_result in matched:
                alerts.append(
                    TransactionAlert(
                        alert_id=_make_alert_id(),
                        transaction_id=txn.id,
                        customer_id=customer.id,
                        industry_id=industry_id,
                        alert_type=AlertType.rule_triggered,
                        severity=AlertSeverity(rule_result.get("severity", "medium")),
                        description=f"Custom rule triggered: '{rule_result['rule_name']}'. Action: {rule_result.get('action', 'flag')}.",
                        rule_id=rule_result.get("rule_id"),
                        rule_name=rule_result.get("rule_name"),
                    )
                )
        except Exception:
            pass

    return alerts


def get_alert_queue(
    db,
    industry_id=None,
    severity=None,
    status=None,
    alert_type=None,
    customer_id=None,
    skip=0,
    limit=100,
):
    q = db.query(TransactionAlert)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    if severity:
        q = q.filter(TransactionAlert.severity == severity)
    if status:
        q = q.filter(TransactionAlert.status == status)
    if alert_type:
        q = q.filter(TransactionAlert.alert_type == alert_type)
    if customer_id:
        q = q.filter_by(customer_id=customer_id)
    return (
        q.order_by(TransactionAlert.created_at.desc()).offset(skip).limit(limit).all()
    )


def monitoring_stats(db, industry_id=None):
    q = db.query(TransactionAlert)
    if industry_id:
        q = q.filter_by(industry_id=industry_id)
    alerts = q.all()
    by_severity = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    by_type: dict = {}
    by_status: dict = {}
    open_count = 0
    for a in alerts:
        sev = a.severity.value if hasattr(a.severity, "value") else str(a.severity)
        by_severity[sev] = by_severity.get(sev, 0) + 1
        atype = (
            a.alert_type.value if hasattr(a.alert_type, "value") else str(a.alert_type)
        )
        by_type[atype] = by_type.get(atype, 0) + 1
        st = a.status.value if hasattr(a.status, "value") else str(a.status)
        by_status[st] = by_status.get(st, 0) + 1
        if st not in ("dismissed", "resolved", "reported"):
            open_count += 1
    txn_q = db.query(Transaction)
    if industry_id:
        txn_q = txn_q.filter_by(industry_id=industry_id)
    total_txns = txn_q.count()
    flagged_txns = txn_q.filter(Transaction.is_suspicious == 1).count()
    return {
        "total_alerts": len(alerts),
        "open_alerts": open_count,
        "by_severity": by_severity,
        "by_type": by_type,
        "by_status": by_status,
        "total_transactions": total_txns,
        "flagged_transactions": flagged_txns,
    }
