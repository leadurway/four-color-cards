import { Card, CardColor, RevealedMeld } from './types';

export function createDeck(): Card[] {
  const deck: Card[] = [];
  const colors: CardColor[] = ['red', 'yellow', 'green', 'white'];
  
  colors.forEach(color => {
    let chars: string[] = [];
    if (color === 'red' || color === 'yellow') {
      chars = ['帥', '仕', '相', '俥', '傌', '炮', '兵'];
    } else {
      chars = ['將', '士', '象', '車', '馬', '包', '卒'];
    }
    
    chars.forEach((char, index) => {
      const order = index + 1;
      const colorChar = color === 'red' ? '紅' : color === 'yellow' ? '黃' : color === 'green' ? '綠' : '白';
      const name = `${colorChar}${char}`;
      // Each card has 4 copies in a deck (Total 112 cards)
      for (let i = 0; i < 4; i++) {
        deck.push({
          id: `${color}-${char}-${i}`,
          color,
          character: char,
          order,
          name,
        });
      }
    });
  });
  return deck;
}

export function shuffle(deck: Card[]): Card[] {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
}

/**
 * Pairs Mode Grouping
 * Group cards into:
 * - Concealed Quads (Count = 4)
 * - Concealed Triples (Count = 3)
 * - Pairs (Count = 2)
 * - Strays (Count = 1)
 */
export interface PairsGrouping {
  quads: Card[][];
  triples: Card[][];
  pairs: Card[][];
  strays: Card[];
}

// For 10-card pairs mode: triple = 1 pair + 1 stray; quad = 2 pairs.
// quads/triples arrays are always empty after decomposition.
export function groupPairsMode(hand: Card[]): PairsGrouping {
  const groupsMap: { [key: string]: Card[] } = {};
  hand.forEach(card => {
    const key = `${card.color}-${card.character}`;
    if (!groupsMap[key]) groupsMap[key] = [];
    groupsMap[key].push(card);
  });

  const pairs: Card[][] = [];
  const strays: Card[] = [];

  Object.values(groupsMap).forEach(rawCards => {
    // Which specific physical card ends up "the pair" vs "the stray" within a
    // 3-of-a-kind group must depend only on WHICH cards are in the group, never
    // on where they happen to sit in `hand` — hand gets re-sorted after every
    // draw/discard (sortHandForDisplay), so grouping off raw array order would
    // let an unrelated draw/discard reshuffle which card of an EXISTING,
    // untouched group gets called the stray. Sorting by id first makes the
    // pair/stray assignment a pure function of the card set.
    const cards = [...rawCards].sort((a, b) => a.id.localeCompare(b.id));
    const n = cards.length;
    if (n >= 4) {
      pairs.push([cards[0], cards[1]]);
      pairs.push([cards[2], cards[3]]);
      for (let i = 4; i < n; i++) strays.push(cards[i]);
    } else if (n === 3) {
      pairs.push([cards[0], cards[1]]);
      strays.push(cards[2]);
    } else if (n === 2) {
      pairs.push(cards);
    } else {
      strays.push(cards[0]);
    }
  });

  strays.sort((a, b) => {
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return a.order - b.order;
  });

  return { quads: [], triples: [], pairs, strays };
}

// ── 15-card mode: check if hand can be partitioned into valid trios ──

export type TrioType = 'sameChar' | 'sequence' | 'rainbow';

// Classifies a 3-card group against the 3 valid 15-card trio shapes, or returns
// null if it doesn't form a valid group at all. `isValidTrio` and the 台數 scoring
// engine (`scorePairsWin`) both build on this single source of truth so the
// win-condition check and the scoring breakdown can never disagree on what counts
// as a valid/typed trio.
export function classifyTrio(a: Card, b: Card, c: Card): TrioType | null {
  // Type 1 (sameChar): same color, same character (3 identical)
  if (a.color === b.color && b.color === c.color &&
      a.character === b.character && b.character === c.character) return 'sameChar';

  // Type 2 (sequence): same color, consecutive sequence (orders 1-2-3 or 4-5-6)
  if (a.color === b.color && b.color === c.color) {
    const orders = [a.order, b.order, c.order].sort((x, y) => x - y);
    if ((orders[0] === 1 && orders[1] === 2 && orders[2] === 3) ||
        (orders[0] === 4 && orders[1] === 5 && orders[2] === 6)) return 'sequence';
  }

  // Type 3 (rainbow): same rank (order), 3 different colors.
  // NOTE: `character` is the literal glyph, which only ever spans 2 colors —
  // red/yellow share one glyph set (帥仕相俥傌炮兵), green/white share a different
  // one (將士象車馬包卒). `order` (1-7) is the actual cross-color rank (e.g. 帥/將
  // are both order 1), so cross-color matching must compare `order`, not `character`.
  if (a.order === b.order && b.order === c.order) {
    const colors = new Set([a.color, b.color, c.color]);
    if (colors.size === 3) return 'rainbow';
  }

  return null;
}

