"""
Query preprocessing for improved retrieval.

This module provides query expansion and preprocessing capabilities
to improve RAG retrieval accuracy through multi-query approaches.

TODO: Upgrade to LLM-driven query preprocessing (see FastGPT queryExtension.ts)
======================================================================
FastGPT approach:
1. Use an LLM to generate ~10 query variants (~200-500 tokens per query)
2. Resolve coreference using conversation history (e.g. "it" -> "FastGPT")
3. Expand from different angles (cause / impact / solution / comparison)
4. Pick the best 3 of N candidates with a submodular greedy algorithm
5. Few-shot prompt with 8 multilingual examples

Core of the FastGPT prompt template:
- Generate N different "search terms" versions of the "original question"
- Explore the topic from different angles for semantic richness
- Requirements: relevant, multi-angle, non-redundant, concise and searchable

Current implementation: rule-driven (zero cost), upgradeable to LLM-driven
when needed. English, Hindi and Marathi are supported.
======================================================================
"""

import re
from typing import List, Optional

from ..config import get_settings
from ..logging_config import get_logger
from .text_utils import STOPWORDS, extract_keywords

logger = get_logger(__name__)


class QueryProcessor:
    """Process and expand queries for better retrieval."""
    
    def __init__(self):
        self.settings = get_settings()
        self._stopwords = STOPWORDS
        # Leading question phrases removed to turn a question into a statement.
        # Latin phrases are matched on word boundaries; Devanagari phrases are
        # matched as whole whitespace-delimited tokens.
        self._question_phrases = [
            "what is", "what are", "how to", "how do i", "how can i", "how do", "how does",
            "why is", "why does", "why do", "which", "please tell me", "can you tell me",
            "\u0915\u094d\u092f\u093e \u0939\u0948", "\u0915\u094d\u092f\u093e", "\u0915\u0948\u0938\u0947", "\u0915\u094d\u092f\u094b\u0902", "\u0915\u094c\u0928 \u0938\u093e", "\u0915\u0943\u092a\u092f\u093e \u092c\u0924\u093e\u090f\u0902",
            "\u0915\u093e\u092f \u0906\u0939\u0947", "\u0915\u093e\u092f", "\u0915\u0938\u0947", "\u0915\u0938\u093e", "\u0915\u0936\u0940", "\u0915\u093e", "\u0915\u094b\u0923\u0924\u0947", "\u0915\u0943\u092a\u092f\u093e \u0938\u093e\u0902\u0917\u093e",
        ]
        self._question_re = re.compile(
            r"(?:(?<=\s)|^)(?:" + "|".join(
                re.escape(p) for p in sorted(self._question_phrases, key=len, reverse=True)
            ) + r")(?=\s|$|[?\u0964])",
            re.IGNORECASE,
        )
    
    async def expand_query(self, query: str) -> List[str]:
        """
        Expand query with variations for multi-query retrieval.
        
        Args:
            query: Original user query
            
        Returns:
            List of query variations including original
        """
        queries = [query]
        
        # 1. Extract keywords version
        keywords = self._extract_keywords(query)
        if keywords and len(keywords) >= 2:
            keyword_query = " ".join(keywords)
            if keyword_query != query:
                queries.append(keyword_query)
        
        # 2. Convert question to declarative statement
        declarative = self._to_declarative(query)
        if declarative and declarative not in queries:
            queries.append(declarative)
        
        logger.debug(f"Expanded query '{query}' to {len(queries)} variants: {queries}")
        return queries
    
    def _extract_keywords(self, query: str) -> List[str]:
        """
        Extract key terms from query by removing stopwords.
        
        Args:
            query: Input query string
            
        Returns:
            List of keywords
        """
        return extract_keywords(query)
    
    def _to_declarative(self, query: str) -> Optional[str]:
        """
        Convert question to declarative statement for better matching.
        
        Args:
            query: Question string
            
        Returns:
            Declarative version or None if not applicable
        """
        result = self._question_re.sub(" ", query)
        result = re.sub(r"[?\u0964\u061f\uff1f]+", " ", result)
        result = re.sub(r"\s+", " ", result).strip()
        changed = result != re.sub(r"\s+", " ", query).strip()
        
        # Only return if it changed and has content
        return result if changed and len(result) >= 2 else None


# Global processor instance
_processor: Optional[QueryProcessor] = None


def get_query_processor() -> QueryProcessor:
    """Get the global query processor instance."""
    global _processor
    if _processor is None:
        _processor = QueryProcessor()
    return _processor


def reset_query_processor() -> None:
    """Reset the global processor instance. Useful for testing."""
    global _processor
    _processor = None
