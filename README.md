# Deck Games

Offline-first card and tile games, served as plain static files. No logins, no daily limits, no network calls.

| Game | Status |
|---|---|
| Solitaire (Klondike, draw 1 / 3; cards fly to the foundations by themselves once the stock and waste are empty) | done |
| Bridge, "Just declare" mode (robots bid, you declare) | done, v1 |
| Bridge, "Bid & play" mode (you bid South against robots) | done, v1 |
| Mahjong Solitaire (turtle layout, always-solvable deals) | done |
| Mahjong Table: 4 players, you vs 3 robots, Hong Kong rules | done, v1 |
| Mahjong Table: Riichi variant (default) | done, v1 (branch `riichi-variant`) |

## Run it
- **Docker (NAS):** `docker compose up -d`, then open `http://<host>:8080`
- **No Docker:** `python3 serve.py` (opens http://localhost:8080). Do not double-click the .html files: the bridge and
  mahjong pages use ES modules, which browsers block on `file://`.
- **GitHub Pages:** push to `main`; `.github/workflows/pages.yml` runs the tests (on pull requests too), then publishes the site. `site.sh` lists the
  files that make up the site, for Pages and the Docker image alike.
  All paths are relative, so it works under `https://<user>.github.io/<repo>/`.

## Test it
`node --test` from this folder (Node 18+). Covers bridge rules, scoring, auction legality, the bidding engine (1,500
simulated auctions, all legal, calibrated against combined HCP), 100+ robot-played boards, and the mahjong rules and
solvability of every deal.

## Mahjong Table
One game with a selectable ruleset (the "Rules" box): **Riichi** (default) and **Hong Kong**. Both share one core (wall,
draw/discard, claims, hand analysis, robots); a variant is a file in `engine/rules/` registered in `engine/rules/index.js`.
- **Riichi:** 136 tiles, riichi (with ippatsu), dora and ura dora, furiten, han/fu scoring with mangan to yakuman limits,
  honba and riichi sticks, tenpai payments on a draw, East round. Yaku: riichi, tsumo, pinfu, tanyao, yakuhai, iipeikou,
  ryanpeikou, sanshoku (both), ittsu, toitoi, sanankou, sankantsu, chiitoitsu, chanta, junchan, honitsu, chinitsu,
  honroutou, shousangen, haitei/houtei, rinshan; yakuman: kokushi, suuankou, daisangen, tsuuiisou, chinroutou, ryuuiisou,
  shousuushii, daisuushii. Not yet: red fives, double riichi, tenhou/chiihou, chankan, pao, abortive draws, chuuren.
- **Hong Kong:** 144 tiles with flowers and seasons, 3-faan minimum, 10-faan limit. Faans: common hand, all pungs, one-suit,
  dragon/wind pungs, three dragons, flowers, concealed, self-drawn, last tile, replacement tile, limit hands.
  Not yet: robbing the kong, kong payments, seven pairs.
- Robots only declare wins that are legal under the active ruleset; they declare riichi, play defensively against riichi.

## Layout
```
deckgames/
  index.html                  menu
  package.json                {"type":"module"} + test script
  shared/                     cards.css, cardview.js (draws a card), rng.js (seedable random)
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
      engine/rules/           hk.js, riichi.js (yaku, fu, payments), index.js (variant registry, default)
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
  site.sh                    the files that make up the site (Pages and Docker)
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
