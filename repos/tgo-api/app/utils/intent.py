"""Intent localization utilities."""

from __future__ import annotations

from typing import Optional


# Chinese ("zh") values are written as unicode escapes; Hindi ("hi") and Marathi ("mr") added.
INTENT_TRANSLATIONS = {
    "purchase": {
        "en": "Purchase",
        "zh": "\u8d2d\u4e70",
        "zh-cn": "\u8d2d\u4e70",
        "zh_cn": "\u8d2d\u4e70",
        "hi": "खरीदारी",
        "mr": "खरेदी",
        "ja": "購入",
    },
    "inquiry": {
        "en": "Inquiry",
        "zh": "\u54a8\u8be2",
        "zh-cn": "\u54a8\u8be2",
        "zh_cn": "\u54a8\u8be2",
        "hi": "पूछताछ",
        "mr": "चौकशी",
        "ja": "問い合わせ",
    },
    "complaint": {
        "en": "Complaint",
        "zh": "\u6295\u8bc9",
        "zh-cn": "\u6295\u8bc9",
        "zh_cn": "\u6295\u8bc9",
        "hi": "शिकायत",
        "mr": "तक्रार",
        "ja": "苦情",
    },
    "support": {
        "en": "Support",
        "zh": "\u652f\u6301",
        "zh-cn": "\u652f\u6301",
        "zh_cn": "\u652f\u6301",
        "hi": "सहायता",
        "mr": "सहाय्य",
        "ja": "サポート",
    },
}


def parse_accept_language(header: Optional[str]) -> str:
    if not header:
        return "en"
    parts = header.split(",")
    if not parts:
        return "en"
    locale = parts[0].split(";")[0].strip().lower()
    return locale or "en"


def localize_intent(intent: Optional[str], accept_language: Optional[str]) -> Optional[str]:
    if not intent:
        return intent

    locale = parse_accept_language(accept_language)
    base_locale = locale.split("-")[0]
    translations = INTENT_TRANSLATIONS.get(intent)
    if not translations:
        return intent

    # Try exact match, underscore variant, base language
    candidates = [locale, locale.replace("_", "-"), locale.replace("-", "_"), base_locale]
    for candidate in candidates:
        if candidate in translations:
            return translations[candidate]
    return translations.get("en", intent)


def localize_visitor_response_intent(visitor_response, accept_language: Optional[str]) -> None:
    ai_insights = getattr(visitor_response, "ai_insights", None)
    if not ai_insights:
        return

    intent_code = getattr(ai_insights, "intent", None)
    localized = localize_intent(intent_code, accept_language)
    if localized is not None:
        ai_insights.intent = localized

