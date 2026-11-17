import { useState } from 'react';
import type { Quiz } from '../engine/types';
import { play } from '../engine/sound';

export function QuizCard({ quiz }: { quiz: Quiz }) {
  const [picked, setPicked] = useState<number | null>(null);
  const answered = picked !== null;
  const choose = (i: number) => {
    if (answered) return;
    setPicked(i);
    play(i === quiz.answer ? 'success' : 'error');
  };
  return (
    <div className="quiz">
      <div className="quiz-label">Check yourself</div>
      <p className="quiz-q">{quiz.question}</p>
      <div className="quiz-options">
        {quiz.options.map((o, i) => {
          const state = !answered ? '' : i === quiz.answer ? 'right' : i === picked ? 'wrong' : 'muted';
          return (
            <button key={i} className={`quiz-option ${state}`} onClick={() => choose(i)} disabled={answered}>
              <span className="quiz-letter">{String.fromCharCode(65 + i)}</span>
              {o}
            </button>
          );
        })}
      </div>
      {answered && (
        <p className={`quiz-explain ${picked === quiz.answer ? 'right' : 'wrong'}`}>
          {picked === quiz.answer ? 'Correct. ' : 'Not quite. '}
          {quiz.explain}
        </p>
      )}
      {answered && (
        <button className="link-btn" onClick={() => setPicked(null)}>
          Try again
        </button>
      )}
    </div>
  );
}
