def classify_symbol(symbol):

    name = symbol.get(
        "name",
        ""
    )

    kind = symbol.get(
        "kind",
        ""
    )


    if kind == "class":
        return "core"


    if name.startswith("_"):
        return "internal"


    domain_keywords = [
        "pazienti",
        "paziente",
        "richiamo",
        "ricetta",
        "prestazione",
        "agenda",
        "appuntamento"
    ]


    name_lower = name.lower()


    if any(
        word in name_lower
        for word in domain_keywords
    ):
        return "domain"


    ui_keywords = [
        "styled",
        "icon",
        "badge",
        "modal",
        "button",
        "toggle",
        "sort"
    ]


    if any(
        word in name_lower
        for word in ui_keywords
    ):
        return "ui"


    return "support"