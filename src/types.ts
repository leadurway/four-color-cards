export type CardColor = 'red' | 'yellow' | 'green' | 'white';

export interface Card {
  id: string;
  color: CardColor;
  character: string;
  order: number; // 1 to 7
  name: string; // e.g. "紅帥", "綠將"
}

export type GameMode = 'pairs' | 'standard';

export interface Player {
  id: 'player' | 'computer';
  name: string;
  hand: Card[]; // Concealed hand
  revealed: RevealedMeld[]; // Revealed cards on table
  score: number;
}

export interface RevealedMeld {
  id: string;
  type: 'pair' | 'triple' | 'quad' | 'consec_three' | 'different_colors' | 'single_general';
  cards: Card[];
  hoo: number;
  name: string; // Description like "同色車馬包", "明刻"
  // 'draw': formed by the player/computer's own draw (never touched the
  // opponent's discard) — displayed inline in the hand, doesn't count toward
  // 露牌 and never breaks 門清. 'discard': claimed straight out of the
  // opponent's discard pile (碰/吃) — displayed in the separate 露牌 row and
  // breaks 門清.
  origin: 'draw' | 'discard';
}

export interface GameState {
  mode: GameMode;
  pairsHandSize: 10 | 15; // Starting hand for pairs mode
  deck: Card[];
  player: Player;
  computer: Player;
  discardPile: Card[];
  curPlayerId: 'player' | 'computer';
  gamePhase: 'setup' | 'playing' | 'waiting_player_action' | 'game_over';
  winnerId: 'player' | 'computer' | 'draw' | null;
  winType: 'pairs' | 'hu' | null;
  winExplanation: string;
  lastDrawnCard: Card | null;
  lastDiscardedCard: Card | null;
  drawnFromDeck: boolean; // Did the last card come from a deck draw?
  isComputerThinking: boolean;
  showComputerHand: boolean; // Translucency / reveal mode
  logs: string[];
}