function isValidTrio(a: Card, b: Card, c: Card): boolean {
  return classifyTrio(a, b, c) !== null;
}

// `color`+`order` fully determines everything isValidTrio checks (character is a
// pure function of color+order, so it adds no extra information) — two cards with
// the same color+order are fully interchangeable for validity purposes. Memoizing
// on this canonical multiset key collapses the many different id-selections that
// lead to the same remaining set of cards, which matters a lot here: fixing Type 3
// to compare `order` instead of `character` (see above) made it match far more
// often than before (same-rank cards across colors are common), which without
// memoization blows up the branching factor of this backtracking search enough to
// noticeably stall on a 12-15 card hand.
function cardMultisetKey(cards: Card[]): string {
  return cards.map(c => `${c.color}${c.order}`).sort().join(',');
}

function partitionIntoTrios(cards: Card[], memo: Map<string, boolean> = new Map()): boolean {
  if (cards.length === 0) return true;
  if (cards.length % 3 !== 0) return false;

  const key = cardMultisetKey(cards);
  const cached = memo.get(key);
  if (cached !== undefined) return cached;

  const [first, ...rest] = cards;
  let result = false;
  for (let i = 0; i < rest.length - 1 && !result; i++) {
    for (let j = i + 1; j < rest.length && !result; j++) {
      if (isValidTrio(first, rest[i], rest[j])) {
        const remaining = rest.filter((_, idx) => idx !== i && idx !== j);
        if (partitionIntoTrios(remaining, memo)) result = true;
      }
    }
  }
  memo.set(key, result);
  return result;
}

export function checkTriosWin(hand: Card[]): boolean {
  return hand.length > 0 && hand.length % 3 === 0 && partitionIntoTrios(hand);
}

// Like `checkTriosWin`, but returns the actual partition (which 3 cards make up
// each of the 5 groups) instead of just a boolean. Used by the 台數 scoring engine
// (`scorePairsWin`) to classify each group's type and tally per-category bonuses —
// `checkTriosWin` itself doesn't need this and stays a cheap boolean check for the
// hot draw/claim path. Not memoized: unlike `partitionIntoTrios`, this only ever
// runs once, at the moment of an actual win, where a valid partition is already
// known to exist, so the search settles quickly without needing the memo table.
export function partitionTriosWithGroups(cards: Card[]): Card[][] | null {
  if (cards.length === 0) return [];
  if (cards.length % 3 !== 0) return null;

  const [first, ...rest] = cards;
  for (let i = 0; i < rest.length - 1; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      if (isValidTrio(first, rest[i], rest[j])) {
        const remaining = rest.filter((_, idx) => idx !== i && idx !== j);
        const restPartition = partitionTriosWithGroups(remaining);
        if (restPartition !== null) {
          return [[first, rest[i], rest[j]], ...restPartition];
        }
      }
    }
  }
  return null;
}

