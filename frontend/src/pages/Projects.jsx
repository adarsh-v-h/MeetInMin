import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderKanban, Plus, Calendar, CheckSquare, ArrowRight, Trash2, Edit2, Loader2, Layers } from 'lucide-react';

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const navigate = useNavigate();

  const fetchProjects = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/v1/projects', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        const data = await response.json();
        setProjects(data);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleCreateProject = async (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    setCreating(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: newProjectName.trim(),
          description: newProjectDesc.trim() || null
        })
      });
      if (response.ok) {
        setNewProjectName('');
        setNewProjectDesc('');
        setShowCreateModal(false);
        fetchProjects();
      } else {
        const err = await response.json();
        alert(err.detail || 'Failed to create project');
      }
    } catch (error) {
      console.error('Error creating project:', error);
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteProject = async (e, projectId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this project? Meetings will remain as standalone meetings.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (response.ok) {
        fetchProjects();
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', color: '#fff' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '1.875rem', fontWeight: '700', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <FolderKanban size={28} style={{ color: '#3B82F6' }} /> Projects & Continuous Memory
          </h1>
          <p style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '0.95rem' }}>
            Group your meetings into projects to automatically accumulate state, decisions, and action items.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            padding: '0.75rem 1.25rem',
            background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
            color: '#fff', border: 'none', borderRadius: '8px',
            fontWeight: '600', cursor: 'pointer',
            boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)',
            transition: 'transform 0.2s'
          }}
        >
          <Plus size={18} /> New Project
        </button>
      </div>

      {/* Projects Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '4rem' }}>
          <Loader2 className="animate-spin" size={32} style={{ color: '#3B82F6' }} />
        </div>
      ) : projects.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: '4rem 2rem',
          background: 'rgba(255, 255, 255, 0.02)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '16px'
        }}>
          <FolderKanban size={48} style={{ color: 'rgba(255, 255, 255, 0.2)', marginBottom: '1rem' }} />
          <h3 style={{ fontSize: '1.2rem', fontWeight: '600', marginBottom: '0.5rem' }}>No Projects Created Yet</h3>
          <p style={{ color: 'rgba(255, 255, 255, 0.5)', maxWidth: '450px', margin: '0 auto 1.5rem', fontSize: '0.9rem' }}>
            Create your first project to start grouping meetings and building automated project continuity memory.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '0.6rem 1.2rem',
              background: '#3B82F6', color: '#fff', border: 'none', borderRadius: '8px',
              fontWeight: '600', cursor: 'pointer'
            }}
          >
            + Create First Project
          </button>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
          gap: '1.5rem'
        }}>
          {projects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '16px',
                padding: '1.5rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
                position: 'relative',
                backdropFilter: 'blur(10px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
              }}
            >
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: '#3B82F6',
                      boxShadow: '0 0 8px #3B82F6'
                    }} />
                    <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff' }}>{project.name}</h3>
                  </div>
                  <button
                    onClick={(e) => handleDeleteProject(e, project.id)}
                    style={{
                      background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)',
                      cursor: 'pointer', padding: '4px', borderRadius: '4px'
                    }}
                    title="Delete Project"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                <p style={{
                  color: 'rgba(255, 255, 255, 0.6)',
                  fontSize: '0.875rem',
                  lineHeight: '1.4',
                  marginBottom: '1.25rem',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  minHeight: '2.5rem'
                }}>
                  {project.description || 'No description provided.'}
                </p>
              </div>

              <div>
                <div style={{
                  display: 'flex', gap: '1rem',
                  paddingTop: '1rem',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  fontSize: '0.8rem', color: 'rgba(255, 255, 255, 0.6)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Layers size={14} style={{ color: '#3B82F6' }} />
                    <span><strong>{project.meeting_count}</strong> Meetings</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <CheckSquare size={14} style={{ color: '#10B981' }} />
                    <span><strong>{project.open_action_count}</strong> Open Tasks</span>
                  </div>
                </div>

                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginTop: '1rem', fontSize: '0.8rem', color: '#3B82F6', fontWeight: '500'
                }}>
                  <span>View Project Memory</span>
                  <ArrowRight size={16} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, backdropFilter: 'blur(5px)'
        }}>
          <div style={{
            background: '#141414',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '16px',
            padding: '2rem',
            width: '100%', maxWidth: '480px',
            color: '#fff',
            boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)'
          }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: '600', marginBottom: '1.25rem' }}>Create New Project</h2>
            <form onSubmit={handleCreateProject}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
                  Project Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Q4 Platform Refactor"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none'
                  }}
                />
              </div>

              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem' }}>
                  Description (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="Brief scope, goals, or objectives..."
                  value={newProjectDesc}
                  onChange={(e) => setNewProjectDesc(e.target.value)}
                  style={{
                    width: '100%', padding: '0.75rem 1rem',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.15)',
                    borderRadius: '8px', color: '#fff', fontSize: '0.95rem', outline: 'none', resize: 'vertical'
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: '8px', color: 'rgba(255,255,255,0.8)', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  style={{
                    padding: '0.6rem 1.25rem',
                    background: '#3B82F6', border: 'none',
                    borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.5rem'
                  }}
                >
                  {creating ? <Loader2 className="animate-spin" size={16} /> : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Projects;
