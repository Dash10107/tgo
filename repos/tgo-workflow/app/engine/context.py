import re
from typing import Any, Dict, Optional

class ExecutionContext:
    def __init__(
        self,
        initial_inputs: Optional[Dict[str, Any]] = None,
        project_id: Optional[str] = None,
        trigger_key: Optional[str] = None,
    ):
        self.data: Dict[str, Any] = initial_inputs or {}
        self.project_id = project_id
        self.trigger_key = trigger_key

    def get_variable(self, path: str) -> Any:
        """
        Get variable value by path like 'start_1.user_input'
        """
        if not path or not isinstance(path, str):
            return None
        # The editor inserts references as '{{node.var}}'; accept both forms
        path = path.strip()
        if path.startswith("{{") and path.endswith("}}"):
            path = path[2:-2].strip()
        # For now, it's a flat dict of 'reference_key.var_name'
        return self.data.get(path)

    def get_trigger_inputs(self) -> Dict[str, Any]:
        """
        Get the variables provided to the trigger node, keyed by variable name
        """
        if not self.trigger_key:
            return {}
        prefix = f"{self.trigger_key}."
        return {k[len(prefix):]: v for k, v in self.data.items() if k.startswith(prefix)}

    def set_variable(self, reference_key: str, var_name: str, value: Any):
        """
        Set variable value
        """
        self.data[f"{reference_key}.{var_name}"] = value

    def set_node_outputs(self, reference_key: str, outputs: Dict[str, Any]):
        """
        Set multiple outputs for a node
        """
        for key, value in outputs.items():
            self.set_variable(reference_key, key, value)

    def get_eval_names(self) -> Dict[str, Any]:
        """
        Names for expression evaluation: flat keys plus per-node dicts,
        so expressions can use `reference_key.var_name` or `reference_key['var_name']`
        """
        nodes: Dict[str, Dict[str, Any]] = {}
        for path, value in self.data.items():
            reference_key, sep, var_name = path.partition(".")
            if sep:
                nodes.setdefault(reference_key, {})[var_name] = value
        return {**self.data, **nodes}

    def resolve_template(self, template: str) -> str:
        """
        Resolve {{reference_key.var_name}} in a string
        """
        if not template or not isinstance(template, str):
            return template

        def replace(match):
            path = match.group(1).strip()
            val = self.get_variable(path)
            return str(val) if val is not None else match.group(0)

        return re.sub(r"\{\{([^}]+)\}\}", replace, template)

    def resolve_variables(self, value: Any) -> Any:
        """
        Recursively resolve variables in dicts, lists, or strings
        """
        if isinstance(value, str):
            return self.resolve_template(value)
        elif isinstance(value, list):
            return [self.resolve_variables(item) for item in value]
        elif isinstance(value, dict):
            return {k: self.resolve_variables(v) for k, v in value.items()}
        return value

