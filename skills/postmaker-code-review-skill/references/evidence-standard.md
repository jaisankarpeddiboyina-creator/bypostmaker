# Evidence Standard

A claim of "PASS," "verified," "confirmed," or "done" is only acceptable
when backed by one of the following:

- Real before/after database rows (actual query output, not a description
  of expected rows).
- Real logs — actual captured output (e.g. `wrangler tail`, console
  output), not a paraphrase of what logs "should" show.
- Real timing measurements — actual elapsed milliseconds/seconds from an
  actual run, not an estimate.
- Real network request list/count — an actual captured list of requests
  (e.g. from a browser Network tab or a proxy log), not "the button was
  disabled so it should be fine."
- Real screenshot or terminal output pasted verbatim.

## NOT acceptable as evidence, ever

- "This should work because..." (reasoning about the code, not running it)
- "Structural guarantee" / "architecturally guaranteed" — this describes
  intent, not a verified runtime outcome.
- "TypeScript compiles" / "the build succeeded" — this proves the code is
  syntactically and type-valid. It proves nothing about runtime behavior.
- A test file that imports the real store/state but reimplements the
  actual handler/component logic separately — this only proves the
  reimplementation works, not the shipped code. Always ask: does this test
  call the exact function/component that was shipped, or a stand-in?
- Restating a previous "PASS" claim without re-verifying it, especially
  after code has changed since that claim was made.
- A claim about current production/staging state ("already deployed,"
  "already set," "already fixed") without a real command output proving
  it right now — earlier claims can go stale or turn out to have been
  aspirational rather than actual.

## When evidence is missing or weak

Don't accept it and don't manufacture a reason to accept it just to move
faster. Say plainly what's missing and ask for exactly that — the specific
real command, the specific real click-through, the specific real log —
not a vague "please verify more thoroughly."

## CI / deploy failures specifically

A CI or deploy failure is only diagnosed once the real remote log has been
read — copy-pasted verbatim from the actual failed step (e.g. the GitHub
Actions log), not inferred from a local `npm run type-check` or local
reproduction passing or failing. Local and CI environments can genuinely
differ (lockfile drift, Node version, clean install vs. cached
`node_modules`) — a clean local run does not explain, let alone rule out,
a CI failure. If the real log hasn't been opened yet, say so and get it
before proposing any cause or fix. Any explanation of "why CI failed"
that doesn't quote the actual log text is a guess, not a diagnosis, and
must be labeled as an unconfirmed hypothesis, never presented as the
finding.

## Rate-limited/paid API calls specifically

Before any test suite runs against a real rate-limited API (e.g. Gemini
free tier):
1. State the total number of real calls the test plan will use.
2. Confirm which specific tests need a real call vs. which can be
   satisfied with a mock (most can — only the "does the real API/key
   actually work" case usually needs one real call).
3. If a test run reports a real call was made, but the evidence shown
   looks generic/reused from a prior run, ask for a fresh, distinguishable
   result (e.g. a new timestamp, a new unique output) to confirm it was
   actually re-run, not copy-pasted from before.