// ── 15-card mode: "組" hint for hand display ──
// Greedily finds non-overlapping trios among the 3 valid types. Returns the actual
// groups (not just a flat id set) so callers can both lock discard on these cards
// and keep each group's 3 cards seated together in the display order.
export function find15TrioHints(hand: Card[]): Card[][] {
  const used = new Set<string>();
  const groups: Card[][] = [];

  // a. 同色同字三張
  const byKey: { [key: string]: Card[] } = {};
  hand.forEach(c => {
    const key = `${c.color}-${c.character}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(c);
  });
  Object.values(byKey).forEach(cards => {
    if (cards.length >= 3) {
      const group = cards.slice(0, 3);
      group.forEach(c => used.add(c.id));
      groups.push(group);
    }
  });

  // b. 同色序列：將士象 (order 1-3) 或 車馬包 (order 4-6)
  const colors: CardColor[] = ['red', 'yellow', 'green', 'white'];
  colors.forEach(color => {
    [[1, 2, 3], [4, 5, 6]].forEach(seq => {
      const found: Card[] = [];
      seq.forEach(o => {
        const card = hand.find(c => c.color === color && c.order === o && !used.has(c.id) && !found.includes(c));
        if (card) found.push(card);
      });
      if (found.length === 3) {
        found.forEach(c => used.add(c.id));
        groups.push(found);
      }
    });
  });

  // c. 同階不同色三張 (比對 order，跨色系)
  const byOrder: { [order: number]: Card[] } = {};
  hand.forEach(c => {
    if (used.has(c.id)) return;
    if (!byOrder[c.order]) byOrder[c.order] = [];
    byOrder[c.order].push(c);
  });
  Object.values(byOrder).forEach(cardsForOrder => {
    // Keep extracting groups from this rank's remaining cards until fewer than
    // 3 colors are left — a single pass here would stop after the first group
    // even when there are enough spare copies (e.g. 2 red + 2 yellow + 1
    // green + 1 white all at the same rank) to form a SECOND, independent
    // rainbow trio out of what's left over. That gap is exactly what let a
    // real completable group (e.g. 紅相／黃相／白象) sit unrecognized in the
    // strays while a different rainbow group at the same rank (紅相／黃相／
    // 綠象) had already been formed from the other copies.
    let remaining = cardsForOrder;
    for (;;) {
      const colorMap = new Map<CardColor, Card>();
      remaining.forEach(c => { if (!colorMap.has(c.color)) colorMap.set(c.color, c); });
      if (colorMap.size < 3) break;
      const group = Array.from(colorMap.values()).slice(0, 3);
      group.forEach(c => used.add(c.id));
      groups.push(group);
      remaining = remaining.filter(c => !used.has(c.id));
    }
  });

  return groups;
}

// Cards already sitting in a complete "組" hint (find15TrioHints) are spoken for —
// they shouldn't also be offered up to complete a *different* claim against an
// incoming trigger card. Filter them out before scanning for claimable trios.
export function excludeLockedTrioCards(hand: Card[]): Card[] {
  const locked = new Set(find15TrioHints(hand).flat().map(c => c.id));
  return hand.filter(c => !locked.has(c.id));
}

// ── 15-card mode: detect claimable trio completions (自摸 or claiming an opponent's discard) ──
export interface TrioClaimOption {
  kind: 'sameChar' | 'sequence' | 'rainbow';
  actionLabel: '碰一隻' | '吃一隻';
  cardsToUse: Card[];
  resultCards: Card[];
  meldName: string;
  meldType: 'triple' | 'consec_three' | 'different_colors';
}

const colorName = (color: CardColor) =>
  color === 'red' ? '紅' : color === 'yellow' ? '黃' : color === 'green' ? '綠' : '白';

export function checkTrioClaims(hand: Card[], trigger: Card): TrioClaimOption[] {
  const options: TrioClaimOption[] = [];

  // a. 同色同字三張 (碰一隻)
  const sameKeyMatches = hand.filter(c => c.color === trigger.color && c.character === trigger.character);
  if (sameKeyMatches.length >= 2) {
    const use = sameKeyMatches.slice(0, 2);
    options.push({
      kind: 'sameChar',
      actionLabel: '碰一隻',
      cardsToUse: use,
      resultCards: [trigger, ...use],
      meldName: `同色三張 [${trigger.name}*3]`,
      meldType: 'triple',
    });
  }

  // b. 同色序列：將士象 (order 1-3) 或 車馬包 (order 4-6) (吃一隻)
  if (trigger.order >= 1 && trigger.order <= 3) {
    const need = [1, 2, 3].filter(o => o !== trigger.order);
    const c1 = hand.find(c => c.color === trigger.color && c.order === need[0]);
    const c2 = hand.find(c => c.color === trigger.color && c.order === need[1] && c.id !== c1?.id);
    if (c1 && c2) {
      options.push({
        kind: 'sequence',
        actionLabel: '吃一隻',
        cardsToUse: [c1, c2],
        resultCards: [trigger, c1, c2].sort((a, b) => a.order - b.order),
        meldName: `同色將士象 [${colorName(trigger.color)}帥仕相]`,
        meldType: 'consec_three',
      });
    }
  } else if (trigger.order >= 4 && trigger.order <= 6) {
    const need = [4, 5, 6].filter(o => o !== trigger.order);
    const c1 = hand.find(c => c.color === trigger.color && c.order === need[0]);
    const c2 = hand.find(c => c.color === trigger.color && c.order === need[1] && c.id !== c1?.id);
    if (c1 && c2) {
      options.push({
        kind: 'sequence',
        actionLabel: '吃一隻',
        cardsToUse: [c1, c2],
        resultCards: [trigger, c1, c2].sort((a, b) => a.order - b.order),
        meldName: `同色車馬包 [${colorName(trigger.color)}車馬包]`,
        meldType: 'consec_three',
      });
    }
  }

  // c. 同階不同色三張 (碰一隻) — 比對 order（跨色階級），不是 character（同一色系才會共用的字形）
  const sameRankDiffColor = hand.filter(c => c.order === trigger.order && c.color !== trigger.color);
  const colorMap = new Map<CardColor, Card>();
  sameRankDiffColor.forEach(c => { if (!colorMap.has(c.color)) colorMap.set(c.color, c); });
  if (colorMap.size >= 2) {
    const use = Array.from(colorMap.values()).slice(0, 2);
    const resultCards = [trigger, ...use];
    options.push({
      kind: 'rainbow',
      actionLabel: '碰一隻',
      cardsToUse: use,
      resultCards,
      meldName: `同階異色 [${resultCards.map(c => c.name).join('')}]`,
      meldType: 'different_colors',
    });
  }

  return options;
}

/**
 * Sort hand for display: groups matching cards together (pairs/triples side-by-side),
 * highest match count first, then by color then order within each group.
 */
export function sortHandForDisplay(hand: Card[]): Card[] {
  const groups: { [key: string]: Card[] } = {};
  hand.forEach(card => {
    const key = `${card.color}-${card.character}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(card);
  });

  const sortedGroups = Object.values(groups).sort((a, b) => {
    if (b.length !== a.length) return b.length - a.length; // More matches first
    if (a[0].color !== b[0].color) return a[0].color.localeCompare(b[0].color);
    return a[0].order - b[0].order;
  });

  return sortedGroups.flat();
}

