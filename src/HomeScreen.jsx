import { useNavigate } from 'react-router-dom';

export default function HomeScreen() {
  const navigate = useNavigate();
  const disasters = [
    { id: 'flood', emoji: '🌊', name: 'Flood', color: '#1a6db5' },
    { id: 'earthquake', emoji: '🌍', name: 'Earthquake', color: '#8B4513' },
  ];

  return (
    <div style={{ minHeight: '100vh', background: '#1a1a2e', color: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <h1 style={{ fontSize: '3rem', color: '#ff4444', margin: 0 }}>⚠️ PANIC MODE</h1>
      <p style={{ color: '#aaa', margin: '8px 0 30px 0' }}>Disaster Survival Strategy Game</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '24px' }}>
        {disasters.map(d => (
          <button key={d.id} onClick={() => navigate(`/game/${d.id}`)}
            style={{ padding: '40px 50px', background: d.color, border: 'none', borderRadius: '16px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '3rem' }}>{d.emoji}</span>
            <span style={{ color: 'white', fontWeight: 'bold', fontSize: '1.1rem' }}>{d.name}</span>
          </button>
        ))}
      </div>
      <button onClick={() => navigate('/leaderboard')}
        style={{ padding: '12px 30px', background: 'transparent', border: '2px solid #ffd700', color: '#ffd700', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem' }}>
        🏆 Leaderboard
      </button>
    </div>
  );
}