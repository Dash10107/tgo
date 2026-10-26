from typing import Any, Dict, Optional, Tuple
from app.engine.nodes.base import BaseNodeExecutor
from app.engine.context import ExecutionContext
from app.integrations.llm_provider import LLMProvider
import json
import re
from app.core.logging import logger
from app.engine.nodes.registry import register_node

@register_node("classifier")
class ClassifierNodeExecutor(BaseNodeExecutor):
    async def execute(self, context: ExecutionContext) -> Tuple[Dict[str, Any], Optional[str]]:
        input_text = context.resolve_template(self.config.get("input_variable", ""))
        categories = self.config.get("categories", [])
        
        if not categories:
            return {"category_id": None, "category_name": None}, None
            
        categories_desc = "\n".join([f"- {c['id']}: {c['name']} ({c['description']})" for c in categories])
        prompt = f"""
Classify the following input into one of these categories:
{categories_desc}

Input: {input_text}

Return the category ID in JSON format: {{"category_id": "..."}}
"""
        
        response = await LLMProvider.chat_completion(
            provider_id=self.config.get("provider_id"),
            model=self.config.get("model_id"),
            user_prompt=prompt,
            temperature=0,
            project_id=context.project_id
        )

        # Simple extraction logic
        category_id = None
        try:
            # Look for JSON in response
            match = re.search(r'\{.*\}', response or "", re.DOTALL)
            if match:
                data = json.loads(match.group(0))
                category_id = data.get("category_id")
        except (json.JSONDecodeError, AttributeError) as e:
            logger.error(f"Error parsing classifier response: {e}")

        # Models sometimes answer with the bare id or the category name instead of JSON
        candidate = str(category_id if category_id is not None else (response or "")).strip().strip('"\'`').lower()
        matched_category = next(
            (c for c in categories if candidate in (str(c["id"]).lower(), str(c["name"]).lower())),
            None
        )
        if matched_category is None:
            matched_category = next(
                (c for c in categories if re.search(rf"\b{re.escape(str(c['id']).lower())}\b", candidate)),
                categories[0]
            )
        
        outputs = {
            "category_id": matched_category["id"],
            "category_name": matched_category["name"]
        }
        
        return outputs, matched_category["id"]

