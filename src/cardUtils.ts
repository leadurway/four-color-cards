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

export function groupPairsMode(hand: Card[]): PairsGrouping {
  const groupsMap: { [key: string]: Card[] } = {};
  
  hand.forEach(card => {
    const key = `${card.color}-${card.character}`;
    if (!groupsMap[key]) {
      groupsMap[key] = [];
    }
    groupsMap[key].push(card);
  });
  
  const quads: Card[][] = [];
  const triples: Card[][] = [];
  const pairs: Card[][] = [];
  const strays: Card[] = [];
  
  Object.values(groupsMap).forEach(cards => {
    if (cards.length === 4) {
      quads.push(cards);
    } else if (cards.length === 3) {
      triples.push(cards);
    } else if (cards.length === 2) {
      pairs.push(cards);
    } else if (cards.length === 1) {
      strays.push(cards[0]);
    }
  });
  
  // Sort strays by color and order
  strays.sort((a, b) => {
    if (a.color !== b.color) {
      return a.color.localeCompare(b.color);
    }
    return a.order - b.order;
  });
  
  return { quads, triples, pairs, strays };
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

    // 6. Same Character, Different Colors (3 or 4 different colors of the same character)
    // Find all colors of the same character
    const charGroup = remainingCards.filter(c => c.character === first.character);
    // Uniq colors
    const colorMap: { [key: string]: Card } = {};
    charGroup.forEach(c => {
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
              name: `三異色 ${first.character} [${comb.map(c => c.name[0]).join('')}]`
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
        name: `四異色 ${first.character} [紅黃綠白]`
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
    canEatSeq: eatSeqOptions.length > 0,
    eatSeqOptions
  };
}
