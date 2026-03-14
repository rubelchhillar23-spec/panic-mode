import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

export default function LeaderboardScreen() {
  const navigate = useNavigate();
  const [scores, setScores] = useState([]);
  const [disaster, setDisaster] = useState('flood');

  useEffect(() => {
    axios.get(`http://localhost:8080/api/scores/leaderboard/${disaster}`)
      .then(res => setScores(res.data));
  }, [disaster]);

  const medals = ['🥇', '🥈', '🥉'];

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', padding: '20px', maxWidth: '700px', margin: '0 auto' }}>
      <h1 style={{ textAlign: 'center', color: '#ffd700' }}>🏆 Leaderboard</h1>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '24px' }}>
        {['flood', 'earthquake'].map(d => (
          <button key={d} onClick={() => setDisaster(d)}
            style={{ padding: '8px 24px', background: disaster === d ? '#16213e' : 'transparent', border: `2px solid ${disaster === d ? '#ffd700' : '#333'}`, color: disaster === d ? '#ffd700' : 'white', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
            {d === 'flood' ? '🌊' : '🌍'} {d}
          </button>
        ))}
      </div>

      {/* Score list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {scores.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '15px', background: '#16213e', padding: '15px 20px', borderRadius: '10px' }}>
            <span style={{ fontSize: '1.4rem', minWidth: '40px' }}>{medals[i] || `#${i + 1}`}</span>
            <span style={{ flex: 1, fontSize: '1rem' }}>{s.username}</span>
            <span style={{ color: '#ffd700', fontWeight: 'bold' }}>{s.score}/100</span>
          </div>
        ))}
      </div>

      <button onClick={() => navigate('/')}
        style={{ marginTop: '24px', padding: '12px 24px', background: 'transparent', border: '1px solid #555', borderRadius: '8px', color: 'white', cursor: 'pointer' }}>
        ← Back to Menu
      </button>
    </div>
  );
}