(function () {
'use strict';
const TR = window.TigrayRamino;

TR.validateSeq = function (cards) {
    if (cards.length < 3) return {valid:false, reason:'Minimum 3 cards'};

    const non = cards.filter(c => !TR.isJoker(c));
    const jok = cards.filter(c => TR.isJoker(c));

    if (jok.length > 1) return {valid:false, reason:'Only 1 joker allowed'};
    if (non.length === 0) return {valid:false, reason:'Need at least one real card'};

    const suit = non[0].suit;
    if (!non.every(c => c.suit === suit))
        return {valid:false, reason:'Must be same suit'};

    function check(aceHigh) {
        const vals = non
            .map(c => TR.numVal(c.rank, aceHigh))
            .filter(v => v !== null)
            .sort((a,b) => a-b);

        if (new Set(vals).size !== vals.length) return null;

        if (jok.length === 0) {
            for (let i=1; i<vals.length; i++) {
                if (vals[i]-vals[i-1] !== 1) return null;
            }
            return {min:vals[0], max:vals[vals.length-1]};
        }

        let internalGap = false;

        for (let i=1; i<vals.length; i++) {
            const gap = vals[i]-vals[i-1];
            if (gap === 1) continue;
            if (gap === 2 && !internalGap) {
                internalGap = true;
                continue;
            }
            return null;
        }

        if (internalGap) return {min:vals[0], max:vals[vals.length-1]};
        return {min:vals[0], max:vals[vals.length-1]+1};
    }

    let r = check(false);
    let aceHigh = false;
    if (!r) {
        r = check(true);
        aceHigh = true;
    }
    if (!r) return {valid:false, reason:'Not consecutive'};

    let pts = 0;
    for (let v=r.min; v<=r.max; v++) {
        let found = null;
        for (const rk of TR.RANKS) {
            if (TR.numVal(rk, aceHigh) === v) {
                found = rk;
                break;
            }
        }
        if (found) pts += TR.scoreVal(found);
    }

    return {valid:true, points:pts, min:r.min, max:r.max, aceHigh};
};

TR.validateGroup = function (cards) {
    if (cards.length < 3) return {valid:false, reason:'Minimum 3 cards'};
    if (cards.length > 4) return {valid:false, reason:'Max 4 cards'};

    const non = cards.filter(c => !TR.isJoker(c));
    const jok = cards.filter(c => TR.isJoker(c));

    if (jok.length > 1) return {valid:false, reason:'Only 1 joker allowed'};
    if (non.length === 0) return {valid:false, reason:'Need at least one real card'};

    const rank = non[0].rank;
    if (!non.every(c => c.rank === rank))
        return {valid:false, reason:'Must be same rank'};

    const suits = non.map(c => c.suit);
    if (new Set(suits).size !== suits.length)
        return {valid:false, reason:'Suits must be distinct'};

    if (jok.length === 0) {
        const colors = cards.map(c => TR.getSuitColor(c.suit));
        const startColor = colors[0];
        const expected = colors.map((_,i) =>
            i%2===0 ? startColor :
            (startColor==='red' ? 'black' : 'red')
        );

        if (!colors.every((c,i) => c===expected[i])) {
            return {
                valid:false,
                reason:cards.length===3
                    ? '3-card group must alternate red-black-red or black-red-black'
                    : '4-card group must alternate red-black-red-black'
            };
        }

        return {valid:true, points:cards.length*TR.scoreVal(rank), rank};
    }

    const jokerIndex = cards.findIndex(c => TR.isJoker(c));

    if (cards.length === 3) {
        if (jokerIndex === 1) {
            const left = cards[0], right = cards[2];
            const leftColor = TR.getSuitColor(left.suit);
            const rightColor = TR.getSuitColor(right.suit);

            if (leftColor !== rightColor) {
                return {
                    valid:false,
                    reason:'Joker in the middle requires the two real cards to have the same color.'
                };
            }

            const requiredColor = leftColor === 'red' ? 'black' : 'red';
            const possibleSuits = TR.SUITS.filter(suit =>
                TR.getSuitColor(suit) === requiredColor &&
                !non.some(c => c.suit === suit)
            );

            if (!possibleSuits.length)
                return {valid:false, reason:'No valid suit remains for the Joker.'};

            // Deterministic choice: the first remaining suit.
            const chosenSuit = possibleSuits[0];

            return {
                valid:true,
                points:cards.length*TR.scoreVal(rank),
                rank,
                jokerRepresentation:{rank, suit:chosenSuit}
            };
        }

        const real1 = jokerIndex===0 ? cards[1] : cards[0];
        const real2 = jokerIndex===0 ? cards[2] : cards[1];
        const color1 = TR.getSuitColor(real1.suit);
        const color2 = TR.getSuitColor(real2.suit);

        if (color1 === color2) {
            return {
                valid:false,
                reason:'Joker at the start or end requires the two real cards to have different colors.'
            };
        }

        const requiredColor = jokerIndex===0 ? color2 : color1;
        const possibleSuits = TR.SUITS.filter(suit =>
            TR.getSuitColor(suit) === requiredColor &&
            !non.some(c => c.suit === suit)
        );

        if (possibleSuits.length !== 1) {
            return {
                valid:false,
                reason:'Could not determine the exact Joker representation.'
            };
        }

        return {
            valid:true,
            points:cards.length*TR.scoreVal(rank),
            rank,
            jokerRepresentation:{rank, suit:possibleSuits[0]}
        };
    }

    if (cards.length === 4) {
        const colors = cards.map(c => TR.isJoker(c) ? null : TR.getSuitColor(c.suit));
        const patternRed = ['red','black','red','black'];
        const patternBlack = ['black','red','black','red'];

        function matchesPattern(pattern) {
            return colors.every((color,index) =>
                color === null || color === pattern[index]
            );
        }

        const validRed = matchesPattern(patternRed);
        const validBlack = matchesPattern(patternBlack);

        if (!validRed && !validBlack) {
            return {
                valid:false,
                reason:'4-card group must alternate red-black-red-black or black-red-black-red in the exact order played.'
            };
        }

        const pattern = validRed ? patternRed : patternBlack;
        const requiredColor = pattern[jokerIndex];

        const possibleSuits = TR.SUITS.filter(suit =>
            TR.getSuitColor(suit) === requiredColor &&
            !non.some(c => c.suit === suit)
        );

        if (possibleSuits.length !== 1) {
            return {
                valid:false,
                reason:'Could not determine the exact Joker representation.'
            };
        }

        return {
            valid:true,
            points:cards.length*TR.scoreVal(rank),
            rank,
            jokerRepresentation:{rank, suit:possibleSuits[0]}
        };
    }

    return {valid:false, reason:'Invalid group.'};
};

TR.validatePair = function (cards) {
    if (cards.length !== 2) return {valid:false, reason:'Must be exactly 2 cards'};
    const c0=cards[0], c1=cards[1];

    if (TR.isJoker(c0) && TR.isJoker(c1))
        return {valid:false, reason:'Two jokers not allowed as pair'};

    if (TR.isJoker(c0) && !TR.isJoker(c1))
        return {valid:true, points:TR.scoreVal(c1.rank), isJokerPair:true};

    if (!TR.isJoker(c0) && TR.isJoker(c1))
        return {valid:true, points:TR.scoreVal(c0.rank), isJokerPair:true};

    if (c0.rank===c1.rank && c0.suit===c1.suit) {
        return {valid:true, points:2*TR.scoreVal(c0.rank), isJokerPair:false};
    }

    return {valid:false, reason:'Cards must be identical or one joker'};
};

TR.comboType = function (cards) {
    if (cards.length===2) return TR.validatePair(cards).valid ? 'pair' : 'unknown';
    const non=cards.filter(c=>!TR.isJoker(c));
    if (!non.length) return 'unknown';
    if (non.every(c=>c.rank===non[0].rank)) return 'group';
    if (non.every(c=>c.suit===non[0].suit)) return 'sequence';
    return 'unknown';
};
})();