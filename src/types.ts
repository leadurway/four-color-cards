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