/**
 * Standard Mode Solver (backtracking DFS)
 * Checks if hand + revealed can win (Hu), and calculates total Hoo.
 */
export interface HuPartitionGroup {
  type: 'pair' | 'triple' | 'quad' | 'consec_three' | 'different_colors' | 'single_general';
  cards: Card[];
  hoo: number;
  name: string;
}

export interface HuResult {
  canHu: boolean;
  totalHoo: number;
  handGroups: HuPartitionGroup[];
  explanation: string;
}

// Check if a card is General
export function isGeneral(card: Card): boolean {
  return card.character === '帥' || card.character === '將';
}

// Convert cards list to frequency map
function getCardKey(card: Card): string {
  return `${card.color}-${card.character}`;
}

/**
 * DFS recursion to partition a list of cards.
 * We want to partition ALL remaining cards into valid sets.
 * We must use exactly one Eye (pair of identical cards) if there are non-general cards, 
 * or we can use an eye even if it contains generals.
 */
export function solveHu(handCards: Card[], revealedMelds: RevealedMeld[]): HuResult {
  let bestResult: HuResult = {
    canHu: false,
    totalHoo: 0,
    handGroups: [],
    explanation: '無法組成胡牌牌型 (未達 10 胡或手牌無法完全配對)'
  };

  // Sort hand cards to ensure consistent search
  const sortedHand = [...handCards].sort((a, b) => {
    if (a.color !== b.color) return a.color.localeCompare(b.color);
    return a.order - b.order;
  });

  // Calculate revealed Hoo values
  const revealedHooTotal = revealedMelds.reduce((sum, m) => sum + m.hoo, 0);

  // We need to trace all valid partitions.
  // We can try different pairs of identical cards as the "Eye" (對子)
  // Find all candidate identical pairs in hand to serve as the eye.
  const uniqueKeys = Array.from(new Set(sortedHand.map(getCardKey)));
  const eyeCandidates: string[] = [];
  
  uniqueKeys.forEach(key => {
    const count = sortedHand.filter(c => getCardKey(c) === key).length;
    if (count >= 2) {
      eyeCandidates.push(key);
    }
  });

  // Helper DFS function
  // Runs a backtracking search on remaining cards to form valid sets
  function search(remainingCards: Card[]): HuPartitionGroup[][] {
    if (remainingCards.length === 0) {
      return [[]];
    }

    const first = remainingCards[0];
    const results: HuPartitionGroup[][] = [];

    // Try all valid groups that INCLUDE the first card 'first'

    // 1. Single General (將 or 帥) - stands alone
    if (isGeneral(first)) {
      const group: HuPartitionGroup = {
        type: 'single_general',
        cards: [first],
        hoo: 1,
        name: `單張${first.name}`
      };
      const subSolutions = search(remainingCards.slice(1));
      subSolutions.forEach(sol => {
        results.push([group, ...sol]);
      });
    }

    const firstKey = getCardKey(first);
    const identicals = remainingCards.filter(c => getCardKey(c) === firstKey);

    // 2. Triple of identical cards (3 identical, same color)
    if (identicals.length >= 3) {
      const groupCards = identicals.slice(0, 3);
      // Remove these 3 cards
      const nextRemaining = removeCards(remainingCards, groupCards);
      const group: HuPartitionGroup = {
        type: 'triple',
        cards: groupCards,
        hoo: 3, // Concealed triple is 3 Hoo in hand
        name: `暗坎 ${first.name}*3`
      };
      const subSolutions = search(nextRemaining);
      subSolutions.forEach(sol => {
        results.push([group, ...sol]);
      });
    }

    // 3. Quad of identical cards (4 identical, same color)
    if (identicals.length === 4) {
      const groupCards = identicals;
      const nextRemaining = removeCards(remainingCards, groupCards);
      const group: HuPartitionGroup = {
        type: 'quad',
        cards: groupCards,
        hoo: 8, // Concealed quad is 8 Hoo in hand
        name: `暗開車 ${first.name}*4`
      };
      const subSolutions = search(nextRemaining);
      subSolutions.forEach(sol => {
        results.push([group, ...sol]);
      });
    }

    // 4. Same-color 將士象 (帥仕相) sequence
    // First card must be part of this.
    // If first.order is 1, 2, or 3, we search for the other two.
    if (first.order <= 3) {
      const targetOrders = [1, 2, 3];
      const seqCards: Card[] = [];
      let ok = true;
      for (const ord of targetOrders) {
        const found = remainingCards.find(c => c.color === first.color && c.order === ord && !seqCards.includes(c));
        if (found) {
          seqCards.push(found);
        } else {
          ok = false;
          break;
        }
      }
      if (ok) {
        const nextRemaining = removeCards(remainingCards, seqCards);
        const group: HuPartitionGroup = {
          type: 'consec_three',
          cards: seqCards,
          hoo: 2,
          name: `同色將士象 [${first.color === 'red' ? '紅' : first.color === 'yellow' ? '黃' : first.color === 'green' ? '綠' : '白'}帥仕相]`
        };
        const subSolutions = search(nextRemaining);
        subSolutions.forEach(sol => {
          results.push([group, ...sol]);
        });
      }
    }

    // 5. Same-color 車馬包 (俥傌炮) sequence
    // If first.order is 4, 5, or 6, we search for 4, 5, 6 of the same color
    if (first.order >= 4 && first.order <= 6) {
      const targetOrders = [4, 5, 6];
      const seqCards: Card[] = [];
      let ok = true;
      for (const ord of targetOrders) {
        const found = remainingCards.find(c => c.color === first.color && c.order === ord && !seqCards.includes(c));
        if (found) {
          seqCards.push(found);
        } else {
          ok = false;
          break;
        }
      }
      if (ok) {
        const nextRemaining = removeCards(remainingCards, seqCards);
        const group: HuPartitionGroup = {
          type: 'consec_three',
          cards: seqCards,
          hoo: 2,
          name: `同色車馬包 [${first.color === 'red' ? '紅' : first.color === 'yellow' ? '黃' : first.color === 'green' ? '綠' : '白'}車馬包]`
        };
        const subSolutions = search(nextRemaining);
        subSolutions.forEach(sol => {
          results.push([group, ...sol]);
        });
      }
    }

    // 6. Same Rank, Different Colors (3 or 4 different colors of the same rank).
    // NOTE: must compare `order` (the cross-color rank, e.g. 帥/將 are both order 1),
    // not `character` (the literal glyph) — red/yellow share one glyph set
    // (帥仕相俥傌炮兵) and green/white share a completely different one
    // (將士象車馬包卒), so a `character` comparison can only ever match within the
    // same 2-color glyph set and can never reach 3 or 4 distinct colors.
    const rankGroup = remainingCards.filter(c => c.order === first.order);
    // Uniq colors
    const colorMap: { [key: string]: Card } = {};
    rankGroup.forEach(c => {
      if (!colorMap[c.color]) {
        colorMap[c.color] = c;
      }
    });
    const uniqueColorCards = Object.values(colorMap);

    // 3 Different colors
    if (uniqueColorCards.length >= 3) {
      // We can try 3 colors
      // Since 'first' is in it, we must include 'first' and select 2 other colors
      // To keep it simple, find combinations of 3 including 'first'
      const firstColor = first.color;
      const otherColors = uniqueColorCards.filter(c => c.color !== firstColor);

      if (otherColors.length >= 2) {
        // Try combinations of 2 from otherColors
        for (let i = 0; i < otherColors.length; i++) {
          for (let j = i + 1; j < otherColors.length; j++) {
            const comb = [first, otherColors[i], otherColors[j]];
            const nextRemaining = removeCards(remainingCards, comb);
            const group: HuPartitionGroup = {
              type: 'different_colors',
              cards: comb,
              hoo: 1,
              name: `三異色 [${comb.map(c => c.name).join('')}]`
            };
            const subSolutions = search(nextRemaining);
            subSolutions.forEach(sol => {
              results.push([group, ...sol]);
            });
          }
        }
      }
    }

    // 4 Different colors
    if (uniqueColorCards.length === 4) {
      const comb = uniqueColorCards;
      const nextRemaining = removeCards(remainingCards, comb);
      const group: HuPartitionGroup = {
        type: 'different_colors',
        cards: comb,
        hoo: 4,
        name: `四異色 [${comb.map(c => c.name).join('')}]`
      };
      const subSolutions = search(nextRemaining);
      subSolutions.forEach(sol => {
        results.push([group, ...sol]);
      });
    }

    return results;
  }

  // Helper: remove cards from a list
  function removeCards(source: Card[], cardListToRemove: Card[]): Card[] {
    const idsToRemove = cardListToRemove.map(c => c.id);
    return source.filter(c => !idsToRemove.includes(c.id));
  }

  // Test 1: Try winning WITHOUT an eye (e.g. only Generals and matches, or the eye is already on table/part of standard melds. In Taiwanese Four Color, if hand contains no other cards but complete melds, can you win? Usually yes, especially if Generals make up the hand.
  // Actually, let's run the search directly. Does a full partition of sortedHand exist?
  const eyeLessPartitions = search(sortedHand);
  eyeLessPartitions.forEach(partition => {
    // Check if this partition is valid (it will be, since search only outputs valid sets).
    // In traditional Four Color, did we need an eye? If there is no non-General eye, is it valid? Yes, if all cards are grouped.
    const handHoo = partition.reduce((sum, g) => sum + g.hoo, 0);
    const totalHoo = handHoo + revealedHooTotal;
    if (totalHoo >= 10 && totalHoo > bestResult.totalHoo) {
      bestResult = {
        canHu: true,
        totalHoo,
        handGroups: partition,
        explanation: `成功判定胡牌！手牌組成 ${handHoo} 胡，案前已亮 ${revealedHooTotal} 胡，總計 ${totalHoo} 胡（高於 10 胡）。`
      };
    }
  });

  // Test 2: Try forming an "Eye" (對子) from candidates, then partition the rest
  eyeCandidates.forEach(eyeKey => {
    // Find two identical cards matching this eyeKey
    const eyeCards = sortedHand.filter(c => getCardKey(c) === eyeKey).slice(0, 2);
    const handWithoutEye = removeCards(sortedHand, eyeCards);
    
    const eyeGroup: HuPartitionGroup = {
      type: 'pair',
      cards: eyeCards,
      hoo: isGeneral(eyeCards[0]) ? 2 : 0, // General pair gets 2 Hoo, other cards get 0 Hoo
      name: `將眼 [對子] ${eyeCards[0].name}*2`
    };

    const partitions = search(handWithoutEye);
    partitions.forEach(partition => {
      const handHoo = partition.reduce((sum, g) => sum + g.hoo, 0) + eyeGroup.hoo;
      const totalHoo = handHoo + revealedHooTotal;
      if (totalHoo >= 10 && totalHoo > bestResult.totalHoo) {
        bestResult = {
          canHu: true,
          totalHoo,
          handGroups: [eyeGroup, ...partition],
          explanation: `成功判定胡牌！手牌包含【將眼 ${eyeCards[0].name}】共 ${handHoo} 胡，案前搭配亮牌 ${revealedHooTotal} 胡，總計 ${totalHoo} 胡（高於 10 胡上限）。`
        };
      }
    });
  });

  return bestResult;
}

