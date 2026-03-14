import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function DebriefScreen() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { decisions, finalScore, disasterType } = state || {};
  const [debrief, setDebrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios.post('http://localhost:8080/api/game/debrief', { decisions, finalScore, disasterType })
      .then(res => { setDebrief(res.data.debrief); setLoading(false); })
      .catch(() => {
        setDebrief({
          good: 'You completed the scenario.',
          missed: 'Review NDMA guidelines for better preparedness.',
          critical: 'Preparedness saves lives.',
          tip: 'Practice emergency drills regularly with your family.'
        });
        setLoading(false);
      });
  }, []);

  const scoreColor = finalScore >= 70 ? '#44ff44' : finalScore >= 40 ? '#ffaa00' : '#ff4444';
  const label = finalScore >= 70 ? 'PREPARED 🛡️' : finalScore >= 40 ? 'DEVELOPING ⚠️' : 'AT RISK ❌';

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#ffd700' }}>📊 Mission Debrief</h1>

      {/* Score card */}
      <div style={{ background: '#16213e', padding: '30px', borderRadius: '16px', textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#aaa', margin: '0 0 8px 0' }}>Risk-Awareness Score</p>
        <p style={{ fontSize: '4rem', fontWeight: 'bold', color: scoreColor, margin: 0 }}>{finalScore}/100</p>
        <p style={{ color: scoreColor, fontWeight: 'bold', margin: '8px 0 0 0' }}>{label}</p>
      </div>

      {/* AI Feedback */}
      {loading ? (
        <p style={{ textAlign: 'center', color: '#aaa', padding: '20px' }}>🤖 Gemini AI is analysing your decisions...</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {[
            ['✅ What you did well', debrief?.good, '#44ff44'],
            ['⚠️ What you missed', debrief?.missed, '#ffaa00'],
            ['❌ Critical lesson', debrief?.critical, '#ff4444'],
            ['💡 Real-life tip', debrief?.tip, '#4da6ff']
          ].map(([title, text, color]) => (
            <div key={title} style={{ background: '#16213e', padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${color}` }}>
              <h3 style={{ margin: '0 0 8px 0', color }}>{title}</h3>
              <p style={{ margin: 0, lineHeight: '1.5' }}>{text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Buttons */}
      <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'center' }}>
        <button onClick={() => navigate('/')}
          style={{ padding: '12px 30px', background: '#ff4444', border: 'none', borderRadius: '8px', color: 'white', cursor: 'pointer', fontWeight: 'bold', fontSize: '1rem' }}>
          🏠 Play Again
        </button>
        <button onClick={() => navigate('/leaderboard')}
          style={{ padding: '12px 30px', background: 'transparent', border: '2px solid #ffd700', borderRadius: '8px', color: '#ffd700', cursor: 'pointer', fontSize: '1rem' }}>
          🏆 Leaderboard
        </button>
      </div>
    </div>
  );
}