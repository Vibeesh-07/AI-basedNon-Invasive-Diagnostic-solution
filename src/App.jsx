import { useState } from 'react';
import Sidebar from './components/Sidebar';
import Radar from './components/Radar';
import AdminDashboard from './components/AdminDashboard';
import DoctorDashboard from './components/DoctorDashboard';
import BrainTumorDashboard from './components/BrainTumorDashboard';

function App() {
  const [activeRole, setActiveRole] = useState('public');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const renderView = () => {
    switch(activeRole) {
      case 'admin':
        return <AdminDashboard />;
      case 'doctor':
        return <DoctorDashboard />;
      case 'braintumor':
        return <BrainTumorDashboard />;
      default:
        return <Radar />;
    }
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-color)' }}>
      <Sidebar 
        activeRole={activeRole} 
        setActiveRole={setActiveRole} 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
      />
      
      <main style={{ 
        flex: 1, 
        marginLeft: isSidebarOpen ? '260px' : '0',
        padding: '2rem 3rem',
        transition: 'margin-left 0.3s ease',
        maxWidth: '100vw',
        overflowX: 'hidden'
      }}>
        {renderView()}
      </main>
    </div>
  );
}

export default App;
