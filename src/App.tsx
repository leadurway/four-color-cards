import React, { useState, useEffect, useRef } from 'react';
import { 
  createDeck, 
  shuffle, 
  groupPairsMode, 
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
  ChevronUp,
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

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

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
      addLog(`啟動【對對子簡單玩法】—— 起手每人分發 ${pairsHandSize} 張牌。`);
      playerHand = shuffled.slice(0, pairsHandSize);
      computerHand = shuffled.slice(pairsHandSize, pairsHandSize * 2);
      remainingDeck = shuffled.slice(pairsHandSize * 2);
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
      hand: playerHand.sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color))),
      revealed: playerRevealed,
      score: 0
    });
    setComputer({
      id: 'computer',
      name: '🤖 智慧電腦 AI',
      hand: computerHand.sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color))),
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
    setCanDiscard(true); // Player starts first with draw privilege
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
      // Check if this newly drawn card matches any of player's strays
      const pGroup = groupPairsMode(player.hand);
      const matchedCard = pGroup.strays.find(c => c.color === drawn.color && c.character === drawn.character);

      if (matchedCard) {
        // Automatically set up 吃對 Match!
        setPendingMoves({
          canHu: false,
          canQuad: false,
          canPong: true, // Used here to represent standard pair match
          canEatSeq: false,
          eatSeqOptions: []
        });
        setGamePhase('waiting_player_action');
        setGuideMessage(`自摸對子！您熟練地摸到 [${drawn.name}]。正好跟手中散牌成對！點點下方的「吃對」按鈕。`);
      } else {
        // No match. Card merges into player's hand, then they must choose one to discard
        const nextHand = [...player.hand, drawn].sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color)));
        setPlayer(prev => ({
          ...prev,
          hand: nextHand
        }));
        setLastDrawnCard(null);
        setCanDiscard(true);
        setGuideMessage(`摸到的 [${drawn.name}] 未能與手牌散牌配對，已自動調入您手牌。請選取一張不需要的牌打出。`);
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
        const nextHand = [...player.hand, drawn].sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color)));
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

          if (inHand.length === 3) {
            const newHand = computer.hand.filter(c => !inHand.map(r => r.id).includes(c.id));
            const newMeld: RevealedMeld = {
              id: `comp-quad-${Date.now()}`,
              type: 'quad',
              cards: [playerDiscard, ...inHand],
              hoo: 6,
              name: `明開車 [${playerDiscard.name}*4]`
            };
            setComputer(prev => ({ ...prev, hand: newHand, revealed: [...prev.revealed, newMeld] }));
            effectiveHand = newHand;
          }
          addLog(`🤖 電腦 AI 吃牌宣告【明開車/槓】，霸氣槓出您的 [${playerDiscard.name}]！`);
          setLastDiscardedCard(null);
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
            hoo: 1,
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
        const updatedHand = [...computer.hand, drawn].sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color)));
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
          const newHand = computer.hand.filter(c => !inHand.map(r => r.id).includes(c.id));
          const newMeld: RevealedMeld = {
            id: `comp-quad-self-${Date.now()}`,
            type: 'quad',
            cards: [drawn, ...inHand],
            hoo: 8, // Concealed Quad getting 8 Hoo
            name: `暗開車 [${drawn.name}*4]`
          };
          setComputer(prev => ({ ...prev, hand: newHand, revealed: [...prev.revealed, newMeld] }));
          addLog(`🤖 電腦 AI 喜獲四張自摸【暗開車/暗槓】，將 [${drawn.name}] 案前暗開。`);
          setLastDrawnCard(null);
          setTimeout(() => { executeComputerDiscard(newHand); }, 900);
          return;
        }
      }

      if (cMoves.canEatSeq) {
        const opt = cMoves.eatSeqOptions[0];
        const idsToRemove = opt.cardsToUse.map(c => c.id);
        const newHand = computer.hand.filter(c => !idsToRemove.includes(c.id));
        const newMeld: RevealedMeld = {
          id: `comp-eat-seq-${Date.now()}`,
          type: 'consec_three',
          cards: opt.resultCards,
          hoo: 2,
          name: opt.meldName
        };

        setComputer(prev => ({ ...prev, hand: newHand, revealed: [...prev.revealed, newMeld] }));
        addLog(`🤖 電腦 AI 自摸吃牌！湊齊了同色棋牌序列 [${opt.meldName}]。`);
        setLastDrawnCard(null);
        setTimeout(() => { executeComputerDiscard(newHand); }, 900);
        return;
      }

      // Default draw and fallback discard
      const appendedHand = [...computer.hand, drawn].sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color)));
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
        setCanDiscard(true);
        setHasDrawn(false);
        setGuideMessage('輪到您的回合！沒有可用配對。請點登左邊「紅疊牌庫」摸新牌。');
      }
    } else {
      // Standard rule checks
      if (playerMoves.canHu || playerMoves.canPong || playerMoves.canQuad || playerMoves.canEatSeq) {
        setPendingMoves(playerMoves);
        setGamePhase('waiting_player_action');
        setGuideMessage(`電腦大意拋出 [${discarded.name}]！您有可用吃碰胡牌機會。請點選下方亮明或吃跑按鈕。`);
      } else {
        setCurPlayerId('player');
        setCanDiscard(true);
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

          const checkGroup = groupPairsMode(nextHand);
          if (checkGroup.strays.length === 0) {
            handleWin('player', 'pairs', '恭喜！您成功配對了手中所有單張散牌，解鎖大勝！');
            return;
          }

          // Active turn continues but is own turn - player must discard
          setCanDiscard(true);
          setCurPlayerId('player');
          setHasDrawn(true);
          setGuideMessage('配對成功！請在手牌選取一張多餘拋牌，並點擊下方「打牌」按鈕，傳遞回合。');
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
      const nextHand = player.hand.filter(c => !toRemove.map(r => r.id).includes(c.id));
      
      const newMeld: RevealedMeld = {
        id: `player-quad-${Date.now()}`,
        type: 'quad',
        cards: [trigger, ...toRemove],
        hoo: 6, // Quad gets 6 Hoo
        name: `明開車 [${trigger.name}*4]`
      };

      setPlayer(prev => ({
        ...prev,
        hand: nextHand,
        revealed: [...prev.revealed, newMeld]
      }));

      addLog(`【開車】您高喊「開車(槓)」！明開車 [${trigger.name}]。`);
      setLastDrawnCard(null);
      setLastDiscardedCard(null);
      setPendingMoves(null);
      setGamePhase('playing');
      setCanDiscard(true);
      setCurPlayerId('player');
      setHasDrawn(true);
      setGuideMessage('開車順利！多抽補牌。請從手中選出一拋牌打出。');
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
      const appendedHand = [...player.hand, lastDrawnCard].sort((a,b) => (a.color === b.color ? a.order - b.order : a.color.localeCompare(b.color)));
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
  const activeHuCheck = solveHu(player.hand, player.revealed);
  const playerGrouping = groupPairsMode(player.hand);

  return (
    <div className="h-[100dvh] w-screen bg-[#022c1e] text-slate-100 flex items-center justify-center relative overflow-hidden font-sans select-none">
      
      {/* BACKGROUND GRADIENT */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_#044e39_0%,_#021d14_100%)] opacity-80 z-0 pointer-events-none" />

      {/* FULLSCREEN GAME BOARD CONSOLE */}
      <div className="w-full h-full max-w-7xl bg-[#064e3b]/95 shadow-2xl flex flex-col overflow-hidden relative border-x border-emerald-950/40 z-20 animate-fade-in">
        
        {/* iPhone Top Status Bar/Notch Area Information Indicator */}
        <div className="md:hidden w-full bg-[#032e22]/90 text-slate-300 flex items-center justify-between px-6 font-mono text-[10px] sm:text-xs tracking-wide shrink-0 relative border-b border-white/5 pt-[env(safe-area-inset-top,12px)] pb-2.5 z-40 select-none">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-yellow-500 font-sans">09:41 🀄</span>
            <span className="text-[10px] hidden sm:inline text-slate-400">| 四色牌智慧護腦</span>
          </div>
          {/* Virtual Notch Dynamic Island Simulation on standard screen view */}
          <div className="hidden sm:block absolute left-1/2 -translate-x-1/2 top-1.5 w-28 h-5.5 bg-black rounded-b-2xl border-x border-b border-white/10" />
          <div className="flex items-center gap-1.5 text-[10px] font-bold">
            <span className="text-emerald-400 font-extrabold font-sans animate-pulse">5G 📶</span>
            <span className="text-emerald-400 font-sans">🔋 100%</span>
          </div>
        </div>

        {/* ========================================== */}
        {/* INTERACTIVE MULTI-PAGE VIEW SYSTEM         */}
        {/* ========================================== */}
        <div className="flex-1 flex flex-col min-h-0 w-full relative bg-[radial-gradient(circle_at_center,_#0b5c40_0%,_#053c29_100%)] select-none">
          
          {/* 1. Lobby/Setup Page (遊戲開始設定頁面) */}
          {activePage === 'lobby' && (
            <div className="flex-1 px-5 py-4 lg:px-16 xl:px-32 flex flex-col justify-between h-full select-none text-white overflow-hidden min-h-0">
              
              {/* Grand compact title */}
              <div className="text-center space-y-1 py-1 shrink-0">
                <div className="flex items-center justify-center gap-2">
                  <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse shrink-0" />
                  <h1 className="text-xl md:text-2xl lg:text-3xl font-serif font-black tracking-widest text-yellow-500 italic select-none">
                    四色牌傳統遊藝廳
                  </h1>
                  <Sparkles className="w-5 h-5 text-yellow-500 animate-pulse shrink-0" />
                </div>
                <p className="text-[10px] md:text-xs tracking-widest text-emerald-300 font-extrabold uppercase font-mono">
                  — 專為銀髮長輩特製 · 護腦防失智 —
                </p>
              </div>

              {/* Steps in a beautiful compact grid to avoid scrolling */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 my-2 select-none min-h-0 flex-1 overflow-y-auto md:overflow-visible items-stretch">
                
                {/* Step 1: Avatar Selector and username setup */}
                <div className="bg-black/35 p-4 rounded-2xl border border-white/10 flex flex-col justify-center space-y-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xs bg-yellow-500 text-slate-950 font-black px-2 py-0.5 rounded shrink-0">1. 入席編制</span>
                    <p className="text-xs md:text-sm font-extrabold text-yellow-400">入席玩家暱稱與頭像：</p>
                  </div>
                  
                  {/* Picker list */}
                  <div className="flex justify-between items-center gap-1.5 select-none my-1">
                    {avatars.map((av, idx) => (
                      <button
                        key={idx}
                        onClick={() => { playSound('click'); setUserAvatar(av); }}
                        className={`text-xl md:text-2xl h-9 w-9 flex items-center justify-center rounded-xl transition-all ${
                          playerAvatar === av 
                            ? 'bg-yellow-500 scale-110 border-2 border-white text-3xl shadow-lg ring-3 ring-yellow-500/40' 
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
                    className="w-full py-2 px-4 bg-[#0a2a1f] border border-emerald-600 rounded-xl text-sm md:text-base text-center font-bold text-white placeholder-slate-400 focus:outline-none focus:border-yellow-500"
                    placeholder="輸入長輩的手遊暱稱"
                  />
                </div>

                {/* Step 2: Game Mode Picker */}
                <div className="bg-black/35 p-4 rounded-2xl border border-white/10 flex flex-col justify-center space-y-3">
                  <div className="flex items-center gap-2 px-1">
                    <span className="text-xs bg-yellow-500 text-slate-950 font-black px-2 py-0.5 rounded shrink-0">2. 自選玩法</span>
                    <p className="text-xs md:text-sm font-extrabold text-yellow-400">挑選您喜愛的對戰玩法：</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-2">
                    {/* Mode 1: Pairs */}
                    <div
                      onClick={() => { playSound('click'); setMode('pairs'); }}
                      className={`text-left p-3 rounded-xl border transition-all block relative cursor-pointer select-none ${
                        mode === 'pairs'
                          ? 'bg-emerald-900/40 border-yellow-500 shadow ring-2 ring-yellow-500/20'
                          : 'bg-black/25 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs md:text-sm font-black text-white flex items-center gap-1">
                          👦 抓對對子簡單對戰
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-300 leading-tight font-medium">
                        簡易配對，長輩首選！系統會自動為您挑出暗坎同色組，只需輕敲出子配對！
                      </p>

                      {/* Mode pairs hand size controls */}
                      {mode === 'pairs' && (
                        <div className="mt-2 flex items-center justify-between gap-1 bg-black/60 p-1 rounded-lg border border-white/5" onClick={(e)=>e.stopPropagation()}>
                          <button
                            onClick={() => { playSound('click'); setPairsHandSize(10); }}
                            className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-colors ${
                              pairsHandSize === 10 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-slate-200'
                            }`}
                          >
                            10張牌極速
                          </button>
                          <button
                            onClick={() => { playSound('click'); setPairsHandSize(15); }}
                            className={`flex-1 py-1 text-[9px] font-bold rounded-md transition-colors ${
                              pairsHandSize === 15 ? 'bg-yellow-500 text-black' : 'bg-white/10 text-slate-200'
                            }`}
                          >
                            15張牌經典
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Mode 2: Standard */}
                    <div
                      onClick={() => { playSound('click'); setMode('standard'); }}
                      className={`text-left p-3 rounded-xl border transition-all block relative cursor-pointer select-none ${
                        mode === 'standard'
                          ? 'bg-emerald-900/40 border-yellow-500 shadow ring-2 ring-yellow-500/20'
                          : 'bg-black/25 border-white/10 hover:border-white/20'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-xs md:text-sm font-black text-white flex items-center gap-1">
                          🀄 傳統吃碰客家玩法
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-350 leading-tight font-medium">
                        正宗客家經典二十張！包含將士象、車馬包同色吃、碰、槓。達成 10 胡之牌點數自摸。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Launcher & Extras Combined Dock */}
              <div className="bg-black/20 p-3 rounded-2xl border border-white/5 space-y-2 shrink-0">
                <div className="flex justify-between items-center gap-4 text-[11px] font-bold text-slate-300">
                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
                    <span>語音配音：{soundEnabled ? '已開啟' : '靜音'}</span>
                  </button>

                  <button
                    onClick={() => setShowComputerHand(!showComputerHand)}
                    className="flex items-center gap-1.5 hover:text-white"
                  >
                    {showComputerHand ? <Eye className="w-4 h-4 text-emerald-400" /> : <EyeOff className="w-4 h-4 text-slate-400" />}
                    <span>防走失作弊透視：{showComputerHand ? '開' : '關'}</span>
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => { playSound('click'); initGame(); }}
                    className="flex-1 py-3 bg-gradient-to-r from-red-600 via-amber-500 to-yellow-500 hover:brightness-110 active:scale-98 transition-all font-black text-slate-950 text-base md:text-lg rounded-xl shadow-xl flex items-center justify-center gap-2 select-none"
                  >
                    開始洗牌、發牌入席 🀄
                  </button>

                  <button
                    onClick={handleOpenRules}
                    className="py-3 px-4 bg-white/10 hover:bg-white/15 text-slate-300 hover:text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-yellow-500" />
                    <span>對戰說明</span>
                  </button>
                </div>
              </div>

            </div>
          )}

          {/* 2. Game Play Page (遊戲頁面) */}
          {activePage === 'game' && (
            <div className="flex-1 flex flex-col h-full w-full select-none text-white overflow-hidden relative">
              
              {/* Compact header */}
              <header className="h-[52px] bg-black/40 border-b border-white/10 px-3 flex items-center justify-between shrink-0 select-none z-10">
                <button
                  onClick={handleQuitToLobby}
                  className="py-1 px-3 bg-red-950/60 hover:bg-red-900/80 border border-red-800 text-xs font-extrabold text-red-200 rounded-xl transition-all"
                >
                  🚪 返回大廳
                </button>

                {/* Speaker icon */}
                <button
                  onClick={() => { playSound('click'); setSoundEnabled(!soundEnabled); }}
                  className="p-1.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-full transition-colors"
                >
                  {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-red-400" />}
                </button>

                <button
                  onClick={handleOpenRules}
                  className="py-1 px-3 bg-yellow-500 text-slate-950 text-xs font-black rounded-xl transition-all flex items-center gap-0.5 shadow hover:bg-yellow-400"
                >
                  <HelpCircle className="w-3.5 h-3.5 shrink-0" />
                  遊戲說明
                </button>
              </header>

              {/* GAME SPACE FLOW */}
              <div className="flex-1 min-h-0 flex overflow-hidden">
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

                {/* ① 遊戲頁面 — Game Display Panel */}
                <div className="shrink-0 flex flex-col px-3 pt-2 pb-1.5 space-y-1.5 border-b-2 border-white/10">

                {/* AI / OPPONENT STATUS (Top) */}
                <div className="bg-black/35 p-2 rounded-2xl border border-white/5 space-y-1 text-xs relative select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-cyan-400 font-black">
                      <Cpu className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
                      <span>{computer.name}</span>
                    </div>
                    
                    <div className="flex items-center gap-1 text-[10px] text-slate-300 bg-white/5 border border-white/10 px-2 py-0.5 rounded-full font-bold">
                      <span>賸餘牌:</span>
                      <strong className="text-yellow-400">{computer.hand.length}</strong>
                      <span>張</span>
                    </div>
                  </div>

                  {/* Robot's revealed sets on screen */}
                  {computer.revealed.length > 0 && (
                    <div className="flex items-center gap-1 p-1 bg-black/40 rounded-xl border border-white/5 mt-0.5 overflow-x-auto whitespace-nowrap scrollbar-none">
                      <span className="text-[9px] text-slate-400 font-bold shrink-0">案前亮相：</span>
                      <div className="flex gap-1">
                        {computer.revealed.map((meld) => (
                          <div key={meld.id} className="bg-white/5 px-1 py-0.5 rounded border border-white/10 text-[9px] flex items-center gap-0.5">
                            <span className="text-yellow-500 font-bold leading-none">{meld.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Fan of AI cards */}
                  <div className="flex flex-wrap justify-center items-center gap-0.5 pt-1.5 border-t border-white/5 max-h-[66px] md:max-h-[110px] lg:max-h-none overflow-hidden">
                    {showComputerHand ? (
                      computer.hand.map((card) => (
                        <div key={card.id} className="opacity-75 filter scale-75">
                          <FourColorCard card={card} size="sm" isRevealed={true} disabled={true} />
                        </div>
                      ))
                    ) : (
                      computer.hand.map((card, idx) => (
                        <div key={card.id} className="-ml-1.5 first:ml-0 scale-75">
                          <FourColorCard card={card} size="sm" isRevealed={false} disabled={true} />
                        </div>
                      ))
                    )}
                  </div>
                </div>

                {/* THE PORTRAIT RIVER / TABLE (Middle) */}
                <div className="p-2 bg-black/20 rounded-2xl border border-white/5 grid grid-cols-12 gap-1.5 items-center select-none">
                  
                  {/* Left: Deck stack (摸牌) */}
                  <div className="col-span-4 flex flex-col items-center justify-center border-r border-white/10 py-1 pr-1">
                    <span className="text-[10px] font-bold text-yellow-500/80 mb-1.5">🎴 牌庫摸牌</span>
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
                          <span className="text-[8px] font-extrabold block text-white/50 leading-none">剩餘</span>
                          <span className="text-base font-mono font-black text-white leading-none mt-1">{deck.length}</span>
                        </div>
                      </button>
                    ) : (
                      <div className="w-14 h-21 border border-dashed border-white/20 bg-white/5 rounded-xl flex items-center justify-center text-center text-[10px] text-slate-500 leading-tight">
                        牌庫空
                      </div>
                    )}
                    <span className="text-[9px] text-slate-300 font-extrabold tracking-tighter mt-1 text-center scale-90">
                      {gamePhase === 'playing' && curPlayerId === 'player' && lastDrawnCard === null && !hasDrawn
                        ? '👆 輪您！點熟摸'
                        : '等您下子'}
                    </span>
                  </div>

                  {/* Center: Current Focus Table card */}
                  <div className="col-span-5 flex flex-col items-center justify-center px-1">
                    <span className="text-[10px] font-bold text-yellow-500/80 mb-1">🔥 桌上焦點牌</span>
                    <div className="h-[95px] flex items-center justify-center relative">
                      {lastDrawnCard ? (
                        <div className="flex flex-col items-center gap-0.5 animate-bounce">
                          <span className="text-[8px] bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 py-0.5 px-1.5 rounded leading-none font-bold">
                            {drawnFromDeck ? '自摸摸出 ➔' : '電腦打出 ➔'}
                          </span>
                          <div className="scale-75">
                            <FourColorCard card={lastDrawnCard} size="sm" isRevealed={true} disabled={true} />
                          </div>
                        </div>
                      ) : lastDiscardedCard ? (
                        <div className="flex flex-col items-center gap-0.5 animate-pulse">
                          <span className="text-[8px] bg-red-950/60 text-red-300 border border-red-900/50 py-0.5 px-1.5 rounded leading-none font-bold">
                            {curPlayerId === 'computer' ? '您打出 ➔' : '電腦棄牌 ➔'}
                          </span>
                          <div className="scale-75">
                            <FourColorCard card={lastDiscardedCard} size="sm" isRevealed={true} disabled={true} />
                          </div>
                        </div>
                      ) : (
                        <div className="w-14 h-21 border border-white/10 bg-white/5 rounded-xl flex flex-col items-center justify-center text-center text-slate-500 p-1 select-none whitespace-normal scale-95">
                          <span className="text-[9px] scale-90 leading-tight">摸牌或棄牌顯示處</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Right: recycler grid (牌河) */}
                  <div className="col-span-3 flex flex-col items-center justify-center border-l border-white/10 py-1 pl-1 max-h-[110px] overflow-hidden">
                    <span className="text-[9px] font-bold text-yellow-500/80 mb-1 text-center scale-95 leading-none">🗑️ 牌河回收</span>
                    <div className="w-full flex-1 min-h-[75px] max-h-[85px] overflow-y-auto bg-black/40 border border-white/5 p-1 rounded-xl flex flex-wrap gap-0.5 justify-center scrollbar-none">
                      {discardPile.map((c, idx) => (
                        <div key={`${c.id}-${idx}`} className="w-[14px] h-[34px] rounded flex items-center justify-center font-bold text-[8px] opacity-75" style={{
                          backgroundColor: c.color === 'yellow' ? '#fef3c7' : c.color === 'green' ? '#047857' : c.color === 'red' ? '#ea580c' : '#f8fafc',
                          color: c.color === 'yellow' ? '#b91c1c' : '#09090b',
                          border: '1px solid #111111'
                        }}>
                          {c.character}
                        </div>
                      ))}
                      {discardPile.length === 0 && (
                        <span className="text-[9px] text-slate-500 my-auto text-center font-medium leading-none">空無一物</span>
                      )}
                    </div>
                  </div>
                </div>

                </div>{/* end 遊戲頁面 */}

                {/* ② 控制頁面 — Control Panel */}
                <div className="flex-1 flex flex-col overflow-y-auto min-h-0 px-3 pt-1.5 pb-2 space-y-1.5">

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
                          className="w-14 h-14 rounded-full bg-red-600 hover:bg-red-500 border-2 border-white shadow flex items-center justify-center text-lg font-black text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                          胡
                        </button>
                      )}

                      {/* Pairs Match or standard Pong */}
                      {pendingMoves.canPong && (
                        <button
                          onClick={() => handlePlayerAction('pong')}
                          className="w-13 h-13 rounded-full bg-orange-500 hover:bg-orange-400 border-2 border-white/40 shadow flex items-center justify-center text-sm font-black text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                          {mode === 'pairs' ? '吃對' : '碰'}
                        </button>
                      )}

                      {/* Quads action */}
                      {pendingMoves.canQuad && (
                        <button
                          onClick={() => handlePlayerAction('quad')}
                          className="w-13 h-13 rounded-full bg-yellow-600 hover:bg-yellow-500 border-2 border-white/40 shadow flex items-center justify-center text-sm font-black text-white hover:scale-105 active:scale-95 transition-transform"
                        >
                          槓
                        </button>
                      )}

                      {/* Eat sequences (with lists support) */}
                      {pendingMoves.canEatSeq && pendingMoves.eatSeqOptions.map((opt, i) => (
                        <button
                          key={i}
                          onClick={() => handlePlayerAction('eat', opt)}
                          className="px-3.5 py-2 rounded-xl bg-yellow-600 border border-yellow-550 text-[10px] font-black text-white active:scale-95 transition-transform"
                        >
                          吃:{opt.resultCards.map(c=>c.character).join('')}
                        </button>
                      ))}

                      {/* Drop choices */}
                      <button
                        onClick={handlePlayerSkip}
                        className="px-3.5 py-2 bg-slate-850 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 rounded-xl active:scale-95"
                      >
                        過 (放棄)
                      </button>
                    </div>
                  </div>
                )}

                {/* ELDER ACTION CONTROLLER AID (Bottom) */}
                <div className="bg-black/35 p-3 rounded-2xl border border-white/10 space-y-2 select-none relative shrink-0">
                  <div className="flex flex-col gap-1.5">
                    
                    {/* User profile banner */}
                    <div className="flex justify-between items-center bg-[#073a2a] py-1 px-2.5 rounded-xl border border-emerald-600/30">
                      <div className="flex items-center gap-1.5">
                        <span className="text-base leading-none">{playerAvatar}</span>
                        <span className="text-xs font-black text-yellow-300">{playerName}</span>
                      </div>

                      {/* Score metrics */}
                      {mode === 'pairs' ? (
                        <div className="text-[10px] font-bold text-red-300 leading-none">
                          散牌目標：<strong className="text-xs text-red-400 font-extrabold">{playerGrouping.strays.length}</strong> 張
                        </div>
                      ) : (
                        <div className="text-[10px] font-bold leading-none">
                          當前積分：{activeHuCheck.canHu ? (
                            <span className="text-emerald-400 font-black">✔ 滿足胡牌條件！</span>
                          ) : (
                            <span>{activeHuCheck.totalHoo} 胡 / 10胡過關</span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Pairs groupings display if in Pairs mode */}
                    {mode === 'pairs' && (
                      <div className="grid grid-cols-4 gap-1 select-none text-[8px] font-mono border-b border-white/5 pb-1 mt-0.5">
                        <div className="bg-emerald-950/40 p-1 rounded text-center">
                          <span className="text-emerald-400 block font-bold leading-none">暗開車✕{playerGrouping.quads.length}</span>
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
                  </div>

                  {/* PLAYER HAND CONTAINER */}
                  <div className="space-y-1 text-left mt-1 select-none">
                    <span className="text-[11px] font-black text-yellow-400/90 block">
                      👇 您的手牌區 (輕敲卡牌可選定，再點擊右下角黃色【打牌】)：
                    </span>

                    <div className="flex flex-wrap justify-center items-center gap-x-1 gap-y-3 p-3.5 bg-black/45 rounded-xl border border-white/10 min-h-[110px] h-auto">
                      {player.hand.map((card) => {
                        const isSelected = card.id === selectedCardId;
                        const isStray = mode === 'pairs' && playerGrouping.strays.some(s => s.id === card.id);
                        return (
                          <div key={card.id} className="relative flex flex-col items-center">
                            <FourColorCard
                              card={card}
                              size="sm"
                              isRevealed={true}
                              isSelected={isSelected}
                              onClick={() => { playSound('click'); setSelectedCardId(isSelected ? null : card.id); }}
                            />
                            {mode === 'pairs' && isStray && (
                              <span className="absolute bottom-[-9px] text-[8px] scale-90 bg-red-950 text-red-500 font-extrabold border border-red-900/60 px-1 rounded leading-none pointer-events-none">
                                散牌
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* BOTTOM PRIVILEGE PANEL */}
                  <div className="bg-black/30 p-2 rounded-xl flex items-center justify-between gap-2 border border-white/5 mt-1 text-xs select-none">
                    <div className="text-[11px] text-slate-300 font-bold max-w-[50%] truncate text-left select-none">
                      {selectedCardId ? (
                        <p className="leading-tight">
                          選中：<strong className="text-yellow-400 text-sm">[{player.hand.find(c => c.id === selectedCardId)?.name}]</strong>
                        </p>
                      ) : (
                        <p className="text-slate-400 text-[10px] leading-tight font-semibold">👉 請輕點上面一張牌</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      {/* Standard declare win button */}
                      {mode === 'standard' && (
                        <button
                          onClick={handleDeclareHuSelf}
                          disabled={gamePhase !== 'playing'}
                          className="px-2.5 py-2 bg-gradient-to-r from-red-600 to-yellow-600 hover:from-red-505 hover:to-yellow-550 text-[11px] text-white font-extrabold rounded-xl shadow border border-yellow-400 disabled:opacity-50"
                        >
                          👑 宣告胡牌
                        </button>
                      )}

                      <button
                        onClick={() => handlePlayerDiscard(selectedCardId!)}
                        disabled={!selectedCardId || !canDiscard || gamePhase !== 'playing' || curPlayerId !== 'player'}
                        className={`px-5 py-2 font-black rounded-xl text-xs transition-all flex items-center gap-1 ${
                          selectedCardId && canDiscard && gamePhase === 'playing' && curPlayerId === 'player'
                            ? 'bg-yellow-500 hover:bg-yellow-400 text-black border border-yellow-300 animate-pulse'
                            : 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
                        }`}
                      >
                        🔨 打牌出這張
                      </button>
                    </div>
                  </div>
                </div>

                {/* HELPER BOX */}
                <div className="lg:hidden bg-yellow-500/10 border-l-2 border-yellow-500 p-2.5 rounded-r-xl flex items-start gap-1.5 mt-1 shrink-0 select-none">
                  <Info className="w-3.5 h-3.5 text-yellow-400 shrink-0 mt-0.5" />
                  <p className="text-slate-100 text-[10px] text-left leading-tight font-bold select-none">
                    {guideMessage}
                  </p>
                </div>

                {/* LOGS MARQUEE TICKER (2 line ticker) */}
                <div
                  onClick={() => setShowLogDrawer(!showLogDrawer)}
                  className="lg:hidden bg-[#05291d] border border-emerald-800/30 rounded-xl p-2.5 flex items-center justify-between cursor-pointer text-[11px] font-mono text-yellow-101/90 hover:bg-[#073325] transition-all select-none pr-3 mt-1.5 shrink-0"
                >
                  <div className="flex-1 space-y-0.5 max-h-[30px] overflow-hidden text-left pr-2">
                    {logs.length > 0 ? (
                      logs.slice(-2).map((lg, i) => (
                        <p key={i} className="truncate select-none leading-none opacity-80 first:opacity-100 flex items-center gap-0.5 font-sans font-semibold text-slate-200">
                          <span className="text-yellow-500 font-extrabold font-mono">▸</span> {lg}
                        </p>
                      ))
                    ) : (
                      <p className="text-slate-400 select-none">無歷史記事。</p>
                    )}
                  </div>
                  <div className="flex flex-col items-center shrink-0">
                    <ChevronUp className={`w-3.5 h-3.5 text-yellow-500 transition-transform ${showLogDrawer ? 'rotate-180':''}`} />
                    <span className="text-[8px] text-slate-400 font-extrabold tracking-tighter">展開日誌</span>
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
                <div className="flex-1 flex flex-col min-h-0 bg-[#05291d] border border-emerald-800/30 rounded-xl overflow-hidden">
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
                <div className="lg:hidden absolute inset-x-0 bottom-0 top-[52px] bg-[#022c1e]/98 border-t border-emerald-500/30 z-30 p-4 flex flex-col justify-between select-none">
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
              <header className="h-[52px] bg-black/40 border-b border-white/10 px-3 flex items-center justify-between shrink-0 select-none z-10">
                <button
                  onClick={handleBackFromRules}
                  className="py-1 px-3 bg-white/10 hover:bg-white/15 border border-white/10 text-xs font-extrabold text-slate-200 rounded-xl transition-all flex items-center gap-0.5"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  返回
                </button>
                <span className="text-sm font-black text-yellow-500 tracking-wider">🀄 傳統四色牌指引</span>
                <div className="w-16 h-3" />
              </header>

              {/* Sub tabs */}
              <div className="bg-black/20 p-2 flex border-b border-white/5 justify-between gap-1 shrink-0 text-[11px] font-semibold select-none">
                <button
                  onClick={() => handleSwitchTab('ranks')}
                  className={`flex-1 py-1 px-0.5 rounded text-center transition-colors ${activeTutorialTab === 'ranks' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  🎨 牌色圖鑑
                </button>
                <button
                  onClick={() => handleSwitchTab('pairs')}
                  className={`flex-1 py-1 px-0.5 rounded text-center transition-colors ${activeTutorialTab === 'pairs' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  👦 簡單對子
                </button>
                <button
                  onClick={() => handleSwitchTab('standard')}
                  className={`flex-1 py-1 px-0.5 rounded text-center transition-colors ${activeTutorialTab === 'standard' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  🀄 傳統吃碰
                </button>
                <button
                  onClick={() => handleSwitchTab('point')}
                  className={`flex-1 py-1 px-0.5 rounded text-center transition-colors ${activeTutorialTab === 'point' ? 'bg-yellow-500 text-black font-extrabold' : 'hover:bg-white/5 text-slate-300 font-medium'}`}
                >
                  📊 胡數計分
                </button>
              </div>

              {/* Tab contents */}
              <div className="flex-1 p-4 overflow-y-auto min-h-0 text-slate-200 text-left text-sm space-y-4 font-sans leading-relaxed scrollbar-thin">

                {activeTutorialTab === 'ranks' && (
                  <div className="space-y-4">
                    <div className="bg-white/5 p-3 rounded-2xl border border-white/10 text-center select-none">
                      <p className="font-extrabold text-yellow-500 text-base mb-1">整套四色牌共有 112 張</p>
                      <p className="text-xs text-slate-400 font-semibold">區分為：紅、黃、綠、白 等四種色系：</p>
                    </div>

                    <div className="space-y-3 select-none">
                      <div className="p-3 bg-red-950/20 border border-red-900/40 rounded-xl">
                        <p className="font-extrabold text-orange-400 text-sm mb-1">🔴 紅色 與 🟡 黃色 (高階牌面)</p>
                        <p className="text-xs text-slate-300 font-medium">
                          文字代表角色依次序為：<strong>帥、仕、相、俥、傌、炮、兵</strong>。
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="bg-amber-100/10 border border-amber-500 px-1.5 py-0.5 rounded text-[10px] text-yellow-400 font-black">黃帥</span>
                          <span className="bg-red-800/15 border border-red-650 px-1.5 py-0.5 rounded text-[10px] text-orange-400 font-black">紅帥</span>
                        </div>
                      </div>

                      <div className="p-3 bg-emerald-950/20 border border-emerald-900/40 rounded-xl">
                        <p className="font-extrabold text-emerald-400 text-sm mb-1">🟢 綠色 與 ⚪ 白色 (基層角色)</p>
                        <p className="text-xs text-slate-300 font-medium">
                          文字代表角色依次序為：<strong>將、士、象、車、馬、包、卒</strong>。
                        </p>
                        <div className="flex gap-1.5 mt-2">
                          <span className="bg-emerald-900/20 border border-emerald-500 px-1.5 py-0.5 rounded text-[10px] text-emerald-400 font-black">綠將</span>
                          <span className="bg-slate-800/20 border border-slate-500 px-1.5 py-0.5 rounded text-[10px] text-slate-200 font-black font-serif">白將</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-yellow-500/5 p-3 rounded-xl border border-yellow-500/20 text-xs select-none">
                      <h4 className="font-extrabold text-yellow-500 mb-1">💡 傳統常識貼心提醒：</h4>
                      <p className="text-slate-300 leading-relaxed font-semibold">
                        兩類字體雖有些微繁簡異體區分，但在配牌成組時，邏輯字體是一一對應、完全同等作用的（如紅帥與綠將在組同牌組時皆代表頂級將軍）。
                      </p>
                    </div>
                  </div>
                )}

                {activeTutorialTab === 'pairs' && (
                  <div className="space-y-3 text-xs select-none">
                    <h3 className="text-sm font-black text-yellow-500 border-b border-white/10 pb-1">👦 玩法一：抓對對子簡單玩法</h3>
                    <p className="text-slate-350 font-semibold leading-relaxed">
                      專門為了長輩日常益智、防走失設計的單純玩法，省卻了複雜牌組計算：
                    </p>
                    <ul className="list-decimal pl-5 space-y-2 text-slate-300 font-bold leading-normal">
                      <li><strong>分發起手牌：</strong> 開局每人分配 10 張或 15 張骨牌。</li>
                      <li><strong>自動防呆判定：</strong> 系統會偵測手牌中的「暗坎（同色同字三張）」與「暗開車（四張）」並直接放在桌上。</li>
                      <li><strong>配對消消樂：</strong> 當電腦打牌或自己摸到跟手上單張完全相同的牌時，點擊【吃對】，即可將牌配對推置桌前。</li>
                      <li><strong>完賽宣告：</strong> 誰最先將手上的單卡「全部配對攤乾淨」，誰便拔得頭籌，宣告大勝！</li>
                    </ul>
                  </div>
                )}

                {activeTutorialTab === 'standard' && (
                  <div className="space-y-3 text-xs select-none">
                    <h3 className="text-sm font-black text-yellow-500 border-b border-white/10 pb-1">🀄 玩法二：傳統吃碰標準玩法</h3>
                    <p className="text-slate-350 font-semibold leading-relaxed">
                      老祖宗正宗四色牌！重在組牌戰術、思索吃碰抉擇：
                    </p>
                    <ul className="list-decimal pl-5 space-y-2 text-slate-300 font-bold leading-normal">
                      <li><strong>發牌張數：</strong> 每人分配 20 張手牌起點。</li>
                      <li><strong>合法牌組組合 (Meld)：</strong>
                        <ul className="list-disc pl-4 mt-1 space-y-1 text-slate-300 font-medium">
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
                  <div className="space-y-3.5 text-xs select-none">
                    <h3 className="text-sm font-black text-yellow-500 border-b border-white/10 pb-1">📊 牌組胡數對抗速查：</h3>
                    
                    <div className="bg-black/35 p-2.5 rounded-xl border border-white/10 space-y-2">
                      <p className="font-extrabold text-emerald-400 leading-none">🎖️ 帥／將 單獨算分：</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                        <li>單張在手或亮相：1 胡</li>
                        <li>對子（將眼）：2 胡</li>
                        <li>暗坎 (三張相同在手)：3 胡</li>
                        <li>四張全集（開車）：8 胡</li>
                      </ul>
                    </div>

                    <div className="bg-black/35 p-2.5 rounded-xl border border-white/10 space-y-2">
                      <p className="font-extrabold text-emerald-400 leading-none">🎎 一般同色牌組算分：</p>
                      <ul className="list-disc pl-4 space-y-1 text-slate-300 font-medium">
                        <li>同色帥仕相 (將士象)：2 胡</li>
                        <li>同色俥傌炮 (車馬包)：2 胡</li>
                        <li>明碰 (碰出去的三張)：1 胡</li>
                        <li>暗坎 (手牌三張)：3 胡</li>
                        <li>明開車/明槓：6 胡</li>
                        <li>暗開車/暗槓：8 胡</li>
                        <li>三異色 / 四異色組：1 胡 / 4 胡</li>
                      </ul>
                    </div>
                  </div>
                )}

              </div>

              {/* Back trigger button */}
              <div className="p-3 border-t border-white/10 bg-[#064e3b] shrink-0">
                <button
                  onClick={handleBackFromRules}
                  className="w-full py-3.5 bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black rounded-2xl text-base"
                >
                  細讀完畢，返回上一頁
                </button>
              </div>
            </div>
          )}

        </div>

        {/* iPhone Bottom Home Indicator Safe Zone Area (上滑回主頁保護區) */}
        <div className="md:hidden w-full bg-[#032e22]/95 py-2.5 flex flex-col items-center justify-center shrink-0 border-t border-white/5 z-40 select-none pb-[env(safe-area-inset-bottom,12px)]">
          <div className="w-[124px] h-[5px] bg-slate-400/70 rounded-full mb-1" />
          <span className="text-[9px] font-bold tracking-widest text-[#5ba283] opacity-80 select-none uppercase">上滑返回主畫面</span>
        </div>

      </div>

      {/* GAME OVER IMMERSIVE MODAL OVERLAY */}
      {gamePhase === 'game_over' && (
        <div className="fixed inset-0 bg-[#021c13]/90 z-[99] flex items-center justify-center p-4 select-none">
          <div className="bg-[#052d21] border-4 border-yellow-500 shadow-2xl rounded-[32px] p-6 max-w-sm w-full text-center relative border-double animate-pulse text-white select-none">
            
            <div className="absolute top-[-35px] left-1/2 transform -translate-x-1/2 bg-yellow-500 rounded-full p-2.5 border-4 border-[#052d21]">
              <Sparkles className="w-8 h-8 text-slate-900" />
            </div>

            <h2 className="text-3xl font-serif font-black text-yellow-500 mt-5 mb-2 leading-tight">
              {winnerId === 'player' ? '🏆 恭喜您大獲全勝！' : winnerId === 'computer' ? '🤖 電腦拔得頭籌' : '🤝 雙方和局流局'}
            </h2>
            
            <p className="text-emerald-400 font-extrabold text-sm mb-3">
              {mode === 'pairs' ? '👦 抓對對子簡單對局' : '🀄 傳統吃碰標準對戰'}
            </p>

            <div className="bg-black/45 p-4 rounded-2xl border border-emerald-800 text-slate-100 text-sm font-serif font-medium leading-relaxed mb-5 max-h-[140px] overflow-y-auto">
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

    </div>
  );
}
