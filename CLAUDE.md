# deckgames

Offline-first card and tile games (Solitaire, Bridge, Mahjong Solitaire, Mahjong Table), served as plain static
files: no logins, no network calls, no build step. Pages under `games/<game>/`, shared card code in `shared/`, game
rules and robots as ES modules with their tests beside them. Runs from Docker (nginx), `python3 serve.py`, or
GitHub Pages (`.github/workflows/pages.yml`).

## Commands

```bash
node --test          # every test (Node 18+): rules, scoring, bidding engine, robot play, mahjong solvability
python3 serve.py     # http://localhost:8080 (ES modules don't load from file://)
docker compose up -d # http://<host>:8080
```

## Agent skills

### Issue tracker

Issues and specs live in this repo's GitHub Issues (`gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

The five default triage labels (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`). See
`docs/agents/triage-labels.md`.

### Domain docs

Single-context: `GLOSSARY.md` and `docs/adr/` at the repo root, created when terms or decisions are settled. See
`docs/agents/domain.md`.

### Plugins

`.claude/settings.json` enables, for everyone who opens this repo in Claude Code, from the official marketplace:
superpowers, feature-dev, pr-review-toolkit, code-simplifier, security-guidance and mattpocock-skills.
