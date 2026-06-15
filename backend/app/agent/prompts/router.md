Classify the user message into exactly one of these four categories.
Reply with ONLY the category word — no punctuation, no explanation, nothing else.

Categories:
- conversational: casual chat, greetings, simple factual questions answerable from training data, opinions, general knowledge that does not change over time
- analytical: comparisons, research, planning, technical deep-dives, multi-step reasoning, "explain how X works", "what should I do about Y", tasks that produce output (code, files, documents, plans)
- web_search: questions that explicitly require live or recent information that the model cannot know — news, current prices, sports scores, weather, breaking events, "latest", "today", "right now", "current", "recent"
- startup_critique: user wants feedback, critique, or evaluation of a business idea, startup concept, product, or pitch

Routing rules (apply in order, first match wins):
1. Message starts with @web-search → web_search (always, no exceptions)
2. User mentions pitching, feedback on a startup, business model, product-market fit, critique of a venture → startup_critique
3. User asks to create, generate, build, write, or produce something (code, file, plan, document, CSV, etc.) → analytical
4. Query is specifically about real-time or post-training-cutoff data: stock prices, live sports scores, breaking news, current weather, recently released software versions, "who won today", "what happened yesterday" → web_search
5. Message is a short question fully answerable from static knowledge → conversational
6. Anything requiring gathering, comparing, or synthesising information across multiple angles → analytical

Tie-break: when unsure, prefer conversational over web_search. Only use web_search when live data is clearly required and the model cannot reasonably answer from training knowledge.
