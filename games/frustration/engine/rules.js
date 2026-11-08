// The house rules, as printed on the Frustration score sheet. Everything the rest of the game needs to know about
// "which variant" lives here, so a different family's rules are a second object like this one, not code changes.
export const SHEET_RULES = {
  id: 'sheet',
  name: 'Frustration (score-sheet rules)',
  // the 13 contracts, word for word from the sheet (5 and 9 are printed the same)
  contracts: [
    '2 Books of 3', '2 Runs of 3', '1 Book+1 Run of 3', 'Run of 4+book of3', 'Book of 4+Run of3',
    '2 Books of 4', '2 Runs of 4', 'Run of 5+Book of3', 'Book of 4+Run of 3', '3 Books of 3',
    '3 Runs of 3', '1 Run of 7', '1 Book of 7',
  ],
  decks: 2,                 // "2 decks of cards"
  jokersPerDeck: 2,         // standard decks carry two jokers; the sheet makes them wild
  handSize: 10,             // "10 cards per person"
  wildRanks: [2],           // "duces & jokers are wild cards" (jokers are always wild)
  aceLow: false,            // "ace is high only": no A-2-3
  // penalty for each card left in hand: "aces, duces & jokers - 50, ten to king - 10, three to nine - 5"
  points: c => (c.joker || c.r === 14 || c.r === 2 ? 50 : c.r >= 10 ? 10 : 5),
  // Not on the sheet; common contract-rummy practice, kept here so they're easy to change:
  minNaturals: 1,           // every book or run needs at least one natural card (it fixes the book's rank / run's suit)
  layOffAfterDown: true,    // you may add to any melds on the table only once your own contract is down
  goOutWithoutDiscard: true,// playing your last card onto the table ends the round; no final discard needed
  maxReshuffles: 2,         // the discards are reshuffled into a new stock this many times, then the round is called
};

export const DEFAULT_RULES = SHEET_RULES;
