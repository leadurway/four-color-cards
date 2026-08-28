// 玩家帳號分數的持久化紀錄，以暱稱為 key 存在 localStorage，讓玩家回到大廳
// 重新「開始遊戲」後，先前累積的分數仍然存在（電腦 AI 的分數則是純 session
// 記憶體狀態，不經過這裡，重啟新局就會回到預設值）。
const STORAGE_KEY = 'fourColorCards.playerScores';

const DEFAULT_SCORE = 10000;

function readStore(): Record<string, number> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function loadPlayerScore(name: string): number {
  const store = readStore();
  const score = store[name];
  return typeof score === 'number' ? score : DEFAULT_SCORE;
}

export function savePlayerScore(name: string, score: number): void {
  const store = readStore();
  store[name] = score;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    // localStorage 不可用（例如無痕模式）時靜默略過，分數仍在當前 session 記憶體中可用。
  }
}

// 記住玩家上次輸入的暱稱，下次開啟頁面時直接帶入，不用重新輸入。
const NAME_STORAGE_KEY = 'fourColorCards.lastPlayerName';

export function loadPlayerName(): string | null {
  try {
    return localStorage.getItem(NAME_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePlayerName(name: string): void {
  try {
    localStorage.setItem(NAME_STORAGE_KEY, name);
  } catch {
    // localStorage 不可用時靜默略過。
  }
}
