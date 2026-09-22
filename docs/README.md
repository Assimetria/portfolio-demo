# Documentation

> Purpose: rules for this directory. The map of documents is `INDEX.md`.
> Last verified: 2026-09-20.

This directory contains persistent product-template documentation only.

## Guidelines

- Every document starts with a purpose line and a "Last verified" date, and names the code files it was checked against.
- Do not commit task-specific investigation, audit or "completion summary" documents (for example `task-NNNN-enhanced.md`, `*-AUDIT.md`, `*_COMPLETE.md`). They are agent work artifacts and belong in the task tracker; use a git-ignored `work/` directory for scratch notes.
- Prefer editing an existing document over adding a new one; add the new one to `INDEX.md` if you must.
- Product-specific docs in a customer repo go under `docs/` too, but keep template docs unchanged so `sync-upstream.sh` can update them.
