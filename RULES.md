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

Monte does not grant normal opening rights, even if a player was open before activating it. Replacing a table Joker is forbidden during Monte. A player who already replaced a Joker that turn cannot switch to Monte. The system checks the finish automatically after discarding; no second confirmation is needed.

**Declare Monte** remains the separate restart-request control.

## Ace points and win value

Ace scores 1 in a low-Ace sequence such as A–2–3, and 11 in a high-Ace sequence or a same-rank group. Three Aces score 33. Together with a valid 3–3–3 group (9 points), or a same-suit 2–3–4 sequence (9 points), they make 42 and satisfy the 41-point opening.

A normal finish is single. Monte is double. A final Joker discard makes a normal finish double. Monte with a final Joker discard is still double: the maximum is double, with no quadruple win.

## Joker replacement and elimination cleanup

Joker replacement requires normal open status earned through one of the three opening methods. The exact represented card must replace the Joker. The player must finish that same turn with a final discard, or be eliminated.

Elimination removes all of the player’s opened combinations and their contributions to other players’ combinations, including cards placed through Joker replacement. Valid remaining combinations stay with recalculated points and display. If removal leaves an invalid group or sequence, that entire combination is cleared. Removed table cards go to the discard pile, as in the existing elimination behavior. Surviving players keep their earned open status.

New combinations and additions record the contributing player, and multiplayer saves this information. Existing combinations without contribution history are treated as their owner’s cards; start a fresh match to track every addition accurately.

## Telegram

`/start` opens the current game; `/help` and `/rules` explain the three openings, same-turn Joker/Monte obligation, and elimination cleanup. Private chats use the Mini App button; group chats use a regular game link. Delivery failures return HTTP 503 so Telegram can retry. Health checks return HTTP 503 when the bot token is missing. The in-game How to Play button displays these rules too.

## Implementation and validation

The active browser modules are under `js/`; legacy root copies of changed modules are kept identical. Online turn actions save shared state and the acting player's hand in one Firestore transaction, with a revision check to reject stale actions. Other players' modified combinations are saved too.

Run regression checks with `node --test tests/rules.test.cjs`. Telegram handler checks run with `python -m unittest discover -s tests -p '*_test.py'`. They mock outgoing messages and do not send anything to users. Tests use an in-memory Firestore stand-in; they do not establish the deployed database's permissions or replace a real two-device match.

Empty-deck behavior and multiplayer restart voting remain unchanged.