/**
 * Scans if a drawn or discarded card can trigger special moves for a player.
 */
export interface AvailableMoves {
  canHu: boolean;
  huResult?: HuResult;
  canQuad: boolean; // 開車 / 槓
  canPong: boolean; // 碰
  canEatSeq: boolean; // 吃將士象 / 吃車馬包
  eatSeqOptions: {
    cardsToUse: Card[];
    meldName: string;
    resultCards: Card[];
  }[];
}

export function checkAvailableMoves(
  hand: Card[],
  revealed: RevealedMeld[],
  triggerCard: Card,
  isOwnTurn: boolean // If it was drawn by themselves vs discarded by opponent
): AvailableMoves {
  const triggerKey = getCardKey(triggerCard);
  
  // 1. Check Pong (碰): Need 2 identical cards in HAND
  const matchesInHand = hand.filter(c => getCardKey(c) === triggerKey);
  const canPong = matchesInHand.length >= 2;

  // 2. Check Quad (開車 / 槓)
  // Can Quad if we have 3 identical in hand, OR if we have index of that card in hand and a revealed triple
  const canQuad = matchesInHand.length === 3 || (matchesInHand.length === 1 && revealed.some(m => m.type === 'triple' && getCardKey(m.cards[0]) === triggerKey));

  // 3. Check Eat Sequence (同色將士象, 同色車馬包)
  const eatSeqOptions: AvailableMoves['eatSeqOptions'] = [];
  
  if (triggerCard.order <= 3) {
    // 將士象 sequence
    const orderNeeded = [1, 2, 3].filter(o => o !== triggerCard.order);
    const card1 = hand.find(c => c.color === triggerCard.color && c.order === orderNeeded[0]);
    const card2 = hand.find(c => c.color === triggerCard.color && c.order === orderNeeded[1]);
    if (card1 && card2) {
      eatSeqOptions.push({
        cardsToUse: [card1, card2],
        meldName: `同色將士象 [${triggerCard.color === 'red' ? '紅' : triggerCard.color === 'yellow' ? '黃' : triggerCard.color === 'green' ? '綠' : '白'}帥仕相]`,
        resultCards: [triggerCard, card1, card2].sort((a,b) => a.order - b.order)
      });
    }
  } else if (triggerCard.order >= 4 && triggerCard.order <= 6) {
    // 車馬包 sequence
    const orderNeeded = [4, 5, 6].filter(o => o !== triggerCard.order);
    const card1 = hand.find(c => c.color === triggerCard.color && c.order === orderNeeded[0]);
    const card2 = hand.find(c => c.color === triggerCard.color && c.order === orderNeeded[1]);
    if (card1 && card2) {
      eatSeqOptions.push({
        cardsToUse: [card1, card2],
        meldName: `同色車馬包 [${triggerCard.color === 'red' ? '紅' : triggerCard.color === 'yellow' ? '黃' : triggerCard.color === 'green' ? '綠' : '白'}車馬包]`,
        resultCards: [triggerCard, card1, card2].sort((a,b) => a.order - b.order)
      });
    }
  }

  // 4. Check Hu (胡牌)
  const expandedHand = [...hand, triggerCard];
  const huResult = solveHu(expandedHand, revealed);
  const canHu = huResult.canHu;

  return {
    canHu,
    huResult: canHu ? huResult : undefined,
    canQuad,
    canPong,
    canEatSeq: !isOwnTurn && eatSeqOptions.length > 0,
    eatSeqOptions: isOwnTurn ? [] : eatSeqOptions
  };
}

