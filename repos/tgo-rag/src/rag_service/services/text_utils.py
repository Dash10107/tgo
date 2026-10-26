"""
Language-aware text helpers shared by query processing, search and chunking.

Supported languages: English, Hindi and Marathi (Devanagari script). Scripts
that are not whitespace-delimited (CJK) are detected so callers can fall back
to substring matching instead of word-based matching.
"""

import re
from typing import List, Set

_DEVANAGARI_RE = re.compile(r"[ऀ-ॿ]")
_CJK_RE = re.compile(r"[぀-ヿ㐀-䶿一-鿿가-힯]")

# Punctuation that separates tokens, including the Devanagari danda (U+0964/U+0965),
# CJK/fullwidth punctuation and Arabic question mark.
_PUNCT_RE = re.compile(
    r"[\s।॥?!.,;:\"'()\[\]{}<>、。！，：；？؟]+"
)

ENGLISH_STOPWORDS: Set[str] = {
    "a", "an", "the", "and", "or", "but", "if", "of", "to", "in", "on", "at", "by",
    "for", "with", "from", "as", "is", "are", "was", "were", "be", "been", "it",
    "this", "that", "these", "those", "i", "you", "he", "she", "we", "they", "me",
    "my", "your", "can", "could", "should", "would", "will", "do", "does", "did",
    "what", "how", "why", "which", "when", "where", "who", "whom", "please",
}

HINDI_STOPWORDS: Set[str] = {
    "का", "की", "के", "को", "से", "में", "पर", "और", "या", "है", "हैं",
    "था", "थी", "थे", "हो", "होता", "होती", "होते", "यह", "वह", "इस",
    "उस", "ने", "कि", "कर", "करना", "करें", "क्या", "क्यों", "कैसे",
    "कौन", "किस", "कब", "कहाँ", "कहां", "कृपया", "मैं", "हम", "तुम", "आप",
    "भी", "तो", "ही", "लिए", "साथ", "बारे",
}

MARATHI_STOPWORDS: Set[str] = {
    "चा", "ची", "चे", "च्या", "ला", "ने", "ती", "तो", "ते", "आहे", "आहेत",
    "होता", "होती", "होते", "आणि", "आणी", "किंवा", "पण", "मात्र", "या",
    "त्या", "हा", "ही", "हे", "त्याचा", "मध्ये", "वर", "साठी", "सह", "काय",
    "कसे", "का", "कोण", "कोठे", "कधी", "कृपया", "मी", "आम्ही", "तुम्ही",
    "तुला", "मला", "करण्यासाठी",
}

STOPWORDS: Set[str] = ENGLISH_STOPWORDS | HINDI_STOPWORDS | MARATHI_STOPWORDS


def has_devanagari(text: str) -> bool:
    """Return True if the text contains Devanagari (Hindi/Marathi) characters."""
    return bool(_DEVANAGARI_RE.search(text))


def has_cjk(text: str) -> bool:
    """Return True if the text contains CJK characters."""
    return bool(_CJK_RE.search(text))


def needs_substring_matching(text: str) -> bool:
    """
    Whether word-based full-text matching is unreliable for this text.

    CJK has no word delimiters. Devanagari words carry inflections and combining
    marks that the stock text-search parser can split unpredictably, so
    substring/trigram matching is used in addition to the full-text index.
    """
    return has_cjk(text) or has_devanagari(text)


def tokenize(text: str) -> List[str]:
    """Split text into tokens on whitespace and punctuation (including danda)."""
    return [t for t in _PUNCT_RE.split(text) if t]


def extract_keywords(text: str, min_length: int = 2) -> List[str]:
    """Tokenize and drop stopwords and very short tokens, preserving order."""
    seen: Set[str] = set()
    keywords: List[str] = []
    for token in tokenize(text):
        lowered = token.lower()
        if len(lowered) < min_length or lowered in STOPWORDS or lowered in seen:
            continue
        seen.add(lowered)
        keywords.append(token)
    return keywords


def escape_like(value: str) -> str:
    """Escape LIKE/ILIKE wildcards so user input is matched literally."""
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def estimate_tokens(text: str) -> int:
    """
    Rough token estimate that does not collapse for unspaced or Indic scripts.

    Whitespace-delimited Latin words ~1 token, each CJK character ~1 token, and
    Devanagari text (poorly covered by most BPE vocabularies) ~1 token per 2
    characters.
    """
    if not text:
        return 0
    cjk = len(_CJK_RE.findall(text))
    devanagari = len(_DEVANAGARI_RE.findall(text))
    stripped = _CJK_RE.sub(" ", _DEVANAGARI_RE.sub(" ", text))
    words = len(stripped.split())
    special = len(re.findall(r"[^\w\s]", stripped))
    return max(1, words + special // 2 + cjk + (devanagari + 1) // 2)
