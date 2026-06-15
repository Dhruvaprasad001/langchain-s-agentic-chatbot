"""
Seed script: creates 50 sessions and 50 messages in session FppABk4eY6Q40GFfbZ2
for the authenticated user.

- Sessions: created via the local REST API (JWT auth).
- Messages: written directly to Firestore via the Firebase Admin SDK
  (no REST endpoint exists for raw message insertion).

Usage (from backend/):
    python scripts/seed_data.py
"""

import sys
import time
from datetime import datetime, timedelta, timezone

import httpx

BASE_URL = "http://localhost:8000"
JWT = (
    "eyJhbGciOiJSUzI1NiIsImtpZCI6ImVlOTA0NmVhZDJlMDUwMDAxMGVkNTA0M2I0ODNkODRi"
    "MGM1MmM3YzQiLCJ0eXAiOiJKV1QifQ.eyJuYW1lIjoiRGhydXZhIFByYXNhZCIsInBpY3R1"
    "cmUiOiJodHRwczovL2xoMy5nb29nbGV1c2VyY29udGVudC5jb20vYS9BQ2c4b2NLWWJwaDhv"
    "eVBZRWpWRGZIRkl4eUJEZ2FjaHhXd2UzZlNiX0NoQ1g1bC1tZTVBa3c9czk2LWMiLCJpc3Mi"
    "OiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vY2hhdGJvdC0yMGM0ZSIsImF1ZCI6"
    "ImNoYXRib3QtMjBjNGUiLCJhdXRoX3RpbWUiOjE3ODE1MzU5MzQsInVzZXJfaWQiOiJhdmc0"
    "UUhVV0dxYVpMUnc5VXBlaXR0eHZ5dDgzIiwic3ViIjoiYXZnNFFIVVdHcWFaTFJ3OVVwZWl0"
    "dHh2eXQ4MyIsImlhdCI6MTc4MTUzOTY1NiwiZXhwIjoxNzgxNTQzMjU2LCJlbWFpbCI6ImRo"
    "cnV2YXByYXNhZDAwM0BnbWFpbC5jb20iLCJlbWFpbF92ZXJpZmllZCI6dHJ1ZSwiZmlyZWJh"
    "c2UiOnsiaWRlbnRpdGllcyI6eyJnb29nbGUuY29tIjpbIjEwODY5MTAwMTI2NDIyODQ0MDQz"
    "MCJdLCJlbWFpbCI6WyJkaHJ1dmFwcmFzYWQwMDNAZ21haWwuY29tIl19LCJzaWduX2luX3By"
    "b3ZpZGVyIjoiZ29vZ2xlLmNvbSJ9fQ.gIlQOkXehYbP9KkCsKUgBi4Ru8td23a0qnEQQ_Rf"
    "--3lUxhh-K66pxPfzzRZ6L10ksJUDCMF7M1huT16fZIdi_eTp_WfoGlUPHWFvQpIa6r4YML3"
    "9EB2ZcKvoQ8ifGOM_EWIEN-7cE1sznCtwNLKHz77EU2cPHf2pptWg5aOYxYKFH-SBtBXKCTt"
    "5g4TFBGES0tVHAGgXwW3nFfIU74sK1aRkoSLWq3jFEijK9B37Tgz6-_vfNo41Gi3dUQcrrli"
    "7kvQxJpzWkZXbTLlnkhq0FWSia2s_S2Rpp6WgAHBtGs05nIKWwUZYTakjIHOosa1Z2SDrKwV"
    "errIX62g-svGtQ"
)
TARGET_SESSION_ID = "FppABk4eY6Q40GFfbZ2"
UID = "avg4QHUWGqaZLRw9Upeittxvyt83"  # sub/user_id from the JWT payload

HEADERS = {"Authorization": f"Bearer {JWT}"}

SESSION_TITLES = [
    "Trip planning to Japan",
    "Python async best practices",
    "Startup pitch deck feedback",
    "Recipe ideas for the week",
    "Workout routine help",
    "Book recommendations",
    "Debugging my React app",
    "Salary negotiation tips",
    "Learning Spanish vocab",
    "Home office setup advice",
    "Investment strategy chat",
    "Machine learning basics",
    "Writing a cover letter",
    "Docker networking issues",
    "Gift ideas for mom",
    "Understanding LLM fine-tuning",
    "Mediterranean diet guide",
    "Weekly meal prep ideas",
    "Photography tips for beginners",
    "Career change to data science",
    "PostgreSQL query optimization",
    "Mindfulness and meditation",
    "Planning a home renovation",
    "TypeScript generics deep dive",
    "Side project brainstorming",
    "Marketing copy review",
    "Understanding RAG pipelines",
    "Best coffee brewing methods",
    "Kubernetes ingress setup",
    "Personal finance basics",
    "Storytelling for presentations",
    "Learning guitar chords",
    "FastAPI dependency injection",
    "Social media growth tips",
    "Understanding transformers",
    "Backpacking gear checklist",
    "Time management techniques",
    "Redis caching strategies",
    "Freelancing rate calculator",
    "Philosophy of mind discussion",
    "CSS animations tutorial",
    "Smart home device setup",
    "Negotiating a raise",
    "Understanding vector databases",
    "Morning routine optimization",
    "Prompt engineering guide",
    "Podcast recommendation engine",
    "WebSocket real-time chat",
    "Planning a board game night",
    "Explaining quantum computing",
]

