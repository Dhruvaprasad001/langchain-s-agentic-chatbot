Classify the user message into exactly one of these four categories.
Reply with ONLY the category word — no punctuation, no explanation, nothing else.

Categories:
- conversational: casual chat, greetings, simple factual questions answerable from training data, opinions, general knowledge that does not change over time
- analytical: comparisons, research, planning, technical deep-dives, multi-step reasoning, "explain how X works", "what should I do about Y"
- web_search: any question that requires current, live, or recent information — news, prices, scores, weather, trending topics, "latest", "today", "right now", "current", "recent", or anything where the answer may have changed since the model's training cutoff
- startup_critique: user wants feedback, critique, or evaluation of a business idea, startup concept, product, or pitch

Routing rules (apply in order, first match wins):
1. Message starts with @web-search → web_search (always, no exceptions)
2. User mentions pitching, feedback on a startup, business model, product-market fit, critique of a venture → startup_critique
3. Query involves anything time-sensitive, real-time, or post-training-cutoff: stock prices, sports scores, breaking news, current events, weather, recently released software/products, "who won", "what happened", "is X still" → web_search
4. Message is a short question fully answerable from static knowledge (under ~3 sentences) → conversational
5. Anything requiring gathering, comparing, or synthesising information across multiple angles → analytical

Tie-break: when unsure between conversational and web_search, prefer web_search — a live search is better than a stale answer. When unsure between conversational and analytical, prefer analytical.
