"""
Generic / Other industry AML template — Tranche 2 fallback.
Used for: insurance, trust & company services, precious metals, and other
Tranche 2 entities not covered by a dedicated template.
"""
from app.templates.aml.base import AMLTemplateBase, BASE_CONTROLS, BASE_POLICIES
import copy


def get_template(risk_level: str = "medium") -> AMLTemplateBase:
    t = AMLTemplateBase(industry="other", risk_level=risk_level)
    t.has_ifti_obligation = False
    t.has_ttr_obligation = False
    t.has_travel_rule = False
    t.is_tranche_2 = True

    t.scope = (
        "This Program applies to the designated services provided by the Organisation "
        "under the AML/CTF Act 2006 as amended by the 2024 Amendment Act.\n\n"
        "The Organisation must identify and document its specific designated services "
        "and update this section accordingly. The AML/CTF Compliance Officer is "
        "responsible for ensuring the scope of this Program reflects the Organisation's "
        "actual business activities at all times."
    )

    t.designated_services = (
        "[To be completed: list the specific designated services provided by "
        "this Organisation under the AML/CTF Act. Reference the relevant items "
        "from the designated services table in the Act or Rules.]\n\n"
        "As a Tranche 2 reporting entity, IFTI and TTR reporting obligations "
        "do not apply unless the Organisation separately provides financial "
        "transfer or cash-handling services."
    )

    t.ifti_procedures = (
        "IFTI reporting does not apply to this Organisation's designated services."
    )

    t.ttr_procedures = (
        "TTR reporting does not apply to this Organisation's designated services. "
        "The Organisation does not accept physical currency as part of its "
        "designated services. Any cash offered by a customer must be declined "
        "and reported to the AML/CTF Compliance Officer."
    )

    t._policies = copy.deepcopy(BASE_POLICIES)
    t._controls = copy.deepcopy(BASE_CONTROLS)

    return t
