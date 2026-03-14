import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';

const API = 'http://localhost:8080/api';

export default function GameScreen() {
  const { disasterType } = useParams();
  const navigate = useNavigate();
  const [situation, setSituation] = useState(null);
  const [score, setScore] = useState(0);
  const [feedback, setFeedback] = useState(null);
  const [timer, setTimer] = useState(30);
  const [decisions, setDecisions] = useState([]);

  useEffect(() => {
    axios.post(`${API}/game/start`, { disasterType }).then(res => {
      setSituation(res.data);
      setTimer(res.data.timeLimit || 30);
    });
  }, []);

  useEffect(() => {
    if (!situation || feedback) return;
    if (timer <= 0) {
      setFeedback({ explanation: "⏰ Time's up! In real disasters, hesitation costs lives.", scoreChange: -15, isCorrect: false });
      setScore(p => p - 15);
      setTimeout(() => navigate('/debrief', { state: { decisions, finalScore: score - 15, disasterType } }), 2000);
      return;
    }
    const t = setTimeout(() => setTimer(p => p - 1), 1000);
    return () => clearTimeout(t);
  }, [timer, situation, feedback]);

  async function makeDecision(choice) {
    setFeedback('loading');
    const res = await axios.post(`${API}/game/decide`, {
      disasterType, situationId: situation.id, choiceId: choice.id
    });
    const newScore = score + res.data.scoreChange;
    setScore(newScore);
    setDecisions(p => [...p, { choice: choice.text, scoreChange: res.data.scoreChange }]);
    setFeedback(res.data);
    if (res.data.isGameOver) {
      setTimeout(() => navigate('/debrief', {
        state: {
          decisions: [...decisions, { choice: choice.text, scoreChange: res.data.scoreChange }],
          finalScore: newScore,
          disasterType
        }
      }), 2500);
    } else {
      setTimeout(() => {
        setSituation(res.data.nextSituation);
        setTimer(res.data.nextSituation?.timeLimit || 30);
        setFeedback(null);
      }, 2500);
    }
  }

  if (!situation) return (
    <div style={{ color: 'white', textAlign: 'center', padding: '100px', background: '#1a1a2e', minHeight: '100vh', fontSize: '1.5rem' }}>
      Loading... 🚨
    </div>
  );

  const timerColor = timer <= 10 ? '#ff4444' : timer <= 20 ? '#ffaa00' : '#44ff44';

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      
      {/* Top bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 15px', background: '#16213e', borderRadius: '10px', marginBottom: '20px' }}>
        <span style={{ color: '#ff4444', fontWeight: 'bold' }}>🚨 {disasterType.toUpperCase()}</span>
        <span style={{ color: timerColor, fontSize: '1.4rem', fontWeight: 'bold' }}>⏱ {timer}s</span>
        <span style={{ color: '#ffd700', fontWeight: 'bold' }}>Score: {score}</span>
      </div>

      {/* Situation box */}
      <div style={{ background: '#16213e', padding: '20px', borderRadius: '12px', borderLeft: '4px solid #ff4444', marginBottom: '20px' }}>
        <p style={{ fontSize: '1.1rem', lineHeight: '1.6', margin: 0 }}>{situation.text}</p>
      </div>

      {/* Feedback after choosing */}
      {feedback && feedback !== 'loading' && (
        <div style={{ background: feedback.isCorrect ? '#1a4a1a' : '#4a1a1a', padding: '15px', borderRadius: '10px', marginBottom: '20px', textAlign: 'center' }}>
          <p style={{ margin: '0 0 8px 0' }}>{feedback.explanation}</p>
          <p style={{ color: feedback.scoreChange > 0 ? '#44ff44' : '#ff4444', fontWeight: 'bold', margin: 0 }}>
            {feedback.scoreChange > 0 ? `+${feedback.scoreChange}` : feedback.scoreChange} points
          </p>
        </div>
      )}

      {/* Choice buttons */}
      {!feedback && situation.choices && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <p style={{ color: '#aaa', margin: '0 0 8px 0' }}>What do you do?</p>
          {situation.choices.map(choice => (
            <button key={choice.id} onClick={() => makeDecision(choice)}
              style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '15px', background: '#16213e', border: '1px solid #333', borderRadius: '10px', color: 'white', cursor: 'pointer', fontSize: '1rem', textAlign: 'left' }}>
              <span style={{ background: '#ff4444', padding: '4px 10px', borderRadius: '6px', fontWeight: 'bold', minWidth: '28px', textAlign: 'center' }}>{choice.id}</span>
              {choice.text}
            </button>
          ))}
        </div>
      )}

    </div>
  );
}