// ── 台數計分 (tai scoring) for pairs mode ──
// Reference: 《四色牌的 台數計分法》— separate 10-card (五對胡) and 15-card
// (五組三張) tai tables. 只有玩家/電腦兩人對戰，沒有實作獨立的「莊家 1台」
// 身分加成，只計算「連莊」：莊家連續蟬聯的局數，不論這局是莊家贏還是被贏
// （放槍），都算進台數（見 scorePairsWin 的 dealerStreak 參數）。
const BASE_PAYOUT = 200; // 底
const TAI_VALUE = 100;   // 每台

export interface ScoreItem {
  label: string;
  tai: number;
}

export interface ScoreBreakdown {
  items: ScoreItem[];
  totalTai: number;
  payout: number; // 底 + 總台數 × 台金額
}

function finalizeScore(items: ScoreItem[]): ScoreBreakdown {
  const totalTai = items.reduce((sum, item) => sum + item.tai, 0);
  return { items, totalTai, payout: BASE_PAYOUT + totalTai * TAI_VALUE };
}

/**
 * 計算「抓對子」玩法（10 張或 15 張）胡牌當下的台數明細。
 *
 * @param remainingHand 胡牌當下仍在手上的牌，含剛自摸/吃碰進來、尚未鎖入
 *                       revealedMelds 的那些牌（例如 15 張模式裡自然湊成、
 *                       從未經過碰一隻/吃一隻明鎖的組別）。
 * @param revealedMelds 這局遊戲過程中已經吃碰鎖定亮出的對子/組，牌不會同時
 *                       出現在 remainingHand 裡。
 * @param pairsHandSize 10（五對胡）或 15（五組三張）張玩法。
 * @param wasSelfDraw   這把胡牌是自摸（true）還是吃碰對方棄牌胡的（false）。
 * @param wasMenqing    這整局從頭到尾是否都沒有吃碰過對方的棄牌（純自己摸牌
 *                       湊對/組）；由呼叫端在每次碰一隻/吃一隻等「吃對方棄牌」
 *                       的動作發生當下即時翻成 false 並持續追蹤。
 * @param dealerStreak  莊家在「這一局之前」已經連續蟬聯的局數（0 表示莊家
 *                       這局才剛上莊，還沒連過莊）。由呼叫端維護莊家輪替
 *                       狀態並傳入；只和電腦兩人對戰，不論這局是莊家自己
 *                       胡牌、或是被對方胡走（放槍），都一律加計這個台數。
 * @param wasLastTileDraw 這把胡牌的最後一張牌，是不是牌庫剛好摸完（見牌局
 *                       規則手冊的「海底撈月」）；只有自摸時才有意義，由
 *                       呼叫端在「摸完這張牌後牌庫是否已空」的當下算好傳入。
 */
