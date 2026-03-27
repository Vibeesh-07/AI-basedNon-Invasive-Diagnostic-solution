import { useState } from 'react';
import Radar from './components/Radar';
import EHR from './components/EHR';
import { ShieldCheck, ActivitySquare } from 'lucide-react';

function App() {
  const [activeTab, setActiveTab] = useState('radar');

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.5rem', color: 'var(--accent-teal)', margin: 0 }}>
          <ShieldCheck size={28} />
          OutbreakPredict
        </h1>
        
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button 
            className="btn-primary"
            style={{ 
              background: activeTab === 'radar' ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))' : 'transparent',
              color: activeTab === 'radar' ? 'white' : 'var(--text-secondary)',
              boxShadow: activeTab === 'radar' ? '0 4px 14px rgba(59, 130, 246, 0.4)' : 'none',
              border: activeTab === 'radar' ? 'none' : '1px solid var(--surface-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={() => setActiveTab('radar')}
          >
            <ShieldCheck size={18} />
            Global Radar
          </button>
          
          <button 
            className="btn-primary"
            style={{ 
              background: activeTab === 'ehr' ? 'linear-gradient(135deg, var(--accent-purple), #ec4899)' : 'transparent',
              color: activeTab === 'ehr' ? 'white' : 'var(--text-secondary)',
              boxShadow: activeTab === 'ehr' ? '0 4px 14px rgba(139, 92, 246, 0.4)' : 'none',
              border: activeTab === 'ehr' ? 'none' : '1px solid var(--surface-border)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
            onClick={() => setActiveTab('ehr')}
          >
            <ActivitySquare size={18} />
            Agentic EHR
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main>
        {activeTab === 'radar' ? <Radar /> : <EHR />}
      </main>
    </div>
  );
}

export default App;
