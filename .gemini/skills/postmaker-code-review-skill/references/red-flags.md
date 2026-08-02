# Red Flags — Send the Work Back, Don't Accept It

- A "test" that reasons about the code instead of running it
  ("structural guarantee," "TypeScript verified," "this should work,"
  "by design this cannot happen").
- A report that answers a different question than the one actually asked,
  or restates the same unresolved item across multiple rounds without
  actually resolving it.
- Any unapproved architecture or scope change bundled into what was
  supposed to be a small, scoped fix — especially anything described
  after the fact as "I also went ahead and..."
- Any real credential, live API key, or real user account touched during
  "testing" — even temporarily, even if it was restored afterward. Ask for
  a fresh disposable test account instead, always.
- A claim about current production/staging state ("already deployed,"
  "already set," "already fixed") without a real command output proving
  it right now.
- A fix that solves the reported symptom but visibly reintroduces the same
  class of bug in a slightly different spot (see production-standard.md's
  red-flag pattern section).
- A rollout/deploy plan that combines two steps that must happen in a
  specific order into one ("enable X and run the migration for X" as a
  single bullet) — this is often actually two steps with a real ordering
  requirement that got compressed and glossed over.
- Silence on a specific question you asked, replaced with general progress
  narration ("I did A, B, C, D...") — if your specific question isn't
  answered word-for-word, it wasn't answered; ask again, more narrowly.
- "Retrying" or "transient error" language used to explain away something
  that should have deterministic, verifiable output (e.g. a deployment
  that either succeeded or didn't — get the real confirmation, don't
  accept "should be fine now" after a retry with no shown result).
- A walkthrough/summary that states a specific value, header, or behavior
  (e.g. a cache header, a config value, an error message) that isn't
  copy-pasted from something actually opened/run in that same pass. Prose
  summaries drift from the real code silently — always cross-check any
  specific claim in a summary against the real file or real output before
  accepting it, even if the surrounding report is otherwise careful.
- Hypothetical reasoning ("if the error were X, then...") that gets
  restated a few lines later as the confirmed finding, without the actual
  source (a real log, a real file) ever having been opened in between.
  This reads as investigation but is actually a guess wearing the
  formatting of a conclusion — treat it exactly like a fabrication.
- A CI/deploy failure diagnosed only from a local reproduction ("it works
  on my machine / local type-check passes") without ever reading the
  actual remote log. Local and CI environments differ (lockfile state,
  Node version, clean vs. cached install) — the real cause must come from
  the real remote output, not an inference from local behavior.
