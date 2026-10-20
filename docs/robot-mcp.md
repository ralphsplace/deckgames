# Robot MCP contract (v0)

Deck Games can ask an external **MCP server** to play the robot seats in Bridge and Mahjong Table. If no server is
configured, or anything goes wrong, the built-in JavaScript robots play instead, so the games never depend on it.

## Connecting
- In the browser: click the **Robots** chip in a game header and paste the server URL, or open a game with
  `?robots=http://host:port/` (remembered; `?robots=off` clears it). One setting covers all games.
- Transport: MCP **Streamable HTTP**: JSON-RPC 2.0 over `POST` to that URL. The client sends `initialize`,
  `notifications/initialized`, then `tools/call`. JSON replies and `text/event-stream` replies are both accepted.
  `Mcp-Session-Id` is honoured if the server sets it.
- **CORS** is required because the games run in a browser. Send `Access-Control-Allow-Origin`, allow headers
  `Content-Type, Accept, Mcp-Session-Id, Mcp-Protocol-Version`, answer `OPTIONS`, and expose `Mcp-Session-Id`.
- **Mixed content:** a page served over https (GitHub Pages) may call `http://localhost` but not `http://<lan-ip>`. For a
  NAS on the LAN, use the Docker/nginx copy of the site (http), or put the MCP server behind https.

## Fallback rules (what the games guarantee)
A call falls back to the built-in robot when: no URL is set; the server is unreachable; it does not answer within 2 s;
it returns an error or `isError`; or its answer is not a legal move (validated by the game). After 2 consecutive
failures the server is paused for 30 s (chip shows "built-in (MCP down)"), then tried again. Games never stall.

## Tools
Results may be returned as `structuredContent` or as one JSON text block. All fields below are JSON.

### `bridge_choose_call`
Input: `{ seat, hand:["SA","HT","D2",...], dealer, auction:[{seat, call, alert}], vulnerability:{NS,EW}|null, board, system }`
Calls: `"P"`, `"X"`, `"XX"`, `"1C"`..`"7N"` (strains C D H S N). Cards: suit `S H D C` + rank `A K Q J T 9..2`.
Output: `{ call, alert? }`. `alert` is shown to the human on hover (e.g. "15-17 HCP, balanced"). Must be legal.

### `bridge_choose_play`
Input: `{ actor, seat, hand, visible:{seat:[cards]}, legal:[cards], contract:{level,strain,declarer,dbl}, trump, dummy,
trick:[{seat,card}], history:[{winner,trick}], tricks:{NS,EW}, vulnerability }`
`seat` is whose card is played; `actor` is who decides (declarer plays dummy's cards). `visible` holds only the hands the
actor may see (own hand, dummy once it is down, and dummy for the declarer).
Output: `{ card }`, one of `legal`.

### `mahjong_choose_discard`
Input: the **mahjong view** (below) plus `riichiOptions:[tiles]` (discards that would declare riichi, Riichi only).
Output: `{ tile, riichi? }`. `tile` must be in `hand`; after riichi it must equal `drawn`.

### `mahjong_choose_claim`
Input: mahjong view plus `options:{ win, pung, kong, chows:[[t,t],...] }` for the tile in `lastDiscard`.
Output: `{ action: "win"|"pung"|"kong"|"chow"|"pass", use? }` (`use` = the two hand tiles for a chow, one of `options.chows`).

### `mahjong_choose_self`
Called after the robot draws, before it discards. Input: mahjong view plus `options:{ win, concealedKongs:[t], addKongs:[t] }`.
Output: `{ action: "win"|"kong"|"none", tile? }`.

### Mahjong view
Tiles are strings: `c1-c9` characters, `d1-d9` dots, `b1-b9` bamboo, `E S W N` winds, `R G P` dragons (red, green, white),
`F1-F4` flowers, `T1-T4` seasons.
```
{ variant: "hk"|"riichi", seat, dealer, roundWind, seatWind,        // winds: 0=E 1=S 2=W 3=N
  hand:[...], drawn: tile|null, melds:[{type:"chow"|"pung"|"kong", tiles, open}], bonus:[...],
  players:[{ seat, seatWind, handCount, melds, bonus, discards, river, riichi }],   // 4 entries, incl. you
  lastDiscard:{tile, from}|null, wallLeft, doraIndicators:[...], honba, riichiSticks, scores:[4]|null }
```
Other players' concealed tiles are never sent.

## Try it
`node tools/mcp-stub/server.mjs --port 8787` runs a **stub** with the right shape and legal-but-dumb moves (pass, play the
last legal card, discard the drawn tile). Copy it into the real server repo and replace the five functions in `tools`.
`shared/robots/robots.test.js` shows how the client is exercised end to end (including failure cases).
