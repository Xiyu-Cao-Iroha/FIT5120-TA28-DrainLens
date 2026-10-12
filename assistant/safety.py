import re

# Deterministic last-line protection. Keep this independent of model prompts.
# Patterns are intentionally narrow to avoid matching warnings such as "never drive".
FORBIDDEN_ADVICE = (
    re.compile(r"\b(?:you (?:should|can|must)|please|go ahead and|it's safe to)\s+(?:walk|wade|drive)\s+(?:through|into|across)\s+(?:the\s+)?flood\s*water\b", re.I),
    re.compile(r"\b(?:touch|handle|switch on|turn on)\s+(?:flooded|submerged|wet)\s+(?:electrical|power)\s+(?:equipment|appliances|outlets|sockets)\b", re.I),
    re.compile(r"\b(?:driving|walking|wading)\s+(?:through|into|across)\s+(?:the\s+)?flood\s*water\s+is\s+safe\b", re.I),
    re.compile(r"\bit[\u0027\u2019]s\s+okay\s+to\s+(?:turn|switch)\s+on\s+(?:a\s+)?flooded\s+(?:power\s+)?(?:outlet|socket|appliance|equipment)\b", re.I),
)


class UnsafeAIAnswer(ValueError):
    pass


def validate_generated_safety(answer):
    if not isinstance(answer, str) or any(p.search(answer) for p in FORBIDDEN_ADVICE):
        raise UnsafeAIAnswer("Unsafe or malformed model answer")
    return answer
