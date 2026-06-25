"""
Smoke test: examination_pack_service.export_html() interpolated
pack.examiner_name, pack.examiner_agency, pack.pack_ref, the organisation
snapshot fields, and per-section metric rows directly into raw HTML with no
escaping — the same pattern already fixed in board_reporting.py.
examiner_name/examiner_agency are fully attacker-controlled via the
GeneratePackRequest body (POST /examination-packs/), so any
compliance-or-above user could plant a <script> payload that executes in
the browser of whoever later opens the exported pack (MLRO, admin, or an
AUSTRAC examiner the pack is meant to be shared with). Fixed by
html.escape()-ing all interpolated user/DB-derived strings.
"""

from datetime import date

from app.models.examination_pack import ExaminationPack
from app.services.examination_pack_service import export_html


def _make_pack(payload: str) -> ExaminationPack:
    return ExaminationPack(
        id="ep_test123",
        org_id="org_test",
        pack_ref=payload,
        period_start=date(2026, 1, 1),
        period_end=date(2026, 3, 31),
        sections=["aml_program"],
        examiner_name=payload,
        examiner_agency=payload,
        requested_by="tester",
        snapshot_data={
            "aml_program": {
                "organisation": {
                    "name": payload,
                    "abn": payload,
                    "austrac_id": payload,
                },
                "error": payload,
            }
        },
        generation_errors=[payload],
        version=1,
    )


def test_export_html_escapes_examiner_and_org_fields():
    payload = "<script>alert(1)</script>"
    pack = _make_pack(payload)

    body = export_html(pack)

    assert "<script>alert(1)</script>" not in body
    assert body.count("&lt;script&gt;alert(1)&lt;/script&gt;") >= 1
