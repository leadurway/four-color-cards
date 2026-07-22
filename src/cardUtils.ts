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

  Object.values(groupsMap).forEach(cards => {
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

function isValidTrio(a: Card, b: Card, c: Card): boolean {
  // Type 1: same color, same character (3 identical)
  if (a.color === b.color && b.color === c.color &&
      a.character === b.character && b.character === c.character) return true;

  // Type 2: same color, consecutive sequence (orders 1-2-3 or 4-5-6)
  if (a.color === b.color && b.color === c.color) {
    const orders = [a.order, b.order, c.order].sort((x, y) => x - y);
    if ((orders[0] === 1 && orders[1] === 2 && orders[2] === 3) ||
        (orders[0] === 4 && orders[1] === 5 && orders[2] === 6)) return true;
  }

  // Type 3: same rank (order), 3 different colors.
  // NOTE: `character` is the literal glyph, which only ever spans 2 colors —
  // red/yellow share one glyph set (帥仕相俥傌炮兵), green/white share a different
  // one (將士象車馬包卒). `order` (1-7) is the actual cross-color rank (e.g. 帥/將
  // are both order 1), so cross-color matching must compare `order`, not `character`.
  if (a.order === b.order && b.order === c.order) {
    const colors = new Set([a.color, b.color, c.color]);
    if (colors.size === 3) return true;
  }

  return false;
}

function partitionIntoTrios(cards: Card[]): boolean {
  if (cards.length === 0) return true;
  if (cards.length % 3 !== 0) return false;
  const [first, ...rest] = cards;
  for (let i = 0; i < rest.length - 1; i++) {
    for (let j = i + 1; j < rest.length; j++) {
      if (isValidTrio(first, rest[i], rest[j])) {
        const remaining = rest.filter((_, idx) => idx !== i && idx !== j);
        if (partitionIntoTrios(remaining)) return true;
      }
    }
  }
  return false;
}

export function checkTriosWin(hand: Card[]): boolean {
  return hand.length > 0 && hand.length % 3 === 0 && partitionIntoTrios(hand);
}

// ── 15-card mode: visual-only "組" hint for hand display ──
// Greedily finds non-overlapping trios among the 3 valid types (does not lock/restrict
// discard — purely a hint so the player can spot groups already sitting in their hand).
export function find15TrioHints(hand: Card[]): Set<string> {
  const used = new Set<string>();
  const ids = new Set<string>();

  // a. 同色同字三張
  const byKey: { [key: string]: Card[] } = {};
  hand.forEach(c => {
    const key = `${c.color}-${c.character}`;
    if (!byKey[key]) byKey[key] = [];
    byKey[key].push(c);
  });
  Object.values(byKey).forEach(cards => {
    if (cards.length >= 3) {
      cards.slice(0, 3).forEach(c => { ids.add(c.id); used.add(c.id); });
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
        found.forEach(c => { ids.add(c.id); used.add(c.id); });
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
  Object.values(byOrder).forEach(cards => {
    const colorMap = new Map<CardColor, Card>();
    cards.forEach(c => { if (!colorMap.has(c.color)) colorMap.set(c.color, c); });
    if (colorMap.size >= 3) {
      Array.from(colorMap.values()).slice(0, 3).forEach(c => { ids.add(c.id); used.add(c.id); });
    }
  });

  return ids;
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
