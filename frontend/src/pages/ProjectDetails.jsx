import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FolderKanban, ArrowLeft, Brain, CheckSquare, Lightbulb, HelpCircle, 
  Video, Calendar, Clock, User, ChevronRight, Loader2, RefreshCw, FileText
} from 'lucide-react';

const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  const fetchProjectDetails = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/projects/${projectId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProject(data);
      } else {
        navigate('/projects');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <Loader2 className="animate-spin" size={36} style={{ color: '#3B82F6' }} />
      </div>
    );
  }

  if (!project) return null;

  const memory = project.memory || {};
  const decisions = project.decisions || [];
  const actions = project.actions || [];
  const questions = project.questions || [];
  const meetings = project.meetings || [];

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      {/* Top Navigation / Breadcrumb */}
      <button
        onClick={() => navigate('/projects')}
        style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.6)',
          fontSize: '0.9rem', cursor: 'pointer', marginBottom: '1.5rem'
        }}
      >
        <ArrowLeft size={16} /> Back to Projects
      </button>

      {/* Project Header Banner */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.05) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '20px',
        padding: '2rem',
        marginBottom: '2rem',
        position: 'relative',
        backdropFilter: 'blur(10px)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
              <span style={{
                background: 'rgba(59, 130, 246, 0.2)', color: '#60A5FA',
                padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.5px'
              }}>
                PROJECT
              </span>
              <h1 style={{ fontSize: '2rem', fontWeight: '700' }}>{project.name}</h1>
            </div>
            {project.description && (
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', maxWidth: '800px', lineHeight: '1.5' }}>
                {project.description}
              </p>
            )}
          </div>
          <button
            onClick={fetchProjectDetails}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.4rem',
              padding: '0.5rem 1rem',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px', color: '#fff', fontSize: '0.85rem', cursor: 'pointer'
            }}
          >
            <RefreshCw size={14} /> Refresh State
          </button>
        </div>

        {/* Quick Stats Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem',
          marginTop: '1.5rem', paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Total Meetings</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#60A5FA' }}>{meetings.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Active Decisions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#F59E0B' }}>{decisions.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Action Items</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10B981' }}>{actions.length}</div>
          </div>
          <div>
            <div style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.5)' }}>Open Questions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#EC4899' }}>{questions.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: '0.5rem', borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        marginBottom: '2rem'
      }}>
        {[
          { id: 'overview', label: 'Project State Memory', icon: <Brain size={18} /> },
          { id: 'decisions', label: `Decisions (${decisions.length})`, icon: <Lightbulb size={18} /> },
          { id: 'actions', label: `Action Items (${actions.length})`, icon: <CheckSquare size={18} /> },
          { id: 'questions', label: `Questions (${questions.length})`, icon: <HelpCircle size={18} /> },
          { id: 'meetings', label: `Meetings (${meetings.length})`, icon: <Video size={18} /> },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              padding: '0.75rem 1.25rem',
              background: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid #3B82F6' : '2px solid transparent',
              color: activeTab === tab.id ? '#3B82F6' : 'rgba(255, 255, 255, 0.6)',
              fontWeight: activeTab === tab.id ? '600' : '500',
              fontSize: '0.95rem', cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Tab Content 1: Project State Memory */}
      {activeTab === 'overview' && (
        <div>
          <div style={{
            background: 'rgba(255, 255, 255, 0.03)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px', padding: '2rem',
            marginBottom: '2rem', backdropFilter: 'blur(10px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem' }}>
              <Brain size={22} style={{ color: '#3B82F6' }} />
              <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Accumulated Project State</h2>
              {memory.updated_at && (
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>
                  Updated {new Date(memory.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {memory.current_state ? (
              <div style={{
                color: 'rgba(255, 255, 255, 0.85)',
                fontSize: '1rem', lineHeight: '1.7', whiteSpace: 'pre-wrap'
              }}>
                {memory.current_state}
              </div>
            ) : (
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic' }}>
                No project memory accumulated yet. Complete meetings in this project to automatically build state!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content 2: Decisions */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {decisions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
              No decisions recorded for this project yet.
            </p>
          ) : (
            decisions.map((d) => (
              <div
                key={d.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', padding: '1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                  <Lightbulb size={20} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff', marginBottom: '0.3rem' }}>
                      {d.decision_text}
                    </div>
                    {d.confidence_reason && (
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {d.confidence_reason}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {d.confidence_score && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24',
                      padding: '0.2rem 0.6rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600'
                    }}>
                      {Math.round(d.confidence_score * 100)}% Confidence
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 3: Action Items */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {actions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
              No action items assigned for this project yet.
            </p>
          ) : (
            actions.map((a) => (
              <div
                key={a.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', padding: '1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <CheckSquare size={20} style={{ color: '#10B981', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff' }}>{a.task}</div>
                    {a.assignee && (
                      <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                        Assignee: <strong>{a.assignee}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <span style={{
                  background: a.status === 'completed' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                  color: a.status === 'completed' ? '#34D399' : '#60A5FA',
                  padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600'
                }}>
                  {a.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 4: Questions */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
              No open questions or unresolved risks identified for this project yet.
            </p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', padding: '1.25rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                  <HelpCircle size={20} style={{ color: '#EC4899', flexShrink: 0 }} />
                  <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff' }}>{q.question}</div>
                </div>

                <span style={{
                  background: 'rgba(236, 72, 153, 0.2)', color: '#F472B6',
                  padding: '0.25rem 0.75rem', borderRadius: '12px', fontSize: '0.75rem', fontWeight: '600'
                }}>
                  {q.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 5: Meetings */}
      {activeTab === 'meetings' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {meetings.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2rem', textAlign: 'center' }}>
              No meetings assigned to this project yet.
            </p>
          ) : (
            meetings.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '12px', padding: '1.25rem',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '40px', height: '40px', borderRadius: '10px',
                    background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#60A5FA'
                  }}>
                    <Video size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.2rem' }}>{m.title}</h4>
                    <div style={{ fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.5)', display: 'flex', gap: '1rem' }}>
                      <span>{new Date(m.created_at).toLocaleDateString()}</span>
                      <span style={{ textTransform: 'capitalize' }}>Status: {m.status}</span>
                    </div>
                  </div>
                </div>

                <ChevronRight size={18} style={{ color: 'rgba(255, 255, 255, 0.4)' }} />
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
