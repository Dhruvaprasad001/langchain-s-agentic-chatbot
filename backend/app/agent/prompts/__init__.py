"""
Prompt loader — reads every .md file in this directory once at import time.

Usage:
    from app.agent.prompts import ROUTER, PLANNER, EXECUTOR
    from app.agent.prompts import SYNTHESIZER, WEB_SEARCH, STARTUP_CRITIQUE
"""

import os

_DIR = os.path.dirname(__file__)


def _load(filename: str) -> str:
    with open(os.path.join(_DIR, filename), encoding="utf-8") as f:
        return f.read().strip()


# Static prompts — used as-is
ROUTER           = _load("router.md")
PLANNER          = _load("planner.md")
EXECUTOR         = _load("executor.md")

# Template prompts — call .format(**kwargs) before use
# synthesizer.md  placeholders: {original_message}, {step_summary}
# web_search.md   placeholders: {query}, {results}, {date}
# startup_critique.md  placeholders: {date}
SYNTHESIZER      = _load("synthesizer.md")
WEB_SEARCH       = _load("web_search.md")
STARTUP_CRITIQUE = _load("startup_critique.md")
