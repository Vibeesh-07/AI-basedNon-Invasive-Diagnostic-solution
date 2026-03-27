import { Shield, Stethoscope, Settings, Menu, X, Activity, Microscope, Scan, BrainCircuit, Zap, Layers } from 'lucide-react';

function Sidebar({ activeRole, setActiveRole, isOpen, setIsOpen }) {
  const roles = [
    { id: 'public', label: 'Outbreak: Public Radar', icon: Shield, color: 'var(--accent-teal)' },
    { id: 'doctor', label: 'Outbreak: Doctor Portal', icon: Stethoscope, color: 'var(--accent-purple)' },
    { id: 'admin', label: 'Outbreak: Admin Console', icon: Settings, color: 'var(--accent-blue)' },
    { id: 'braintumor', label: 'Brain Tumor Diagnosis', icon: Activity, color: 'var(--accent-purple)' },
    { id: 'skincancer', label: 'Skin Cancer — CNN', icon: Scan, color: 'var(--accent-blue)' },
    { id: 'alzheimer', label: 'Alzheimer\'s — EffNetV2', icon: Zap, color: '#f97316' },
    { id: 'tb', label: 'Tuberculosis — CNN', icon: Layers, color: '#dc2626' },
  ];

  return (
    <>
      {/* Mobile Toggle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          top: '1rem',
          left: '1rem',
          zIndex: 100,
          background: 'var(--surface-color)',
          border: '1px solid var(--surface-border)',
          borderRadius: '8px',
          padding: '8px',
          display: 'lg:none'
        }}
      >
        {isOpen ? <X size={24}/> : <Menu size={24}/>}
      </button>

      <aside style={{
        width: isOpen ? '260px' : '0',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        background: 'rgba(15, 17, 26, 0.95)',
        backdropFilter: 'blur(20px)',
        borderRight: '1px solid var(--surface-border)',
        transition: 'width 0.3s ease',
        overflow: 'hidden',
        zIndex: 90,
        display: 'flex',
        flexDirection: 'column',
        padding: isOpen ? '2rem 1rem' : '0'
      }}>
        <div style={{ marginBottom: '3rem', whiteSpace: 'nowrap' }}>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '1.25rem', color: 'var(--text-primary)' }}>
            <Shield size={28} color="var(--accent-teal)" />
            Sentinel 3
          </h1>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>EHR v2.1.0 (Agentic)</p>
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {roles.map((role) => {
            const Icon = role.icon;
            const isActive = activeRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => setActiveRole(role.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '12px 16px',
                  borderRadius: '12px',
                  background: isActive ? 'rgba(255,255,255,0.05)' : 'transparent',
                  border: 'none',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  width: '100%',
                  textAlign: 'left',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  whiteSpace: 'nowrap'
                }}
              >
                <Icon size={20} color={isActive ? role.color : 'var(--text-secondary)'} />
                <span style={{ fontWeight: isActive ? 600 : 400 }}>{role.label}</span>
                {isActive && (
                  <div style={{ 
                    marginLeft: 'auto', 
                    width: '6px', 
                    height: '6px', 
                    borderRadius: '50%', 
                    background: role.color,
                    boxShadow: `0 0 10px ${role.color}`
                  }} />
                )}
              </button>
            );
          })}
        </nav>

        <div className="glass-panel" style={{ padding: '12px', marginTop: 'auto', fontSize: '0.8rem' }}>
          <p style={{ color: 'var(--text-secondary)' }}>System Status: <span style={{ color: 'var(--risk-low)' }}>● Online</span></p>
          <p style={{ color: 'var(--text-secondary)' }}>Agentic Engine: <span style={{ color: 'var(--accent-purple)' }}>Active</span></p>
        </div>
      </aside>
    </>
  );
}

export default Sidebar;
