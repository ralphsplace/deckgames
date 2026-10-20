# Deck Games

Offline-first card and tile games, served as plain static files. No logins, no daily limits, no network calls.

| Game | Status |
|---|---|
| Solitaire (Klondike, draw 1 / 3) | done |
| Bridge, "Just declare" mode (robots bid, you declare) | done, v1 |
| Bridge, "Bid & play" mode (you bid South against robots) | done, v1 |
| Mahjong Solitaire (turtle layout, always-solvable deals) | done |
| Mahjong Table: 4 players, you vs 3 robots, Hong Kong rules | done, v1 |
| Mahjong Table: Riichi variant (to become the default) | planned |

## Run it
- **Docker (NAS):** `docker compose up -d`, then open `http://<host>:8080`
- **No Docker:** `python3 serve.py` (opens http://localhost:8080). Do not double-click the .html files: the bridge and
  mahjong pages use ES modules, which browsers block on `file://`.
- **GitHub Pages:** push to `main`; `.github/workflows/pages.yml` runs the tests, then publishes the site.
  All paths are relative, so it works under `https://<user>.github.io/<repo>/`.

## Test it
`node --test` from this folder (Node 18+). Covers bridge rules, scoring, auction legality, the bidding engine (1,500
simulated auctions, all legal, calibrated against combined HCP), 100+ robot-played boards, and the mahjong rules and
solvability of every deal.

## Mahjong Table
One game with a selectable ruleset (the "Rules" box). Hong Kong is first; Riichi shares the same core (wall, draw/discard,
claims, hand analysis, robots) and will be added as `engine/rules/riichi.js`, then made the default in
`engine/rules/index.js`. Hong Kong v1: 144 tiles, flowers/seasons, 3-faan minimum, 10-faan limit, East round (extended
when the dealer wins or the hand is drawn). Faans: common hand, all pungs, one-suit (mixed/pure), dragon and wind pungs,
small/big three dragons, flowers, concealed, self-drawn, last tile, replacement tile, limit hands (thirteen orphans, all
honors, four winds). Payments: self-draw, every opponent pays; by discard, the discarder pays. Not yet: robbing the kong,
kong payments, seven pairs, multiple round winds. Robots only declare a win that meets the minimum.

## Robots and MCP
Every robot decision goes through `shared/robots/`: it asks an optional **MCP robot server** first and falls back to the
built-in JS robots on any failure (unset, unreachable, slow, error, or an illegal answer). Set the server with the
**Robots** chip in a game header or `?robots=<url>`. Contract: `docs/robot-mcp.md`. Reference stub:
`node tools/mcp-stub/server.mjs`.

## Layout
```
deckgames/
  index.html                  menu
  package.json                {"type":"module"} + test script
  shared/                     cards.css, cardview.js (draws a card), rng.js (seedable random)
    robots/                   MCP client + fallback, bridge/mahjong adapters, header chip
  tools/mcp-stub/             reference MCP robot server (stub)
  docs/robot-mcp.md           MCP robot contract
  games/
    solitaire/index.html
    mahjong/
      index.html              board UI (hint, undo, shuffle, restart deal, best time)
      faces.js                tile drawings as inline SVG (no fonts/images)
      engine/layout.js        board layouts (turtle, 144 tiles)
      engine/tiles.js         tile set and matching rule
      engine/game.js          free-tile rule, reverse-built solvable deals, undo, shuffle
      mahjong.test.js
    mahjong-table/
      index.html              4-player table UI, claim buttons, results screen, variant selector
      engine/tiles.js hand.js round.js match.js   ruleset-agnostic core (shanten, claims, dealer rotation)
      engine/rules/           hk.js (scoring + payments), index.js (variant registry, default)
      ai/robot.js             discards, claims, wins
      mahjong-table.test.js
    bridge/
      index.html              table UI: mode switch, auction grid, bidding box, alerts on hover/click
      engine/                 pure rules, no DOM: cards, auction, play, scoring, table (modes 'declare' and 'full')
      ai/
        bidder.js             entry point: (hand, auction, seat) => call
        hand.js               HCP + "total points" evaluation
        open.js  respond.js  rebid.js  compete.js   rule tables
        judge.js              fallback: estimate combined strength + fit, pick a target contract
        meaning.js            what each call promises; reads human calls naturally
        contract.js           Just-declare provider: robots bid, deal is rotated so you declare
        player.js             heuristic card play
      engine.test.js  bidder.test.js
  Dockerfile  docker-compose.yml  .dockerignore  serve.py
  .github/workflows/pages.yml  .nojekyll
```

## Bridge robots: what they know (v1) and what they don't
Style follows the Bridge Base robot notes: 2/1 game force, 5-card majors, 15-17 notrump, strong artificial 2C, weak twos.
- **Bid:** all openings; responses incl. raises, Jacoby 2NT, 2/1, inverted minor raises; Stayman and Jacoby transfers over
  1NT/2NT; opener rebids and simple game tries; overcalls, weak jump overcalls, takeout and negative doubles; competing by
  the law of total tricks; game and slam chosen from an estimate of combined strength and fit.
- **Not yet:** Blackwood/RKCB and cue bids (slams are bid directly on strength), Texas transfers, Smolen, Lebensohl,
  Michaels/Unusual NT, Cappelletti, most penalty doubles, detailed continuations after interference.
- **Play:** heuristic (sensible leads, cover/duck/discard), not GIB-style double-dummy simulation.
- **Alerts:** robot calls that carry a meaning show it on hover/click in the auction grid.
