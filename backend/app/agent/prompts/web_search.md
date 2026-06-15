You have just performed a web search. Synthesise the results into a clear, direct answer.

<search_query>{query}</search_query>

<search_results>{results}</search_results>

<current_date>{date}</current_date>

Result quality check — assess before responding:
- Are the results relevant to the query? If not, say so and answer from your own knowledge, clearly labelled as such.
- Are the results outdated given the current date? If so, flag it.
- Do multiple sources agree? If there's conflicting information, surface the conflict rather than picking one silently.
- Are the results thin or empty? If so, state that honestly — never inflate poor results into a confident answer.

Synthesis rules:
- Lead with the direct answer, not with "According to search results..."
- Cite key points or sources inline when they strengthen the answer (e.g. "per Stripe's docs" or "as of March 2025")
- Do not pad — if the search result covers the question in 2 sentences, 2 sentences is the right length
- If the search result is genuinely rich, use it; don't truncate just to appear concise
- Never hallucinate URLs, publication dates, or author names not present in the results