USER_MESSAGES = [
    "Can you help me understand this concept better?",
    "What are the best practices here?",
    "I'm getting an error, can you take a look?",
    "How does this compare to the alternatives?",
    "Can you give me a quick summary?",
    "What would you recommend for a beginner?",
    "Is there a simpler way to do this?",
    "Can you write an example for me?",
    "What are the trade-offs here?",
    "How do I get started with this?",
    "That's helpful, can you expand on it?",
    "What's the most common mistake people make?",
    "Can you explain it differently?",
    "What tools do you suggest?",
    "How long would this typically take?",
    "What should I learn first?",
    "Can you give me a step-by-step?",
    "What are the pros and cons?",
    "Is this production-ready?",
    "How do I test this?",
    "Any good resources you recommend?",
    "What's the difference between X and Y?",
    "Can you review what I have so far?",
    "How do I debug this?",
    "What does this error message mean?",
]

ASSISTANT_MESSAGES = [
    "Great question! Here's a breakdown of how this works...",
    "The best practice here is to start with a solid foundation. Let me explain the key steps.",
    "Looking at your error, this is likely caused by a missing dependency. Try installing it first.",
    "Both approaches have merit. The key difference is performance under load.",
    "Sure! In short, this is about separating concerns and keeping your code modular.",
    "For beginners, I'd recommend starting with the official docs and building small projects.",
    "Yes — you can simplify this significantly by using a higher-order function here.",
    "Here's a minimal working example that demonstrates the core idea.",
    "The main trade-off is between developer experience and runtime performance.",
    "Getting started is easier than it looks. Here are the three steps I'd follow.",
    "Absolutely, let me dive deeper into the second point since that's where the nuance lies.",
    "The most common mistake is premature optimization. Focus on correctness first.",
    "Let me try a different angle — think of it like a restaurant kitchen...",
    "I'd suggest starting with the built-in tools before reaching for third-party libraries.",
    "With focused effort, most people get comfortable with this in about two weeks.",
    "Learn the fundamentals first: types, control flow, then data structures.",
    "Here's a step-by-step breakdown: first, then second, then third.",
    "Pros: fast, easy to use, well-documented. Cons: limited flexibility at scale.",
    "With a few hardening steps, yes — let me walk you through the checklist.",
    "Unit tests here should cover the happy path and at least two edge cases.",
    "The official documentation is excellent. Also check out the community Discord.",
    "X is optimized for read-heavy workloads, Y is better when you need write throughput.",
    "Your approach is solid. One suggestion: extract the helper into its own module.",
    "To debug this, add logging at the entry and exit of each function first.",
    "This error means the runtime couldn't resolve the module path. Check your import.",
]


def create_sessions(client: httpx.Client, count: int) -> list[str]:
    created = []
    print(f"\nCreating {count} sessions...")
    for i, title in enumerate(SESSION_TITLES[:count], 1):
        resp = client.post(
            f"{BASE_URL}/api/v1/sessions",
            json={"title": title},
            headers=HEADERS,
        )
        if resp.status_code in (200, 201):
            session_id = resp.json()["session_id"]
            created.append(session_id)
            print(f"  [{i:02d}/{count}] Created: '{title}' → {session_id}")
        else:
            print(f"  [{i:02d}/{count}] FAILED ({resp.status_code}): {resp.text[:120]}")
            if resp.status_code == 401:
                print("\n  JWT is expired. Please refresh it and update the script.")
                sys.exit(1)
        time.sleep(0.05)
    return created


def seed_messages_firestore(uid: str, session_id: str, count: int) -> None:
    import firebase_admin
    from firebase_admin import credentials, firestore as fb_firestore
    from app.core.config import settings

    print(f"\nWriting {count} messages to Firestore for session {session_id}...")

    if not firebase_admin._apps:
        if settings.firebase_service_account_json:
            import json
            cred = credentials.Certificate(json.loads(settings.firebase_service_account_json))
        else:
            cred = credentials.Certificate(settings.firebase_service_account_path)
        firebase_admin.initialize_app(cred)

    db = fb_firestore.client()
    col = (
        db.collection("users")
        .document(uid)
        .collection("sessions")
        .document(session_id)
        .collection("messages")
    )

    # Space messages 30 seconds apart so ordering is deterministic
    base_time = datetime.now(timezone.utc) - timedelta(seconds=count * 30)
    pairs = count // 2
    written = 0
    for i in range(pairs):
        for j, (role, content) in enumerate([
            ("user",      USER_MESSAGES[i % len(USER_MESSAGES)]),
            ("assistant", ASSISTANT_MESSAGES[i % len(ASSISTANT_MESSAGES)]),
        ]):
            ts = base_time + timedelta(seconds=(i * 2 + j) * 30)
            col.document().set({"role": role, "content": content, "timestamp": ts})
            written += 1
            idx = i * 2 + j + 1
            print(f"  [{idx:02d}/{count}] {role:9s}: {content[:60]}")
    print(f"\nWrote {written} messages.")


def main() -> None:
    with httpx.Client(timeout=30) as client:
        # Sanity check: verify the JWT works
        resp = client.get(f"{BASE_URL}/api/v1/sessions?page=1&limit=1", headers=HEADERS)
        if resp.status_code == 401:
            print("JWT is expired or invalid. Please provide a fresh token.")
            sys.exit(1)
        if resp.status_code != 200:
            print(f"Unexpected response from server ({resp.status_code}): {resp.text[:200]}")
            sys.exit(1)
        print("JWT verified. Server is reachable.")

        # 1. Create 50 sessions (skip if already seeded)
        created_ids = create_sessions(client, 50)
        print(f"\nDone. Created {len(created_ids)} sessions.")

    # 2. Seed 50 messages directly into Firestore (no REST endpoint for this)
    seed_messages_firestore(uid=UID, session_id=TARGET_SESSION_ID, count=50)
    print(f"\nAll done.")


if __name__ == "__main__":
    main()
