Classify the user message into exactly one of these four categories.
Reply with only the category word, nothing else.

Categories:
- conversational: casual chat, simple questions, general knowledge
- analytical: comparison, research, planning, multi-step reasoning
- web_search: message starts with @web-search
- startup_critique: user wants feedback or critique on a business idea, startup, or product concept

Rules:
- If message starts with @web-search → always return web_search
- If user mentions pitching an idea, getting feedback on a startup, critiquing a business model → startup_critique
- Otherwise use your judgment between conversational and analytical
