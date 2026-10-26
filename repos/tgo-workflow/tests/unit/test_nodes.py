import pytest
from app.engine.context import ExecutionContext
from app.engine.executor import WorkflowExecutor
from app.engine.nodes.agent import AgentNodeExecutor
from app.engine.nodes.answer import AnswerNodeExecutor
from app.engine.nodes.classifier import ClassifierNodeExecutor
from app.engine.nodes.tool import ToolNodeExecutor
from app.integrations.ai_client import AIClient
from app.integrations.llm_provider import LLMProvider


def _node(node_id, node_type, **data):
    return {"id": node_id, "type": node_type, "data": {"label": node_id, "reference_key": node_id, "type": node_type, **data}}


def test_get_variable_accepts_braced_reference():
    ctx = ExecutionContext({"llm_1.text": "hi"})
    assert ctx.get_variable("{{llm_1.text}}") == "hi"
    assert ctx.get_variable(" {{ llm_1.text }} ") == "hi"
    assert ctx.get_variable("") is None


@pytest.mark.asyncio
async def test_answer_variable_output_with_braced_reference():
    ctx = ExecutionContext({"llm_1.text": "hello"})
    node = _node("answer_1", "answer", output_type="variable", output_variable="{{llm_1.text}}")
    outputs, _ = await AnswerNodeExecutor("answer_1", node).execute(ctx)
    assert outputs == {"result": "hello"}


@pytest.mark.asyncio
async def test_agent_node_sends_agent_id_and_mapped_message(monkeypatch):
    calls = []

    async def fake_run_agent(project_id, payload):
        calls.append((project_id, payload))
        return {"success": True, "content": "agent reply"}

    monkeypatch.setattr(AIClient, "run_agent", staticmethod(fake_run_agent))
    ctx = ExecutionContext({"input_1.query": "where is my order"}, project_id="p1", trigger_key="input_1")
    node = _node("agent_1", "agent", agent_id="a1", input_mapping={"message": "{{input_1.query}}"})

    outputs, handle = await AgentNodeExecutor("agent_1", node).execute(ctx)

    assert outputs == {"text": "agent reply"}
    assert handle is None
    assert calls == [("p1", {"message": "where is my order", "stream": False, "agent_id": "a1"})]


@pytest.mark.asyncio
async def test_agent_node_defaults_to_project_agent_and_trigger_inputs(monkeypatch):
    calls = []

    async def fake_run_agent(project_id, payload):
        calls.append(payload)
        return {"success": True, "content": "ok"}

    monkeypatch.setattr(AIClient, "run_agent", staticmethod(fake_run_agent))
    ctx = ExecutionContext({"input_1.query": "hello"}, project_id="p1", trigger_key="input_1")
    node = _node("agent_1", "agent", agent_id="")

    await AgentNodeExecutor("agent_1", node).execute(ctx)

    assert calls == [{"message": "hello", "stream": False}]


@pytest.mark.asyncio
async def test_agent_node_raises_on_failed_run(monkeypatch):
    async def fake_run_agent(project_id, payload):
        return {"success": False, "content": "", "error": "Default agent not configured for project"}

    monkeypatch.setattr(AIClient, "run_agent", staticmethod(fake_run_agent))
    ctx = ExecutionContext({"input_1.query": "hello"}, project_id="p1", trigger_key="input_1")
    node = _node("agent_1", "agent", agent_id="")

    with pytest.raises(RuntimeError, match="Default agent not configured"):
        await AgentNodeExecutor("agent_1", node).execute(ctx)


@pytest.mark.asyncio
async def test_tool_node_raises_on_failure(monkeypatch):
    async def fake_execute_tool(project_id, tool_id, inputs):
        return {"success": False, "error": "boom"}

    monkeypatch.setattr(AIClient, "execute_tool", staticmethod(fake_execute_tool))
    node = _node("tool_1", "tool", tool_id="t1")

    with pytest.raises(RuntimeError, match="boom"):
        await ToolNodeExecutor("tool_1", node).execute(ExecutionContext())


@pytest.mark.asyncio
@pytest.mark.parametrize("response, expected", [
    ('{"category_id": "billing"}', "billing"),
    ('```json\n{"category_id": "billing"}\n```', "billing"),
    ("billing", "billing"),
    ("Billing & Payments", "billing"),
    ("The answer is billing.", "billing"),
    ("no idea", "general"),
])
async def test_classifier_matches_category(monkeypatch, response, expected):
    async def fake_chat_completion(**kwargs):
        return response

    monkeypatch.setattr(LLMProvider, "chat_completion", staticmethod(fake_chat_completion))
    node = _node(
        "classifier_1", "classifier",
        input_variable="{{input_1.query}}",
        provider_id="p", model_id="m",
        categories=[
            {"id": "general", "name": "General Inquiry", "description": "anything else"},
            {"id": "billing", "name": "Billing & Payments", "description": "charges"},
        ],
    )
    ctx = ExecutionContext({"input_1.query": "I was charged twice"})

    outputs, handle = await ClassifierNodeExecutor("classifier_1", node).execute(ctx)

    assert handle == expected
    assert outputs["category_id"] == expected


@pytest.mark.asyncio
async def test_llm_provider_requires_model():
    with pytest.raises(ValueError, match="No LLM model selected"):
        await LLMProvider.chat_completion(provider_id=None, model="", user_prompt="hi")


@pytest.mark.asyncio
async def test_executor_fails_run_when_node_fails():
    definition = {
        "nodes": [
            _node("input_1", "input", input_variables=[{"name": "query", "type": "string"}]),
            _node("llm_1", "llm", user_prompt="{{input_1.query}}"),
            _node("answer_1", "answer", output_type="template", output_template="{{llm_1.text}}"),
        ],
        "edges": [
            {"source": "input_1", "target": "llm_1"},
            {"source": "llm_1", "target": "answer_1"},
        ],
    }
    completed = []

    async def on_node_complete(node_id, status, **kwargs):
        completed.append((node_id, status))

    with pytest.raises(RuntimeError, match="Node 'llm_1' failed: No LLM model selected"):
        await WorkflowExecutor(definition).run({"query": "hi"}, on_node_complete=on_node_complete)

    assert completed == [("input_1", "completed"), ("llm_1", "failed")]