export function scorePairsWin(
  remainingHand: Card[],
  revealedMelds: RevealedMeld[],
  pairsHandSize: 10 | 15,
  wasSelfDraw: boolean,
  wasMenqing: boolean,
  dealerStreak: number = 0,
  wasLastTileDraw: boolean = false,
): ScoreBreakdown {
  const items: ScoreItem[] = [{ label: '底台', tai: 1 }];
  if (wasSelfDraw) items.push({ label: '自摸', tai: 1 });
  if (wasMenqing) items.push({ label: '門清', tai: 1 });
  // 門清一摸三：門清狀態下自摸胡牌，除了門清、自摸各自的 1 台，規則手冊另外
  // 再給 1 台組合獎勵，三者合計 3 台（不是門清+自摸單純相加的 2 台）。
  if (wasSelfDraw && wasMenqing) items.push({ label: '門清自摸加成', tai: 1 });

  if (dealerStreak > 0) items.push({ label: '連莊', tai: dealerStreak });

  // 海底撈月：自摸的那張牌剛好是牌庫最後一張。
  if (wasSelfDraw && wasLastTileDraw) items.push({ label: '海底撈月', tai: 1 });

  const allCards = [...remainingHand, ...revealedMelds.flatMap(m => m.cards)];

  if (pairsHandSize === 10) {
    const revealedPairs = revealedMelds.map(m => m.cards);
    const remainingPairs = groupPairsMode(remainingHand).pairs;
    const allPairs = [...revealedPairs, ...remainingPairs];

    // 將/帥對：每對 +1 台。帥/將固定是 order 1，四色皆同階，跨色比對用 order。
    const generalPairCount = allPairs.filter(pair => pair[0] && pair[0].order === 1).length;
    if (generalPairCount > 0) items.push({ label: '將/帥對', tai: generalPairCount });

    // 三隻(刻子)／四隻(開槓)：目前 10 張配對引擎（groupPairsMode）一律把 3 張
    // 同字拆成「1 對＋1 張散牌」、4 張拆成「2 對」，牌局中永遠不會把 3、4 張
    // 同字鎖成一個獨立單位，這兩項台數在目前規則下結構上恆為 0，不列入計算。

    // 清一色：10 張全同色 +3 台。
    if (new Set(allCards.map(c => c.color)).size === 1) items.push({ label: '清一色', tai: 3 });

    // 無將／全將：手牌完全沒有將/帥（+1），或 5 對全部都是將/帥（+1）。
    const hasGeneral = allCards.some(c => c.order === 1);
    if (!hasGeneral) {
      items.push({ label: '無將', tai: 1 });
    } else if (generalPairCount === 5) {
      items.push({ label: '全將', tai: 1 });
    }
  } else {
    // concealed = 自然湊成、從未經過碰一隻/吃一隻明鎖的組（remainingGroups
    // 全部算，revealedMelds 只有 origin==='draw' 的算）——「暗」對應這裡的
    // concealed，「明」則是 origin==='discard' 的碰/吃鎖定組，用來判斷
    // 三暗刻/四暗刻。
    const revealedGroups = revealedMelds.map(m => ({ cards: m.cards, concealed: m.origin === 'draw' }));
    const remainingGroups = (partitionTriosWithGroups(remainingHand) ?? []).map(cards => ({ cards, concealed: true }));
    const allGroupsWithConcealment = [...revealedGroups, ...remainingGroups];

    let sameCharCount = 0; // 三張同色同字（崁）每組 +1
    let concealedSameCharCount = 0; // 三暗刻/四暗刻判斷用
    let sequenceCount = 0; // 同色將士象/車馬包 每組 +1
    allGroupsWithConcealment.forEach(({ cards: group, concealed }) => {
      if (group.length !== 3) return;
      const type = classifyTrio(group[0], group[1], group[2]);
      if (type === 'sameChar') {
        sameCharCount++;
        if (concealed) concealedSameCharCount++;
      } else if (type === 'sequence') sequenceCount++;
      // 'rainbow'型（同階不同色）不逐組計台，由下面「四色同字」的整手牌檢查
      // 涵蓋，避免重複計分。
    });
    if (sameCharCount > 0) items.push({ label: '三張同色同字(崁)', tai: sameCharCount });
    if (sequenceCount > 0) items.push({ label: '同色將士象/車馬包', tai: sequenceCount });

    // 三暗刻/四暗刻：5 組裡有 3 組或 4 組是「暗」的三張同色同字。5 組全部
    // 都命中的極端情況也算四暗刻（>= 4，不用剛好等於 4）。
    if (concealedSameCharCount >= 4) {
      items.push({ label: '四暗刻', tai: 5 });
    } else if (concealedSameCharCount === 3) {
      items.push({ label: '三暗刻', tai: 2 });
    }

    // 四張同色同字（槓）：目前 15 張引擎每組固定湊 3 張，結構上不會出現 4 張
    // 鎖在同一組的情況，這項台數在目前規則下結構上恆為 0，不列入計算。

    // 四色同字：某個階級（帥/將、仕/士、相/象、俥/車、傌/馬、炮/包、兵/卒）
    // 紅黃綠白四色恰好各集滿 1 張，每個階級 +2 台（一手牌裡理論上可以同時
    // 湊到不只一個階級，逐一累加）。order=1（帥/將）另外還有「四大將/四大
    // 帥」的加成，兩者不互斥、會疊加，呼應規則手冊裡「將帥」向來享有更高
    // 台數的慣例。
    for (let order = 1; order <= 7; order++) {
      if (new Set(allCards.filter(c => c.order === order).map(c => c.color)).size === 4) {
        const sample = allCards.find(c => c.order === order)!;
        items.push({ label: `四色同字（${sample.character}）`, tai: 2 });
      }
    }

    // 清一色：15 張全同色 +4 台。
    if (new Set(allCards.map(c => c.color)).size === 1) items.push({ label: '清一色', tai: 4 });

    // 四大將/四大帥：紅黃綠白四色的 order=1 牌（將/帥）各恰好集滿 1 張。額外
    // 疊加在上面的「四色同字（帥/將）」之上，是這個階級專屬的加成。
    if (new Set(allCards.filter(c => c.order === 1).map(c => c.color)).size === 4) {
      items.push({ label: '四大將/四大帥', tai: 2 });
    }
  }

  // 槓上開花／天胡／地胡：這三項規則手冊裡的台數，在目前的遊戲設計下結構上
  // 不會出現，未列入計算：
  // - 槓上開花：需要「開槓」（4張同字明鎖 + 補牌）機制，這個遊戲的配對引擎
  //   完全沒有開槓這個概念（見上面兩處「目前XX張引擎結構上不會出現」的說明）。
  // - 天胡：規則手冊的起手牌數莊家比閒家多1張（例如10張仔莊家直接拿10張），
  //   讓莊家有機會開局就湊滿胡牌；這個遊戲目前不分莊閒，起手都發
  //   pairsHandSize-1 張，沒有「一開局就胡」的可能。
  // - 地胡：閒家第一巡自摸胡牌——理論上可能發生，但呼叫端目前沒有追蹤「這是
  //   本局第幾次摸牌」，尚未接上這個判斷。

  return finalizeScore(items);
}
