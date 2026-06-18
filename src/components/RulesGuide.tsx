import React from 'react';
import { HelpCircle, X } from 'lucide-react';

interface RulesGuideProps {
  onClose: () => void;
}

export const RulesGuide: React.FC<RulesGuideProps> = ({ onClose }) => {
  return (
    <div className="fixed inset-0 bg-[#064e3b]/90 z-50 flex items-center justify-center p-4">
      <div className="bg-[#0a2a1f] border-2 border-yellow-500 rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl flex flex-col text-white">
        {/* Header */}
        <div className="p-4 border-b border-white/10 flex items-center justify-between sticky top-0 bg-[#0a2a1f] z-10">
          <div className="flex items-center gap-3">
            <HelpCircle className="w-8 h-8 text-yellow-500" />
            <h2 className="text-2xl font-bold tracking-tight text-yellow-500">🀄 四色牌傳統桌遊遊玩指南</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 hover:bg-white/10 rounded-full text-white/75 hover:text-white transition-colors"
          >
            <X className="w-8 h-8" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-lg leading-relaxed">
          {/* Card colors explanation */}
          <section className="bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-xl font-bold text-yellow-500 mb-2">🎨 牌面色系與角色</h3>
            <p className="text-base text-slate-200">
              一套四色牌共 112 張，分為四群顏色：<strong className="text-yellow-400">黃</strong>、<strong className="text-emerald-400">綠</strong>、<strong className="text-orange-400">紅</strong>、<strong className="text-slate-100">白</strong>。
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2 text-base text-slate-300">
              <li><strong className="text-orange-400">紅</strong> 與 <strong className="text-yellow-400">黃</strong> 牌面：高階將領，文字為 <span className="font-extrabold text-yellow-500">帥、仕、相、俥、馬、炮、兵</span>。</li>
              <li><strong className="text-emerald-400">綠</strong> 與 <strong className="text-slate-100">白</strong> 牌面：基層戰士，文字為 <span className="font-extrabold text-emerald-400">將、士、象、車、馬、包、卒</span>。</li>
            </ul>
          </section>

          {/* Mode 1 */}
          <section className="space-y-2">
            <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              <span className="bg-yellow-500 text-slate-950 px-2 py-0.5 rounded text-sm font-semibold">玩法一</span>
              👦 抓對對子玩法 (Pairs Mode)
            </h3>
            <p className="text-slate-200">
              最適合日常放鬆的極速玩法，規則單純：
            </p>
            <ul className="list-decimal pl-6 space-y-2 text-base text-slate-300">
              <li>開局可選擇起手發 <strong className="text-yellow-400">10張</strong> 或 <strong className="text-yellow-400">15張</strong> 牌。</li>
              <li>系統會為您<strong>自動識別</strong>手牌中現有的「三張相同（暗坎）」與「四張相同（暗開車）」，將其單獨鎖定，並標記出已經配好對的牌。</li>
              <li>剩下的單張牌，就是您需要配對的<strong>「散牌」</strong>。</li>
              <li>起手或摸牌後，當有任意新牌出現：如果您手中含有<strong>相同顏色和文字的單張牌</strong>，點選<strong>【配對對子】</strong>就可以將其結合成對子攤開放在前方！</li>
              <li>最先將手中的<strong>「散牌徹底配對歸零」</strong>者（所有手牌都有對子、三張或四張一組），即宣告<strong>取得大勝</strong>！</li>
            </ul>
          </section>

          {/* Mode 2 */}
          <section className="space-y-2 border-t border-white/15 pt-4">
            <h3 className="text-xl font-bold text-yellow-500 flex items-center gap-2">
              <span className="bg-yellow-500 text-slate-950 px-2 py-0.5 rounded text-sm font-semibold">玩法二</span>
              🀄 傳統吃碰玩法 (Standard Mahjong-Like)
            </h3>
            <p className="text-slate-200">
              正宗傳統四色牌，牌桌決策博弈：
            </p>
            <ul className="list-decimal pl-6 space-y-2 text-base text-slate-300">
              <li>起手發 <strong className="text-yellow-400">20張</strong> 手牌，輪流自摸或打出棄牌。</li>
              <li>支援傳統牌組吃碰配對：
                <ul className="list-disc pl-6 mt-1 space-y-1 text-slate-400">
                  <li><strong className="text-yellow-400">同色將士象 (帥仕相)</strong>：例如 紅帥-紅仕-紅相 三張。</li>
                  <li><strong className="text-yellow-400">同色車馬包 (俥傌炮)</strong>：例如 綠車-綠馬-綠包 三張。</li>
                  <li><strong className="text-yellow-400">碰牌（明刻）</strong>：別人家打出你手中有同色同字一對的牌。</li>
                  <li><strong className="text-yellow-400">開車（明槓/暗槓）</strong>：同色同字四張集齊。</li>
                  <li><strong className="text-yellow-400">同字異色組</strong>：如三張不同顏色的「仕」或四種顏色的「馬」。</li>
                </ul>
              </li>
              <li>
                <strong className="text-red-400">什麼時候可以胡牌？</strong>
                <p className="mt-1">
                  您的手牌全部必須被完整組裝成上述合法牌組或單張將/帥（沒有散牌），且<strong>「總胡數 (Hoo) 點數大於或等於 10 胡」</strong>！點擊<strong>【宣告胡牌】</strong>即可奪冠！
                </p>
              </li>
            </ul>
          </section>

          {/* Hoo scoring legend */}
          <section className="bg-white/5 p-4 rounded-xl border border-white/10">
            <h3 className="text-xl font-bold text-yellow-500 mb-2">📊 胡數 (Hoo) 點數計分對照</h3>
            <div className="grid grid-cols-2 gap-4 text-base text-slate-300">
              <div>
                <p className="font-semibold text-emerald-400 mb-1">🏰 將/帥 (Generals)</p>
                <p>• 單張在手/亮牌：1 胡</p>
                <p>• 一對 (將眼)：2 胡</p>
                <p>• 暗坎 (手牌三張)：3 胡</p>
                <p>• 暗開車 (手牌四張)：8 胡</p>
              </div>
              <div>
                <p className="font-semibold text-emerald-400 mb-1">🎭 其他牌組 (Melds)</p>
                <p>• 同色將士象 / 車馬包：2 胡</p>
                <p>• 明碰 (吃來的三張)：1 胡</p>
                <p>• 暗坎 (手中的三張)：3 胡</p>
                <p>• 明開車 (明槓)：6 胡</p>
                <p>• 暗開車 (暗槓)：8 胡</p>
                <p>• 三異色 / 四異色組：1 胡 / 4 胡</p>
              </div>
            </div>
          </section>

          {/* AI Info */}
          <section className="bg-white/5 p-4 rounded-xl border border-white/10">
            <h4 className="text-lg font-bold text-cyan-400 mb-1">💡 智慧新手透視助手</h4>
            <p className="text-base text-slate-300">
              新手或是長輩想練習？開啟左側的<strong>【透視手牌】</strong>，即可時時觀察電腦 AI 手中的持牌、散牌配置，方便練習與博弈推導！
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 flex justify-end bg-[#0a2a1f]">
          <button
            onClick={onClose}
            className="px-8 py-3 bg-yellow-500 hover:bg-yellow-400 font-black rounded-xl text-slate-950 transition-colors text-lg"
          >
            我懂了，開始遊戲
          </button>
        </div>
      </div>
    </div>
  );
};
