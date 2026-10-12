import pytest
from assistant.safety import validate_generated_safety, UnsafeAIAnswer

@pytest.mark.parametrize("answer", [
    "You should drive through floodwater.",
    "Please walk through the flood water.",
    "Go ahead and wade into floodwater.",
    "Turn on flooded electrical equipment.",
])
def test_forbidden_output_blocked(answer):
    with pytest.raises(UnsafeAIAnswer):
        validate_generated_safety(answer)

@pytest.mark.parametrize("answer", [
    "Never walk through floodwater.",
    "Do not drive through floodwater.",
    "Call VICSES on 132 500 for flood or storm assistance.",
])
def test_safe_warning_remains_allowed(answer):
    assert validate_generated_safety(answer) == answer

@pytest.mark.parametrize("answer", [
    "Driving through floodwater is safe.",
    "It's okay to turn on a flooded power outlet.",
])
def test_additional_unsafe_advice_blocked(answer):
    with pytest.raises(UnsafeAIAnswer):
        validate_generated_safety(answer)
