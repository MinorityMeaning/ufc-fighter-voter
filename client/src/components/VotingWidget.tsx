import React, { useState, useEffect } from 'react';

interface VotingWidgetProps {
  fight: any;
  onVote: (fighter: 1 | 2) => void;
}

export const VotingWidget: React.FC<VotingWidgetProps> = ({ fight, onVote }) => {
  // Используем правильные поля из voteStats
  const fighter1Votes = fight.fighter1_votes || fight.fighter1 || 0;
  const fighter2Votes = fight.fighter2_votes || fight.fighter2 || 0;
  const totalVotes = fighter1Votes + fighter2Votes;
  const percent1 = totalVotes ? Math.round((fighter1Votes / totalVotes) * 100) : 0;
  const percent2 = totalVotes ? Math.round((fighter2Votes / totalVotes) * 100) : 0;

  const [selectedFighter, setSelectedFighter] = useState<1 | 2 | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  useEffect(() => {
    // Проверяем localStorage, чтобы не дать проголосовать повторно
    const voted = localStorage.getItem(`ufc_vote_${fight.id}`);
    if (voted) {
      setHasVoted(true);
      setSelectedFighter(parseInt(voted) as 1 | 2);
    } else {
      setHasVoted(false);
      setSelectedFighter(null);
    }
  }, [fight.id]);

  const handleVote = (fighter: 1 | 2) => {
    if (hasVoted) return;
    setSelectedFighter(fighter);
    setHasVoted(true);
    localStorage.setItem(`ufc_vote_${fight.id}`, fighter.toString());
    onVote(fighter);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ufc-gray-900">
      <div className="card w-full max-w-2xl p-2 rounded-none">
        <div className="flex items-center justify-between gap-1">
          {/* Fighter 1 */}
          <div
            className={`relative fighter-card flex-1 flex items-center gap-1 p-0.5 rounded-none${hasVoted ? ' opacity-80' : ' cursor-pointer'}`}
            onClick={() => !hasVoted && handleVote(1)}
            style={{ minWidth: 0 }}
          >
            {/* Dot indicator for selected fighter */}
            {selectedFighter === 1 && (
              <span
                className="absolute right-1 bottom-1 w-2 h-2 bg-ufc-gold rounded-full shadow"
                aria-label="Выбранный боец"
              />
            )}
            <img src={fight.fighter1_image} alt={fight.fighter1_name} className="w-10 h-10 rounded-none border-2 border-ufc-gray-600 object-cover object-top" />
            <div className="truncate">
              <div className="font-display text-sm font-bold text-white truncate">{fight.fighter1_name}</div>
              {hasVoted && (
                <div className="vote-counter text-[10px] text-ufc-gold font-bold">{fighter1Votes} голосов</div>
              )}
            </div>
          </div>
          {/* VS + Total */}
          <div className="flex flex-col items-center justify-center min-w-[40px]">
            <div className="font-display text-xs font-bold text-white">VS</div>
            <div className="text-ufc-gray-300 text-[10px] mt-0.5">{totalVotes} всего</div>
          </div>
          {/* Fighter 2 */}
          <div
            className={`relative fighter-card flex-1 flex flex-row-reverse items-center gap-1 p-0.5 rounded-none${hasVoted ? ' opacity-80' : ' cursor-pointer'}`}
            onClick={() => !hasVoted && handleVote(2)}
            style={{ minWidth: 0 }}
          >
            {/* Dot indicator for selected fighter */}
            {selectedFighter === 2 && (
              <span
                className="absolute left-1 bottom-1 w-2 h-2 bg-ufc-gold rounded-full shadow"
                aria-label="Выбранный боец"
              />
            )}
            <img src={fight.fighter2_image} alt={fight.fighter2_name} className="w-10 h-10 rounded-none border-2 border-ufc-gray-600 object-cover object-top" />
            <div className="text-right truncate">
              <div className="font-display text-sm font-bold text-white truncate">{fight.fighter2_name}</div>
              {hasVoted && (
                <div className="vote-counter text-[10px] text-ufc-gold font-bold">{fighter2Votes} голосов</div>
              )}
            </div>
          </div>
        </div>
        {/* Progress Bar */}
        <div className="progress-bar mt-2 flex rounded-none" style={{ minHeight: '1rem' }}>
          {hasVoted ? (
            <>
              <div
                className="progress-fill-green flex items-center justify-center"
                style={{ width: `${percent1}%`, borderTopLeftRadius: 0, borderBottomLeftRadius: 0 }}
              >
                {percent1 > 0 ? <span className="text-[10px]">{percent1}%</span> : ''}
              </div>
              <div
                className="progress-fill-blue flex items-center justify-center"
                style={{ width: `${percent2}%`, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
              >
                {percent2 > 0 ? <span className="text-[10px]">{percent2}%</span> : ''}
              </div>
            </>
          ) : (
            // Пустой прогресс-бар для сохранения высоты
            <div style={{ width: '100%', height: '100%' }} />
          )}
        </div>
      </div>
    </div>
  );
}; 