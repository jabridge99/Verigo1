"""
Smoke test for Critical #9: app/main.py used to call sentry_sdk.init() a
second time right after app.logging_config.setup_logging() already
initialised Sentry. The second call silently replaced the first client,
dropping FastApiIntegration/SqlalchemyIntegration, release tagging, and
the configured traces_sample_rate. main.py must no longer call
sentry_sdk.init directly — only logging_config.setup_logging() may.
"""

import ast
from pathlib import Path

import app.main as main_module


def test_main_module_does_not_call_sentry_init_directly():
    source = Path(main_module.__file__).read_text()
    tree = ast.parse(source)
    init_calls = [
        node
        for node in ast.walk(tree)
        if isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "init"
        and isinstance(node.func.value, ast.Name)
        and node.func.value.id == "sentry_sdk"
    ]
    assert init_calls == [], "main.py must not call sentry_sdk.init() — that belongs solely to logging_config.setup_logging()"


def test_logging_config_initialises_sentry_with_pii_scrubbing_and_integrations():
    source = Path(
        Path(main_module.__file__).parent / "logging_config.py"
    ).read_text()
    assert "send_default_pii=False" in source
    assert "FastApiIntegration" in source
    assert "SqlalchemyIntegration" in source
