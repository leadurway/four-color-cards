import React, { useState, useEffect, useRef } from 'react';
import {
  createDeck,
  shuffle,
  groupPairsMode,
  sortHandForDisplay,
  solveHu,
  checkAvailableMoves,
  isGeneral,
  PairsGrouping,
  HuResult
} from './cardUtils';
import { Card, GameMode, GameState, Player, RevealedMeld } from './types';
import { FourColorCard } from './components/FourColorCard';
import { 
  Sparkles, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Info, 
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
    name: '🤖 智慧電腦 AI',
    hand: [],
    revealed: [],
    score: 0
  });
  
  const [discardPile, setDiscardPile] = useState<Card[]>([]);
  const [curPlayerId, setCurPlayerId] = useState<'player' | 'computer'>('player');
  const [gamePhase, setGamePhase] = useState<GameState['gamePhase']>('setup');
  const [winnerId, setWinnerId] = useState<GameState['winnerId']>(null);
  const [winType, setWinType] = useState<GameState['winType']>(null);
  const [winExplanation, setWinExplanation] = useState('');
  
  const [lastDrawnCard, setLastDrawnCard] = useState<Card | null>(null);
  const [lastDiscardedCard, setLastDiscardedCard] = useState<Card | null>(null);
  const [drawnFromDeck, setDrawnFromDeck] = useState(false);
  const [isComputerThinking, setIsComputerThinking] = useState(false);
  const [showComputerHand, setShowComputerHand] = useState(false);
  
  const [logs, setLogs] = useState<string[]>([]);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  
  // Available moves for player during checking state
  const [pendingMoves, setPendingMoves] = useState<ReturnType<typeof checkAvailableMoves> | null>(null);
  const [canDiscard, setCanDiscard] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  
  // Quick tutorial navigation tabs
  const [activeTutorialTab, setActiveTutorialTab] = useState<'ranks' | 'pairs' | 'standard' | 'point'>('ranks');
  
  // Mini logs expanded drawer state for portrait space optimization
  const [showLogDrawer, setShowLogDrawer] = useState(false);

  // Interactive senior helper voice-box
  const [guideMessage, setGuideMessage] = useState('歡迎進入四色牌遊藝廳！請選擇想玩的玩法，輸入大名並點擊下方按鈕即可開盤！');
  
  const logsEndRef = useRef<HTMLDivElement>(null);
  const handContainerRef = useRef<HTMLDivElement>(null);
  const [handCardDims, setHandCardDims] = useState({ w: 32, h: 84, fs: 19 });

  // Animation overlays
  const [showEatPairAnim, setShowEatPairAnim] = useState(false);
  const [showHuCelebration, setShowHuCelebration] = useState(false);
  const [huCelebShowContinue, setHuCelebShowContinue] = useState(false);
  const fireworksCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Recalculate hand card size whenever hand count or container size changes
  useEffect(() => {
    const el = handContainerRef.current;
    if (!el || player.hand.length === 0) return;

    const calc = (containerW: number, containerH: number) => {
      const count = player.hand.length;
      const cols = Math.ceil(count / 2) || 1;
      const colGap = 1;
      const rowGap = 10; // gap-y-2.5
      const maxCardW = (containerW - colGap * (cols - 1)) / cols;
      const maxCardH = (containerH - rowGap) / 2; // 2 rows
      const aspect = 32 / 84; // xs card W/H ratio
      let w: number, h: number;
      if (maxCardW / aspect <= maxCardH) {
        w = maxCardW; h = maxCardW / aspect;
      } else {
        h = maxCardH; w = maxCardH * aspect;
      }
      setHandCardDims({ w: Math.floor(w), h: Math.floor(h), fs: Math.round(w * 19 / 32) });
    };

    calc(el.getBoundingClientRect().width, el.getBoundingClientRect().height);
    const obs = new ResizeObserver(([entry]) => {
      calc(entry.contentRect.width, entry.contentRect.height);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, [player.hand.length]);

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

  // Setup/Initialize core gaming deck & distribute hands
  const initGame = () => {
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
          name: `自帶暗開車 [${q[0].name}*4]`
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
          name: `自帶暗坎 [${t[0].name}*3]`
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
          name: `自帶暗開車 [${q[0].name}*4]`
        });
        addLog(`[開局判定] 電腦 AI 自動鎖定【暗開車 ${q[0].name}*4】。`);
      });
      cGroup.triples.forEach(t => {
        computerRevealed.push({
          id: `init-c-triple-${Math.random()}`,
          type: 'triple',
          cards: t,
          hoo: isGeneral(t[0]) ? 3 : 1,
          name: `自帶暗坎 [${t[0].name}*3]`
        });
        addLog(`[開局判定] 電腦 AI 自動鎖定【暗坎 ${t[0].name}*3】。`);
      });

      const filteredCHand: Card[] = [];
      cGroup.pairs.forEach(p => filteredCHand.push(...p));
      filteredCHand.push(...cGroup.strays);
      computerHand = filteredCHand;
    }

    setDeck(remainingDeck);
    setPlayer({
      id: 'player',
      name: `${playerAvatar} ${playerName}`,
      hand: sortHandForDisplay(playerHand),
      revealed: playerRevealed,
      score: 0
    });
    setComputer({
      id: 'computer',
      name: '🤖 智慧電腦 AI',
      hand: sortHandForDisplay(computerHand),
      revealed: computerRevealed,
      score: 0
    });

    setDiscardPile([]);
    setCurPlayerId('player');
    setGamePhase('playing');
    setWinnerId(null);
    setWinType(null);
    setWinExplanation('');
    setLastDrawnCard(null);
    setLastDiscardedCard(null);
    setDrawnFromDeck(false);
    setSelectedCardId(null);
    setPendingMoves(null);
    // In pairs mode player must draw first; in standard mode initial discard is allowed
    setCanDiscard(mode !== 'pairs');
    setHasDrawn(false);
    
    setGuideMessage('發牌與洗牌完成！輪到您的回合。點選左方「紅疊牌庫」抽取一張牌。');
    addLog(`牌局正常開啟。洗牌分發完畢，牌席賸餘牌 ${remainingDeck.length} 張。`);
    
    playSound('action');
    setActivePage('game');
  };

  // Player Manual Trigger to Draw card from Deck
  const handlePlayerDraw = () => {
    if (gamePhase !== 'playing' || curPlayerId !== 'player' || lastDrawnCard !== null || hasDrawn) return;
    
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

    if (mode === 'pairs') {
      const pGroup = groupPairsMode(player.hand);
      const matchedCard = pGroup.strays.find(c => c.color === drawn.color && c.character === drawn.character);

      if (matchedCard) {
        // AUTO-PAIR: pair immediately without asking, then show 吃對 animation
        const nextHand = player.hand.filter(c => c.id !== matchedCard.id);
        const autoPairMeld: RevealedMeld = {
          id: `player-pair-${Date.now()}`,
          type: 'pair',
          cards: [drawn, matchedCard],
          hoo: isGeneral(drawn) ? 2 : 0,
          name: `對子 [${drawn.name}]`
        };
        setPlayer(prev => ({ ...prev, hand: nextHand, revealed: [...prev.revealed, autoPairMeld] }));
        setLastDrawnCard(null);
        setLastDiscardedCard(null);
        addLog(`【自動配對】自摸 [${drawn.name}] 已自動與手中 [${matchedCard.name}] 配對！`);
        setShowEatPairAnim(true);

        const autoCheck = groupPairsMode(nextHand);
        if (autoCheck.strays.length === 0) {
          setTimeout(() => {
            setShowEatPairAnim(false);
            handleWin('player', 'pairs', '恭喜！自摸配對完成所有散牌，宣告勝出！');
          }, 3000);
          return;
        }
        setHasDrawn(true);
        setCanDiscard(false);
        setTimeout(() => {
          setShowEatPairAnim(false);
          setCanDiscard(true);
          setGuideMessage('自動配對成功！請選取一張散牌打出。');
        }, 3000);
      } else {
        // No match — add to hand, player chooses which stray to discard
        const nextHand = sortHandForDisplay([...player.hand, drawn]);
        setPlayer(prev => ({ ...prev, hand: nextHand }));
        setLastDrawnCard(null);
        setCanDiscard(true);
        setGuideMessage(`摸到的 [${drawn.name}] 未能配對，已加入手牌。請選取一張散牌打出。`);
      }
    } else {
      // Standard Mahjong-like rules check when drawing from deck
      const moves = checkAvailableMoves(player.hand, player.revealed, drawn, true);
      
      if (moves.canHu || moves.canQuad || moves.canPong || moves.canEatSeq) {
        setPendingMoves(moves);
        setGamePhase('waiting_player_action');
        setGuideMessage(`摸出 [${drawn.name}]！觸發了可配對行動。點選下方操作按鈕，或選擇「過」保留去手牌中。`);
      } else {
        // No moves. Push to hand and configure discard action
        const nextHand = sortHandForDisplay([...player.hand, drawn]);
        setPlayer(prev => ({
          ...prev,
          hand: nextHand
        }));
        setLastDrawnCard(null);
        setCanDiscard(true);
        setGuideMessage(`自摸摸牌 [${drawn.name}]。無可用序列吃碰，牌已自動置入手牌。請選中一張牌打出去。`);
      }
    }
  };

  // Player Manual Touch to Discard a selected Card
  const handlePlayerDiscard = (cardId: string) => {
    if (gamePhase !== 'playing' || curPlayerId !== 'player' || !canDiscard) return;

    const cardToDiscard = player.hand.find(c => c.id === cardId);
    if (!cardToDiscard) return;

    // In pairs mode, only stray (unpaired) cards can be discarded
    if (mode === 'pairs') {
      const dGroup = groupPairsMode(player.hand);
      if (!dGroup.strays.some(s => s.id === cardId)) return;
    }

    playSound('discard');
    const updatedHand = player.hand.filter(c => c.id !== cardId);
    
    setPlayer(prev => ({
      ...prev,
      hand: updatedHand
    }));

    setDiscardPile(prev => [cardToDiscard, ...prev]);
    setLastDiscardedCard(cardToDiscard);
    setLastDrawnCard(null);
    setSelectedCardId(null);
    setCanDiscard(false); // Finished play privilege
    setHasDrawn(false); // Reset drawing lock for player's future turn

    addLog(`【您打牌】打出了一張棄牌：[${cardToDiscard.name}]`);

    // Pairs mode: check if discarding this card leaves hand with no strays → win
    if (mode === 'pairs') {
      const afterGroup = groupPairsMode(updatedHand);
      if (afterGroup.strays.length === 0 && updatedHand.length > 0) {
        handleWin('player', 'pairs', '恭喜！您打出多餘單張後，手中所有散牌均已配對完畢，宣告勝出！');
        return;
      }
    }

    // Hand turn over to computer. Computer checks if it wants to react to player's discard
    setCurPlayerId('computer');
    setIsComputerThinking(true);
    setGuideMessage('您已成功出手！電腦正在絞盡大腦思索對抗策略...');

    setTimeout(() => {
      runComputerTurn(cardToDiscard);
    }, 1200);
  };

  // Computes Computer reaction and self-play logic
  const runComputerTurn = (playerDiscard: Card | null) => {
    if (gamePhase !== 'playing') {
      setIsComputerThinking(false);
      return;
    }

    // 1. If player discarded a card, AI checks reaction moves first
    if (playerDiscard) {
      const moves = checkAvailableMoves(computer.hand, computer.revealed, playerDiscard, false);
      
      if (mode === 'pairs') {
        const cGroup = groupPairsMode(computer.hand);
        const matchesStray = cGroup.strays.find(c => c.color === playerDiscard.color && c.character === playerDiscard.character);
        
        if (matchesStray) {
          // AI automatically eats the card to pair
          const newHand = computer.hand.filter(c => c.id !== matchesStray.id);
          const newMeld: RevealedMeld = {
            id: `comp-pair-${Date.now()}`,
            type: 'pair',
            cards: [playerDiscard, matchesStray],
            hoo: isGeneral(playerDiscard) ? 2 : 0,
            name: `對子 [${playerDiscard.name}]`
          };

          setComputer(prev => ({
            ...prev,
            hand: newHand,
            revealed: [...prev.revealed, newMeld]
          }));
          setLastDiscardedCard(null);
          addLog(`🤖 電腦 AI 宣告【吃對子】，將剛才您打出的 [${playerDiscard.name}] 配成一對。`);

          // Inspect AI win
          const nextGroup = groupPairsMode(newHand);
          if (nextGroup.strays.length === 0) {
            handleWin('computer', 'pairs', '電腦配對抓完手牌散牌徹底歸零，取得勝利！');
            setIsComputerThinking(false);
            return;
          }

          // AI needs to discard a card from hand to maintain turn flow
          setTimeout(() => {
            executeComputerDiscard(newHand);
          }, 900);
          return;
        }
      } else {
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
              name: `明開車 [${playerDiscard.name}*4]`
            };
            effectiveRevealed = [...computer.revealed, newMeld];
            setComputer(prev => ({ ...prev, hand: effectiveHand, revealed: effectiveRevealed }));
          }
          addLog(`🤖 電腦 AI 吃牌宣告【明開車/槓】，霸氣槓出您的 [${playerDiscard.name}]！`);
          setLastDiscardedCard(null);

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
            name: `明刻 [${playerDiscard.name}*3]`
          };
          setComputer(prev => ({ ...prev, hand: newHand, revealed: [...prev.revealed, newMeld] }));
          addLog(`🤖 電腦 AI 碰牌成功！亮明碰出了您的 [${playerDiscard.name}]。`);
          setLastDiscardedCard(null);
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

    if (mode === 'pairs') {
      const cGroup = groupPairsMode(computer.hand);
      const matchedIdx = cGroup.strays.findIndex(c => c.color === drawn.color && c.character === drawn.character);
      
      if (matchedIdx !== -1) {
        // AI self-draw matches a stray Card
        const matched = cGroup.strays[matchedIdx];
        const newHand = computer.hand.filter(c => c.id !== matched.id);
        const newMeld: RevealedMeld = {
          id: `comp-pair-draw-${Date.now()}`,
          type: 'pair',
          cards: [drawn, matched],
          hoo: isGeneral(drawn) ? 2 : 0,
          name: `對子 [${drawn.name}]`
        };

        setComputer(prev => ({
          ...prev,
          hand: newHand,
          revealed: [...prev.revealed, newMeld]
        }));
        setLastDrawnCard(null);
        addLog(`🤖 電腦 AI 自我配對成功！亮出明對：[${drawn.name}]。`);

        const nextGroup = groupPairsMode(newHand);
        if (nextGroup.strays.length === 0) {
          handleWin('computer', 'pairs', '電腦自摸對子成功，手中散牌宣告配對歸零，斬獲勝利！');
          setIsComputerThinking(false);
          return;
        }

        setTimeout(() => {
          executeComputerDiscard(newHand);
        }, 900);
      } else {
        // No match. Card remains in computer hand, and AI plays a card
        const updatedHand = sortHandForDisplay([...computer.hand, drawn]);
        setComputer(prev => ({ ...prev, hand: updatedHand }));
        setLastDrawnCard(null);
        setTimeout(() => {
          executeComputerDiscard(updatedHand);
        }, 900);
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
            name: `暗開車 [${drawn.name}*4]`
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
    let discardIndex = -1;

    if (mode === 'pairs') {
      const group = groupPairsMode(handBeforeDicard);
      if (group.strays.length > 0) {
        // AI discards the first stray card
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

    setDiscardPile(prev => [discarded, ...prev]);
    setLastDiscardedCard(discarded);
    addLog(`🤖 電腦 AI 思考後打出了拋牌：[${discarded.name}]`);

    // Pairs mode: check if computer's hand is now all-paired after discarding
    if (mode === 'pairs') {
      const compAfterGroup = groupPairsMode(finalHand);
      if (compAfterGroup.strays.length === 0 && finalHand.length > 0) {
        handleWin('computer', 'pairs', '電腦打出多餘單張後，手中散牌全部配對完畢，電腦勝出！');
        setIsComputerThinking(false);
        return;
      }
    }

    // Let the player react to computer's discard!
    const playerMoves = checkAvailableMoves(player.hand, player.revealed, discarded, false);
    setIsComputerThinking(false);

    if (mode === 'pairs') {
      const pGroup = groupPairsMode(player.hand);
      const canPair = pGroup.strays.some(c => c.color === discarded.color && c.character === discarded.character);

      if (canPair) {
        setPendingMoves({
          canHu: false,
          canQuad: false,
          canPong: true, // For pair matching
          canEatSeq: false,
          eatSeqOptions: []
        });
        setGamePhase('waiting_player_action');
        setGuideMessage(`電腦拋出 [${discarded.name}]！正好可以為您的單張配對。點選下方【吃對】按鈕以攤派對子，或按【過】。`);
      } else {
        setCurPlayerId('player');
        setCanDiscard(false);
        setHasDrawn(false);
        setGuideMessage('輪到您的回合！沒有可用配對。請點選左邊「紅疊牌庫」摸新牌。');
      }
    } else {
      // Standard rule checks
      if (playerMoves.canHu || playerMoves.canPong || playerMoves.canQuad || playerMoves.canEatSeq) {
        setPendingMoves(playerMoves);
        setGamePhase('waiting_player_action');
        setGuideMessage(`電腦大意拋出 [${discarded.name}]！您有可用吃碰胡牌機會。請點選下方亮明或吃跑按鈕。`);
      } else {
        setCurPlayerId('player');
        setCanDiscard(false);
        setHasDrawn(false);
        setGuideMessage('輪到您的回合！無吃碰吃跑。請點選「紅疊牌庫」抽取下一張。');
      }
    }
  };

  // Player clicks one of matching active decision choices (Eat, Pong, Quad, Hu)
  const handlePlayerAction = (actionType: 'eat' | 'pong' | 'quad' | 'hu', eatOption?: any) => {
    const trigger = lastDrawnCard || lastDiscardedCard;
    if (!trigger) return;

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
            name: `對子 [${trigger.name}]`
          };

          const updatedRevealed = [...player.revealed, newMeld];
          setPlayer(prev => ({
            ...prev,
            hand: nextHand,
            revealed: updatedRevealed
          }));

          addLog(`【吃對子】您吃對了 [${trigger.name}]，配對擺在案前。`);
          setLastDrawnCard(null);
          setLastDiscardedCard(null);
          setPendingMoves(null);
          setGamePhase('playing');
          setShowEatPairAnim(true);

          const checkGroup = groupPairsMode(nextHand);
          if (checkGroup.strays.length === 0) {
            setTimeout(() => {
              setShowEatPairAnim(false);
              handleWin('player', 'pairs', '恭喜！您成功配對了手中所有單張散牌，解鎖大勝！');
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
            setGuideMessage('配對成功！請在手牌選取一張散牌打出。');
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
          name: `明刻 [${trigger.name}*3]`
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
        name: `明開車 [${trigger.name}*4]`
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
          setGuideMessage(`補摸 [${repCard.name}]！再次觸發行動機會，請選擇！`);
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
        name: eatOption.meldName
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

  // Human manual trigger of WIN (HU)
  const handleDeclareHuSelf = () => {
    playSound('click');
    const result = solveHu(player.hand, player.revealed);
    if (result.canHu) {
      handleWin('player', 'hu', result.explanation);
    } else {
      playSound('lose');
      setGuideMessage(`宣告胡牌失敗：尚未滿足胡牌條件 (必須所有手牌都被成功分組，且總分數需達 10 胡或以上)！`);
      addLog(`[宣告失敗] ${result.explanation}`);
    }
  };

  // Player skips matching option trigger
  const handlePlayerSkip = () => {
    playSound('click');
    addLog(`您的回合判定：您選擇【過 (跳過行動)】。`);
    
    setPendingMoves(null);
    setGamePhase('playing');

    if (curPlayerId === 'player' && lastDrawnCard && drawnFromDeck) {
      // Skipped on self-drawn card. Push to hand and prepare discard action
      const appendedHand = sortHandForDisplay([...player.hand, lastDrawnCard]);
      setPlayer(prev => ({ ...prev, hand: appendedHand }));
      setLastDrawnCard(null);
      setCanDiscard(true);
      setGuideMessage('已跳過。摸牌置入您的手牌。請選取一張牌打出。');
    } else {
      // Skipped reacting to opponent's discard card. Turn becomes computer's active draw turn
      setLastDiscardedCard(null);
      setCanDiscard(false);
      setCurPlayerId('computer');
      setIsComputerThinking(true);
      setGuideMessage('電腦取得了摸牌先手權，摸牌中...');
      
      setTimeout(() => {
        runComputerTurn(null);
      }, 1000);
    }
  };

  // Triggers game-over winner scene
  const handleWin = (winner: 'player' | 'computer', type: 'pairs' | 'hu', explanation: string) => {
    playSound(winner === 'player' ? 'win' : 'lose');
    setGamePhase('game_over');
    setWinnerId(winner);
    setWinType(type);
    setWinExplanation(explanation);
    addLog(`📢 牌局終止！【${winner === 'player' ? '玩家' : '電腦 AI'}】宣佈贏得本盤勝利！理由：${explanation}`);
    if (winner === 'player') {
      setShowHuCelebration(true);
      setHuCelebShowContinue(false);
      setTimeout(() => setHuCelebShowContinue(true), 5000);
    }
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
      if (confirm('確定要終止當前進行中的護腦牌局，返回設定大廳嗎？')) {
        setGamePhase('setup');
        setActivePage('lobby');
      }
    } else {
      setActivePage('lobby');
    }
  };

  // Dynamic checks for Standard Mode score preview helper
  // Include lastDrawnCard when it is pending (not yet merged into player.hand)
  const huCheckHand = lastDrawnCard && drawnFromDeck ? [...player.hand, lastDrawnCard] : player.hand;
  const activeHuCheck = solveHu(huCheckHand, player.revealed);
  const playerGrouping = groupPairsMode(player.hand);

  return (
    <div className="h-[100dvh] w-screen bg-[#0a1628] text-slate-100 flex items-center justify-center relative overflow-hidden font-sans select-none">
      
      {/* BACKGROUND GRADIENT */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#0d2d6b_0%,_#071020_100%)] opacity-80 z-0 pointer-events-none" />

      {/* FULLSCREEN GAME BOARD CONSOLE */}
      <div
        className="w-full h-full max-w-7xl bg-[#0f2d5c]/95 shadow-2xl flex flex-col overflow-hidden relative border-x border-blue-950/40 z-20 animate-fade-in"
      >

        {/* ========================================== */}
        {/* INTERACTIVE MULTI-PAGE VIEW SYSTEM         */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col min-h-0 w-full relative bg-[radial-gradient(circle_at_center,_#1a3d7c_0%,_#0a2347_100%)] select-none">
          
          {/* 1. Lobby/Setup Page (遊戲開始設定頁面) */}
          {activePage === 'lobby' && (
            <div className="flex-1 px-5 lg:px-16 xl:px-32 flex flex-col justify-between h-full select-none text-white overflow-hidden min-h-0" style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 1rem)', paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 1rem)' }}>
              
              {/* Grand compact title */}
              <div className="text-center space-y-1.5 py-2 shrink-0">
                <div className="flex items-center justify-center gap-3">
                  <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse shrink-0" />
                  <h1 className="text-3xl md:text-4xl font-serif font-black tracking-widest text-yellow-500 italic select-none">
                    四色牌傳統遊藝廳
                  </h1>
                  <Sparkles className="w-6 h-6 text-yellow-500 animate-pulse shrink-0" />
                </div>
                <p className="text-sm tracking-widest text-blue-200 font-extrabold uppercase font-mono">
                  — 專為銀髮長輩特製 · 護腦防失智 —
                </p>
              </div>

              {/* Steps in a beautiful compact grid to avoid scrolling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 select-none min-h-0 flex-1 overflow-y-auto md:overflow-visible items-stretch">
                
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
                    <p className="text-sm font-extrabold text-yellow-400">挑選您喜愛的對戰玩法：</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                    {/* Mode 1: Pairs */}
                    <div
                      onClick={() => { playSound('click'); setMode('pairs'); }}
                      className={`text-left p-3 rounded-xl border transition-all block relative cursor-pointer select-none ${
                        mode === 'pairs'
                          ? 'bg-blue-900/40 border-yellow-500 shadow ring-2 ring-yellow-500/20'
                          : 'bg-black/25 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-black text-white flex items-center gap-1">
                          👦 抓對對子簡單對戰
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug font-medium">
                        簡易配對，長輩首選！系統會自動為您挑出暗坎同色組，只需輕敲出子配對！
                      </p>

                      {/* Mode pairs hand size controls */}
                      {mode === 'pairs' && (
                        <div className="mt-2 flex items-center justify-between gap-1 bg-black/60 p-1.5 rounded-lg border border-white/5" onClick={(e)=>e.stopPropagation()}>
                          <button
                            onClick={() => { playSound('click'); setPairsHandSize(10); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                              pairsHandSize === 10 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-slate-200'
                            }`}
                          >
                            10張五對胡（發9張）
                          </button>
                          <button
                            onClick={() => { playSound('click'); setPairsHandSize(15); }}
                            className={`flex-1 py-1.5 text-xs font-bold rounded-md transition-colors ${
                              pairsHandSize === 15 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-slate-200'
                            }`}
                          >
                            15張五組胡（發14張）
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mode 2: Standard */}
                    <div
                      onClick={() => { playSound('click'); setMode('standard'); }}
                      className={`text-left p-3 rounded-xl border transition-all block relative cursor-pointer select-none ${
                        mode === 'standard'
                          ? 'bg-blue-900/40 border-yellow-500 shadow ring-2 ring-yellow-500/20'
                          : 'bg-black/25 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-base font-black text-white flex items-center gap-1">
                          🀄 傳統吃碰客家玩法
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-snug font-medium">
                        正宗客家經典二十張！包含將士象、車馬包同色吃、碰、槓。達成 10 胡之牌點數自摸。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launcher & Extras Combined Dock */}
              <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-3 shrink-0">
                <div className="flex justify-between items-center gap-4 text-sm font-bold text-slate-300">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="flex items-center gap-2 hover:text-white"
                  >
                    {soundEnabled ? <Volume2 className="w-5 h-5 text-blue-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                    <span>語音配音：{soundEnabled ? '已開啟' : '靜音'}</span>
                  </button>

                  <button
                    onClick={() => setShowComputerHand(!showComputerHand)}
                    className="flex items-center gap-2 hover:text-white"
                  >
                    {showComputerHand ? <Eye className="w-5 h-5 text-blue-400" /> : <EyeOff className="w-5 h-5 text-slate-400" />}
                    <span>防走失作弊透視：{showComputerHand ? '開' : '關'}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { playSound('click'); initGame(); }}
                    className="flex-1 py-4 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:brightness-110 active:scale-98 transition-all font-black text-slate-950 text-xl rounded-xl shadow-xl flex items-center justify-center gap-2 select-none"
                  >
                    開始洗牌、發牌入席 🀄
                  </button>

                  <button
                    onClick={handleOpenRules}
                    className="py-4 px-4 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-sm font-black flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <BookOpen className="w-4 h-4 text-yellow-500" />
                    <span>說明</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* 2. Game Play Page (遊戲頁面) */}
          {activePage === 'game' && (
            <div className="flex-1 flex flex-col h-full w-full select-none text-white overflow-hidden relative">
              
              {/* Compact header — paddingTop fills behind the notch */}
              <header
                className="bg-black/40 border-b border-white/10 px-3 flex flex-col shrink-0 select-none z-10"
                style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}
              >
                {/* Row 1: navigation buttons */}
                <div className="h-12 flex items-center justify-between">
                  <button
                    onClick={handleQuitToLobby}
                    className="py-1.5 px-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-sm font-extrabold text-red-200 rounded-xl transition-all"
                  >
                    🚪 返回
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => { playSound('click'); setSoundEnabled(!soundEnabled); }}
                      className="p-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-full transition-colors"
                    >
                      {soundEnabled ? <Volume2 className="w-5 h-5 text-blue-400" /> : <VolumeX className="w-5 h-5 text-red-400" />}
                    </button>
                    <button
                      onClick={() => setShowLogDrawer(!showLogDrawer)}
                      className="p-2 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-full transition-colors lg:hidden"
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

              {/* GAME SPACE FLOW */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* ① 遊戲頁面 — Game Display Panel */}
                <div className="shrink-0 flex flex-col px-3 pt-2 pb-1.5 space-y-1.5 border-b-2 border-white/10">

                {/* AI / OPPONENT STATUS (Top) */}
                <div className="bg-black/35 p-2 rounded-2xl border border-white/5 space-y-1 text-sm relative select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-black">
                      <Cpu className="w-4 h-4 animate-pulse text-cyan-400" />
                      <span>{computer.name}</span>
                    </div>

                    <div className="flex items-center gap-1 text-xs text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold">
                      <span>賸餘牌:</span>
                      <strong className="text-yellow-400 text-sm">{computer.hand.length}</strong>
                      <span>張</span>
                    </div>
                  </div>

                  {/* Robot's revealed sets on screen */}
                  {computer.revealed.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 mt-0.5 overflow-x-auto whitespace-nowrap scrollbar-none">
                      <span className="text-xs text-slate-400 font-bold shrink-0">案前亮相：</span>
                      <div className="flex gap-1">
                        {computer.revealed.map((meld) => (
                          <div key={meld.id} className="bg-white/5 px-1.5 py-0.5 rounded border border-white/10 text-xs flex items-center gap-0.5">
                            <span className="text-yellow-500 font-bold leading-none">{meld.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fan of AI cards — only shown in cheat/透視 mode */}
                  {showComputerHand && (
                    <div className="flex flex-wrap justify-center items-center gap-0.5 pt-1.5 border-t border-white/5 max-h-[110px] overflow-hidden">
                      {computer.hand.map((card) => (
                        <div key={card.id} className="opacity-75 filter scale-75">
                          <FourColorCard card={card} size="sm" isRevealed={true} disabled={true} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* THE PORTRAIT RIVER / TABLE (Middle) */}
                <div className="p-2 bg-black/20 rounded-2xl border border-white/5 grid grid-cols-12 gap-1.5 items-center select-none">
                  
                  {/* Left: Deck stack (摸牌) */}
                  <div className="col-span-4 flex flex-col items-center justify-center border-r border-white/10 py-1 pr-1">
                    <span className="text-xs font-bold text-yellow-500/80 mb-1.5">🎴 牌庫摸牌</span>
                    {deck.length > 0 ? (
                      <button
                        onClick={handlePlayerDraw}
                        disabled={gamePhase !== 'playing' || curPlayerId !== 'player' || lastDrawnCard !== null || hasDrawn}
                        className={`relative w-14 h-21 rounded-xl transition-all shadow-md flex flex-col items-center justify-center ${
                          gamePhase === 'playing' && curPlayerId === 'player' && lastDrawnCard === null && !hasDrawn
                            ? 'scale-105 active:scale-95 ring-3 ring-yellow-500 animate-bounce cursor-pointer'
                            : 'opacity-70 cursor-not-allowed'
                        }`}
                      >
                        <div className="absolute top-0.5 left-0.5 w-full h-full bg-[#922b21] rounded-xl border border-white/10 transform translate-x-1 translate-y-1 z-0" />
                        <div className="relative w-full h-full bg-[#c0392b] border-2 border-white/10 rounded-xl flex flex-col items-center justify-center text-center p-1.5 z-10 leading-none">
                          <span className="text-[10px] font-extrabold block text-white/60 leading-none">剩餘</span>
                          <span className="text-lg font-mono font-black text-white leading-none mt-0.5">{deck.length}</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-14 h-21 border border-dashed border-white/20 bg-white/5 rounded-xl flex items-center justify-center text-center text-xs text-slate-500 leading-tight">
                        牌庫空
                      </div>
                    )}
                    <span className="text-[10px] text-slate-300 font-extrabold mt-1 text-center leading-tight">
                      {gamePhase === 'playing' && curPlayerId === 'player' && lastDrawnCard === null && !hasDrawn
                        ? '👆 點此摸牌'
                        : '等待中…'}
                    </span>
                  </div>

                  {/* Center: Current Focus Table card */}
                  <div className="col-span-5 flex flex-col items-center justify-center px-1">
                    <span className="text-xs font-bold text-yellow-500/80 mb-1">🔥 桌上焦點牌</span>
                    <div className="h-[95px] flex items-center justify-center relative">
                      {lastDrawnCard ? (
                        <div className="flex flex-col items-center gap-0.5 animate-bounce">
                          <span className="text-[10px] bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 py-0.5 px-1.5 rounded leading-none font-bold">
                            {drawnFromDeck ? '自摸摸出 ➔' : '電腦打出 ➔'}
                          </span>
                          <div className="scale-75">
                            <FourColorCard card={lastDrawnCard} size="sm" isRevealed={true} disabled={true} />
                          </div>
                        </div>
                      ) : lastDiscardedCard ? (
                        <div className="flex flex-col items-center gap-0.5 animate-pulse">
                          <span className="text-[10px] bg-red-950/60 text-red-300 border border-red-900/50 py-0.5 px-1.5 rounded leading-none font-bold">
                            {curPlayerId === 'computer' ? '您打出 ➔' : '電腦棄牌 ➔'}
                          </span>
                          <div className="scale-75">
                            <FourColorCard card={lastDiscardedCard} size="sm" isRevealed={true} disabled={true} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-21 border border-white/10 bg-white/5 rounded-xl flex flex-col items-center justify-center text-center text-slate-500 p-1 select-none whitespace-normal">
                          <span className="text-[10px] leading-tight">等待摸牌或棄牌</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: recycler grid (牌河) */}
                  <div className="col-span-3 flex flex-col items-center justify-center border-l border-white/10 py-1 pl-1 max-h-[110px] overflow-hidden">
                    <span className="text-[10px] font-bold text-yellow-500/80 mb-1 text-center leading-none">🗑️ 牌河回收</span>
                    <div className="w-full flex-1 min-h-[75px] max-h-[85px] overflow-y-auto bg-black/40 border border-white/5 p-1 rounded-xl flex flex-wrap gap-0.5 justify-center scrollbar-none">
                      {discardPile.map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="w-[16px] h-[36px] rounded flex items-center justify-center font-bold text-[9px] opacity-80" style={{
                          backgroundColor: c.color === 'yellow' ? '#fef3c7' : c.color === 'green' ? '#047857' : c.color === 'red' ? '#ea580c' : '#f8fafc',
                          color: c.color === 'yellow' ? '#b91c1c' : '#09090b',
                          border: '1px solid #111111'
                        }}>
                          {c.character}
                        </div>
                      ))}
                      {discardPile.length === 0 && (
                        <span className="text-xs text-slate-500 my-auto text-center font-medium leading-none">空無一物</span>
                      )}
                    </div>
                  </div>
                </div>

                </div>{/* end 遊戲頁面 */}

                {/* ② 控制頁面 — Control Panel (no vertical scroll — everything fits) */}
                <div className="flex-1 flex flex-col min-h-0 px-3 pt-1.5 gap-1.5 overflow-hidden">

                {/* GAME ACTIVE DECISIONS */}
                {pendingMoves && gamePhase === 'waiting_player_action' && (
                  <div className="bg-black/95 border-2 border-yellow-500 p-2.5 rounded-2xl flex flex-col items-center gap-2 animate-pulse shadow-2xl shrink-0 z-40">
                    <div className="text-[11px] font-black text-yellow-400 border-b border-white/10 w-full text-center pb-1">
                      🚨 雷達鎖定配對信號！請選擇：
                    </div>
                    
                    <div className="flex flex-wrap items-center justify-center gap-2">
                      {/* Declare HU (Winning) */}
                      {pendingMoves.canHu && (
                        <button
                          onClick={() => handlePlayerAction('hu')}
                          className="w-18 h-18 rounded-full bg-red-600 hover:bg-red-500 border-4 border-yellow-400 shadow-lg flex items-center justify-center text-2xl font-black text-white hover:scale-105 active:scale-95 transition-transform animate-bounce"
                        >
                          胡！
                        </button>
                      )}

                      {/* Pairs Match or standard Pong */}
                      {pendingMoves.canPong && (
                        <button
                          onClick={() => handlePlayerAction('pong')}
                          className="w-16 h-16 rounded-full bg-orange-500 hover:bg-orange-400 border-2 border-white/60 shadow flex items-center justify-center text-base font-black text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                          {mode === 'pairs' ? '吃對' : '碰'}
                        </button>
                      )}

                      {/* Quads action */}
                      {pendingMoves.canQuad && (
                        <button
                          onClick={() => handlePlayerAction('quad')}
                          className="w-16 h-16 rounded-full bg-yellow-600 hover:bg-yellow-500 border-2 border-white/60 shadow flex items-center justify-center text-base font-black text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                          槓
                        </button>
                      )}

                      {/* Eat sequences (with lists support) */}
                      {pendingMoves.canEatSeq && pendingMoves.eatSeqOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlayerAction('eat', opt)}
                          className="px-4 py-3 rounded-xl bg-yellow-600 border border-yellow-500 text-sm font-black text-white active:scale-95 transition-transform"
                        >
                          吃:{opt.resultCards.map(c=>c.character).join('')}
                        </button>
                      ))}

                      {/* Drop choices */}
                      <button
                        onClick={handlePlayerSkip}
                        className="px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-sm font-bold text-slate-300 rounded-xl active:scale-95"
                      >
                        過 (放棄)
                      </button>
                    </div>
                  </div>
                )}

                {/* ELDER ACTION CONTROLLER AID — flex-1 fills remaining height */}
                <div className="flex-1 flex flex-col min-h-0 bg-black/35 rounded-2xl border border-white/10 select-none overflow-hidden">

                  {/* User profile banner */}
                  <div className="flex justify-between items-center bg-[#0c2852] py-2 px-3 border-b border-white/5 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xl leading-none">{playerAvatar}</span>
                      <span className="text-sm font-black text-yellow-300">{playerName}</span>
                    </div>
                    {mode === 'pairs' ? (
                      <div className="text-xs font-bold text-red-300 leading-none">
                        散牌：<strong className="text-sm text-red-400 font-extrabold">{playerGrouping.strays.length}</strong> 張
                      </div>
                    ) : (
                      <div className="text-xs font-bold leading-none">
                        {activeHuCheck.canHu ? (
                          <span className="text-emerald-400 font-black">✔ 可胡牌！</span>
                        ) : (
                          <span>{activeHuCheck.totalHoo} / 10 胡</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Pairs groupings row */}
                  {mode === 'pairs' && (
                    <div className="grid grid-cols-4 gap-1 px-2 py-1 shrink-0 text-[10px] font-mono border-b border-white/5">
                      <div className="bg-emerald-950/40 p-1 rounded text-center">
                        <span className="text-emerald-400 block font-bold leading-none">開車✕{playerGrouping.quads.length}</span>
                      </div>
                      <div className="bg-cyan-950/40 p-1 rounded text-center">
                        <span className="text-cyan-400 block font-bold leading-none">暗坎✕{playerGrouping.triples.length}</span>
                      </div>
                      <div className="bg-purple-950/40 p-1 rounded text-center">
                        <span className="text-purple-400 block font-bold leading-none">對子✕{playerGrouping.pairs.length}</span>
                      </div>
                      <div className="bg-red-950/40 p-1 rounded text-center">
                        <span className="text-red-400 block font-bold leading-none">散牌✕{playerGrouping.strays.length}</span>
                      </div>
                    </div>
                  )}

                  {/* PLAYER HAND — 2 rows, max card size via ResizeObserver */}
                  <div className="flex-1 min-h-0 flex flex-col px-1 pt-1 pb-0 overflow-hidden">
                    <span className="text-xs font-black text-yellow-400/90 shrink-0 mb-1 px-1">
                      👇 您的手牌 (輕敲選牌，再點打牌)：
                    </span>
                    <div
                      ref={handContainerRef}
                      className="flex-1 min-h-0 grid justify-center content-start gap-x-[1px] gap-y-2.5 overflow-hidden py-1"
                      style={{ gridTemplateColumns: `repeat(${Math.ceil(player.hand.length / 2) || 1}, ${handCardDims.w}px)` }}
                    >
                      {player.hand.map((card) => {
                        const isStray = mode !== 'pairs' || playerGrouping.strays.some(s => s.id === card.id);
                        const isPaired = mode === 'pairs' && !isStray;
                        const isSelected = card.id === selectedCardId && isStray;
                        return (
                          <div key={card.id} className="relative flex flex-col items-center">
                            <FourColorCard
                              card={card}
                              size="xs"
                              isRevealed={true}
                              isSelected={isSelected}
                              disabled={isPaired}
                              onClick={() => {
                                if (isPaired) return;
                                playSound('click');
                                setSelectedCardId(isSelected ? null : card.id);
                              }}
                              cardStyle={{
                                width: handCardDims.w,
                                height: handCardDims.h,
                                opacity: isPaired ? 0.45 : 1,
                                filter: isPaired ? 'brightness(0.6) saturate(0.5)' : undefined,
                                transition: 'opacity 0.3s, filter 0.3s',
                              }}
                              charFontSize={handCardDims.fs}
                            />
                            {mode === 'pairs' && isPaired && (
                              <span className="absolute bottom-[-8px] text-[7px] bg-purple-950 text-purple-400 font-extrabold border border-purple-900/60 px-0.5 rounded leading-none pointer-events-none">
                                對
                              </span>
                            )}
                            {mode === 'pairs' && isStray && (
                              <span className="absolute bottom-[-8px] text-[7px] bg-red-950 text-red-500 font-extrabold border border-red-900/60 px-0.5 rounded leading-none pointer-events-none">
                                散
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* ACTION BAR */}
                  <div className="bg-black/30 px-3 py-2 flex items-center justify-between gap-2 border-t border-white/5 shrink-0">
                    <div className="text-xs text-slate-300 font-bold max-w-[40%] text-left select-none">
                      {selectedCardId ? (
                        <p className="leading-tight">
                          選中：<strong className="text-yellow-400 text-base">[{player.hand.find(c => c.id === selectedCardId)?.name}]</strong>
                        </p>
                      ) : (
                        <p className="text-slate-400 text-xs leading-tight font-semibold">👉 輕點一張牌</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      {mode === 'standard' && (
                        <button
                          onClick={handleDeclareHuSelf}
                          disabled={gamePhase !== 'playing'}
                          className={`px-4 py-2.5 text-sm text-white font-extrabold rounded-xl shadow border transition-all disabled:opacity-40 ${
                            activeHuCheck.canHu && gamePhase === 'playing'
                              ? 'bg-gradient-to-r from-red-500 to-yellow-500 border-yellow-300 animate-pulse scale-105'
                              : 'bg-gradient-to-r from-red-900 to-yellow-900 border-yellow-800'
                          }`}
                        >
                          👑 宣告胡牌
                        </button>
                      )}

                      <button
                        onClick={() => handlePlayerDiscard(selectedCardId!)}
                        disabled={!selectedCardId || !canDiscard || gamePhase !== 'playing' || curPlayerId !== 'player'}
                        className={`px-5 py-2.5 font-black rounded-xl text-sm transition-all flex items-center gap-1 ${
                          selectedCardId && canDiscard && gamePhase === 'playing' && curPlayerId === 'player'
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black border border-yellow-300 animate-pulse'
                            : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        🔨 打牌出這張
                      </button>
                    </div>
                  </div>

                  {/* GUIDE BAR — very bottom of screen, above home indicator */}
                  <div
                    className={`lg:hidden flex items-center gap-2 px-3 py-2 shrink-0 border-t transition-colors ${
                      pendingMoves && gamePhase === 'waiting_player_action'
                        ? 'bg-orange-900/60 border-orange-500/40 text-orange-100'
                        : mode === 'standard' && activeHuCheck.canHu
                          ? 'bg-emerald-900/70 border-emerald-500/40 text-emerald-100'
                          : 'bg-black/50 border-white/5 text-slate-300'
                    }`}
                    style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 0.375rem)' }}
                  >
                    <span className="text-base shrink-0 leading-none">
                      {pendingMoves && gamePhase === 'waiting_player_action' ? '🚨'
                       : mode === 'standard' && activeHuCheck.canHu ? '🏆'
                       : 'ℹ️'}
                    </span>
                    <p className="text-xs font-semibold leading-snug">{guideMessage}</p>
                  </div>
                </div>

                </div>{/* end 控制頁面 */}

              </div>{/* end main column */}

              {/* SIDEBAR — Desktop lg+ only */}
              <aside className="hidden lg:flex flex-col w-72 xl:w-80 border-l border-white/10 bg-black/20 p-4 gap-3 overflow-hidden shrink-0">
                {/* Guide */}
                <div className="bg-yellow-500/10 border-l-2 border-yellow-500 p-3 rounded-r-xl flex items-start gap-2 shrink-0">
                  <Info className="w-4 h-4 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-slate-100 text-xs leading-relaxed font-bold">{guideMessage}</p>
                </div>
                {/* Logs */}
                <div className="flex-1 flex flex-col min-h-0 bg-[#071838] border border-blue-800/30 rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-white/10 text-[11px] font-extrabold text-yellow-500 flex items-center gap-1.5 shrink-0">
                    <History className="w-3.5 h-3.5" />
                    牌局記錄
                  </div>
                  <div className="flex-1 overflow-y-auto p-2 space-y-0.5 text-[10px] font-mono">
                    {logs.length === 0 ? (
                      <p className="text-slate-500 text-center mt-4">尚無記錄</p>
                    ) : (
                      [...logs].reverse().map((log, idx) => (
                        <div key={idx} className="py-0.5 border-b border-white/5 last:border-0 flex items-start gap-1 leading-snug text-slate-300">
                          <span className="text-yellow-500 shrink-0">▸</span>
                          <span>{log}</span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </aside>

              </div>{/* closes flex-1 min-h-0 flex overflow-hidden */}

              {/* RETRO DIALOG HISTORY ON DEMAND OVERLAY */}
              {showLogDrawer && (
                <div className="lg:hidden absolute inset-x-0 bottom-0 top-[52px] bg-[#0a1628]/98 border-t border-blue-500/30 z-30 p-4 flex flex-col justify-between select-none">
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
                <button
                  onClick={() => handleSwitchTab('standard')}
                  className={`flex-1 py-3 px-0.5 rounded-lg text-center transition-colors ${activeTutorialTab === 'standard' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  🀄 傳統吃碰
                </button>
                <button
                  onClick={() => handleSwitchTab('point')}
                  className={`flex-1 py-3 px-0.5 rounded-lg text-center transition-colors ${activeTutorialTab === 'point' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  📊 胡數計分
                </button>
              </div>

              {/* Tab contents */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 text-slate-200 text-left text-base space-y-4 font-sans leading-relaxed scrollbar-thin">

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
                        <li><strong className="text-white">摸牌：</strong>輪到自己時從牌疊摸一張。若與手中某張單牌湊成對子，點【吃對】配對並打出一張不要的牌；若無法配對，可打出剛摸到的牌，或換入手中打出另一張。</li>
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
                  </div>
                )}

                {activeTutorialTab === 'standard' && (
                  <div className="space-y-4 select-none">
                    <h3 className="text-lg font-black text-yellow-500 border-b border-white/10 pb-2">🀄 玩法二：傳統吃碰標準玩法</h3>
                    <p className="text-slate-300 font-semibold leading-relaxed text-base">
                      老祖宗正宗四色牌！重在組牌戰術、思索吃碰抉擇：
                    </p>
                    <ul className="list-decimal pl-5 space-y-3 text-slate-300 font-bold leading-relaxed text-sm">
                      <li><strong>發牌張數：</strong> 每人分配 20 張手牌起點。</li>
                      <li><strong>合法牌組組合 (Meld)：</strong>
                        <ul className="list-disc pl-4 mt-2 space-y-1.5 text-slate-300 font-medium">
                          <li><span className="text-yellow-400">同色帥仕相 / 將士象</span>（3張各1）</li>
                          <li><span className="text-yellow-400">同色俥傌炮 / 車馬包</span>（3張各1）</li>
                          <li><span className="text-yellow-400">同色同字三張（明碰 / 暗坎）</span></li>
                          <li><span className="text-yellow-400">同色同字四張（明槓 / 暗槓，俗稱開車）</span></li>
                          <li><span className="text-yellow-400">同字異色組</span>（3家不同色 1胡，4色全齊 4胡）</li>
                        </ul>
                      </li>
                      <li><strong>獲勝條件：</strong>
                        <p className="mt-1 font-medium">
                          除了成組合法牌搭外，最後可自摸胡牌、或引誘敵手棄牌，且<strong>累積亮明與暗坎之「胡數 (Hoo)」大於或等於 10 胡</strong>，點宣告胡牌胡取勝利。
                        </p>
                      </li>
                    </ul>
                  </div>
                )}

                {activeTutorialTab === 'point' && (
                  <div className="space-y-4 select-none">
                    <h3 className="text-lg font-black text-yellow-500 border-b border-white/10 pb-2">📊 牌組胡數對抗速查：</h3>

                    <div className="bg-black/35 p-4 rounded-xl border border-white/10 space-y-3">
                      <p className="font-extrabold text-emerald-400 text-base">🎖️ 帥／將 單獨算分：</p>
                      <ul className="list-disc pl-5 space-y-2 text-slate-300 font-medium text-sm">
                        <li>單張在手或亮相：<strong className="text-yellow-400">1 胡</strong></li>
                        <li>對子（將眼）：<strong className="text-yellow-400">2 胡</strong></li>
                        <li>暗坎 (三張相同在手)：<strong className="text-yellow-400">3 胡</strong></li>
                        <li>四張全集（開車）：<strong className="text-yellow-400">8 胡</strong></li>
                      </ul>
                    </div>

                    <div className="bg-black/35 p-4 rounded-xl border border-white/10 space-y-3">
                      <p className="font-extrabold text-emerald-400 text-base">🎎 一般同色牌組算分：</p>
                      <ul className="list-disc pl-5 space-y-2 text-slate-300 font-medium text-sm">
                        <li>同色帥仕相 (將士象)：<strong className="text-yellow-400">2 胡</strong></li>
                        <li>同色俥傌炮 (車馬包)：<strong className="text-yellow-400">2 胡</strong></li>
                        <li>明碰 (碰出去的三張)：<strong className="text-yellow-400">1 胡</strong></li>
                        <li>暗坎 (手牌三張)：<strong className="text-yellow-400">3 胡</strong></li>
                        <li>明開車 / 明槓：<strong className="text-yellow-400">6 胡</strong></li>
                        <li>暗開車 / 暗槓：<strong className="text-yellow-400">8 胡</strong></li>
                        <li>三異色 / 四異色組：<strong className="text-yellow-400">1 胡 / 4 胡</strong></li>
                      </ul>
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

            <div className="bg-black/45 p-4 rounded-2xl border border-blue-800 text-slate-100 text-sm font-serif font-medium leading-relaxed mb-5 max-h-[140px] overflow-y-auto">
              {winExplanation}
            </div>

            <button
              onClick={() => { playSound('click'); initGame(); }}
              className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 tracking-wider text-base font-black rounded-2xl shadow-xl transition-all active:scale-95"
            >
              重新發牌，再開一局 🀄
            </button>
          </div>
        </div>
      )}

      {/* 吃對 ANIMATION OVERLAY — 3 seconds, pointer-events-none */}
      {showEatPairAnim && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center pointer-events-none select-none">
          <div className="flex flex-col items-center gap-3">
            <div
              className="text-white font-black leading-none"
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(5rem, 22vw, 9rem)',
                color: '#f5c218',
                animation: 'eatPairPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both, eatPairGlow 0.8s ease-in-out 0.5s infinite alternate',
                WebkitTextStroke: '2px rgba(240,120,0,0.6)',
              }}
            >
              吃對！
            </div>
            <div
              className="text-yellow-200 font-extrabold tracking-widest"
              style={{
                fontSize: 'clamp(1.1rem, 5vw, 1.8rem)',
                animation: 'fadeInUp 0.4s ease 0.4s both',
                textShadow: '0 0 20px rgba(240,179,41,0.9)',
                letterSpacing: '0.2em',
              }}
            >
              ✨ 配對成功 ✨
            </div>
          </div>
        </div>
      )}

      {/* 胡牌 CELEBRATION OVERLAY — fireworks + stamp + 繼續下局 button */}
      {showHuCelebration && (
        <div className="fixed inset-0 z-[200] flex flex-col items-center justify-center select-none overflow-hidden">
          {/* Fireworks canvas */}
          <canvas
            ref={fireworksCanvasRef}
            className="absolute inset-0 w-full h-full"
            style={{ background: 'rgba(6,14,30,0.82)' }}
          />

          {/* Content on top of canvas */}
          <div className="relative z-10 flex flex-col items-center gap-6 px-6 text-center">
            {/* 胡牌 stamp */}
            <div
              style={{
                fontFamily: 'Georgia, serif',
                fontSize: 'clamp(5.5rem, 28vw, 11rem)',
                fontWeight: 900,
                color: '#ff4444',
                lineHeight: 1,
                animation: 'huStamp 0.7s cubic-bezier(0.22,1,0.36,1) both, huGlow 1s ease-in-out 0.7s infinite alternate',
                WebkitTextStroke: '3px rgba(240,179,41,0.7)',
              }}
            >
              胡牌！
            </div>

            {/* Sub-label */}
            <div
              style={{
                fontSize: 'clamp(1rem, 4.5vw, 1.6rem)',
                color: '#f5c218',
                fontWeight: 800,
                letterSpacing: '0.15em',
                animation: 'fadeInUp 0.5s ease 0.6s both',
                textShadow: '0 0 20px rgba(245,194,24,0.8)',
              }}
            >
              🏆 恭喜大獲全勝！🏆
            </div>

            {/* 繼續下局 button — appears after 5s */}
            {huCelebShowContinue && (
              <button
                onClick={() => {
                  setShowHuCelebration(false);
                  setHuCelebShowContinue(false);
                  playSound('click');
                  initGame();
                }}
                style={{
                  fontSize: 'clamp(1.4rem, 6vw, 2.2rem)',
                  padding: 'clamp(0.9rem, 3vw, 1.4rem) clamp(2rem, 8vw, 4rem)',
                  background: 'linear-gradient(135deg, #f0b329 0%, #f5c218 50%, #f0b329 100%)',
                  color: '#0a1628',
                  fontWeight: 900,
                  borderRadius: '2rem',
                  border: '4px solid #fff8cc',
                  animation: 'fadeInUp 0.6s ease both, continuePulse 1.2s ease-in-out infinite alternate',
                  cursor: 'pointer',
                  letterSpacing: '0.05em',
                }}
              >
                🀄 繼續下局
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
