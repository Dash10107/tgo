# Debugging Missing Warning Logs

## Problem

`logger.warning()` output is not printed, but `info`-level logs are visible.

## Diagnosis

The diagnostic run shows:

✅ **The logging system itself works** - warning logs are emitted normally
✅ **Log level is correct** - the root logger is at INFO, so WARNING is emitted
✅ **Both JSON and console formats work** - both render warnings correctly

**Conclusion: the problem is not the logging system; your HTTP exception handler is probably not being triggered.**

## Possible Causes

1. **The exception handler is not called** - the HTTP exception may be caught elsewhere
2. **The request raised no HTTP exception** - the endpoint you hit may not raise one
3. **Uvicorn overrides the logging config** - Uvicorn may reconfigure logging on startup

## Debugging Steps

### Step 1: Verify the logging system works

Run the diagnostic script:

```bash
python3 test_warning_logs.py
```

You should see the warning logs. If you do not, the logging system itself has a problem.

### Step 2: Add debug code to verify the handler is called

Add debug code to the HTTP exception handler in `src/rag_service/main.py`:

```python
async def _http_exception_handler(request: Request, exc):
    # DEBUG: Print to console to verify handler is called
    print(f"[DEBUG] HTTP exception handler called! Exception type: {type(exc).__name__}")
    
    # ... existing code ...
    
    print(f"[DEBUG] About to log warning: status_code={status_code}, detail={detail}")
    logger.warning("HTTP exception occurred", ...)
    print(f"[DEBUG] Warning logged successfully")
```

### Step 3: Start the app and trigger an exception

1. Start the app:

```bash
poetry run uvicorn src.rag_service.main:app --reload
```

2. In another terminal, run the test script:

```bash
python3 test_http_exception.py
```

### Step 4: Check the server console output

Look for the following in the server console:

1. **[DEBUG] messages** - if you see them, the handler was called
2. **Warning logs** - you should see the warning log between the [DEBUG] messages

## Scenarios and Solutions

### Scenario 1: [DEBUG] appears but no warning log

**Cause:** Uvicorn's logging configuration overrides ours

**Solution:** disable Uvicorn's logging configuration when starting it:

```python
# In the if __name__ == "__main__": block of main.py
uvicorn.run(
    "src.rag_service.main:app",
    host=settings.host,
    port=settings.port,
    reload=settings.debug,
    log_config=None,  # Add this line to disable uvicorn's log config
)
```

Or reconfigure logging after startup:

```python
# In the startup section of the lifespan function
from .logging_config import configure_logging
configure_logging(log_level="INFO", json_output=False, force_reconfigure=True)
```

### Scenario 2: No [DEBUG] messages at all

**Cause:** the exception handler is not being called at all

**Possible sub-causes:**

1. **The exception is caught in middleware** - check whether another middleware swallows it
2. **The route does not exist** - FastAPI may return its default 404 response instead of raising
3. **Handler registration failed** - check that `setup_exception_handlers(app)` is called

**Solution:** add logging at the start of `setup_exception_handlers`:

```python
def setup_exception_handlers(app: FastAPI) -> None:
    print("[DEBUG] Setting up exception handlers...")
    logger.info("Registering exception handlers")
    # ... rest of the code
```

### Scenario 3: Both [DEBUG] and warning logs appear

**Good news:** logging works. Earlier the cause was probably:
- The endpoint you hit did not raise an exception
- Or you were looking for the logs in the wrong place

## FAQ

### Q: Why can I see INFO logs but not WARNING?

A: This is usually not a log-level problem (WARNING is above INFO). It is more often:
- A code path problem: the code that emits the warning is not executed
- An output location problem: warnings may go elsewhere (file vs console)

### Q: How do I make sure the logging config is not overridden?

A: Force reconfiguration after uvicorn starts:

```python
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from .logging_config import configure_logging
    configure_logging(log_level="INFO", json_output=False, force_reconfigure=True)
    logger.info("Logging reconfigured after uvicorn startup")
    # ... rest of startup code
```

### Q: How do I inspect all logging configuration?

A: Run Test 4 and Test 5 of the diagnostic script:

```bash
python3 test_warning_logs.py
```

Check the "Root Logger Level" and "Specific Logger Level" sections.

## Next Steps

1. Run `python3 test_warning_logs.py` to verify the logging system
2. Start the app and run `python3 test_http_exception.py`
3. Check the server console output
4. Pick the matching solution from the scenarios above

## Clean Up Debug Code

Once the issue is resolved, remove the `print()` debug statements from `main.py`.

