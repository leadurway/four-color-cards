import React, { useState, useEffect, useRef } from 'react';
import liangGameLogo from './assets/liang-game-logo.png';
import {
  createDeck,
  shuffle,
  groupPairsMode,
  checkTriosWin,
  checkTrioClaims,
  TrioClaimOption,
  find15TrioHints,
  excludeLockedTrioCards,
  sortHandForDisplay,
  solveHu,
  checkAvailableMoves,
  isGeneral,
  scorePairsWin,
  ScoreBreakdown,
  PairsGrouping,
  HuResult,
  classifyTrio
} from './cardUtils';
import { Card, GameMode, GameState, Player, RevealedMeld } from './types';
import { loadPlayerScore, savePlayerScore } from './scoreStorage';
import { FourColorCard } from './components/FourColorCard';
import { 
  Sparkles, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Eye,
  EyeOff,
  Award,
  ChevronRight, 
  User, 
  Cpu, 
  ArrowLeft, 
  BookOpen, 
  History
} from 'lucide-react';

export default function App() {
  // Navigation Router & Setup State
  const [activePage, setActivePage] = useState<'lobby' | 'game' | 'rules'>('lobby');
  const [previousPage, setPreviousPage] = useState<'lobby' | 'game'>('lobby');
  
  // Custom Player Options
  const [playerName, setUserName] = useState('長輩玩家');
  const [playerAvatar, setUserAvatar] = useState('👵');
  const avatars = ['👵', '👴', '👩', '👨', '🀄', '🏆', '⭐'];

  // Sound control
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Active Game parameters
  const [mode, setMode] = useState<GameMode>('pairs');
  const [pairsHandSize, setPairsHandSize] = useState<10 | 15>(10);
  
  // Play Space State Variables
  const [deck, setDeck] = useState<Card[]>([]);
  const [player, setPlayer] = useState<Player>({
    id: 'player',
    name: '您 (長輩玩家)',
    hand: [],
    revealed: [],
    score: 0
  });
  const [computer, setComputer] = useState<Player>({
    id: 'computer',
    name: '🤖 電腦AI',
    hand: [],
    revealed: [],
    score: 0
  });
  
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  // Mirror deck/player/computer/discardPile into refs, kept in sync every
  // render. runComputerTurn/executeComputerDiscard are ALWAYS invoked via
  // setTimeout (never directly from a click), so the closure they capture is
  // frozen to whichever render scheduled that timeout — if a card-moving
  // handler (e.g. handlePlayerDiscard) updates one of these AND THEN
  // schedules the timeout in that same render, the callback's own closure
  // over that state is one render stale by the time it fires. That's
  // deterministic, not a maybe: handlePlayerDiscard always updates
  // discardPile immediately before scheduling runComputerTurn, so the
  // discard the player just made was silently missing from what the
  // computer's turn saw — showing briefly in 回收牌, then getting wiped out
  // the moment the computer's own discard applied its (also stale, one
  // render behind) view of the pile. Refs are mutable and read synchronously,
  // immune to this gap; both functions rebind these names to `X.current` at
  // their very top (see below) so every read for the rest of each function
  // resolves to the live values instead of the stale closure.
  const deckRef = useRef(deck);
  const playerRef = useRef(player);
  const computerRef = useRef(computer);
  const discardPileRef = useRef(discardPile);
  useEffect(() => { deckRef.current = deck; }, [deck]);
  useEffect(() => { playerRef.current = player; }, [player]);
  useEffect(() => { computerRef.current = computer; }, [computer]);
  useEffect(() => { discardPileRef.current = discardPile; }, [discardPile]);
  const [curPlayerId, setCurPlayerId] = useState<'player' | 'computer'>('player');
  const [gamePhase, setGamePhase] = useState<GameState['gamePhase']>('setup');
  const [winnerId, setWinnerId] = useState<GameState['winnerId']>(null);
  const [winType, setWinType] = useState<GameState['winType']>(null);
  const [winExplanation, setWinExplanation] = useState('');
  const [winScore, setWinScore] = useState<ScoreBreakdown | null>(null);
  
  const [lastDrawnCard, setLastDrawnCard] = useState<Card | null>(null);
  const [lastDiscardedCard, setLastDiscardedCard] = useState<Card | null>(null);
  const [drawnFromDeck, setDrawnFromDeck] = useState(false);
  // Set atomically alongside setLastDiscardedCard so the 桌面牌 "誰出牌" label can
  // never desync from the card shown — inferring "who" from curPlayerId is fragile
  // since curPlayerId may not flip until well after the discard is displayed
  // (e.g. during the delayed reaction-check window).
  const [discardedBy, setDiscardedBy] = useState<'player' | 'computer' | null>(null);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [showComputerHand, setShowComputerHand] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // Available moves for player during checking state
  const [pendingMoves, setPendingMoves] = useState<ReturnType<typeof checkAvailableMoves> | null>(null);
  const [pendingTrioOptions, setPendingTrioOptions] = useState<TrioClaimOption[]>([]);
  const [canDiscard, setCanDiscard] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  // Quick tutorial navigation tabs
  const [activeTutorialTab, setActiveTutorialTab] = useState<'ranks' | 'pairs'>('ranks');
  
  // Mini logs expanded drawer state for portrait space optimization
  const [showLogDrawer, setShowLogDrawer] = useState(false);

  // Interactive senior helper voice-box
  const [guideMessage, setGuideMessage] = useState('歡迎進入四色牌遊藝廳！請選擇想玩的玩法，輸入大名並點擊下方按鈕即可開盤！');
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const guideBarRef = useRef<HTMLDivElement>(null);
  // Guards handlePlayerDraw/handlePlayerDiscard against a fast double-tap
  // firing the same action twice before React has re-rendered to disable the
  // button — the guard conditions those handlers check (hasDrawn, canDiscard)
  // are React STATE, which only updates on the next render, so two taps
  // landing within that same window would both read the pre-update values
  // and both run. A ref updates synchronously and is immune to that gap; it
  // self-releases on the next tick (setTimeout 0) so it can never get stuck.
  const playerActionLockRef = useRef(false);
  const [handCardDims, setHandCardDims] = useState({ w: 32, h: 84, fs: 19 });
  // Device/orientation classification: iPhone portrait is the ONE reference
  // design (isPhoneSized && !isLandscape) — its 2-row hand layout, 6-card-
  // width reference, and page width are left completely untouched. Every
  // other case (iPhone landscape, iPad portrait/landscape, PC web) reuses
  // that EXACT SAME layout/formula — same 2 rows, same 6-column reference —
  // just fed a wider container width (the page's max-width cap is loosened,
  // see useWideLayout below), so the whole screen scales up proportionally
  // to fill the available space while staying pixel-ratio-identical to
  // iPhone. This replaced an earlier attempt at a separate single-row,
  // differently-referenced layout for wider devices, which kept producing
  // subtly wrong card proportions — reusing the exact same formula at a
  // larger input size is simpler and guaranteed to match.
  // "Phone-sized" is judged by the SHORTER of the two viewport dimensions (the
  // phone's portrait-width even while it's held sideways), so a rotated iPhone
  // doesn't get misclassified as tablet-sized.
  const [isLandscape, setIsLandscape] = useState(false);
  const [isPhoneSized, setIsPhoneSized] = useState(true);
  useEffect(() => {
    const update = () => {
      const w = window.innerWidth, h = window.innerHeight;
      setIsLandscape(w > h);
      setIsPhoneSized(Math.min(w, h) < 768);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update);
    };
  }, []);
  const isIphonePortrait = isPhoneSized && !isLandscape;
  const isPhoneLandscape = isPhoneSized && isLandscape;
  const useWideLayout = !isIphonePortrait;
  // Hand layout (2-row fixed size vs single-row fit-to-space) follows
  // orientation alone, regardless of phone vs tablet: any portrait screen
  // (iPhone or iPad) gets the fixed 2-row formula below; any landscape
  // screen (iPhone, iPad, or PC web) gets the single-row fit-to-space one.
  // This is independent of useWideLayout (page width), which iPad portrait
  // still shares with the other non-iPhone-portrait cases.
  const showTwoRowHand = !isLandscape;

  // Animation overlays
  const [showEatPairAnim, setShowEatPairAnim] = useState(false);
  const [eatPairAnimWho, setEatPairAnimWho] = useState<'player' | 'computer'>('player');
  const [eatPairAnimCards, setEatPairAnimCards] = useState<Card[]>([]);
  // Captured at the moment of claiming (lastDrawnCard/lastDiscardedCard get
  // cleared in the same synchronous action that starts the animation, so this
  // can't be derived at render time the way the radar panel's label is).
  const [eatPairAnimSource, setEatPairAnimSource] = useState('');
  const [drawnCardPreview, setDrawnCardPreview] = useState<import('./types').Card | null>(null);
  const [showHuCelebration, setShowHuCelebration] = useState(false);
  const [huCelebShowContinue, setHuCelebShowContinue] = useState(false);
  const [huAnimWho, setHuAnimWho] = useState<'player' | 'computer'>('player');
  const [huAnimCards, setHuAnimCards] = useState<Card[]>([]);
  const [huAnimSelfDraw, setHuAnimSelfDraw] = useState(false);
  const [backConfirmPending, setBackConfirmPending] = useState(false);
  const fireworksCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Card size, height derived from width via the fixed aspect ratio iPhone's
  // own layout naturally lands on.
  //
  // Portrait orientation (showTwoRowHand — iPhone OR iPad) is the
  // fixed-formula case: width is set to exactly fit a reference card count
  // across the row, 2 rows tall — 6 for iPhone, 10 for iPad (see
  // portraitReferenceCols below). Only the reference count and the actual
  // measured width differ between them; the formula itself is identical.
  //
  // Landscape orientation (iPhone, iPad, or PC web) instead FITS to the
  // actual measured available space, single row, referenced against
  // HAND_REFERENCE_COLS_WIDE (15) cards — scaling up through this same
  // formula/ratio for a bigger, but still proportionally iPhone-shaped,
  // card. That's the "enlarge to fill the wider screen while keeping
  // iPhone's exact ratio" mechanism: same formula, same aspect constant,
  // just a bigger input and a reference sized for a full 15-card hand
  // instead of 6.
  const portraitReferenceCols = isPhoneSized ? 6 : 10;
  const HAND_REFERENCE_COLS_WIDE = 15;
  const HAND_CARD_ASPECT = 32 / 84; // iPhone's natural xs card W/H ratio
  useEffect(() => {
    const el = handContainerRef.current;
    if (!el) return;
    const wrapperEl = el.parentElement ?? el;

    const calc = () => {
      let w: number, h: number;

      // The wrapper's measured box still includes ITS OWN horizontal
      // padding (px-1) — the grid inside it has less room than that raw
      // measurement suggests. Reading the real applied padding via
      // getComputedStyle (rather than hardcoding it) keeps this correct
      // even if that class ever changes.
      const wrapperPadX = (() => {
        const cs = window.getComputedStyle(wrapperEl);
        return parseFloat(cs.paddingLeft || '0') + parseFloat(cs.paddingRight || '0');
      })();

      if (showTwoRowHand) {
        const containerW = wrapperEl.getBoundingClientRect().width - wrapperPadX;
        if (containerW < 10) return;
        w = containerW / portraitReferenceCols;
        h = w / HAND_CARD_ASPECT;
      } else {
        // Measure against the OUTER (non-scrolling) wrapper, not the grid
        // element itself. The grid has an explicit gridTemplateRows height
        // and its own overflow-x-auto; measuring it directly can create a
        // feedback loop on some WebKit layouts where each recompute reads a
        // slightly inflated size, making hand cards visibly grow with every
        // card drawn. The wrapper's size is fixed by the surrounding flex
        // layout and never depends on the grid's own content, so it's a
        // stable reference.
        const containerW = wrapperEl.getBoundingClientRect().width - wrapperPadX;
        const containerH = wrapperEl.getBoundingClientRect().height;
        // Guard against measuring before layout has settled (e.g. mid
        // page-transition): an invalid 0/near-0 reading would otherwise
        // collapse cards to ~0px wide until something else forces a fresh
        // measurement.
        if (containerW < 10 || containerH < 10) return;
        const colGap = 1;
        const rowGap = 10; // gap-y-2.5
        const rows = 1; // every non-portrait device shows the hand as a single row
        const maxCardW = (containerW - colGap * (HAND_REFERENCE_COLS_WIDE - 1)) / HAND_REFERENCE_COLS_WIDE;

        // The wrapper's box holds the grid AND the action bar AND the guide
        // bar together (they live inside it so controls sit snugly under
        // the cards instead of stretching the whole panel). The action
        // bar's own height is set equal to the card width by design; the
        // guide bar's height is measured directly (plain text/icon content,
        // independent of card size, so reading it here is safe — no
        // circular dependency). Both need to be subtracted before dividing
        // what's left by the row count, or the grid would be sized as if it
        // alone owned the whole wrapper — overflowing past what's actually
        // available and clipping the result.
        const guideBarH = guideBarRef.current?.getBoundingClientRect().height ?? 0;
        const chromeH = maxCardW + guideBarH;
        const maxCardH = Math.max(10, containerH - chromeH - rowGap * (rows - 1)) / rows;
        if (maxCardW / HAND_CARD_ASPECT <= maxCardH) {
          w = maxCardW; h = maxCardW / HAND_CARD_ASPECT;
        } else {
          h = maxCardH; w = maxCardH * HAND_CARD_ASPECT;
        }
      }
      setHandCardDims({ w: Math.floor(w), h: Math.floor(h), fs: Math.round(w * 19 / 32) });
    };

    calc();
    const obs = new ResizeObserver(() => calc());
    obs.observe(wrapperEl);
    window.addEventListener('resize', calc);
    window.addEventListener('orientationchange', calc);
    return () => {
      obs.disconnect();
      window.removeEventListener('resize', calc);
      window.removeEventListener('orientationchange', calc);
    };
  }, [activePage, showTwoRowHand]);

  // Fireworks canvas animation
  useEffect(() => {
    if (!showHuCelebration) return;
    const canvas = fireworksCanvasRef.current;
    if (!canvas) return;

    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);

    const ctx = canvas.getContext('2d')!;
    const colors = ['#f0b329','#ff5511','#f5c218','#5ed07a','#60a5fa','#e8541a','#ff6b9d','#c084fc','#ffffff'];
    type Particle = { x: number; y: number; vx: number; vy: number; color: string; life: number; size: number };
    const particles: Particle[] = [];

    const burst = () => {
      const x = 0.15 * canvas.width + Math.random() * canvas.width * 0.7;
      const y = 0.1 * canvas.height + Math.random() * canvas.height * 0.45;
      const count = 55 + Math.floor(Math.random() * 30);
      const color = colors[Math.floor(Math.random() * colors.length)];
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 2.5 + Math.random() * 6;
        particles.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1, color, life: 1, size: 2 + Math.random() * 3 });
      }
    };

    let animId: number;
    let lastBurst = -1000;
    const animate = (t: number) => {
      if (t - lastBurst > 420) { burst(); if (Math.random() > 0.5) burst(); lastBurst = t; }
      ctx.fillStyle = 'rgba(6,14,30,0.18)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy; p.vy += 0.13; p.vx *= 0.99; p.life -= 0.016;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.life;
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      animId = requestAnimationFrame(animate);
    };
    animId = requestAnimationFrame(animate);

    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, [showHuCelebration]);

  // Clear selected card if it becomes paired (e.g. after draw-and-pair)
  useEffect(() => {
    if (!selectedCardId || mode !== 'pairs') return;
    const group = groupPairsMode(player.hand);
    if (!group.strays.some(s => s.id === selectedCardId)) setSelectedCardId(null);
  }, [player.hand]);

  // Web Audio Synthesizer for high-fidelity direct physical sounds
  const playSound = (type: 'draw' | 'discard' | 'action' | 'win' | 'lose' | 'click') => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      if (type === 'draw') {
        osc.frequency.setValueAtTime(450, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.08, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.12);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } else if (type === 'discard') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(180, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.25, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.14);
        osc.start();
        osc.stop(ctx.currentTime + 0.14);
      } else if (type === 'action') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08); // E5
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.2);
      } else if (type === 'click') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        gain.gain.setValueAtTime(0.05, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.05);
        osc.start();
        osc.stop(ctx.currentTime + 0.05);
      } else if (type === 'win') {
        const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
        notes.forEach((freq, idx) => {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.connect(g);
          g.connect(ctx.destination);
          o.frequency.setValueAtTime(freq, ctx.currentTime + idx * 0.09);
          g.gain.setValueAtTime(0.08, ctx.currentTime + idx * 0.09);
          g.gain.linearRampToValueAtTime(0, ctx.currentTime + idx * 0.09 + 0.25);
          o.start(ctx.currentTime + idx * 0.09);
          o.stop(ctx.currentTime + idx * 0.09 + 0.25);
        });
      } else if (type === 'lose') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(140, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(90, ctx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      }
    } catch (e) {
      console.warn("Audio Context Blocked/Not Supported:", e);
    }
  };

  const addLog = (msg: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString('zh-TW', { hour12: false })}] ${msg}`]);
  };

  // Runtime invariant check, called explicitly right at every 摸/吃/碰/丟牌 point
  // (immediately after computing that action's own new hand/revealed/deck/
  // discardPile values, using those LOCAL values directly rather than waiting
  // for a re-render) — the full 112-card deck must always be conserved across
  // deck + both hands + both revealed piles + the discard pile + one pending
  // self-drawn card. Passing a `label` naming the specific action means that
  // if the count is ever off, the game log points at exactly which action
  // caused it instead of just the after-the-fact symptom. Any piece not
  // touched by a given action is left undefined and falls back to the current
  // committed state for that piece.
  // lastDiscardedCard is deliberately never added — it's always a pointer to
  // the top of discardPile for display, not a separate physical card (see
  // handlePlayerDiscard/executeComputerDiscard).
  // Also validates two DEEPER invariants beyond the raw total (either of which
  // could hide behind a total that still happens to add up to 112):
  // 1. No single physical card (by id) appears in more than one pile at once —
  //    this is the specific "double-booked" bug class this project has hit
  //    before (a card shown both in a meld and still lingering in hand/discard).
  // 2. Every revealed meld has the right card count for the mode (2 for a
  //    10-card pair, 3 for a 15-card trio) and is an actually-valid grouping
  //    (matching color+character for a pair; classifyTrio non-null for a
  //    trio) — catches a meld having been assembled from the wrong cards even
  //    when the total count still happens to balance out.
  // `expect`, when passed, checks a THIRD, even more targeted invariant on top
  // of the two above: at a draw/claim checkpoint, that side's own hand+
  // revealed total must equal pairsHandSize (10 or 15) — the just-drawn/
  // claimed card is now committed to their side; at a discard checkpoint it
  // must equal pairsHandSize-1. This is the tightest check of the three: the
  // global-112 and no-duplicate-id checks can both still pass if one side
  // gained a phantom card while the OTHER side or a shared pile lost the
  // matching one elsewhere, since the totals/ids across all piles could still
  // balance out — this check catches that by pinning down exactly what THIS
  // side's own count should be at THIS specific kind of checkpoint.
  const assertCardTotal = (label: string, overrides: {
    deck?: Card[];
    playerHand?: Card[];
    playerRevealed?: RevealedMeld[];
    computerHand?: Card[];
    computerRevealed?: RevealedMeld[];
    discardPile?: Card[];
    pendingDrawn?: Card | null;
  }, expect?: { side: 'player' | 'computer'; kind: 'draw' | 'discard' }) => {
    const d = overrides.deck ?? deck;
    const ph = overrides.playerHand ?? player.hand;
    const pr = overrides.playerRevealed ?? player.revealed;
    const ch = overrides.computerHand ?? computer.hand;
    const cr = overrides.computerRevealed ?? computer.revealed;
    const dp = overrides.discardPile ?? discardPile;
    const pd = 'pendingDrawn' in overrides ? overrides.pendingDrawn : lastDrawnCard;
    const revealedCount = (melds: RevealedMeld[]) => melds.reduce((sum, m) => sum + m.cards.length, 0);
    const total = d.length + ph.length + revealedCount(pr) + ch.length + revealedCount(cr) + dp.length + (pd ? 1 : 0);
    if (total !== 112) {
      const detail = `牌庫=${d.length} 玩家手牌=${ph.length} 玩家露牌=${revealedCount(pr)} 電腦手牌=${ch.length} 電腦露牌=${revealedCount(cr)} 棄牌堆=${dp.length} 待定摸牌=${pd ? 1 : 0} 總計=${total}`;
      console.warn(`[牌數異常/${label}] 總牌數應為112，實際為${total}。${detail}`);
      addLog(`⚠️ [系統偵測/${label}] 牌數異常！總數應為112，目前為 ${total} 張。${detail}`);
    }

    const allCards = [...d, ...ph, ...pr.flatMap(m => m.cards), ...ch, ...cr.flatMap(m => m.cards), ...dp, ...(pd ? [pd] : [])];
    const idCounts = new Map<string, number>();
    allCards.forEach(c => idCounts.set(c.id, (idCounts.get(c.id) ?? 0) + 1));
    const dupes = [...idCounts.entries()].filter(([, n]) => n > 1);
    if (dupes.length > 0) {
      const names = dupes.map(([id, n]) => `${allCards.find(c => c.id === id)?.name ?? id}×${n}`).join('、');
      console.warn(`[牌卡重複/${label}] 同一張牌出現在多個位置：${names}`);
      addLog(`⚠️ [系統偵測/${label}] 發現重複的牌：${names}（同一張牌被算在兩個地方）`);
    }

    if (mode === 'pairs') {
      const expectedMeldSize = pairsHandSize === 10 ? 2 : 3;
      const checkMelds = (side: string, revealed: RevealedMeld[]) => {
        revealed.forEach(meld => {
          if (meld.cards.length !== expectedMeldSize) {
            console.warn(`[露牌張數錯誤/${label}] ${side}「${meld.name}」有 ${meld.cards.length} 張`);
            addLog(`⚠️ [系統偵測/${label}] ${side}的露牌「${meld.name}」有 ${meld.cards.length} 張，${pairsHandSize}張玩法應為 ${expectedMeldSize} 張！`);
            return;
          }
          if (pairsHandSize === 10) {
            const [a, b] = meld.cards;
            if (a.color !== b.color || a.character !== b.character) {
              console.warn(`[露牌型態錯誤/${label}] ${side}「${meld.name}」不是有效對子`);
              addLog(`⚠️ [系統偵測/${label}] ${side}的露牌「${meld.name}」兩張牌花色不同，不是有效對子！`);
            }
          } else {
            const [a, b, c] = meld.cards;
            if (classifyTrio(a, b, c) === null) {
              console.warn(`[露牌型態錯誤/${label}] ${side}「${meld.name}」不是有效組子`);
              addLog(`⚠️ [系統偵測/${label}] ${side}的露牌「${meld.name}」不符合任何有效組子型態！`);
            }
          }
        });
      };
      checkMelds('玩家', pr);
      checkMelds('電腦', cr);
    }

    if (expect && mode === 'pairs') {
      const ownHandLen = expect.side === 'player' ? ph.length : ch.length;
      const ownRevealedLen = revealedCount(expect.side === 'player' ? pr : cr);
      // At the very "just drew, still pending" checkpoints (e.g. 玩家摸牌/
      // 電腦摸牌), the drawn card hasn't been merged into hand yet — it's
      // still sitting in `pd`. Count it as this side's for a 'draw' check
      // (it always belongs to whoever's checkpoint this is); every other
      // 'draw' checkpoint already merged it into hand/revealed and explicitly
      // passes pendingDrawn: null, so this adds 0 there.
      const ownTotal = ownHandLen + ownRevealedLen + (expect.kind === 'draw' && pd ? 1 : 0);
      const expectedTotal = expect.kind === 'draw' ? pairsHandSize : pairsHandSize - 1;
      if (ownTotal !== expectedTotal) {
        const sideName = expect.side === 'player' ? '玩家' : '電腦';
        const kindName = expect.kind === 'draw' ? '摸牌/吃碰' : '丟牌';
        const msg = `⚠️ [系統偵測/${label}] ${sideName}${kindName}後，手牌(${ownHandLen})+露牌(${ownRevealedLen})=${ownTotal}張，${pairsHandSize}張玩法應為 ${expectedTotal} 張！`;
        console.warn(`[本方張數錯誤/${label}] ${msg}`);
        addLog(msg);
      }
    }
  };

  // Setup/Initialize core gaming deck & distribute hands.
  // `isNewSession` distinguishes the lobby's "開始遊戲" (a brand-new session) from
  // "重新發牌，再開一局"/"繼續下局" (continuing the current session): only a new
  // session reloads the player's persisted score from localStorage and resets the
  // computer's score back to the default — within one session both scores carry
  // over round to round so the running tally stays meaningful.
  const initGame = (isNewSession: boolean = true) => {
    const fullDeck = createDeck();
    const shuffled = shuffle(fullDeck);
    
    let playerHand: Card[] = [];
    let computerHand: Card[] = [];
    let remainingDeck: Card[] = [];

    // Clear and print setup
    setLogs([]);
    addLog(`-------------------------------`);
    addLog(`歡迎 ${playerAvatar} ${playerName} 進入牌局！`);
    
    if (mode === 'pairs') {
      // Per rules: start with pairsHandSize-1 cards; the winning card is the Nth drawn/received
      const startSize = pairsHandSize - 1;
      addLog(`啟動【抓對子玩法】—— 起手每人分發 ${startSize} 張牌，湊成 ${pairsHandSize === 10 ? '五對（10張）' : '五組三張（15張）'} 勝出。`);
      playerHand = shuffled.slice(0, startSize);
      computerHand = shuffled.slice(startSize, startSize * 2);
      remainingDeck = shuffled.slice(startSize * 2);
    } else {
      addLog(`啟動【傳統吃碰標準玩法】—— 起手發 20 張牌進行博弈。`);
      playerHand = shuffled.slice(0, 20);
      computerHand = shuffled.slice(20, 40);
      remainingDeck = shuffled.slice(40);
    }

    // Auto-Group quads and triples for simple mode to make it easy for seniors
    let playerRevealed: RevealedMeld[] = [];
    let computerRevealed: RevealedMeld[] = [];

    if (mode === 'pairs') {
      const pGroup = groupPairsMode(playerHand);
      // Auto move Quads to revealed
      pGroup.quads.forEach(q => {
        playerRevealed.push({
          id: `init-p-quad-${Math.random()}`,
          type: 'quad',
          cards: q,
          hoo: isGeneral(q[0]) ? 8 : 4,
          name: `自帶暗開車 [${q[0].name}*4]`,
          origin: 'draw'
        });
        addLog(`[開局判定] 系統為您自動保留【暗開車 ${q[0].name}*4】。`);
      });
      // Auto move Triples to revealed
      pGroup.triples.forEach(t => {
        playerRevealed.push({
          id: `init-p-triple-${Math.random()}`,
          type: 'triple',
          cards: t,
          hoo: isGeneral(t[0]) ? 3 : 1,
          name: `自帶暗坎 [${t[0].name}*3]`,
          origin: 'draw'
        });
        addLog(`[開局判定] 系統為您自動保留【暗坎 ${t[0].name}*3】。`);
      });

      // Filter hand
      const filteredPHand: Card[] = [];
      pGroup.pairs.forEach(p => filteredPHand.push(...p));
      filteredPHand.push(...pGroup.strays);
      playerHand = filteredPHand;

      // Same auto-retention for computer AI
      const cGroup = groupPairsMode(computerHand);
      cGroup.quads.forEach(q => {
        computerRevealed.push({
          id: `init-c-quad-${Math.random()}`,
          type: 'quad',
          cards: q,
          hoo: isGeneral(q[0]) ? 8 : 4,
          name: `自帶暗開車 [${q[0].name}*4]`,
          origin: 'draw'
        });
        addLog(`[開局判定] 電腦 AI 自動鎖定【暗開車 ${q[0].name}*4】。`);
      });
      cGroup.triples.forEach(t => {
        computerRevealed.push({
          id: `init-c-triple-${Math.random()}`,
          type: 'triple',
          cards: t,
          hoo: isGeneral(t[0]) ? 3 : 1,
          name: `自帶暗坎 [${t[0].name}*3]`,
          origin: 'draw'
        });
        addLog(`[開局判定] 電腦 AI 自動鎖定【暗坎 ${t[0].name}*3】。`);
      });

      const filteredCHand: Card[] = [];
      cGroup.pairs.forEach(p => filteredCHand.push(...p));
      filteredCHand.push(...cGroup.strays);
      computerHand = filteredCHand;
    }

    const newPlayerScore = isNewSession ? loadPlayerScore(playerName) : player.score;
    const newComputerScore = isNewSession ? 10000 : computer.score;

    setDeck(remainingDeck);
    setPlayer({
      id: 'player',
      name: `${playerAvatar} ${playerName}`,
      hand: sortHandForDisplay(playerHand),
      revealed: playerRevealed,
      score: newPlayerScore
    });
    setComputer({
      id: 'computer',
      name: '🤖 電腦AI',
      hand: sortHandForDisplay(computerHand),
      revealed: computerRevealed,
      score: newComputerScore
    });

    setDiscardPile([]);
    setCurPlayerId('player');
    setGamePhase('playing');
    setWinnerId(null);
    setWinType(null);
    setWinExplanation('');
    setWinScore(null);
    setLastDrawnCard(null);
    setLastDiscardedCard(null);
    setDrawnFromDeck(false);
    setSelectedCardId(null);
    setPendingMoves(null);
    // In pairs mode player must draw first; in standard mode initial discard is allowed
    setCanDiscard(mode !== 'pairs');
    setHasDrawn(false);
    
    setGuideMessage('發牌完成，請摸牌。');
    addLog(`牌局正常開啟。洗牌分發完畢，牌席賸餘牌 ${remainingDeck.length} 張。`);
    
    playSound('action');
    setActivePage('game');
  };

  // Player Manual Trigger to Draw card from Deck
  const handlePlayerDraw = () => {
    if (gamePhase !== 'playing' || curPlayerId !== 'player' || lastDrawnCard !== null || hasDrawn) return;
    if (playerActionLockRef.current) return;
    playerActionLockRef.current = true;
    setTimeout(() => { playerActionLockRef.current = false; }, 0);

    if (deck.length === 0) {
      handleDrawGame();
      return;
    }

    playSound('draw');
    setHasDrawn(true);
    const newDeck = [...deck];
    const drawn = newDeck.shift()!;
    setDeck(newDeck);

    setLastDrawnCard(drawn);
    setLastDiscardedCard(null);
    setDrawnFromDeck(true); // Player drew this card
    addLog(`【您摸牌】摸到了一張牌：[${drawn.name}]`);
    assertCardTotal('玩家摸牌', { deck: newDeck, pendingDrawn: drawn }, { side: 'player', kind: 'draw' });

    if (mode === 'pairs' && pairsHandSize === 15) {
      // ── 15-card mode: check if the drawn card completes a claimable trio first ──
      const trioOptions = checkTrioClaims(excludeLockedTrioCards(player.hand), drawn);
      if (trioOptions.length > 0) {
        setLastDiscardedCard(null);
        setPendingTrioOptions(trioOptions);
        setGamePhase('waiting_player_action');
        setGuideMessage(`[${drawn.name}] 可湊成一組！請選擇或按過。`);
        return;
      }

      // No auto-pair; check trio win on full 15-card hand. The drawn card is
      // appended unsorted (lands at the far right of row 2) so the player can
      // clearly see what they just drew; the hand gets sorted once, after the
      // discard decision (see handlePlayerDiscard).
      const newHand15 = [...player.hand, drawn];
      setLastDrawnCard(null);
      setLastDiscardedCard(null);
      assertCardTotal('玩家摸牌-加入手牌(15張)', { playerHand: newHand15, pendingDrawn: null }, { side: 'player', kind: 'draw' });
      if (checkTriosWin(newHand15)) {
        setPlayer(prev => ({ ...prev, hand: newHand15 }));
        handleWin('player', 'pairs', '恭喜！您的15張牌已湊成5組三張，宣告勝出！', [], { hand: newHand15, revealed: player.revealed, wasSelfDraw: true });
        return;
      }
      setPlayer(prev => ({ ...prev, hand: newHand15 }));
      setCanDiscard(true);
      setGuideMessage(`[${drawn.name}] 已加入手牌。`);
    } else if (mode === 'pairs') {
      // ── 10-card mode: auto-pair strays ──
      const pGroup = groupPairsMode(player.hand);
      const matchedCard = pGroup.strays.find(c => c.color === drawn.color && c.character === drawn.character);

      if (matchedCard) {
        // Step 1: show drawn card for 3s
        setLastDrawnCard(null);
        setLastDiscardedCard(null);
        setDrawnCardPreview(drawn);
        addLog(`【自摸】摸到 [${drawn.name}]，正好與手中 [${matchedCard.name}] 配對！`);

        setTimeout(() => {
          // Step 2: execute pair + show 吃對 for 3s
          setDrawnCardPreview(null);
          const nextHand = player.hand.filter(c => c.id !== matchedCard.id);
          const autoPairMeld: RevealedMeld = {
            id: `player-pair-${Date.now()}`,
            type: 'pair',
            cards: [drawn, matchedCard],
            hoo: isGeneral(drawn) ? 2 : 0,
            name: `對子 [${drawn.name}]`,
            origin: 'draw'
          };
          const newRevealed = [...player.revealed, autoPairMeld];
          setPlayer(prev => ({ ...prev, hand: nextHand, revealed: newRevealed }));
          assertCardTotal('玩家自摸配對', { playerHand: nextHand, playerRevealed: newRevealed, pendingDrawn: null }, { side: 'player', kind: 'draw' });
          setEatPairAnimWho('player');
          setEatPairAnimCards([drawn, matchedCard]);
          setEatPairAnimSource('玩家摸牌');
          setShowEatPairAnim(true);

          const autoCheck = groupPairsMode(nextHand);
          if (autoCheck.strays.length === 0) {
            setTimeout(() => {
              setShowEatPairAnim(false);
              handleWin('player', 'pairs', '恭喜！自摸配對完成所有散牌，宣告勝出！', [drawn, matchedCard], { hand: nextHand, revealed: newRevealed, wasSelfDraw: true });
            }, 3000);
            return;
          }
          setHasDrawn(true);
          setCanDiscard(false);
          setTimeout(() => {
            setShowEatPairAnim(false);
            setCanDiscard(true);
            setGuideMessage('配對成功！請選牌打出。');
          }, 3000);
        }, 3000);
      } else {
        // No match — append unsorted (lands at the far right of row 2) so the
        // player can clearly see what they just drew; the hand gets sorted
        // once, after the discard decision (see handlePlayerDiscard).
        const nextHand = [...player.hand, drawn];
        setPlayer(prev => ({ ...prev, hand: nextHand }));
        setLastDrawnCard(null);
        assertCardTotal('玩家摸牌-加入手牌', { playerHand: nextHand, pendingDrawn: null }, { side: 'player', kind: 'draw' });
        setCanDiscard(true);
        setGuideMessage(`[${drawn.name}] 未配對，已加入手牌。`);
      }
    } else {
      // Standard Mahjong-like rules check when drawing from deck
      const moves = checkAvailableMoves(player.hand, player.revealed, drawn, true);
      
      if (moves.canHu || moves.canQuad || moves.canPong || moves.canEatSeq) {
        setPendingMoves(moves);
        setGamePhase('waiting_player_action');
        setGuideMessage(`摸出 [${drawn.name}]，可行動！請選擇或按過。`);
      } else {
        // No moves. Push to hand and configure discard action
        const nextHand = sortHandForDisplay([...player.hand, drawn]);
        setPlayer(prev => ({
          ...prev,
          hand: nextHand
        }));
        setLastDrawnCard(null);
        setCanDiscard(true);
        setGuideMessage(`[${drawn.name}] 無法吃碰，已加入手牌。`);
      }
    }
  };

  // Player Manual Touch to Discard a selected Card
  const handlePlayerDiscard = (cardId: string) => {
    if (gamePhase !== 'playing' || curPlayerId !== 'player' || !canDiscard) return;
    if (playerActionLockRef.current) return;
    playerActionLockRef.current = true;
    setTimeout(() => { playerActionLockRef.current = false; }, 0);

    const cardToDiscard = player.hand.find(c => c.id === cardId);
    if (!cardToDiscard) return;

    // In 10-card pairs mode, only stray (unpaired) cards can be discarded
    if (mode === 'pairs' && pairsHandSize === 10) {
      const dGroup = groupPairsMode(player.hand);
      if (!dGroup.strays.some(s => s.id === cardId)) return;
    }

    playSound('discard');
    // Re-sort once the discard decision is made — until now the just-drawn
    // card (if any) was left unsorted at the far right of row 2 so the player
    // could clearly see what they'd just drawn.
    const updatedHand = sortHandForDisplay(player.hand.filter(c => c.id !== cardId));

    setPlayer(prev => ({
      ...prev,
      hand: updatedHand
    }));

    const newDiscardPile = [cardToDiscard, ...discardPile];
    setDiscardPile(newDiscardPile);
    setLastDiscardedCard(cardToDiscard);
    setDiscardedBy('player');
    setLastDrawnCard(null);
    setSelectedCardId(null);
    setCanDiscard(false); // Finished play privilege
    setHasDrawn(false); // Reset drawing lock for player's future turn

    addLog(`【您打牌】打出了一張棄牌：[${cardToDiscard.name}]`);
    assertCardTotal('玩家丟牌', { playerHand: updatedHand, discardPile: newDiscardPile, pendingDrawn: null }, { side: 'player', kind: 'discard' });

    // 10-card pairs mode: check if discarding leaves hand with no strays → win
    if (mode === 'pairs' && pairsHandSize === 10) {
      const afterGroup = groupPairsMode(updatedHand);
      if (afterGroup.strays.length === 0 && updatedHand.length > 0) {
        handleWin('player', 'pairs', '恭喜！您打出多餘單張後，手中所有散牌均已配對完畢，宣告勝出！', [], { hand: updatedHand, revealed: player.revealed, wasSelfDraw: true });
        return;
      }
    }
    // 15-card: win only triggers on draw; no win check after discard

    // Hand turn over to computer. Computer checks if it wants to react to player's discard
    setCurPlayerId('computer');
    setIsComputerThinking(true);
    setGuideMessage('等待電腦...');

    setTimeout(() => {
      runComputerTurn(cardToDiscard);
    }, 1200);
  };

  // Computes Computer reaction and self-play logic
  const runComputerTurn = (playerDiscard: Card | null) => {
    // This function is always scheduled via setTimeout from a prior render,
    // so its closure over deck/player/computer/discardPile would otherwise be
    // frozen to that render. Rebind to the refs' live values so every read
    // below sees state as of right now, not as of whichever render queued
    // this timeout.
    const deck = deckRef.current;
    const player = playerRef.current;
    const computer = computerRef.current;
    const discardPile = discardPileRef.current;

    if (gamePhase !== 'playing') {
      setIsComputerThinking(false);
      return;
    }

    // 1. If player discarded a card, AI checks reaction moves first
    if (playerDiscard) {
      const moves = checkAvailableMoves(computer.hand, computer.revealed, playerDiscard, false);
      
      if (mode === 'pairs' && pairsHandSize === 10) {
        // 10-card: AI checks if player's discard completes a pair
        const cGroup = groupPairsMode(computer.hand);
        const matchesStray = cGroup.strays.find(c => c.color === playerDiscard.color && c.character === playerDiscard.character);

        if (matchesStray) {
          const newHand = computer.hand.filter(c => c.id !== matchesStray.id);
          const newMeld: RevealedMeld = {
            id: `comp-pair-${Date.now()}`,
            type: 'pair',
            cards: [playerDiscard, matchesStray],
            hoo: isGeneral(playerDiscard) ? 2 : 0,
            name: `對子 [${playerDiscard.name}]`,
            origin: 'discard'
          };
          const newRevealed = [...computer.revealed, newMeld];
          setComputer(prev => ({ ...prev, hand: newHand, revealed: newRevealed }));
          setLastDiscardedCard(null);
          const newDiscardPile = discardPile.filter(c => c.id !== playerDiscard.id);
          setDiscardPile(newDiscardPile);
          addLog(`🤖 電腦 AI 宣告【吃一隻】，將剛才您打出的 [${playerDiscard.name}] 配成一對。`);
          assertCardTotal('電腦吃一隻', { computerHand: newHand, computerRevealed: newRevealed, discardPile: newDiscardPile }, { side: 'computer', kind: 'draw' });
          setEatPairAnimWho('computer');
          setEatPairAnimCards([playerDiscard, matchesStray]);
          setEatPairAnimSource('玩家出牌');
          setShowEatPairAnim(true);
          setIsComputerThinking(false);

          const nextGroup = groupPairsMode(newHand);
          if (nextGroup.strays.length === 0) {
            setTimeout(() => {
              setShowEatPairAnim(false);
              handleWin('computer', 'pairs', '電腦配對抓完手牌散牌徹底歸零，取得勝利！', [playerDiscard, matchesStray], { hand: newHand, revealed: newRevealed, wasSelfDraw: false });
            }, 3000);
            return;
          }
          setTimeout(() => {
            setShowEatPairAnim(false);
            executeComputerDiscard(newHand);
          }, 3000);
          return;
        }
        // No stray match → fall through to computer draw turn
      } else if (mode === 'pairs' && pairsHandSize === 15) {
        // 15-card: AI checks if player's discard completes a claimable trio (碰一隻/吃一隻)
        const trioOptions = checkTrioClaims(excludeLockedTrioCards(computer.hand), playerDiscard);
        if (trioOptions.length > 0 && Math.random() < 0.75) {
          const option = trioOptions[Math.floor(Math.random() * trioOptions.length)];
          const newHand = computer.hand.filter(c => !option.cardsToUse.map(u => u.id).includes(c.id));
          const newMeld: RevealedMeld = {
            id: `comp-trio-${Date.now()}`,
            type: option.meldType,
            cards: option.resultCards,
            hoo: 0,
            name: option.meldName,
            origin: 'discard'
          };
          const newRevealed = [...computer.revealed, newMeld];
          setComputer(prev => ({ ...prev, hand: newHand, revealed: newRevealed }));
          setLastDiscardedCard(null);
          const newDiscardPile = discardPile.filter(c => c.id !== playerDiscard.id);
          setDiscardPile(newDiscardPile);
          addLog(`🤖 電腦 AI 宣告【${option.actionLabel}】，用您打出的 [${playerDiscard.name}] 湊成${option.meldName}。`);
          assertCardTotal(`電腦${option.actionLabel}`, { computerHand: newHand, computerRevealed: newRevealed, discardPile: newDiscardPile }, { side: 'computer', kind: 'draw' });
          setEatPairAnimWho('computer');
          setEatPairAnimCards(option.resultCards);
          setEatPairAnimSource('玩家出牌');
          setShowEatPairAnim(true);
          setIsComputerThinking(false);

          if (newHand.length === 0 || checkTriosWin(newHand)) {
            setTimeout(() => {
              setShowEatPairAnim(false);
              handleWin('computer', 'pairs', '電腦的15張牌湊成5組三張，電腦勝出！', option.resultCards, { hand: newHand, revealed: newRevealed, wasSelfDraw: false });
            }, 3000);
            return;
          }
          setTimeout(() => {
            setShowEatPairAnim(false);
            executeComputerDiscard(newHand);
          }, 3000);
          return;
        }
        // No claim taken → fall through to computer draw turn
      } else if (mode !== 'pairs') {
        // Standard Mode AI evaluations on opponent discard
        if (moves.canHu) {
          handleWin('computer', 'hu', `電腦阻擊胡牌！在您拋出 [${playerDiscard.name}] 時完美鳴牌自胡！ ${moves.huResult!.explanation}`);
          setIsComputerThinking(false);
          return;
        }

        if (moves.canQuad) {
          const pKey = `${playerDiscard.color}-${playerDiscard.character}`;
          const inHand = computer.hand.filter(c => `${c.color}-${c.character}` === pKey);
          let effectiveHand = computer.hand;
          let effectiveRevealed = computer.revealed;

          if (inHand.length === 3) {
            effectiveHand = computer.hand.filter(c => !inHand.map(r => r.id).includes(c.id));
            const newMeld: RevealedMeld = {
              id: `comp-quad-${Date.now()}`,
              type: 'quad',
              cards: [playerDiscard, ...inHand],
              hoo: 6,
              name: `明開車 [${playerDiscard.name}*4]`,
              origin: 'discard'
            };
            effectiveRevealed = [...computer.revealed, newMeld];
            setComputer(prev => ({ ...prev, hand: effectiveHand, revealed: effectiveRevealed }));
          }
          addLog(`🤖 電腦 AI 吃牌宣告【明開車/槓】，霸氣槓出您的 [${playerDiscard.name}]！`);
          setLastDiscardedCard(null);
          setDiscardPile(prev => prev.filter(c => c.id !== playerDiscard.id));

          // Replacement draw after quad (rule requirement)
          if (deck.length > 0) {
            const repDeck = [...deck];
            const repCard = repDeck.shift()!;
            setDeck(repDeck);
            addLog(`🤖 電腦開車補摸：[${repCard.name}]`);
            const repMoves = checkAvailableMoves(effectiveHand, effectiveRevealed, repCard, true);
            if (repMoves.canHu) {
              handleWin('computer', 'hu', `電腦開車補摸後胡牌！${repMoves.huResult!.explanation}`);
              setIsComputerThinking(false);
              return;
            }
            effectiveHand = sortHandForDisplay([...effectiveHand, repCard]);
            setComputer(prev => ({ ...prev, hand: effectiveHand, revealed: effectiveRevealed }));
          }
          setTimeout(() => { executeComputerDiscard(effectiveHand); }, 900);
          return;
        }

        if (moves.canPong && Math.random() < 0.75) {
          const pKey = `${playerDiscard.color}-${playerDiscard.character}`;
          const toRemove = computer.hand.filter(c => `${c.color}-${c.character}` === pKey).slice(0, 2);
          const newHand = computer.hand.filter(c => !toRemove.map(r => r.id).includes(c.id));
          const newMeld: RevealedMeld = {
            id: `comp-pong-${Date.now()}`,
            type: 'triple',
            cards: [playerDiscard, ...toRemove],
            hoo: isGeneral(playerDiscard) ? 3 : 1,
            name: `明刻 [${playerDiscard.name}*3]`,
            origin: 'discard'
          };
          setComputer(prev => ({ ...prev, hand: newHand, revealed: [...prev.revealed, newMeld] }));
          addLog(`🤖 電腦 AI 碰牌成功！亮明碰出了您的 [${playerDiscard.name}]。`);
          setLastDiscardedCard(null);
          setDiscardPile(prev => prev.filter(c => c.id !== playerDiscard.id));
          setTimeout(() => { executeComputerDiscard(newHand); }, 900);
          return;
        }
      }
    }

    // 2. Clear focus card and Draw from Deck autonomously
    if (deck.length === 0) {
      handleDrawGame();
      setIsComputerThinking(false);
      return;
    }

    // AI draws card
    playSound('draw');
    const newDeck = [...deck];
    const drawn = newDeck.shift()!;
    setDeck(newDeck);
    
    setLastDrawnCard(drawn);
    setLastDiscardedCard(null);
    setDrawnFromDeck(false); // Was drawn by computer
    addLog(`🤖 電腦 AI 從牌庫自摸摸牌：[${drawn.name}]。`);
    assertCardTotal('電腦摸牌', { deck: newDeck, pendingDrawn: drawn }, { side: 'computer', kind: 'draw' });

    if (mode === 'pairs' && pairsHandSize === 15) {
      // 15-card: self-drawn card may complete a claimable trio (碰一隻/吃一隻) — claim it immediately
      const trioOptions = checkTrioClaims(excludeLockedTrioCards(computer.hand), drawn);
      if (trioOptions.length > 0) {
        const option = trioOptions[0];
        const newHand = computer.hand.filter(c => !option.cardsToUse.map(u => u.id).includes(c.id));
        const newMeld: RevealedMeld = {
          id: `comp-trio-self-${Date.now()}`,
          type: option.meldType,
          cards: option.resultCards,
          hoo: 0,
          name: option.meldName,
          origin: 'draw'
        };
        const newRevealed = [...computer.revealed, newMeld];
        setComputer(prev => ({ ...prev, hand: newHand, revealed: newRevealed }));
        setLastDrawnCard(null);
        addLog(`🤖 電腦 AI 自摸【${option.actionLabel}】，湊成${option.meldName}。`);
        assertCardTotal(`電腦自摸${option.actionLabel}`, { computerHand: newHand, computerRevealed: newRevealed, pendingDrawn: null }, { side: 'computer', kind: 'draw' });
        setEatPairAnimWho('computer');
        setEatPairAnimCards(option.resultCards);
        setEatPairAnimSource('電腦摸牌');
        setShowEatPairAnim(true);

        if (newHand.length === 0 || checkTriosWin(newHand)) {
          setTimeout(() => {
            setShowEatPairAnim(false);
            handleWin('computer', 'pairs', '電腦的15張牌湊成5組三張，電腦勝出！', option.resultCards, { hand: newHand, revealed: newRevealed, wasSelfDraw: true });
          }, 3000);
          setIsComputerThinking(false);
          return;
        }
        setTimeout(() => {
          setShowEatPairAnim(false);
          executeComputerDiscard(newHand);
        }, 3000);
        return;
      }

      // No auto-pair; check trio win on 15-card hand
      const newHand15 = sortHandForDisplay([...computer.hand, drawn]);
      setLastDrawnCard(null);
      assertCardTotal('電腦摸牌-加入手牌(15張)', { computerHand: newHand15, pendingDrawn: null }, { side: 'computer', kind: 'draw' });
      if (checkTriosWin(newHand15)) {
        setComputer(prev => ({ ...prev, hand: newHand15 }));
        handleWin('computer', 'pairs', '電腦的15張牌湊成5組三張，電腦勝出！', [], { hand: newHand15, revealed: computer.revealed, wasSelfDraw: true });
        setIsComputerThinking(false);
        return;
      }
      setComputer(prev => ({ ...prev, hand: newHand15 }));
      setTimeout(() => { executeComputerDiscard(newHand15); }, 900);
    } else if (mode === 'pairs') {
      // 10-card: auto-pair strays
      const cGroup = groupPairsMode(computer.hand);
      const matchedIdx = cGroup.strays.findIndex(c => c.color === drawn.color && c.character === drawn.character);

      if (matchedIdx !== -1) {
        const matched = cGroup.strays[matchedIdx];
        const newHand = computer.hand.filter(c => c.id !== matched.id);
        const newMeld: RevealedMeld = {
          id: `comp-pair-draw-${Date.now()}`,
          type: 'pair',
          cards: [drawn, matched],
          hoo: isGeneral(drawn) ? 2 : 0,
          name: `對子 [${drawn.name}]`,
          origin: 'draw'
        };
        const newRevealed = [...computer.revealed, newMeld];
        setComputer(prev => ({ ...prev, hand: newHand, revealed: newRevealed }));
        setLastDrawnCard(null);
        addLog(`🤖 電腦 AI 自我配對成功！亮出明對：[${drawn.name}]。`);
        assertCardTotal('電腦自摸配對', { computerHand: newHand, computerRevealed: newRevealed, pendingDrawn: null }, { side: 'computer', kind: 'draw' });
        setEatPairAnimWho('computer');
        setEatPairAnimCards([drawn, matched]);
        setEatPairAnimSource('電腦摸牌');
        setShowEatPairAnim(true);

        const nextGroup = groupPairsMode(newHand);
        if (nextGroup.strays.length === 0) {
          setTimeout(() => {
            setShowEatPairAnim(false);
            handleWin('computer', 'pairs', '電腦自摸對子成功，手中散牌宣告配對歸零，斬獲勝利！', [drawn, matched], { hand: newHand, revealed: newRevealed, wasSelfDraw: true });
          }, 3000);
          setIsComputerThinking(false);
          return;
        }
        setTimeout(() => {
          setShowEatPairAnim(false);
          executeComputerDiscard(newHand);
        }, 3000);
      } else {
        const updatedHand = sortHandForDisplay([...computer.hand, drawn]);
        setComputer(prev => ({ ...prev, hand: updatedHand }));
        setLastDrawnCard(null);
        assertCardTotal('電腦摸牌-加入手牌', { computerHand: updatedHand, pendingDrawn: null }, { side: 'computer', kind: 'draw' });
        setTimeout(() => { executeComputerDiscard(updatedHand); }, 900);
      }
    } else {
      // Standard AI decision-making when drawing card
      const cMoves = checkAvailableMoves(computer.hand, computer.revealed, drawn, true);
      
      if (cMoves.canHu) {
        handleWin('computer', 'hu', `電腦 AI 自摸宣告胡牌！胡牌牌型：${cMoves.huResult!.explanation}`);
        setIsComputerThinking(false);
        return;
      }

      if (cMoves.canQuad) {
        const pKey = `${drawn.color}-${drawn.character}`;
        const inHand = computer.hand.filter(c => `${c.color}-${c.character}` === pKey);

        if (inHand.length === 3) {
          const quadHand = computer.hand.filter(c => !inHand.map(r => r.id).includes(c.id));
          const newMeld: RevealedMeld = {
            id: `comp-quad-self-${Date.now()}`,
            type: 'quad',
            cards: [drawn, ...inHand],
            hoo: 8,
            name: `暗開車 [${drawn.name}*4]`,
            origin: 'draw'
          };
          const quadRevealed = [...computer.revealed, newMeld];
          setComputer(prev => ({ ...prev, hand: quadHand, revealed: quadRevealed }));
          addLog(`🤖 電腦 AI 喜獲四張自摸【暗開車/暗槓】，將 [${drawn.name}] 案前暗開。`);
          setLastDrawnCard(null);

          // Replacement draw after quad (rule requirement)
          let finalHand = quadHand;
          if (deck.length > 0) {
            const repDeck = [...deck];
            const repCard = repDeck.shift()!;
            setDeck(repDeck);
            addLog(`🤖 電腦暗開車補摸：[${repCard.name}]`);
            const repMoves = checkAvailableMoves(quadHand, quadRevealed, repCard, true);
            if (repMoves.canHu) {
              handleWin('computer', 'hu', `電腦暗開車補摸後胡牌！${repMoves.huResult!.explanation}`);
              setIsComputerThinking(false);
              return;
            }
            finalHand = sortHandForDisplay([...quadHand, repCard]);
            setComputer(prev => ({ ...prev, hand: finalHand, revealed: quadRevealed }));
          }
          setTimeout(() => { executeComputerDiscard(finalHand); }, 900);
          return;
        }
      }

      // cMoves.canEatSeq is now always false for own-turn draws (isOwnTurn=true); dead branch kept for safety

      // Default draw and fallback discard
      const appendedHand = sortHandForDisplay([...computer.hand, drawn]);
      setComputer(prev => ({ ...prev, hand: appendedHand }));
      setLastDrawnCard(null);
      setTimeout(() => {
        executeComputerDiscard(appendedHand);
      }, 900);
    }
  };

  // Perform computer automatic discard evaluation
  const executeComputerDiscard = (handBeforeDicard: Card[]) => {
    // Same stale-closure risk as runComputerTurn (this is always reached via
    // setTimeout, as a separate top-level function that does not inherit
    // runComputerTurn's local rebinding) — rebind to the refs' live values.
    const deck = deckRef.current;
    const player = playerRef.current;
    const computer = computerRef.current;
    const discardPile = discardPileRef.current;

    let discardIndex = -1;

    if (mode === 'pairs' && pairsHandSize === 15) {
      // 15-card: discard card with fewest potential trio partners
      const scoreCard = (card: Card) => {
        const sameKey = handBeforeDicard.filter(x => x.color === card.color && x.character === card.character).length;
        const sameChar = handBeforeDicard.filter(x => x.character === card.character && x.color !== card.color).length;
        const seqPartner = handBeforeDicard.filter(x => x.color === card.color &&
          Math.abs(x.order - card.order) === 1 && card.order !== 7 && x.order !== 7).length;
        return sameKey + sameChar + seqPartner;
      };
      let lowest = Infinity;
      handBeforeDicard.forEach((c, idx) => {
        const s = scoreCard(c);
        if (s < lowest) { lowest = s; discardIndex = idx; }
      });
    } else if (mode === 'pairs') {
      const group = groupPairsMode(handBeforeDicard);
      if (group.strays.length > 0) {
        const choice = group.strays[0];
        discardIndex = handBeforeDicard.findIndex(c => c.id === choice.id);
      }
    } else {
      const uniqueKeys = Array.from(new Set(handBeforeDicard.map(c => `${c.color}-${c.character}`)));
      const singletons: Card[] = [];

      uniqueKeys.forEach(k => {
        const occurrences = handBeforeDicard.filter(c => `${c.color}-${c.character}` === k).length;
        if (occurrences === 1) {
          const card = handBeforeDicard.find(c => `${c.color}-${c.character}` === k)!;
          if (!isGeneral(card)) {
            singletons.push(card);
          }
        }
      });

      if (singletons.length > 0) {
        discardIndex = handBeforeDicard.findIndex(c => c.id === singletons[0].id);
      }
    }

    if (discardIndex === -1) {
      // Fallback
      const nonGenerals = handBeforeDicard.filter(c => !isGeneral(c));
      if (nonGenerals.length > 0) {
        discardIndex = handBeforeDicard.findIndex(c => c.id === nonGenerals[0].id);
      } else {
        discardIndex = Math.floor(Math.random() * handBeforeDicard.length);
      }
    }

    if (discardIndex === -1) discardIndex = 0;
    const discarded = handBeforeDicard[discardIndex];
    const finalHand = handBeforeDicard.filter((_, idx) => idx !== discardIndex);

    setComputer(prev => ({
      ...prev,
      hand: finalHand
    }));

    const newDiscardPile = [discarded, ...discardPile];
    setDiscardPile(newDiscardPile);
    setLastDiscardedCard(discarded);
    setDiscardedBy('computer');
    addLog(`🤖 電腦 AI 思考後打出了拋牌：[${discarded.name}]`);
    setGuideMessage(`電腦打出了 [${discarded.name}]，正在判斷您是否能配對...`);
    assertCardTotal('電腦丟牌', { computerHand: finalHand, discardPile: newDiscardPile }, { side: 'computer', kind: 'discard' });

    // Pairs mode: check if computer's hand is all-paired after discarding (10-card only)
    if (mode === 'pairs' && pairsHandSize === 10) {
      const compAfterGroup = groupPairsMode(finalHand);
      if (compAfterGroup.strays.length === 0 && finalHand.length > 0) {
        handleWin('computer', 'pairs', '電腦打出多餘單張後，手中散牌全部配對完畢，電腦勝出！', [], { hand: finalHand, revealed: computer.revealed, wasSelfDraw: true });
        setIsComputerThinking(false);
        return;
      }
    }

    setIsComputerThinking(false);

    // Let the discarded card sit visibly on the table for a beat before evaluating
    // (and possibly popping up) the player's reaction options — keeps the
    // discard → table display → reaction-check → radar sequence readable instead
    // of everything landing in the same instant.
    setTimeout(() => {
      // Let the player react to computer's discard!
      const playerMoves = checkAvailableMoves(player.hand, player.revealed, discarded, false);

      if (mode === 'pairs' && pairsHandSize === 15) {
        // 15-card: check if the discard completes a claimable trio (碰一隻/吃一隻)
        const trioOptions = checkTrioClaims(excludeLockedTrioCards(player.hand), discarded);
        if (trioOptions.length > 0) {
          setPendingTrioOptions(trioOptions);
          setGamePhase('waiting_player_action');
          setGuideMessage(`電腦出 [${discarded.name}]，可湊組！請選擇或按過。`);
        } else {
          setCurPlayerId('player');
          setCanDiscard(false);
          setHasDrawn(false);
          setGuideMessage('輪到您！請摸牌。');
        }
      } else if (mode === 'pairs') {
        // 10-card: offer pair match if player has matching stray
        const pGroup = groupPairsMode(player.hand);
        const canPair = pGroup.strays.some(c => c.color === discarded.color && c.character === discarded.character);

        if (canPair) {
          setPendingMoves({
            canHu: false,
            canQuad: false,
            canPong: true,
            canEatSeq: false,
            eatSeqOptions: []
          });
          setGamePhase('waiting_player_action');
          setGuideMessage(`電腦出 [${discarded.name}]，可配對！請選擇或按過。`);
        } else {
          setCurPlayerId('player');
          setCanDiscard(false);
          setHasDrawn(false);
          setGuideMessage('輪到您！請摸牌。');
        }
      } else {
        // Standard rule checks
        if (playerMoves.canHu || playerMoves.canPong || playerMoves.canQuad || playerMoves.canEatSeq) {
          setPendingMoves(playerMoves);
          setGamePhase('waiting_player_action');
          setGuideMessage(`電腦出 [${discarded.name}]，可吃碰胡！請選擇。`);
        } else {
          setCurPlayerId('player');
          setCanDiscard(false);
          setHasDrawn(false);
          setGuideMessage('輪到您！請摸牌。');
        }
      }
    }, 1000);
  };

  // Player clicks one of matching active decision choices (Eat, Pong, Quad, Hu)
  const handlePlayerAction = (actionType: 'eat' | 'pong' | 'quad' | 'hu', eatOption?: any) => {
    const trigger = lastDrawnCard || lastDiscardedCard;
    if (!trigger) return;
    if (playerActionLockRef.current) return;
    playerActionLockRef.current = true;
    setTimeout(() => { playerActionLockRef.current = false; }, 0);

    // Claiming a card straight out of the discard pile (as opposed to a self-drawn
    // trigger) must remove it from discardPile — otherwise it stays double-booked:
    // visible both in 回收牌 and in the newly revealed meld.
    const claimedFromDiscard = !lastDrawnCard && !!lastDiscardedCard;
    const newDiscardPile = claimedFromDiscard ? discardPile.filter(c => c.id !== trigger.id) : discardPile;
    if (claimedFromDiscard) {
      setDiscardPile(newDiscardPile);
    }

    playSound('action');

    if (actionType === 'pong') {
      if (mode === 'pairs') {
        // Complete the pair match safely
        const pGroup = groupPairsMode(player.hand);
        // Find in strays first, fallback to any matching card in hand
        let matchCard = pGroup.strays.find(c => c.color === trigger.color && c.character === trigger.character);
        if (!matchCard) {
          matchCard = player.hand.find(c => c.color === trigger.color && c.character === trigger.character);
        }
        
        if (matchCard) {
          const nextHand = player.hand.filter(c => c.id !== matchCard.id);
          const newMeld: RevealedMeld = {
            id: `player-pair-${Date.now()}`,
            type: 'pair',
            cards: [trigger, matchCard],
            hoo: isGeneral(trigger) ? 2 : 0,
            name: `對子 [${trigger.name}]`,
            origin: claimedFromDiscard ? 'discard' : 'draw'
          };

          const updatedRevealed = [...player.revealed, newMeld];
          setPlayer(prev => ({
            ...prev,
            hand: nextHand,
            revealed: updatedRevealed
          }));

          addLog(`【吃一隻】您吃到了 [${trigger.name}]，配對擺在案前。`);
          assertCardTotal('玩家吃一隻', { playerHand: nextHand, playerRevealed: updatedRevealed, discardPile: newDiscardPile, pendingDrawn: null }, { side: 'player', kind: 'draw' });
          setLastDrawnCard(null);
          setLastDiscardedCard(null);
          setPendingMoves(null);
          setGamePhase('playing');
          setEatPairAnimWho('player');
          setEatPairAnimCards([trigger, matchCard]);
          setEatPairAnimSource('電腦出牌');
          setShowEatPairAnim(true);

          const checkGroup = groupPairsMode(nextHand);
          if (checkGroup.strays.length === 0) {
            setTimeout(() => {
              setShowEatPairAnim(false);
              handleWin('player', 'pairs', '恭喜！您成功配對了手中所有單張散牌，解鎖大勝！', [trigger, matchCard], { hand: nextHand, revealed: updatedRevealed, wasSelfDraw: !claimedFromDiscard });
            }, 3000);
            return;
          }

          // Show animation, then allow discard
          setCurPlayerId('player');
          setHasDrawn(true);
          setCanDiscard(false);
          setTimeout(() => {
            setShowEatPairAnim(false);
            setCanDiscard(true);
            setGuideMessage('配對成功！請選牌打出。');
          }, 3000);
        } else {
          // Fallback to avoid deadlocks/hangs if mismatch occurs
          addLog(`【配對提示】手牌未找到與 [${trigger.name}] 相同的牌，無法配對，已自動回歸您的打牌階段。`);
          setLastDrawnCard(null);
          setLastDiscardedCard(null);
          setPendingMoves(null);
          setGamePhase('playing');
          setCanDiscard(true);
          setCurPlayerId('player');
        }
      } else {
        // Standard rule Pong (碰)
        const triggerKey = `${trigger.color}-${trigger.character}`;
        const toRemove = player.hand.filter(c => `${c.color}-${c.character}` === triggerKey).slice(0, 2);
        const nextHand = player.hand.filter(c => !toRemove.map(r => r.id).includes(c.id));
        
        const newMeld: RevealedMeld = {
          id: `player-pong-${Date.now()}`,
          type: 'triple',
          cards: [trigger, ...toRemove],
          hoo: isGeneral(trigger) ? 3 : 1, // Standard general triple gets 3 Hoo
          name: `明刻 [${trigger.name}*3]`,
          origin: claimedFromDiscard ? 'discard' : 'draw'
        };

        setPlayer(prev => ({
          ...prev,
          hand: nextHand,
          revealed: [...prev.revealed, newMeld]
        }));

        addLog(`【碰牌】您高喊「碰」！碰起 [${trigger.name}] 集成三張。`);
        setLastDrawnCard(null);
        setLastDiscardedCard(null);
        setPendingMoves(null);
        setGamePhase('playing');
        setCanDiscard(true); // Player must discard now
        setCurPlayerId('player');
        setHasDrawn(true);
        setGuideMessage('碰牌成刻！已亮明案前。請選一張手牌打出。');
      }
    } else if (actionType === 'quad') {
      // Quad /槓 /開車
      const triggerKey = `${trigger.color}-${trigger.character}`;
      const toRemove = player.hand.filter(c => `${c.color}-${c.character}` === triggerKey);
      const quadHand = player.hand.filter(c => !toRemove.map(r => r.id).includes(c.id));
      const newMeld: RevealedMeld = {
        id: `player-quad-${Date.now()}`,
        type: 'quad',
        cards: [trigger, ...toRemove],
        hoo: 6,
        name: `明開車 [${trigger.name}*4]`,
        origin: claimedFromDiscard ? 'discard' : 'draw'
      };
      const quadRevealed = [...player.revealed, newMeld];

      addLog(`【開車】您高喊「開車(槓)」！明開車 [${trigger.name}]。`);
      setLastDrawnCard(null);
      setLastDiscardedCard(null);
      setPendingMoves(null);

      // Replacement draw after Quad (rule requirement)
      if (deck.length > 0) {
        const repDeck = [...deck];
        const repCard = repDeck.shift()!;
        setDeck(repDeck);
        addLog(`【開車補牌】補摸一張：[${repCard.name}]`);
        playSound('draw');

        const repMoves = checkAvailableMoves(quadHand, quadRevealed, repCard, true);
        setPlayer(prev => ({ ...prev, hand: quadHand, revealed: quadRevealed }));

        if (repMoves.canHu || repMoves.canQuad) {
          setLastDrawnCard(repCard);
          setDrawnFromDeck(true);
          setPendingMoves(repMoves);
          setGamePhase('waiting_player_action');
          setGuideMessage(`補摸 [${repCard.name}]，可行動！請選擇。`);
        } else {
          const finalHand = sortHandForDisplay([...quadHand, repCard]);
          setPlayer(prev => ({ ...prev, hand: finalHand, revealed: quadRevealed }));
          setGamePhase('playing');
          setCanDiscard(true);
          setCurPlayerId('player');
          setHasDrawn(true);
          setGuideMessage(`開車順利！補摸 [${repCard.name}]，請選牌打出。`);
        }
      } else {
        setPlayer(prev => ({ ...prev, hand: quadHand, revealed: quadRevealed }));
        setGamePhase('playing');
        setCanDiscard(true);
        setCurPlayerId('player');
        setHasDrawn(true);
        setGuideMessage('開車成功！牌庫已空，請選牌打出。');
      }
    } else if (actionType === 'eat' && eatOption) {
      // Eat Sequence for Standard mode
      const idsToRemove = eatOption.cardsToUse.map((c: Card) => c.id);
      const nextHand = player.hand.filter(c => !idsToRemove.includes(c.id));

      const newMeld: RevealedMeld = {
        id: `player-eat-${Date.now()}`,
        type: 'consec_three',
        cards: eatOption.resultCards,
        hoo: 2,
        name: eatOption.meldName,
        origin: 'discard'
      };

      setPlayer(prev => ({
        ...prev,
        hand: nextHand,
        revealed: [...prev.revealed, newMeld]
      }));

      addLog(`【吃牌】您宣告吃牌！組成同色牌組 [${eatOption.meldName}]。`);
      setLastDrawnCard(null);
      setLastDiscardedCard(null);
      setPendingMoves(null);
      setGamePhase('playing');
      setCanDiscard(true);
      setCurPlayerId('player');
      setHasDrawn(true);
      setGuideMessage(`吃牌成功！組成同色序列 [${eatOption.meldName}]。請選牌打出。`);
    } else if (actionType === 'hu') {
      handleWin('player', 'hu', pendingMoves!.huResult!.explanation);
    }
  };

  // 15-card mode: player claims a 碰一隻/吃一隻 trio (either self-drawn or from opponent's discard)
  const handlePlayerTrioAction = (option: TrioClaimOption) => {
    const trigger = lastDrawnCard || lastDiscardedCard;
    if (!trigger) return;
    if (playerActionLockRef.current) return;
    playerActionLockRef.current = true;
    setTimeout(() => { playerActionLockRef.current = false; }, 0);

    // Claiming straight out of the discard pile must remove the card from
    // discardPile — otherwise it stays double-booked (still shown in 回收牌
    // while also now part of the newly revealed 組).
    const claimedFromDiscard = !lastDrawnCard && !!lastDiscardedCard;
    const newDiscardPile = claimedFromDiscard ? discardPile.filter(c => c.id !== trigger.id) : discardPile;
    if (claimedFromDiscard) {
      setDiscardPile(newDiscardPile);
    }

    playSound('action');

    const wasSelfDraw = !!lastDrawnCard;
    const nextHand = player.hand.filter(c => !option.cardsToUse.map(u => u.id).includes(c.id));
    const newMeld: RevealedMeld = {
      id: `player-trio-${Date.now()}`,
      type: option.meldType,
      cards: option.resultCards,
      hoo: 0,
      name: option.meldName,
      origin: wasSelfDraw ? 'draw' : 'discard'
    };
    const newRevealed = [...player.revealed, newMeld];
    setPlayer(prev => ({ ...prev, hand: nextHand, revealed: newRevealed }));
    addLog(`【${option.actionLabel}】您用 [${trigger.name}] 湊成${option.meldName}，鎖定亮出。`);
    assertCardTotal(`玩家${option.actionLabel}`, { playerHand: nextHand, playerRevealed: newRevealed, discardPile: newDiscardPile, pendingDrawn: null }, { side: 'player', kind: 'draw' });
    setLastDrawnCard(null);
    setLastDiscardedCard(null);
    setPendingMoves(null);
    setPendingTrioOptions([]);
    setGamePhase('playing');
    setEatPairAnimWho('player');
    setEatPairAnimCards(option.resultCards);
    setEatPairAnimSource(wasSelfDraw ? '玩家摸牌' : '電腦出牌');
    setShowEatPairAnim(true);

    if (nextHand.length === 0 || checkTriosWin(nextHand)) {
      setTimeout(() => {
        setShowEatPairAnim(false);
        handleWin('player', 'pairs', '恭喜！您的15張牌已湊成5組三張，宣告勝出！', option.resultCards, { hand: nextHand, revealed: newRevealed, wasSelfDraw });
      }, 3000);
      return;
    }

    setCurPlayerId('player');
    setHasDrawn(true);
    setCanDiscard(false);
    setTimeout(() => {
      setShowEatPairAnim(false);
      setCanDiscard(true);
      setGuideMessage('組合成功！請選牌打出。');
    }, 3000);
  };

  // Human manual trigger of WIN (HU)
  const handleDeclareHuSelf = () => {
    playSound('click');
    const result = solveHu(player.hand, player.revealed);
    if (result.canHu) {
      handleWin('player', 'hu', result.explanation);
    } else {
      playSound('lose');
      setGuideMessage('尚未達成胡牌條件（需完整分組且達 10 胡）。');
      addLog(`[宣告失敗] ${result.explanation}`);
    }
  };

  // Player skips matching option trigger
  const handlePlayerSkip = () => {
    if (playerActionLockRef.current) return;
    playerActionLockRef.current = true;
    setTimeout(() => { playerActionLockRef.current = false; }, 0);
    playSound('click');
    addLog(`您的回合判定：您選擇【過 (跳過行動)】。`);

    setPendingMoves(null);
    setPendingTrioOptions([]);
    setGamePhase('playing');

    if (curPlayerId === 'player' && lastDrawnCard && drawnFromDeck) {
      // Skipped on self-drawn card. Push to hand and prepare discard action.
      // 15-card mode: the drawn card was only withheld from the hand because
      // it could ALSO complete a claimable trio (see handlePlayerDraw) — the
      // player might have skipped that specific option because the hand is
      // ALREADY a complete win without locking it into a meld, so this still
      // needs its own win check (checkTriosWin), same as the normal
      // no-claimable-trio draw path does.
      const appendedHand = sortHandForDisplay([...player.hand, lastDrawnCard]);
      setLastDrawnCard(null);
      assertCardTotal('玩家跳過-摸牌加入手牌', { playerHand: appendedHand, pendingDrawn: null }, { side: 'player', kind: 'draw' });
      if (mode === 'pairs' && pairsHandSize === 15 && checkTriosWin(appendedHand)) {
        setPlayer(prev => ({ ...prev, hand: appendedHand }));
        handleWin('player', 'pairs', '恭喜！您的15張牌已湊成5組三張，宣告勝出！', [], { hand: appendedHand, revealed: player.revealed, wasSelfDraw: true });
        return;
      }
      setPlayer(prev => ({ ...prev, hand: appendedHand }));
      setCanDiscard(true);
      setGuideMessage('已跳過，請選牌打出。');
    } else {
      // Skipped reacting to opponent's discard card. Turn becomes computer's active draw turn
      setLastDiscardedCard(null);
      setCanDiscard(false);
      setCurPlayerId('computer');
      setIsComputerThinking(true);
      setGuideMessage('電腦摸牌中...');
      
      setTimeout(() => {
        runComputerTurn(null);
      }, 1000);
    }
  };

  // Triggers game-over winner scene
  // `scoring` is only meaningful for type==='pairs' wins (10/15-card 抓對子 modes —
  // the only modes actually reachable via the lobby). It must carry the winner's
  // FINAL hand/revealed explicitly rather than have handleWin read `player`/
  // `computer` off its own closure: most callers fire this synchronously right
  // after (or inside a setTimeout following) their own `setPlayer`/`setComputer`
  // call in the same turn, and React state updates aren't visible in the closure
  // that issued them — reading `player.hand` here would often be one render stale.
  const handleWin = (
    winner: 'player' | 'computer',
    type: 'pairs' | 'hu',
    explanation: string,
    winCards: Card[] = [],
    scoring?: { hand: Card[]; revealed: RevealedMeld[]; wasSelfDraw: boolean }
  ) => {
    playSound(winner === 'player' ? 'win' : 'lose');
    setGamePhase('game_over');
    setWinnerId(winner);
    setWinType(type);

    let breakdown: ScoreBreakdown | null = null;
    if (type === 'pairs' && scoring) {
      // 門清 is now purely structural: true unless the revealed melds include at
      // least one claimed straight out of the opponent's discard pile (碰/吃).
      // Self-formed melds (origin 'draw') never break it, matching the rule that
      // 露牌 only counts discard-claimed melds.
      const wasMenqing = !scoring.revealed.some(m => m.origin === 'discard');
      breakdown = scorePairsWin(scoring.hand, scoring.revealed, pairsHandSize, scoring.wasSelfDraw, wasMenqing);
    }
    setWinExplanation(explanation);
    setWinScore(breakdown);

    // 贏家得分、輸家扣分；玩家分數同時寫回 localStorage 做跨 session 持久化
    // （電腦分數只在記憶體中，於 initGame(isNewSession=true) 時重設）。
    if (breakdown) {
      const payout = breakdown.payout;
      const newPlayerScore = player.score + (winner === 'player' ? payout : -payout);
      const newComputerScore = computer.score + (winner === 'computer' ? payout : -payout);
      setPlayer(prev => ({ ...prev, score: newPlayerScore }));
      setComputer(prev => ({ ...prev, score: newComputerScore }));
      savePlayerScore(playerName, newPlayerScore);
    }

    addLog(`📢 牌局終止！【${winner === 'player' ? '玩家' : '電腦 AI'}】宣佈贏得本盤勝利！理由：${explanation}${breakdown ? `（共 ${breakdown.totalTai} 台）` : ''}`);
    setHuAnimWho(winner);
    setHuAnimCards(winCards);
    setHuAnimSelfDraw(!!scoring?.wasSelfDraw);
    setShowHuCelebration(true);
    setHuCelebShowContinue(false);
    setTimeout(() => setHuCelebShowContinue(true), 5000);
  };

  // Triggers draw game when remaining cards hit zero
  const handleDrawGame = () => {
    playSound('lose');
    setGamePhase('game_over');
    setWinnerId(null);
    setWinType(null);
    setWinExplanation('牌庫的所有卡牌已被完全抽空！雙方均未能滿足宣告牌局大勝，最終判定為【流局平手】。');
    addLog(`📢 牌局終止！牌庫摸牌告磬。宣布「荒局/流局」和局。`);
  };

  // Change to rules tab
  const handleSwitchTab = (tabName: typeof activeTutorialTab) => {
    playSound('click');
    setActiveTutorialTab(tabName);
  };

  // Modal returning navigation
  const handleBackFromRules = () => {
    playSound('click');
    setActivePage(previousPage);
  };

  const handleOpenRules = () => {
    playSound('click');
    setPreviousPage(activePage);
    setActivePage('rules');
  };

  const handleQuitToLobby = () => {
    playSound('click');
    if (activePage === 'game' && gamePhase === 'playing') {
      if (!backConfirmPending) {
        setBackConfirmPending(true);
        setTimeout(() => setBackConfirmPending(false), 3000);
        return;
      }
      setBackConfirmPending(false);
    }
    setGamePhase('setup');
    setActivePage('lobby');
  };

  // Dynamic checks for Standard Mode score preview helper
  // Include lastDrawnCard when it is pending (not yet merged into player.hand)
  const huCheckHand = lastDrawnCard && drawnFromDeck ? [...player.hand, lastDrawnCard] : player.hand;
  const activeHuCheck = solveHu(huCheckHand, player.revealed);
  const playerGrouping = groupPairsMode(player.hand);
  const computerGrouping = groupPairsMode(computer.hand);
  // Only discard-claimed melds (碰/吃) count as 露牌 — self-formed ones render
  // inline in the computer's own hand-fan (cheat mode) instead.
  const computerClaimedMelds = computer.revealed.filter(m => m.origin === 'discard');

  // 15-card mode: "組" hint (all 3 valid trio types) — locked from discard, seated together in display
  const player15TrioGroups = mode === 'pairs' && pairsHandSize === 15 ? find15TrioHints(player.hand) : [];
  const player15TrioIds = new Set(player15TrioGroups.flat().map(c => c.id));
  const computer15TrioIds = new Set(
    (mode === 'pairs' && pairsHandSize === 15 ? find15TrioHints(computer.hand) : []).flat().map(c => c.id)
  );
  // 散牌 = 手裡牌扣除掉已標示對子/組子的牌。10張玩法看的是「對」（同色同字在
  // 手牌裡有沒有搭檔，即 groupPairsMode 的配對邏輯，跟手牌格線裡「對」徽章用的
  // 是同一套判斷）；15張玩法看的是「組」（能不能湊成任一種組子提示，跟手牌格線
  // 裡「組」徽章用的是同一套 find15TrioHints 判斷）——15張玩法先前誤用了10張
  // 玩法的配對邏輯，算出來的散牌數跟畫面上實際的徽章標記兜不起來。
  const playerStrayCount = mode !== 'pairs' ? 0
    : pairsHandSize === 15 ? player.hand.length - player15TrioIds.size
    : playerGrouping.strays.length;
  const computerStrayCount = mode !== 'pairs' ? 0
    : pairsHandSize === 15 ? computer.hand.length - computer15TrioIds.size
    : computerGrouping.strays.length;
  // Locked melds split by origin: self-formed ones (drawn — never touched the
  // opponent's discard) render inline in the hand grid, badge-marked, since
  // they're conceptually "still yours". Melds claimed from the opponent's
  // discard (碰/吃) instead render in the separate 露牌 row (see
  // playerClaimedMelds below), matching the original display and — more
  // importantly — being the only thing that counts toward 露牌/breaks 門清.
  const playerDrawMelds = player.revealed.filter(m => m.origin === 'draw');
  const playerClaimedMelds = player.revealed.filter(m => m.origin === 'discard');
  const playerRevealedCards = playerDrawMelds.flatMap(m => m.cards);
  const playerRevealedIds = new Set(playerRevealedCards.map(c => c.id));
  const playerRevealedBadge = new Map<string, string>();
  playerDrawMelds.forEach(meld => {
    const label = meld.type === 'pair' ? '對' : '組';
    meld.cards.forEach(c => playerRevealedBadge.set(c.id, label));
  });
  const playerHandDisplay = [
    ...playerRevealedCards,
    ...player15TrioGroups.flat(),
    ...player.hand.filter(c => !player15TrioIds.has(c.id)),
  ];
  // Row-1 capacity (columns before wrapping to row 2, portrait only). iPhone:
  // 10-card mode's normal hand fills row 1 with 6 cards exactly (matching
  // the fixed 6-card width reference, so 10-card mode never needs to
  // scroll); 15-card mode's larger hand prioritizes filling row 1 with 9
  // before wrapping to row 2 — since card width stays fixed for 6, those
  // extra 3 columns overflow past the visible width and the hand scrolls
  // horizontally to reach them. iPad: both modes prioritize filling row 1
  // with 10 cards, matching its own 10-card width reference exactly (see
  // portraitReferenceCols above), so 10-card mode never scrolls and 15-card
  // mode only scrolls for its last few cards. In landscape the hand is a
  // single row instead, so the column count is simply however many cards
  // are actually displayed.
  const handRowCapacity = showTwoRowHand
    ? (isPhoneSized ? (mode === 'pairs' && pairsHandSize === 15 ? 9 : 6) : 10)
    : (playerHandDisplay.length || 1);

  // 桌面牌 discard/drawn card size: mirrors handCardDims's proportions but capped independently
  // of the (fixed-height) table row, so it never feeds back into the hand container's ResizeObserver.
  const tableCardDims = (() => {
    const maxH = 90;
    const h = Math.min(handCardDims.h, maxH);
    const aspect = handCardDims.h > 0 ? handCardDims.w / handCardDims.h : 32 / 84;
    return { w: Math.round(h * aspect), h, fs: Math.round(handCardDims.fs * (h / (handCardDims.h || h))) };
  })();

  // Where the current claimable trigger card came from — used to annotate the
  // radar panel and the 吃一隻/碰一隻 animation so it's clear whether the
  // opportunity came from a self-draw or an opponent's discard.
  const triggerSourceLabel = lastDrawnCard
    ? (drawnFromDeck ? '玩家摸牌' : '電腦摸牌')
    : lastDiscardedCard
      ? (discardedBy === 'computer' ? '電腦出牌' : '玩家出牌')
      : '';

  const renderMiniCard = (c: Card, key: string) => (
    <div key={key} className="w-5 h-5 rounded-sm flex items-center justify-center font-black text-base shrink-0 overflow-visible" style={{
      backgroundColor: c.color === 'yellow' ? '#ffd300' : c.color === 'green' ? '#299c42' : c.color === 'red' ? '#ff5511' : '#ffffff',
      color: c.color === 'yellow' ? '#ab1313' : '#111111',
    }}>
      {c.character}
    </div>
  );

  // Small fanned four-color-cards logo (no text) — one blank card in each of
  // the four suit colors, used in place of decorative icons/emoji on the
  // lobby title and launch button.
  const renderFourColorLogo = (height: number) => (
    <div className="flex items-center shrink-0" style={{ height }}>
      {(['yellow', 'green', 'red', 'white'] as const).map((color, i) => (
        <div
          key={color}
          className="rounded-[2px] border border-black/40 shadow-sm"
          style={{
            width: height * 0.56,
            height,
            background: color === 'yellow' ? '#ffd300' : color === 'green' ? '#299c42' : color === 'red' ? '#ff5511' : '#ffffff',
            marginLeft: i === 0 ? 0 : -height * 0.22,
            zIndex: i,
          }}
        />
      ))}
    </div>
  );

  return (
    <div className="min-h-screen w-full bg-[#0a1628] text-slate-100 flex justify-center relative font-sans select-none">
      
      {/* BACKGROUND GRADIENT */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#0d2d6b_0%,_#071020_100%)] opacity-80 z-0 pointer-events-none" />

      {/* FULLSCREEN GAME BOARD CONSOLE */}
      <div
        className="w-full max-w-7xl min-h-screen bg-[#0f2d5c]/95 shadow-2xl flex flex-col relative border-x border-blue-950/40 z-20 animate-fade-in"
      >

        {/* ========================================== */}
        {/* INTERACTIVE MULTI-PAGE VIEW SYSTEM         */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col min-h-0 w-full relative bg-[radial-gradient(circle_at_center,_#1a3d7c_0%,_#0a2347_100%)] select-none">
          
          {/* 1. Lobby/Setup Page (遊戲開始設定頁面) */}
          {activePage === 'lobby' && (
            <div className="flex-1 px-5 lg:px-16 xl:px-32 flex flex-col gap-3 select-none text-white overflow-y-auto min-h-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', paddingBottom: '1rem' }}>
              
              {/* Grand compact title */}
              <div className="text-center space-y-1.5 py-2 shrink-0">
                <div className="flex items-center justify-center gap-3">
                  {renderFourColorLogo(28)}
                  <h1 className="text-3xl md:text-4xl font-serif font-black tracking-widest text-yellow-500 select-none">
                    四色牌-吃一隻
                  </h1>
                  <img src={liangGameLogo} alt="LIANG GAME" className="w-9 h-9 rounded-full object-cover shrink-0" />
                </div>
                <p className="text-sm tracking-widest text-blue-200 font-extrabold uppercase font-mono">
                  — 專為銀髮長輩特製 · 護腦防失智 —
                </p>
              </div>

              {/* Steps in a beautiful compact grid to avoid scrolling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 select-none min-h-0 shrink-0 items-start">
                
                {/* Step 1: Avatar Selector and username setup */}
                <div className="bg-black/35 p-4 rounded-2xl border border-white/10 flex flex-col justify-center space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm bg-yellow-500 text-slate-950 font-black px-2.5 py-1 rounded shrink-0">1. 入席編制</span>
                    <p className="text-sm font-extrabold text-yellow-400">入席玩家暱稱與頭像：</p>
                  </div>

                  {/* Picker list */}
                  <div className="flex justify-between items-center gap-1 select-none">
                    {avatars.map((av, idx) => (
                      <button
                        key={idx}
                        onClick={() => { playSound('click'); setUserAvatar(av); }}
                        className={`text-2xl h-11 w-11 flex items-center justify-center rounded-xl transition-all ${
                          playerAvatar === av
                            ? 'bg-yellow-500 scale-110 border-2 border-white shadow-lg ring-3 ring-yellow-500/40'
                            : 'bg-white/10 hover:bg-white/15'
                        }`}
                      >
                        {av}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    maxLength={10}
                    value={playerName}
                    onChange={(e) => setUserName(e.target.value || '長輩玩家')}
                    className="w-full py-3 px-4 bg-[#0a1e3d] border border-blue-600 rounded-xl text-lg text-center font-bold text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500"
                    placeholder="輸入長輩的手遊暱稱"
                  />
                </div>

                {/* Step 2: Game Mode Picker */}
                <div className="bg-black/35 p-4 rounded-2xl border border-white/10 flex flex-col justify-center space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-sm bg-yellow-500 text-slate-950 font-black px-2.5 py-1 rounded shrink-0">2. 自選玩法</span>
                    <p className="text-sm font-extrabold text-yellow-400">👦 抓對對子簡單對戰</p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => { playSound('click'); setPairsHandSize(10); }}
                      className={`text-left px-4 py-4 rounded-xl border-2 transition-all font-black ${
                        pairsHandSize === 10
                          ? 'bg-yellow-500 text-slate-950 border-yellow-300 shadow-lg scale-[1.02]'
                          : 'bg-white/10 text-slate-200 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-lg">10張五對胡（發9張）</div>
                      <div className={`text-xs font-medium mt-0.5 ${pairsHandSize === 10 ? 'text-slate-800' : 'text-slate-400'}`}>
                        湊滿 5 對牌即胡，規則最簡單，新手首選
                      </div>
                    </button>
                    <button
                      onClick={() => { playSound('click'); setPairsHandSize(15); }}
                      className={`text-left px-4 py-4 rounded-xl border-2 transition-all font-black ${
                        pairsHandSize === 15
                          ? 'bg-yellow-500 text-slate-950 border-yellow-300 shadow-lg scale-[1.02]'
                          : 'bg-white/10 text-slate-200 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="text-lg">15張五組胡（發14張）</div>
                      <div className={`text-xs font-medium mt-0.5 ${pairsHandSize === 15 ? 'text-slate-800' : 'text-slate-400'}`}>
                        湊滿 5 組三張即胡，稍具挑戰性
                      </div>
                    </button>
                  </div>

                  {/* Extras: sound / computer-hand toggles + rules button */}
                  <div className="flex items-center gap-2 pt-1 border-t border-white/10 mt-1">
                    <button
                      onClick={() => setSoundEnabled(!soundEnabled)}
                      className="flex-1 flex items-center gap-1.5 justify-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
                    >
                      {soundEnabled ? <Volume2 className="w-4 h-4 text-blue-400 shrink-0" /> : <VolumeX className="w-4 h-4 text-red-400 shrink-0" />}
                      <span>語音：{soundEnabled ? '開' : '關'}</span>
                    </button>

                    <button
                      onClick={() => setShowComputerHand(!showComputerHand)}
                      className="flex-1 flex items-center gap-1.5 justify-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
                    >
                      {showComputerHand ? <Eye className="w-4 h-4 text-blue-400 shrink-0" /> : <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />}
                      <span>電腦手牌：{showComputerHand ? '開' : '關'}</span>
                    </button>

                    <button
                      onClick={handleOpenRules}
                      className="flex-1 flex items-center gap-1.5 justify-center py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 hover:text-white"
                    >
                      <BookOpen className="w-4 h-4 text-yellow-500 shrink-0" />
                      <span>說明</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Launcher */}
              <div className="shrink-0">
                <button
                  onClick={() => { playSound('click'); initGame(); }}
                  className="w-full py-5 bg-yellow-500 hover:brightness-105 active:scale-98 transition-all font-black text-slate-950 text-2xl rounded-xl border-4 border-red-500 flex items-center justify-center gap-2 select-none"
                  style={{ animation: 'bounceSmall 1.4s ease-in-out infinite, huBoxGlow 1s ease-in-out infinite alternate' }}
                >
                  開始遊戲 {renderFourColorLogo(26)}
                </button>
              </div>

            </div>
          )}

          {/* 2. Game Play Page (遊戲頁面) */}
          {activePage === 'game' && (
            <div
              className={`flex-1 flex flex-col h-full w-full select-none text-white relative ${isPhoneLandscape ? 'overflow-y-auto' : 'overflow-hidden'}`}
              style={isPhoneLandscape ? { paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' } : undefined}
            >
              
              {/* Compact header — paddingTop fills behind the notch */}
              <header
                className="bg-black/40 border-b border-white/10 px-3 flex flex-col shrink-0 select-none z-10"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
              >
                {/* Row 1: navigation buttons */}
                <div className="h-12 flex items-center justify-between">
                  <button
                    onClick={handleQuitToLobby}
                    className={`py-1.5 px-3 border text-sm font-extrabold rounded-xl transition-all ${
                      backConfirmPending
                        ? 'bg-red-600 border-red-400 text-white'
                        : 'bg-red-950/60 hover:bg-red-900/80 border-red-800 text-red-200'
                    }`}
                  >
                    {backConfirmPending ? '再按確定返回' : '🚪 返回'}
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { playSound('click'); setSoundEnabled(!soundEnabled); }}
                      className="p-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-full transition-colors"
                    >
                      {soundEnabled ? <Volume2 className="w-5 h-5 text-blue-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                    </button>
                    <img src={liangGameLogo} alt="LIANG GAME" className="w-8 h-8 rounded-full object-cover shrink-0" />
                    <button
                      onClick={() => setShowLogDrawer(!showLogDrawer)}
                      className="p-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-full transition-colors"
                    >
                      <History className="w-5 h-5 text-slate-400" />
                    </button>
                  </div>

                  <button
                    onClick={handleOpenRules}
                    className="py-1.5 px-3 bg-yellow-500 text-slate-950 text-sm font-black rounded-xl transition-all flex items-center gap-1 shadow hover:bg-yellow-400"
                  >
                    <HelpCircle className="w-4 h-4 shrink-0" />
                    說明
                  </button>
                </div>

              </header>

              {/* GAME SPACE FLOW. On phone-landscape this (and the layers below, down to
                  the hand wrapper) drop min-h-0 so they size to their actual content
                  instead of being squeezed to fit — since the card size there is fixed
                  (not fitted to available space, see the effect above), letting them
                  overflow their flex-allocated space and be revealed via the game page
                  root's scroll is what keeps the cards from shrinking to near-nothing. */}
              <div className={`flex-1 flex overflow-hidden ${isPhoneLandscape ? '' : 'min-h-0'}`}>
              {/* iPhone portrait keeps its original max-w-lg cap untouched. Every other
                  device (useWideLayout) fills the full width available inside the outer
                  max-w-7xl console instead — the hand-sizing effect above reads this
                  wider containerW and scales every card/button up proportionally through
                  the exact same iPhone formula, so the whole screen enlarges to fill the
                  space while staying pixel-ratio-identical to iPhone. */}
              <div className={`flex-1 flex flex-col overflow-hidden mx-auto ${isPhoneLandscape ? '' : 'min-h-0'} ${useWideLayout ? 'w-full' : 'max-w-lg'}`}>

                {/* ① 遊戲頁面 — Game Display Panel */}
                <div className="shrink-0 flex flex-col px-3 pt-2 pb-1.5 space-y-1.5 border-b-2 border-white/10">

                {/* AI / OPPONENT STATUS (Top) */}
                <div className="bg-black/35 p-2 rounded-2xl border border-white/5 space-y-1 text-sm relative select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-black">
                      <Cpu className="w-4 h-4 animate-pulse text-cyan-400" />
                      <span>{computer.name}</span>
                      <span className="text-[11px] font-bold bg-cyan-400/10 border border-cyan-400/30 rounded-full px-2 py-0.5 tabular-nums">{computer.score.toLocaleString()}</span>
                    </div>

                    {mode === 'pairs' ? (
                      <div className="flex items-center gap-1 text-xs text-cyan-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold">
                        <span>散牌:</span>
                        <strong className="text-cyan-400 text-sm">{computerStrayCount}</strong>
                        <span>張</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-xs text-cyan-400 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold">
                        <span>賸餘牌:</span>
                        <strong className="text-cyan-400 text-sm">{computer.hand.length}</strong>
                        <span>張</span>
                      </div>
                    )}
                  </div>

                  {/* Robot's 露牌: only melds claimed from the player's discard (碰/吃) —
                      self-formed ones render inline in the hand area below (or in the
                      透視 fan when cheat mode is on) and don't count here. */}
                  {mode === 'pairs' ? (
                    <div className="flex items-center gap-1.5 p-1 bg-black/25 rounded-xl border border-white/5">
                      <span className="text-xs font-bold text-cyan-400 shrink-0">{pairsHandSize === 15 ? '組' : '對'}</span>
                      <strong className="text-sm text-cyan-400 shrink-0">{computerClaimedMelds.length}</strong>
                      <div className="flex flex-wrap gap-[3px] flex-1 min-w-0">
                        {computerClaimedMelds.length > 0
                          ? computerClaimedMelds.map((meld) => (
                              <div key={meld.id} className="flex gap-[1px]">
                                {meld.cards.map((c, i) => renderMiniCard(c, `comp-claim-${meld.id}-${c.id}-${i}`))}
                              </div>
                            ))
                          : <span className="text-cyan-400/60 text-xs">無</span>}
                      </div>
                    </div>
                  ) : computer.revealed.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 mt-0.5 overflow-x-auto whitespace-nowrap scrollbar-none">
                      <span className="text-xs text-cyan-400 font-bold shrink-0">案前亮相：</span>
                      <div className="flex gap-1">
                        {computer.revealed.map((meld) => (
                          <div key={meld.id} className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-xs flex items-center gap-0.5">
                            <span className="text-cyan-400 font-bold leading-none">{meld.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fan of AI cards — only shown in cheat/透視 mode. Self-formed (draw-origin)
                      melds render inline with the rest of the hand, tagged with their 對/組
                      badge; discard-claimed melds already show in the 露牌 row above instead. */}
                  {showComputerHand && (
                    <div className="flex flex-wrap justify-center items-center gap-0.5 pt-1.5 border-t border-white/5 max-h-[110px] overflow-hidden">
                      {computer.revealed.filter(m => m.origin === 'draw').flatMap(meld =>
                        meld.cards.map((card, i) => (
                          <div key={`comp-revealed-${meld.id}-${card.id}-${i}`} className="opacity-75 filter scale-75 relative">
                            <FourColorCard card={card} size="sm" isRevealed={true} disabled={true} />
                            <span className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-[10px] font-black leading-none py-0.5" style={{ background: '#1d4ed8', color: '#ffffff' }}>
                              {meld.type === 'pair' ? '對' : '組'}
                            </span>
                          </div>
                        ))
                      )}
                      {computer.hand.map((card) => (
                        <div key={card.id} className="opacity-75 filter scale-75">
                          <FourColorCard card={card} size="sm" isRevealed={true} disabled={true} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* THE PORTRAIT RIVER / TABLE (Middle) — 桌面牌(左半) | 回收牌(右半)。摸牌按鈕已移至下方 ACTION BAR，跟打出這張牌並排 */}
                {/* Fixed row height — must NOT derive from handCardDims: this row is a shrink-0 sibling of
                    the flex-1 hand container below, so a handCardDims-derived height here would create a
                    layout feedback loop (row height <-> hand container's measured available height),
                    which occasionally left the hand grid mis-sized until an unrelated re-render (e.g. drawing
                    a card) forced the ResizeObserver to settle. The table card is capped independently instead. */}
                <div className="p-2 bg-black/20 rounded-2xl border border-white/5 flex gap-1.5 items-stretch select-none" style={{ height: 110 }}>

                  {/* Left half: 桌面牌 — text left (enlarged), card right (matches hand card size, capped) */}
                  <div className="flex-1 basis-1/2 min-w-0 flex gap-2 py-1 px-1 border-r border-white/10 overflow-hidden">
                    <div className="flex flex-col justify-between shrink-0">
                      <span className="font-bold text-yellow-300 leading-none" style={{ fontSize: 14 }}>桌面牌</span>
                      <div>
                        {lastDrawnCard && (
                          <span className="font-black leading-none block" style={{ fontSize: 14, color: drawnFromDeck ? '#fde047' : '#22d3ee' }}>
                            {drawnFromDeck ? '玩家摸牌' : '電腦摸牌'}
                          </span>
                        )}
                        {!lastDrawnCard && lastDiscardedCard && discardedBy && (
                          <span className="font-black leading-none block" style={{ fontSize: 14, color: discardedBy === 'computer' ? '#22d3ee' : '#fde047' }}>
                            {discardedBy === 'computer' ? '電腦出牌' : '玩家出牌'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex-1 flex items-center justify-center min-w-0">
                      {lastDrawnCard ? (
                        <FourColorCard card={lastDrawnCard} size="xs" isRevealed={true} disabled={true}
                          cardStyle={{ width: tableCardDims.w, height: tableCardDims.h }} charFontSize={tableCardDims.fs} />
                      ) : lastDiscardedCard ? (
                        <FourColorCard card={lastDiscardedCard} size="xs" isRevealed={true} disabled={true}
                          cardStyle={{ width: tableCardDims.w, height: tableCardDims.h }} charFontSize={tableCardDims.fs} />
                      ) : (
                        <span className="text-[10px] text-slate-500">—</span>
                      )}
                    </div>
                  </div>

                  {/* Right half: 回收區 */}
                  <div className="flex-1 basis-1/2 min-w-0 flex flex-col py-0.5 px-1 overflow-hidden">
                    <span className="text-[10px] font-bold text-yellow-300 mb-0.5 leading-none shrink-0">回收牌</span>
                    <div className="flex-1 min-h-0 overflow-y-auto bg-black/40 border border-white/5 p-0.5 rounded-lg flex flex-wrap gap-[1px] content-start scrollbar-none">
                      {discardPile.map((c, idx) => renderMiniCard(c, `${c.id}-${idx}`))}
                      {discardPile.length === 0 && (
                        <span className="text-[9px] text-slate-500 m-auto">空</span>
                      )}
                    </div>
                  </div>
                </div>

                </div>{/* end 遊戲頁面 */}

                {/* ② 控制頁面 — Control Panel (no vertical scroll — everything fits, except
                    on phone-landscape where the whole page scrolls instead — see above) */}
                <div className={`flex-1 flex flex-col px-3 pt-1.5 gap-1.5 overflow-hidden ${isPhoneLandscape ? '' : 'min-h-0'}`}>

                {/* ELDER ACTION CONTROLLER AID — flex-1 fills remaining height */}
                <div className={`flex-1 flex flex-col bg-black/35 rounded-2xl border border-white/10 select-none overflow-hidden ${isPhoneLandscape ? '' : 'min-h-0'}`}>

                  {/* User profile banner */}
                  <div className="flex flex-col gap-1 bg-[#0c2852] py-2 px-3 border-b border-white/5 shrink-0">
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xl leading-none">{playerAvatar}</span>
                        <span className="text-sm font-black text-yellow-300">{playerName}</span>
                        <span className="text-[11px] font-bold bg-yellow-300/10 border border-yellow-300/30 rounded-full px-2 py-0.5 tabular-nums">{player.score.toLocaleString()}</span>
                      </div>
                      {mode === 'pairs' ? (
                        <div className="flex items-center gap-1 text-xs text-yellow-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold">
                          <span>散牌:</span>
                          <strong className="text-yellow-300 text-sm">{playerStrayCount}</strong>
                          <span>張</span>
                        </div>
                      ) : (
                        <div className="text-xs font-bold leading-none text-yellow-300">
                          {activeHuCheck.canHu ? (
                            <span className="text-yellow-300 font-black">✔ 可胡牌！</span>
                          ) : (
                            <span>{activeHuCheck.totalHoo} / 10 胡</span>
                          )}
                        </div>
                      )}
                    </div>
                    {mode === 'pairs' && (
                      <div className="flex items-center gap-1.5 p-1 bg-black/25 rounded-xl border border-white/5">
                        <span className="text-xs font-bold text-yellow-300 shrink-0">{pairsHandSize === 15 ? '組' : '對'}</span>
                        <strong className="text-sm text-yellow-300 shrink-0">{playerClaimedMelds.length}</strong>
                        <div className="flex flex-wrap gap-[3px] flex-1 min-w-0">
                          {playerClaimedMelds.length > 0
                            ? playerClaimedMelds.map((meld) => (
                                <div key={meld.id} className="flex gap-[1px]">
                                  {meld.cards.map((c, i) => renderMiniCard(c, `player-claim-${meld.id}-${c.id}-${i}`))}
                                </div>
                              ))
                            : <span className="text-yellow-300/60 text-xs">無</span>}
                        </div>
                      </div>
                    )}
                  </div>


                  {/* PLAYER HAND — see effect above for sizing. Portrait (showTwoRowHand,
                      iPhone or iPad): fixed 6-card-width reference, 2 rows; row 1 fills
                      first, up to handRowCapacity (6 or 9 depending on mode) before
                      wrapping to row 2; once that capacity exceeds the visible 6-wide
                      reference width, the extra columns overflow past the viewport and the
                      hand scrolls horizontally to reach them. Landscape (iPhone, iPad, or
                      PC web): the whole hand sits in a single row instead, fit to the
                      actual available space through the same formula — see handRowCapacity
                      and the effect above.
                      This outer wrapper stays flex-1 — it's the stable ResizeObserver
                      measurement target the effect above reads from (its own size is
                      dictated purely by the surrounding flex layout, never by its
                      content, so measuring it can't create a feedback loop). The grid,
                      ACTION BAR and GUIDE BAR below are all shrink-0/content-sized and
                      now live INSIDE it (rather than as separate siblings), so on a
                      screen with lots of spare vertical room (iPad, desktop web) they
                      stack snugly right below each other; only the truly leftover space
                      (if any) collects at the very bottom of this box, instead of
                      appearing as a gap between the cards and the action buttons. */}
                  <div className={`flex-1 flex flex-col px-1 pt-1 pb-0 overflow-hidden ${isPhoneLandscape ? '' : 'min-h-0'}`}>
                    <div
                      ref={handContainerRef}
                      className="shrink-0 grid justify-start content-start gap-x-[1px] gap-y-2.5 overflow-x-auto overflow-y-hidden py-1"
                      style={{ gridAutoFlow: 'row', gridTemplateRows: `repeat(${showTwoRowHand ? 2 : 1}, ${handCardDims.h}px)`, gridTemplateColumns: `repeat(${handRowCapacity}, ${handCardDims.w}px)` }}
                    >
                      {playerHandDisplay.map((card) => {
                        const is10 = mode === 'pairs' && pairsHandSize === 10;
                        const is15 = mode === 'pairs' && pairsHandSize === 15;
                        const isRevealedLocked = playerRevealedIds.has(card.id);
                        const isStray = !is10 || playerGrouping.strays.some(s => s.id === card.id);
                        const isPaired = (is10 && !isStray) || (isRevealedLocked && playerRevealedBadge.get(card.id) === '對');
                        const isTrioHint = (is15 && player15TrioIds.has(card.id)) || (isRevealedLocked && playerRevealedBadge.get(card.id) === '組');
                        const isLocked = isPaired || isTrioHint || isRevealedLocked;
                        const isSelected = card.id === selectedCardId && (isStray || is15) && !isTrioHint;
                        const badgeStyle: React.CSSProperties = {
                          left: 2, right: 2,
                          top: '50%',
                          transform: 'translateY(-50%)',
                          height: Math.max(16, handCardDims.h * 0.19),
                          fontSize: Math.max(13, handCardDims.fs * 0.5),
                          background: '#1d4ed8',
                          color: '#ffffff',
                          borderRadius: 4,
                        };
                        return (
                          <div key={card.id} className={`relative flex flex-col items-center ${isSelected ? 'z-30' : ''}`}>
                            <FourColorCard
                              card={card}
                              size="xs"
                              isRevealed={true}
                              isSelected={isSelected}
                              onClick={() => {
                                if (isLocked) return;
                                playSound('click');
                                setSelectedCardId(isSelected ? null : card.id);
                              }}
                              cardStyle={{
                                width: handCardDims.w,
                                height: handCardDims.h,
                                cursor: isLocked ? 'default' : undefined,
                              }}
                              charFontSize={handCardDims.fs}
                            />
                            {isPaired && (
                              <span
                                className="absolute z-10 flex items-center justify-center pointer-events-none font-black leading-none"
                                style={badgeStyle}
                              >
                                對
                              </span>
                            )}
                            {isTrioHint && (
                              <span
                                className="absolute z-10 flex items-center justify-center pointer-events-none font-black leading-none"
                                style={badgeStyle}
                              >
                                組
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                  {/* ACTION BAR — 摸牌 and 打出這張牌 share the same size/color scheme */}
                  <div className="bg-black/30 px-3 py-2 flex items-center gap-2 border-t border-white/5 shrink-0">
                    <button
                      onClick={handlePlayerDraw}
                      disabled={gamePhase !== 'playing' || curPlayerId !== 'player' || lastDrawnCard !== null || hasDrawn || deck.length === 0}
                      style={{
                        height: handCardDims.w,
                        ...(gamePhase === 'playing' && curPlayerId === 'player' && lastDrawnCard === null && !hasDrawn && deck.length > 0
                          ? { animation: 'bounceSmall 1s ease-in-out infinite' }
                          : {}),
                      }}
                      className={`flex-1 rounded-xl transition-all flex items-center justify-center ${
                        gamePhase === 'playing' && curPlayerId === 'player' && lastDrawnCard === null && !hasDrawn && deck.length > 0
                          ? 'bg-red-600 border-2 border-red-400 text-white active:scale-95 ring-2 ring-red-300 shadow-lg'
                          : 'bg-white/5 border-2 border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black leading-none whitespace-nowrap" style={{ fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>
                        {deck.length > 0 ? `摸牌 ${deck.length}張` : '牌庫空'}
                      </span>
                    </button>

                    <button
                      onClick={() => handlePlayerDiscard(selectedCardId!)}
                      disabled={!selectedCardId || !canDiscard || gamePhase !== 'playing' || curPlayerId !== 'player'}
                      style={{
                        height: handCardDims.w,
                        ...(selectedCardId && canDiscard && gamePhase === 'playing' && curPlayerId === 'player'
                          ? { animation: 'bounceSmall 1s ease-in-out infinite' }
                          : {}),
                      }}
                      className={`flex-1 rounded-xl transition-all flex items-center justify-center ${
                        selectedCardId && canDiscard && gamePhase === 'playing' && curPlayerId === 'player'
                          ? 'bg-red-600 border-2 border-red-400 text-white active:scale-95 ring-2 ring-red-300 shadow-lg'
                          : 'bg-white/5 border-2 border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span className="font-black leading-none whitespace-nowrap" style={{ fontSize: 'clamp(1rem, 5vw, 1.5rem)' }}>
                        打出這張牌
                      </span>
                    </button>
                  </div>

                  {/* GUIDE BAR — very bottom of screen, above home indicator. Also carries the
                      "您的手牌" selection reminder that used to live in a separate action-bar label,
                      so this one bar always reflects the real-time next action to take. */}
                  <div
                    ref={guideBarRef}
                    className={`flex items-center gap-2 px-3 py-2 shrink-0 border-t transition-colors ${
                      (pendingMoves || pendingTrioOptions.length > 0) && gamePhase === 'waiting_player_action'
                        ? 'bg-orange-900/60 border-orange-500/40 text-orange-100'
                        : 'bg-black/50 border-white/5 text-slate-300'
                    }`}
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)' }}
                  >
                    <span className="text-lg shrink-0 leading-none">
                      {(pendingMoves || pendingTrioOptions.length > 0) && gamePhase === 'waiting_player_action' ? '🚨'
                       : selectedCardId ? '👉'
                       : 'ℹ️'}
                    </span>
                    <p className="text-base font-black leading-tight truncate flex-1 text-cyan-400">
                      {gamePhase === 'playing' && curPlayerId === 'player' && canDiscard
                        ? (selectedCardId
                            ? `已選 [${player.hand.find(c => c.id === selectedCardId)?.name}]，點擊打出`
                            : '請點一張牌，再點擊打出')
                        : guideMessage}
                    </p>
                  </div>
                  </div>{/* end hand+action-bar+guide-bar group */}
                </div>

                </div>{/* end 控制頁面 */}

              </div>{/* end main column */}

              </div>{/* closes flex-1 min-h-0 flex overflow-hidden */}

              {/* GAME ACTIVE DECISIONS — floats over the game page so showing/hiding it
                  never reflows the underlying layout (was previously an in-flow shrink-0
                  block inside the control panel, which pushed the hand/action area down
                  whenever it appeared) */}
              {(pendingMoves || pendingTrioOptions.length > 0) && gamePhase === 'waiting_player_action' && (
                <div
                  className="absolute inset-x-0 bottom-0 top-[52px] z-40 flex items-end justify-center pointer-events-none px-3"
                  style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.75rem)' }}
                >
                  <div className="pointer-events-auto bg-black/95 border-2 border-yellow-500 p-2.5 rounded-2xl flex flex-col items-center gap-2 shadow-2xl max-w-full">
                    <div className="grid grid-cols-2 gap-2">
                      {/* Declare HU (Winning) */}
                      {pendingMoves?.canHu && (
                        <button
                          onClick={() => handlePlayerAction('hu')}
                          style={{
                            width: handCardDims.w * 3,
                            height: handCardDims.w,
                            fontSize: Math.min(handCardDims.w * 0.55, handCardDims.h * 0.38),
                            animation: 'bounceSmall 0.7s ease-in-out infinite',
                          }}
                          className="rounded-xl bg-yellow-400 hover:bg-yellow-300 border-2 border-white shadow-lg flex items-center justify-center font-black text-black hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
                        >
                          胡！
                        </button>
                      )}

                      {/* Pairs Match or standard Pong */}
                      {pendingMoves?.canPong && (
                        <button
                          onClick={() => handlePlayerAction('pong')}
                          style={{
                            width: handCardDims.w * 3,
                            height: handCardDims.w,
                            fontSize: Math.min(handCardDims.w * 0.5, handCardDims.h * 0.34),
                            animation: 'bounceSmall 0.85s ease-in-out infinite',
                          }}
                          className="rounded-xl bg-yellow-400 hover:bg-yellow-300 border-2 border-white shadow-md flex items-center justify-center font-black text-black hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
                        >
                          {mode === 'pairs' ? '吃一隻' : '碰'}
                        </button>
                      )}

                      {/* Quads action */}
                      {pendingMoves?.canQuad && (
                        <button
                          onClick={() => handlePlayerAction('quad')}
                          style={{
                            width: handCardDims.w * 3,
                            height: handCardDims.w,
                            fontSize: Math.min(handCardDims.w * 0.5, handCardDims.h * 0.34),
                            animation: 'bounceSmall 0.85s ease-in-out infinite 0.1s',
                          }}
                          className="rounded-xl bg-yellow-400 hover:bg-yellow-300 border-2 border-white shadow-md flex items-center justify-center font-black text-black hover:scale-105 active:scale-95 transition-transform whitespace-nowrap"
                        >
                          槓
                        </button>
                      )}

                      {/* Eat sequences (with lists support) */}
                      {pendingMoves?.canEatSeq && pendingMoves.eatSeqOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlayerAction('eat', opt)}
                          style={{
                            width: handCardDims.w * 3,
                            height: handCardDims.w,
                            fontSize: Math.min(handCardDims.w * 0.5, handCardDims.h * 0.34),
                            animation: `bounceSmall 0.85s ease-in-out infinite ${i * 0.1}s`,
                          }}
                          className="rounded-xl bg-yellow-400 hover:bg-yellow-300 border-2 border-white shadow-md flex items-center justify-center font-black text-black active:scale-95 transition-transform whitespace-nowrap"
                        >
                          吃:{opt.resultCards.map(c=>c.character).join('')}
                        </button>
                      ))}

                      {/* 15-card mode: 碰一隻/吃一隻 trio claim options */}
                      {pendingTrioOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlayerTrioAction(opt)}
                          style={{
                            width: handCardDims.w * 3,
                            height: handCardDims.w,
                            animation: `bounceSmall 0.85s ease-in-out infinite ${i * 0.1}s`,
                          }}
                          className="rounded-xl bg-yellow-400 hover:bg-yellow-300 border-2 border-white shadow-md flex flex-col items-center justify-center font-black text-black hover:scale-105 active:scale-95 transition-transform"
                        >
                          <span style={{ fontSize: Math.min(handCardDims.w * 0.42, handCardDims.h * 0.28) }}>{opt.actionLabel}</span>
                          <span className="opacity-90" style={{ fontSize: Math.min(handCardDims.w * 0.22, handCardDims.h * 0.15) }}>
                            {opt.resultCards.map(c => c.name).join('‧')}
                          </span>
                        </button>
                      ))}

                      {/* Drop choices */}
                      <button
                        onClick={handlePlayerSkip}
                        style={{
                          width: handCardDims.w * 3,
                          height: handCardDims.w,
                          fontSize: Math.min(handCardDims.w * 0.5, handCardDims.h * 0.34),
                        }}
                        className="rounded-xl bg-slate-600 hover:bg-slate-500 border border-slate-400 font-bold text-white active:scale-95 flex items-center justify-center whitespace-nowrap"
                      >
                        過 (放棄)
                      </button>
                    </div>

                    <div className="text-base font-black text-yellow-400 border-t border-white/10 w-full text-center pt-1.5">
                      🚨 雷達配對組信號{triggerSourceLabel ? `（${triggerSourceLabel}）` : ''}！請選擇：
                    </div>
                  </div>
                </div>
              )}

              {/* RETRO DIALOG HISTORY ON DEMAND OVERLAY */}
              {showLogDrawer && (
                <div className="absolute inset-x-0 bottom-0 top-[52px] bg-[#0a1628]/98 border-t border-blue-500/30 z-30 p-4 flex flex-col justify-between select-none">
                  <div className="text-sm font-extrabold text-yellow-500 border-b border-white/10 pb-2 mb-3 flex items-center justify-between">
                    <span>📋 牌局歷程回顧：</span>
                    <button 
                      onClick={() => setShowLogDrawer(false)}
                      className="px-2 py-0.5 bg-white/10 hover:bg-white/15 text-slate-300 font-extrabold rounded"
                    >
                      關閉 ✕
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto space-y-1.5 pr-2 text-xs text-left text-yellow-101/90 font-mono scrollbar-thin">
                    {logs.map((log, idx) => (
                      <div key={idx} className="border-b border-white/5 last:border-0 pb-1 flex items-start gap-1 leading-snug">
                        <span className="text-yellow-500 shrink-0 pr-0.5">▸</span>
                        <span>{log}</span>
                      </div>
                    ))}
                    <div ref={logsEndRef} />
                    {logs.length === 0 && <p className="text-center text-slate-500 my-10">尚無內容可供追憶。</p>}
                  </div>
                  <button
                    onClick={() => setShowLogDrawer(false)}
                    className="w-full mt-4 py-3 bg-yellow-500 hover:bg-yellow-400 font-black text-slate-950 text-sm rounded-xl"
                  >
                    關閉回溯，繼續遊戲
                  </button>
                </div>
              )}

            </div>
          )}

          {/* 3. Detailed Rules and Tutorial Screen (遊戲說明教學頁面) */}
          {activePage === 'rules' && (
            <div className="flex-1 flex flex-col justify-between h-full w-full select-none text-white overflow-hidden">
              
              {/* Header */}
              <header className="bg-black/40 border-b border-white/10 px-3 flex items-center justify-between shrink-0 select-none z-10" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)', paddingBottom: '0.75rem' }}>
                <button
                  onClick={handleBackFromRules}
                  className="py-2.5 px-5 bg-white/10 hover:bg-white/15 border border-white/10 text-base font-extrabold text-slate-200 rounded-xl transition-all flex items-center gap-2"
                >
                  <ArrowLeft className="w-5 h-5" />
                  返回
                </button>
                <span className="text-lg font-black text-yellow-500 tracking-wider">🀄 傳統四色牌指引</span>
                <div className="w-20 h-3" />
              </header>

              {/* Sub tabs */}
              <div className="bg-black/20 p-2 flex border-b border-white/5 justify-between gap-1.5 shrink-0 text-sm font-semibold select-none">
                <button
                  onClick={() => handleSwitchTab('ranks')}
                  className={`flex-1 py-3 px-0.5 rounded-lg text-center transition-colors ${activeTutorialTab === 'ranks' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  🎨 牌色圖鑑
                </button>
                <button
                  onClick={() => handleSwitchTab('pairs')}
                  className={`flex-1 py-3 px-0.5 rounded-lg text-center transition-colors ${activeTutorialTab === 'pairs' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  👦 簡單對子
                </button>
              </div>

              {/* Tab contents */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 text-slate-200 text-left text-base space-y-4 font-sans leading-relaxed scrollbar-thin max-w-2xl mx-auto w-full">

                {activeTutorialTab === 'ranks' && (
                  <div className="space-y-4">
                    <div className="bg-white/5 p-4 rounded-2xl border border-white/10 text-center select-none">
                      <p className="font-extrabold text-yellow-500 text-xl mb-1">整套四色牌共有 112 張</p>
                      <p className="text-sm text-slate-400 font-semibold">區分為：紅、黃、綠、白 等四種色系：</p>
                    </div>

                    <div className="space-y-3 select-none">
                      <div className="p-4 bg-red-950/20 border border-red-900/40 rounded-xl">
                        <p className="font-extrabold text-orange-400 text-base mb-2">🔴 紅色 與 🟡 黃色 (高階牌面)</p>
                        <p className="text-sm text-slate-300 font-medium">
                          文字代表角色依次序為：<strong>帥、仕、相、俥、傌、炮、兵</strong>。
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="bg-amber-100/10 border border-amber-500 px-2.5 py-1 rounded text-sm text-yellow-400 font-black">黃帥</span>
                          <span className="bg-red-800/15 border border-red-650 px-2.5 py-1 rounded text-sm text-orange-400 font-black">紅帥</span>
                        </div>
                      </div>

                      <div className="p-4 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
                        <p className="font-extrabold text-emerald-400 text-base mb-2">🟢 綠色 與 ⚪ 白色 (基層角色)</p>
                        <p className="text-sm text-slate-300 font-medium">
                          文字代表角色依次序為：<strong>將、士、象、車、馬、包、卒</strong>。
                        </p>
                        <div className="flex gap-2 mt-3">
                          <span className="bg-emerald-900/20 border border-emerald-500 px-2.5 py-1 rounded text-sm text-emerald-400 font-black">綠將</span>
                          <span className="bg-slate-800/20 border border-slate-500 px-2.5 py-1 rounded text-sm text-slate-200 font-black font-serif">白將</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-500/5 p-4 rounded-xl border border-yellow-500/20 select-none">
                      <h4 className="font-extrabold text-yellow-500 text-base mb-2">💡 傳統常識貼心提醒：</h4>
                      <p className="text-slate-300 leading-relaxed font-semibold text-sm">
                        兩類字體雖有些微繁簡異體區分，但在配牌成組時，邏輯字體是一一對應、完全同等作用的（如紅帥與綠將在組同牌組時皆代表頂級將軍）。
                      </p>
                    </div>
                  </div>
                )}

                {activeTutorialTab === 'pairs' && (
                  <div className="space-y-4 select-none">
                    <h3 className="text-lg font-black text-yellow-500 border-b border-white/10 pb-2">👦 玩法一：抓對子（湊對子）</h3>
                    <p className="text-slate-300 font-semibold leading-relaxed text-sm">
                      比傳統十胡更簡單、快速的入門玩法，核心在於湊出相同的牌（同色同字）。
                    </p>

                    {/* 10-card rules */}
                    <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 space-y-2">
                      <p className="font-extrabold text-yellow-400 text-sm">🃏 10張玩法「五對胡」</p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs font-medium leading-snug">
                        <li><strong className="text-white">起手牌數：</strong>每人發 <strong className="text-yellow-300">9 張</strong>牌，其餘放在中央為牌疊。</li>
                        <li><strong className="text-white">摸牌：</strong>輪到自己時從牌疊摸一張。若與手中某張單牌湊成對子，點【吃一隻】配對並打出一張不要的牌；若無法配對，可打出剛摸到的牌，或換入手中打出另一張。</li>
                        <li><strong className="text-white">碰牌：</strong>他人打出與你手中單牌完全相同的牌時，可喊「碰」湊成對子，再打出一張手牌。</li>
                        <li><strong className="text-white">聽牌：</strong>手中已有 4 個對子＋1 張單牌時，為「聽牌」狀態。</li>
                        <li><strong className="text-yellow-300">胡牌：</strong>自摸或他人打出與那張單牌配對的牌，完成 <strong>5 個對子（共 10 張）</strong>，喊「胡」勝出！</li>
                      </ul>
                    </div>

                    {/* 15-card rules */}
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-3 space-y-2">
                      <p className="font-extrabold text-blue-300 text-sm">🀄 15張玩法「五組三張」</p>
                      <ul className="list-disc pl-4 space-y-1.5 text-slate-300 text-xs font-medium leading-snug">
                        <li><strong className="text-white">起手牌數：</strong>每人發 <strong className="text-blue-200">14 張</strong>牌。</li>
                        <li><strong className="text-white">容許組合（每組 3 張）：</strong>
                          <ul className="list-none pl-2 mt-1 space-y-1">
                            <li>① 同色同字三張（例：3張綠包）</li>
                            <li>② 常規散牌組（同色：將士象 或 車馬包）</li>
                            <li>③ 同字異色三張（例：紅兵＋綠兵＋黃兵）</li>
                          </ul>
                        </li>
                        <li><strong className="text-white">摸牌與碰吃：</strong>輪流摸牌；摸到可湊組的牌可保留並打出一張；他人打出的牌若能湊組可喊「碰」或「吃」。</li>
                        <li><strong className="text-blue-200">胡牌：</strong>手牌加上最後贏的那張牌，剛好湊滿 <strong>5 組（共 15 張）</strong>即為胡牌！</li>
                      </ul>
                    </div>

                    {/* General rule */}
                    <div className="bg-black/30 border border-white/10 rounded-xl p-3">
                      <p className="text-slate-400 text-xs font-semibold leading-snug">
                        💡 <strong className="text-slate-200">系統自動處理：</strong>開局時系統會自動偵測手牌中的「暗坎（三張）」與「暗開車（四張）」並直接放桌上。牌疊摸完無人胡牌則判定為<strong className="text-orange-300">流局（平手）</strong>。
                      </p>
                    </div>

                    {/* 台數計分 */}
                    <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 space-y-2">
                      <p className="font-extrabold text-emerald-300 text-sm">💰 胡牌怎麼算分？台數計分法</p>
                      <p className="text-slate-300 text-xs font-medium leading-snug">
                        每次胡牌，系統會依牌型自動列出「台數明細」，總台數換算成輸贏分數：
                        底 <strong className="text-emerald-300">200</strong> 分 ＋ 總台數 × 每台 <strong className="text-emerald-300">100</strong> 分。
                      </p>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-black/25 rounded-lg p-2">
                          <p className="text-yellow-300 font-bold text-xs mb-1">🃏 10張「五對胡」加台</p>
                          <ul className="text-slate-300 text-[11px] font-medium leading-relaxed space-y-0.5">
                            <li>底台：<strong className="text-white">1台</strong></li>
                            <li>自摸：<strong className="text-white">+1台</strong></li>
                            <li>門清（全程沒吃碰對方棄牌）：<strong className="text-white">+1台</strong></li>
                            <li>每組將/帥對：<strong className="text-white">+1台</strong></li>
                            <li>無將（沒有半張將/帥）：<strong className="text-white">+1台</strong></li>
                            <li>全將（5對都是將/帥）：<strong className="text-white">+1台</strong></li>
                            <li>清一色（10張同色）：<strong className="text-white">+3台</strong></li>
                          </ul>
                        </div>
                        <div className="bg-black/25 rounded-lg p-2">
                          <p className="text-blue-300 font-bold text-xs mb-1">🀄 15張「五組三張」加台</p>
                          <ul className="text-slate-300 text-[11px] font-medium leading-relaxed space-y-0.5">
                            <li>底台：<strong className="text-white">1台</strong></li>
                            <li>自摸：<strong className="text-white">+1台</strong></li>
                            <li>門清（全程沒吃碰對方棄牌）：<strong className="text-white">+1台</strong></li>
                            <li>每組三張同色同字（崁）：<strong className="text-white">+1台</strong></li>
                            <li>每組同色將士象/車馬包：<strong className="text-white">+1台</strong></li>
                            <li>四色兵/卒（四色各一張）：<strong className="text-white">+1台</strong></li>
                            <li>四大將/四大帥（四色各一張）：<strong className="text-white">+2台</strong></li>
                            <li>清一色（15張同色）：<strong className="text-white">+4台</strong></li>
                          </ul>
                        </div>
                      </div>

                      <p className="text-slate-500 text-[11px] font-medium leading-snug">
                        ※ 莊家/連莊加台目前尚未開放（固定 0 台）；三隻／四隻／開槓等「刻子、槓」相關台數在本遊戲配對規則下不會出現，故未列入計算。
                      </p>
                    </div>
                  </div>
                )}

              </div>

              {/* Back trigger button */}
              <div className="px-4 pt-4 border-t border-white/10 bg-[#0f2d5c] shrink-0" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
                <button
                  onClick={handleBackFromRules}
                  className="w-full py-5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black rounded-2xl text-xl"
                >
                  細讀完畢，返回上一頁
                </button>
              </div>
            </div>
          )}

        </div>


      </div>

      {/* GAME OVER MODAL — hidden while player-win celebration is showing */}
      {gamePhase === 'game_over' && !showHuCelebration && (
        <div className="fixed inset-0 bg-[#060e1e]/90 z-[99] flex items-center justify-center p-4 select-none">
          <div className="bg-[#091e3e] border-4 border-yellow-500 shadow-2xl rounded-[32px] p-6 max-w-sm w-full text-center relative border-double animate-pulse text-white select-none">

            <div className="absolute top-[-35px] left-1/2 transform -translate-x-1/2 bg-yellow-500 rounded-full p-2.5 border-4 border-[#091e3e]">
              <Sparkles className="w-8 h-8 text-slate-900" />
            </div>

            <h2 className="text-3xl font-serif font-black text-yellow-500 mt-5 mb-2 leading-tight">
              {winnerId === 'player' ? '🏆 恭喜您大獲全勝！' : winnerId === 'computer' ? '🤖 電腦拔得頭籌' : '🤝 雙方和局流局'}
            </h2>

            <p className="text-emerald-400 font-extrabold text-sm mb-3">
              {mode === 'pairs' ? '👦 抓對對子簡單對局' : '🀄 傳統吃碰標準對戰'}
            </p>

            {/* This modal only ever appears for the 流局/draw path (handleDrawGame) —
                real wins stay inside the 胡牌慶祝 celebration overlay (which owns the
                積分計算資訊框) until "繼續下局" restarts the round, so there's no score
                to show here; a draw never changes anyone's score. */}
            <div className="bg-black/45 p-4 rounded-2xl border border-blue-800 text-slate-100 text-sm font-serif font-medium leading-relaxed mb-5 max-h-[140px] overflow-y-auto">
              {winExplanation}
            </div>

            <button
              onClick={() => { playSound('click'); initGame(false); }}
              className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 tracking-wider text-base font-black rounded-2xl shadow-xl transition-all active:scale-95"
            >
              重新發牌，再開一局 🀄
            </button>
          </div>
        </div>
      )}

      {/* 摸牌預覽 OVERLAY — shows drawn card for 3s before auto-pair */}
      {drawnCardPreview && (
        <div className="fixed inset-0 z-[145] flex flex-col items-center justify-center pointer-events-none select-none" style={{ background: 'rgba(6,14,30,0.78)' }}>
          <div style={{ animation: 'cardReveal 0.5s cubic-bezier(0.34,1.56,0.64,1) both' }}>
            <div className="flex flex-col items-center gap-4">
              <FourColorCard card={drawnCardPreview} size="lg" isRevealed={true} />
            </div>
          </div>
        </div>
      )}

      {/* 吃對 ANIMATION OVERLAY — 3 seconds, pointer-events-none */}
      {showEatPairAnim && (
        <div className="fixed inset-0 z-[150] flex flex-col items-center justify-center pointer-events-none select-none" style={{ background: 'rgba(6,14,30,0.72)', gap: 10 }}>
          {/* Trigger source (self-draw vs opponent's discard) — above everything else */}
          {eatPairAnimSource && (
            <div
              className="font-black tracking-widest"
              style={{
                fontSize: 'clamp(0.9rem, 4vw, 1.3rem)',
                color: '#f5c218',
                letterSpacing: '0.15em',
                textShadow: '0 0 16px rgba(245,194,24,0.85)',
                animation: 'fadeInUp 0.4s ease both',
              }}
            >
              {eatPairAnimSource}
            </div>
          )}
          {/* Paired / trio cards above badge */}
          {eatPairAnimCards.length > 0 && (
            <div className="flex items-end" style={{ gap: 3, animation: 'cardReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
              {eatPairAnimCards.map((c, i) => (
                <FourColorCard
                  key={`ep-${c.id}-${i}`}
                  card={c}
                  size="xs"
                  isRevealed={true}
                  cardStyle={{ width: handCardDims.w, height: handCardDims.h }}
                  charFontSize={handCardDims.fs}
                />
              ))}
            </div>
          )}
          {/* Badge: 長=一個手牌的高度, 高=兩個手牌的寬度 */}
          <div
            style={{
              width: handCardDims.h,
              height: handCardDims.w * 2,
              background: '#f5c218',
              color: '#0a1628',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
              borderRadius: '0.6rem',
              lineHeight: 1.1,
              border: '3px solid #fff59d',
              animation: 'eatPairPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, boxGlow 0.8s ease-in-out 0.5s infinite alternate',
            }}
          >
            <span style={{ fontSize: Math.min(handCardDims.w * 0.88, handCardDims.h * 0.38) }}>{eatPairAnimWho === 'player' ? '玩家' : '電腦'}</span>
            <span style={{ fontSize: Math.min(handCardDims.w * 0.58, handCardDims.h * 0.25) }}>吃一隻</span>
          </div>
        </div>
      )}

      {/* 胡牌 CELEBRATION OVERLAY — stamp + cards + 繼續下局 button (fireworks for player only) */}
      {showHuCelebration && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none overflow-hidden">
          {/* Fireworks canvas — player wins only */}
          {huAnimWho === 'player' && (
            <canvas
              ref={fireworksCanvasRef}
              className="absolute inset-0 w-full h-full"
              style={{ background: 'rgba(6,14,30,0.82)' }}
            />
          )}
          {/* Plain dark overlay — computer wins */}
          {huAnimWho === 'computer' && (
            <div className="absolute inset-0" style={{ background: 'rgba(6,14,30,0.88)' }} />
          )}

          {/* Content on top */}
          <div className="relative z-10 flex flex-col items-center px-6 text-center" style={{ gap: 10 }}>
            {/* Cards above badge */}
            {huAnimCards.length > 0 && (
              <div className="flex items-end" style={{ gap: 3, animation: 'cardReveal 0.4s cubic-bezier(0.34,1.56,0.64,1) both' }}>
                {huAnimCards.map((c, i) => (
                  <FourColorCard
                    key={`hu-${c.id}-${i}`}
                    card={c}
                    size="xs"
                    isRevealed={true}
                    cardStyle={{ width: handCardDims.w, height: handCardDims.h }}
                    charFontSize={handCardDims.fs}
                  />
                ))}
              </div>
            )}

            {/* 胡牌 badge: 單排四字（玩家自摸／玩家胡牌／電腦自摸／電腦胡牌），紅底白字，長方形 */}
            <div
              style={{
                width: handCardDims.h * 1.7,
                height: handCardDims.w * 1.3,
                background: '#dc2626',
                color: '#ffffff',
                display: 'flex',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                fontSize: Math.min(handCardDims.w * 0.88, handCardDims.h * 0.38),
                fontWeight: 900,
                borderRadius: '0.6rem',
                lineHeight: 1.1,
                border: '3px solid #fca5a5',
                animation: 'huStamp 0.7s cubic-bezier(0.22,1,0.36,1) both, huBoxGlow 1s ease-in-out 0.7s infinite alternate',
              }}
            >
              <span>{huAnimWho === 'player' ? '玩家' : '電腦'}</span>
              <span>{huAnimSelfDraw ? '自摸' : '胡牌'}</span>
            </div>

            {/* Sub-label */}
            <div
              style={{
                fontSize: 'clamp(0.8rem, 3.5vw, 1.2rem)',
                color: huAnimWho === 'player' ? '#f5c218' : '#fca5a5',
                fontWeight: 700,
                letterSpacing: '0.15em',
                animation: 'fadeInUp 0.5s ease 0.6s both',
                textShadow: huAnimWho === 'player' ? '0 0 20px rgba(245,194,24,0.8)' : '0 0 20px rgba(239,68,68,0.8)',
              }}
            >
              {huAnimWho === 'player' ? '恭喜大獲全勝！' : '電腦勝出'}
            </div>

            {/* 積分計算資訊框：台數明細 + 本局輸贏 + 雙方最新總分 */}
            {winScore && (
              <div
                className="bg-black/55 border border-emerald-500/30 rounded-2xl px-4 py-3 text-left"
                style={{ animation: 'fadeInUp 0.5s ease 0.7s both', minWidth: 230, maxWidth: 300 }}
              >
                <p className="text-emerald-300 font-black text-xs text-center mb-1.5 tracking-wide">💰 積分計算</p>
                <ul className="space-y-0.5 mb-1.5">
                  {winScore.items.map((it, i) => (
                    <li key={i} className="flex justify-between text-[11px] font-semibold text-slate-200">
                      <span>{it.label}</span>
                      <span className="tabular-nums">+{it.tai} 台</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between text-xs font-black text-emerald-300 border-t border-emerald-500/25 pt-1 mb-1.5">
                  <span>共計台數</span>
                  <span className="tabular-nums">{winScore.totalTai} 台</span>
                </div>
                <p className="text-emerald-300 font-black text-sm text-center mb-1">
                  本局輸贏：{huAnimWho === 'player' ? '+' : '-'}{winScore.payout.toLocaleString()} 分
                </p>
                <div className="flex justify-between text-[11px] font-bold text-slate-300 tabular-nums">
                  <span>{playerAvatar} {playerName}：{player.score.toLocaleString()}</span>
                  <span>🤖 電腦AI：{computer.score.toLocaleString()}</span>
                </div>
              </div>
            )}

            {/* 繼續下局 button — appears after 5s, styled like 吃對 badge */}
            {huCelebShowContinue && (
              <button
                onClick={() => {
                  setShowHuCelebration(false);
                  setHuCelebShowContinue(false);
                  playSound('click');
                  initGame(false);
                }}
                style={{
                  width: handCardDims.h * 1.7,
                  height: handCardDims.w * 1.3,
                  background: '#f5c218',
                  color: '#0a1628',
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  fontSize: Math.min(handCardDims.w * 0.88, handCardDims.h * 0.38),
                  fontWeight: 900,
                  borderRadius: '0.6rem',
                  lineHeight: 1.1,
                  border: '3px solid #fff59d',
                  cursor: 'pointer',
                  animation: 'fadeInUp 0.6s ease both, continuePulse 1.2s ease-in-out infinite alternate',
                }}
              >
                <span>繼續</span>
                <span>下局</span>
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
