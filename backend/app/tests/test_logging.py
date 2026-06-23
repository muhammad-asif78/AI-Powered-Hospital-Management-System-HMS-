import json
import logging
from io import StringIO
from app.logging_utils import (
    StructuredJSONFormatter,
    set_log_context,
    clear_log_context,
)


def test_structured_json_formatter():
    # Setup standard logging intercept using our JSON formatter
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    formatter = StructuredJSONFormatter()
    handler.setFormatter(formatter)

    logger = logging.getLogger("test_logger")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)

    # Set log context variables
    set_log_context({"request_id": "test-req-123", "user_id": 42})

    try:
        # Log a simple message
        logger.info("Test message", extra={"additional_key": "additional_value"})

        # Retrieve log output
        log_output = stream.getvalue().strip()
        assert log_output != ""

        # Parse log string back into JSON dictionary
        log_json = json.loads(log_output)

        # Assert correct field presence and values
        assert log_json["level"] == "INFO"
        assert log_json["logger"] == "test_logger"
        assert log_json["message"] == "Test message"
        assert log_json["request_id"] == "test-req-123"
        assert log_json["user_id"] == 42
        assert log_json["additional_key"] == "additional_value"
        assert "timestamp" in log_json
        assert "module" in log_json

    finally:
        clear_log_context()
        logger.handlers = []


def test_structured_logging_exception():
    stream = StringIO()
    handler = logging.StreamHandler(stream)
    formatter = StructuredJSONFormatter()
    handler.setFormatter(formatter)

    logger = logging.getLogger("test_exception_logger")
    logger.handlers = [handler]
    logger.setLevel(logging.INFO)

    try:
        raise ValueError("Simulated error message")
    except ValueError as e:
        logger.error("An error occurred", exc_info=e)

    log_output = stream.getvalue().strip()
    log_json = json.loads(log_output)

    assert log_json["level"] == "ERROR"
    assert log_json["message"] == "An error occurred"
    assert "exception" in log_json
    assert log_json["exception"]["type"] == "ValueError"
    assert log_json["exception"]["message"] == "Simulated error message"
    assert "traceback" in log_json["exception"]
    assert "ValueError: Simulated error message" in log_json["exception"]["traceback"]

    logger.handlers = []
