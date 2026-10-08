# Confirmed opening and Monte rules

## Turn order

The starting player receives 14 cards and discards first. Everyone else receives 13 cards. Subsequent turns start with drawing from the deck or taking the top discard, then playing cards, then discarding. Playing combinations, adding cards, and replacing Jokers require the draw/take step first. Every winning turn requires a final discard.

## Opening

A player may remain closed during a normal turn. Once they lay down an opening combination, they must satisfy an opening condition before that turn's discard; otherwise they are eliminated. Smaller openings cannot accumulate across turns.

Any of these conditions grants the same permanent open status and rights to take discards and add to combinations:

1. One or more valid combinations totaling at least 41 points.
2. Three valid combinations, even below 41 points.
3. One valid four-image combination: same-suit J-Q-K-A, or a four-card group of Jacks, Queens, Kings, or Aces obeying the group rules. A Joker may substitute for a card under the normal combination rules.

Pairs do not count toward normal opening. Existing sequence/group validation still applies, including alternating group colors and at most one Joker per combination.

The existing take-while-closed behavior is retained: taking the top discard commits the player to opening in that turn. Failing to open eliminates them at discard. They may instead activate Monte Win after taking it, which commits them to the Monte finish below.

## Monte Win

Only tapping **Monte Win** activates a Monte attempt, and it belongs to the player whose turn it is. The player must win that turn or be eliminated at discard.

A valid finish has exactly five two-card identical pairs plus one valid three-card sequence or group, totaling 13 table cards, and an empty hand after the final discard. One ordinary card paired with a Joker is a valid pair. Two Jokers are not a valid pair.

Replacing a table Joker is forbidden during Monte. A player who already replaced a Joker that turn cannot switch to Monte. The system checks the finish automatically after discarding; no second confirmation is needed.

**Declare Monte** remains the separate restart-request control.

## Implementation and validation

The active browser modules are under `js/`; legacy root copies of changed modules are kept identical. Online turn actions save shared state and the acting player's hand in one Firestore transaction, with a revision check to reject stale actions. Other players' modified combinations are saved too.

Run regression checks with `node --test tests/rules.test.cjs`. Tests use an in-memory Firestore stand-in; they do not establish the deployed database's permissions or replace a real two-device match.

Ace point values, win multipliers, empty-deck behavior, and multiplayer restart voting are unchanged by this update.
