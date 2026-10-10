import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  FolderKanban, ArrowLeft, Brain, CheckSquare, Lightbulb, HelpCircle, 
  Video, Calendar, Clock, User, ChevronRight, Loader2, RefreshCw, FileText, Plus, X, CheckCircle2,
  UploadCloud, Download, Trash2, AlertTriangle, FileCheck, FileX, Users, UserPlus, Mail
} from 'lucide-react';


const ProjectDetails = () => {
  const { projectId } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Add Existing Meeting state
  const [showAddModal, setShowAddModal] = useState(false);
  const [standaloneMeetings, setStandaloneMeetings] = useState([]);
  const [loadingStandalone, setLoadingStandalone] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [addingMeeting, setAddingMeeting] = useState(false);
  const [addError, setAddError] = useState(null);

  // Upload Document state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadError, setUploadError] = useState(null);

  // Team Roster state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [teamRole, setTeamRole] = useState('');
  const [teamEmail, setTeamEmail] = useState('');
  const [teamFocus, setTeamFocus] = useState('');
  const [addingTeamMember, setAddingTeamMember] = useState(false);
  const [teamError, setTeamError] = useState(null);

  const handleAddTeamMember = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;

    setAddingTeamMember(true);
    setTeamError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/projects/${projectId}/team`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: teamName.trim(),
          role: teamRole.trim() || null,
          email: teamEmail.trim() || null,
          current_focus: teamFocus.trim() || null
        })
      });

      if (response.ok) {
        setShowAddTeamModal(false);
        setTeamName('');
        setTeamRole('');
        setTeamEmail('');
        setTeamFocus('');
        fetchProjectDetails(true);
      } else {
        const errData = await response.json().catch(() => ({}));
        setTeamError(errData.detail || 'Failed to add team member');
      }
    } catch (err) {
      setTeamError(err.message);
    } finally {
      setAddingTeamMember(false);
    }
  };

  const handleDeleteTeamMember = async (memberId) => {
    if (!window.confirm("Are you sure you want to remove this team member from the project?")) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/projects/${projectId}/team/${memberId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        fetchProjectDetails(true);
      }
    } catch (err) {
      console.error('Failed to delete team member:', err);
    }
  };


  const fetchProjectDetails = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
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
      } else if (!isBackground) {
        navigate('/projects');
      }
    } catch (error) {
      console.error('Error fetching project details:', error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  const fetchStandaloneCompletedMeetings = async () => {
    setLoadingStandalone(true);
    setAddError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/v1/meetings?project_id=standalone&status=completed&limit=50', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStandaloneMeetings(data.items || []);
        if (data.items && data.items.length > 0) {
          setSelectedMeetingId(data.items[0].id);
        } else {
          setSelectedMeetingId('');
        }
      }
    } catch (err) {
      console.error('Failed to fetch standalone completed meetings:', err);
    } finally {
      setLoadingStandalone(false);
    }
  };

  const handleOpenAddModal = () => {
    setShowAddModal(true);
    fetchStandaloneCompletedMeetings();
  };

  const handleAddMeetingToProject = async (e) => {
    e.preventDefault();
    if (!selectedMeetingId) return;
    setAddingMeeting(true);
    setAddError(null);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/meetings/${selectedMeetingId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ project_id: projectId })
      });

      if (response.ok) {
        setShowAddModal(false);
        fetchProjectDetails();
      } else {
        const err = await response.json();
        setAddError(err.detail || 'Failed to assign meeting to project.');
      }
    } catch (err) {
      console.error('Error assigning meeting:', err);
      setAddError('Network error while assigning meeting.');
    } finally {
      setAddingMeeting(false);
    }
  };

  // Document Upload Handlers
  const handleOpenUploadModal = () => {
    setSelectedFile(null);
    setUploadError(null);
    setShowUploadModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const allowedExtensions = ['.pdf', '.docx', '.md', '.txt'];
    const fileExt = '.' + file.name.split('.').pop().toLowerCase();
    
    if (!allowedExtensions.includes(fileExt)) {
      setUploadError(`Invalid file type "${fileExt}". Only PDF, DOCX, MD, and TXT files are supported.`);
      setSelectedFile(null);
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      setUploadError('File size exceeds the maximum limit of 15 MB.');
      setSelectedFile(null);
      return;
    }

    setUploadError(null);
    setSelectedFile(file);
  };

  const handleUploadDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!selectedFile) return;

    setUploadingDoc(true);
    setUploadError(null);

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('file', selectedFile);

      const response = await fetch(`/v1/projects/${projectId}/documents`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (response.ok) {
        setShowUploadModal(false);
        setSelectedFile(null);
        fetchProjectDetails();
      } else {
        const err = await response.json();
        setUploadError(err.detail || 'Failed to upload document.');
      }
    } catch (err) {
      console.error('Error uploading document:', err);
      setUploadError('Network error while uploading document.');
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleDownloadDocument = async (docId, originalFilename) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/projects/${projectId}/documents/${docId}/download`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        alert('Failed to download file.');
        return;
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = originalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      console.error('Download error:', err);
      alert('Error downloading file.');
    }
  };

  useEffect(() => {
    fetchProjectDetails();
  }, [projectId]);

  // Auto-poll if any document is processing or uploaded
  useEffect(() => {
    if (!project || !project.documents) return;
    const isProcessing = project.documents.some(
      (doc) => doc.status === 'uploaded' || doc.status === 'processing'
    );

    if (isProcessing) {
      const timer = setTimeout(() => {
        fetchProjectDetails(true);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [project]);

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
  const documents = project.documents || [];
  const teamMembers = project.team_members || [];

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

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
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(37, 99, 235, 0.04) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        borderRadius: '24px',
        padding: '2.25rem',
        marginBottom: '2rem',
        position: 'relative',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 12px 32px -8px rgba(0, 0, 0, 0.3)'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.6rem' }}>
              <span style={{
                background: 'rgba(59, 130, 246, 0.18)', color: '#60A5FA',
                padding: '0.3rem 0.85rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '600',
                textTransform: 'uppercase', letterSpacing: '0.6px', border: '1px solid rgba(59, 130, 246, 0.25)'
              }}>
                PROJECT
              </span>
              <h1 style={{ fontSize: '2.1rem', fontWeight: '700', letterSpacing: '-0.02em', margin: 0 }}>{project.name}</h1>
            </div>
            {project.description && (
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: '1rem', maxWidth: '800px', lineHeight: '1.6', margin: 0 }}>
                {project.description}
              </p>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleOpenUploadModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.6rem 1.25rem',
                background: 'rgba(255, 255, 255, 0.07)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#fff', borderRadius: '12px',
                fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                backdropFilter: 'blur(8px)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.07)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
              }}
            >
              <UploadCloud size={17} style={{ color: '#60A5FA' }} /> Upload Document
            </button>
            <button
              onClick={handleOpenAddModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.35)';
              }}
            >
              <Plus size={17} /> Add Existing Meeting
            </button>
            <button
              onClick={() => fetchProjectDetails()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.6rem 1.1rem',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '12px', color: 'rgba(255, 255, 255, 0.85)', fontSize: '0.85rem', cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.09)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
              }}
            >
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '1rem',
          marginTop: '1.75rem', paddingTop: '1.5rem',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)'
        }}>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Meetings</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#60A5FA', marginTop: '0.2rem' }}>{meetings.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Documents</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#A7F3D0', marginTop: '0.2rem' }}>{documents.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Team Roster</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#C084FC', marginTop: '0.2rem' }}>{teamMembers.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Decisions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#F59E0B', marginTop: '0.2rem' }}>{decisions.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Action Items</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#10B981', marginTop: '0.2rem' }}>{actions.length}</div>
          </div>
          <div style={{ background: 'rgba(255, 255, 255, 0.02)', padding: '0.85rem 1.1rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
            <div style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Questions</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#EC4899', marginTop: '0.2rem' }}>{questions.length}</div>
          </div>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div style={{
        display: 'flex', gap: '0.4rem', borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        marginBottom: '2rem', paddingBottom: '0.4rem', flexWrap: 'wrap'
      }}>
        {[
          { id: 'overview', label: 'Project State Memory', icon: <Brain size={18} /> },
          { id: 'team', label: `Team & Roles (${teamMembers.length})`, icon: <Users size={18} /> },
          { id: 'documents', label: `Documents (${documents.length})`, icon: <FileText size={18} /> },
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
              padding: '0.65rem 1.25rem',
              background: activeTab === tab.id ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
              border: activeTab === tab.id ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
              borderRadius: '12px',
              color: activeTab === tab.id ? '#60A5FA' : 'rgba(255, 255, 255, 0.65)',
              fontWeight: activeTab === tab.id ? '600' : '500',
              fontSize: '0.92rem', cursor: 'pointer',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
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
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '20px', padding: '2.25rem',
            marginBottom: '2rem', backdropFilter: 'blur(16px)',
            boxShadow: '0 8px 30px rgba(0, 0, 0, 0.2)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
                <Brain size={22} />
              </div>
              <h2 style={{ fontSize: '1.3rem', fontWeight: '600', margin: 0 }}>Accumulated Project State</h2>
              {memory.updated_at && (
                <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', background: 'rgba(255,255,255,0.04)', padding: '0.25rem 0.75rem', borderRadius: '20px' }}>
                  Updated {new Date(memory.updated_at).toLocaleDateString()}
                </span>
              )}
            </div>

            {memory.current_state ? (
              <div style={{
                color: 'rgba(255, 255, 255, 0.88)',
                fontSize: '1rem', lineHeight: '1.75', whiteSpace: 'pre-wrap',
                background: 'rgba(0, 0, 0, 0.2)', padding: '1.5rem', borderRadius: '14px', border: '1px solid rgba(255, 255, 255, 0.04)'
              }}>
                {memory.current_state}
              </div>
            ) : (
              <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', margin: 0 }}>
                No project memory accumulated yet. Complete meetings or upload documents in this project to automatically build state!
              </p>
            )}
          </div>
        </div>
      )}

      {/* Tab Content: Team & Roles */}
      {activeTab === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff', margin: 0 }}>
                Project Team Roster & Roles ({teamMembers.length})
              </h3>
              <p style={{ fontSize: '0.85rem', color: 'rgba(255, 255, 255, 0.5)', margin: '0.3rem 0 0 0' }}>
                Team roster is automatically extracted from meetings, uploaded documents, and email threads, or managed manually below.
              </p>
            </div>
            <button
              onClick={() => {
                setTeamError(null);
                setShowAddTeamModal(true);
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.35)';
              }}
            >
              <UserPlus size={17} /> Add Team Member
            </button>
          </div>

          {/* Member Card Grid */}
          {teamMembers.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              borderRadius: '18px', padding: '3.5rem 2rem', textAlign: 'center',
              backdropFilter: 'blur(8px)'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.04)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <Users size={28} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
              </div>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                No team members associated with this project yet.
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Upload project specs, process meetings, or click "Add Team Member" above to populate the roster.
              </p>
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
              gap: '1.25rem'
            }}>
              {teamMembers.map((member) => (
                <div
                  key={member.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: '20px',
                    padding: '1.4rem',
                    display: 'flex',
                    flexDirection: 'column',
                    justify: 'space-between',
                    gap: '1.1rem',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(12px)',
                    position: 'relative'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.045)';
                    e.currentTarget.style.boxShadow = '0 8px 30px -8px rgba(0, 0, 0, 0.4)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Top Section: Avatar + Name + Role + Delete */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                        {/* Initial Avatar */}
                        <div style={{
                          width: '46px', height: '46px', borderRadius: '14px',
                          background: 'linear-gradient(135deg, rgba(99, 102, 241, 0.25) 0%, rgba(59, 130, 246, 0.15) 100%)',
                          border: '1px solid rgba(99, 102, 241, 0.3)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          color: '#818CF8', fontSize: '1.1rem', fontWeight: '700', flexShrink: 0
                        }}>
                          {member.name ? member.name.charAt(0).toUpperCase() : 'U'}
                        </div>
                        <div>
                          <h4 style={{ fontSize: '1.05rem', fontWeight: '600', color: '#fff', margin: 0, letterSpacing: '-0.01em' }}>
                            {member.name}
                          </h4>
                          {member.role ? (
                            <span style={{
                              display: 'inline-block',
                              background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA',
                              border: '1px solid rgba(59, 130, 246, 0.2)',
                              padding: '0.15rem 0.6rem', borderRadius: '8px',
                              fontSize: '0.75rem', fontWeight: '600', marginTop: '0.35rem'
                            }}>
                              {member.role}
                            </span>
                          ) : (
                            <span style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' }}>
                              Role unspecified
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Delete Action Button */}
                      <button
                        onClick={() => handleDeleteTeamMember(member.id)}
                        title="Remove Team Member"
                        style={{
                          background: 'rgba(239, 68, 68, 0.08)',
                          border: '1px solid rgba(239, 68, 68, 0.2)',
                          color: '#F87171',
                          borderRadius: '10px',
                          padding: '0.45rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Email Display */}
                    {member.email && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.85rem', color: 'rgba(255, 255, 255, 0.65)', fontSize: '0.85rem' }}>
                        <Mail size={14} style={{ color: '#60A5FA', flexShrink: 0 }} />
                        <a href={`mailto:${member.email}`} style={{ color: 'rgba(255, 255, 255, 0.75)', textDecoration: 'none', transition: 'color 0.2s' }} onMouseEnter={(e) => e.currentTarget.style.color = '#60A5FA'} onMouseLeave={(e) => e.currentTarget.style.color = 'rgba(255, 255, 255, 0.75)'}>
                          {member.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Current Focus Callout Box */}
                  {member.current_focus ? (
                    <div style={{
                      background: 'rgba(0, 0, 0, 0.25)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '0.85rem 1rem',
                      fontSize: '0.85rem',
                      color: 'rgba(255, 255, 255, 0.8)',
                      lineHeight: '1.5'
                    }}>
                      <div style={{ fontSize: '0.72rem', color: 'rgba(255, 255, 255, 0.45)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.3rem' }}>
                        Active Focus / Assigned Work
                      </div>
                      {member.current_focus}
                    </div>
                  ) : (
                    <div style={{
                      background: 'rgba(255, 255, 255, 0.015)',
                      border: '1px dashed rgba(255, 255, 255, 0.05)',
                      borderRadius: '12px',
                      padding: '0.7rem 1rem',
                      fontSize: '0.8rem',
                      color: 'rgba(255, 255, 255, 0.35)',
                      fontStyle: 'italic'
                    }}>
                      No specific focus recorded yet.
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 2: Documents */}
      {activeTab === 'documents' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Beta Notice Banner */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1) 0%, rgba(217, 119, 6, 0.04) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.22)',
            borderRadius: '16px',
            padding: '1.1rem 1.4rem',
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(245, 158, 11, 0.08)'
          }}>
            <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: 'rgba(245, 158, 11, 0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <AlertTriangle size={20} style={{ color: '#FBBF24' }} />
            </div>
            <div style={{ fontSize: '0.88rem', color: 'rgba(255, 255, 255, 0.88)', lineHeight: '1.5' }}>
              <strong style={{ color: '#FBBF24', fontWeight: '600' }}>Beta Notice:</strong> We are currently in Beta state and only able to analyze text content. Images embedded in uploaded files will be ignored, and image-only scanned files (e.g. image PDFs without text layer) will fail analysis. Supported formats: <strong>.pdf, .docx, .md, .txt</strong> (Max 15 MB).
            </div>
          </div>

          {/* Documents Header Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.15rem', fontWeight: '600', color: '#fff', margin: 0 }}>
              Uploaded Project Documents ({documents.length})
            </h3>
            <button
              onClick={handleOpenUploadModal}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.6rem 1.25rem',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#fff', border: 'none', borderRadius: '12px',
                fontSize: '0.88rem', fontWeight: '600', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(59, 130, 246, 0.35)',
                transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 20px rgba(59, 130, 246, 0.45)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 16px rgba(59, 130, 246, 0.35)';
              }}
            >
              <UploadCloud size={17} /> Upload Document
            </button>
          </div>

          {/* Row-wise Document View */}
          {documents.length === 0 ? (
            <div style={{
              background: 'rgba(255, 255, 255, 0.02)',
              border: '1px dashed rgba(255, 255, 255, 0.12)',
              borderRadius: '18px', padding: '3.5rem 2rem', textAlign: 'center',
              backdropFilter: 'blur(8px)'
            }}>
              <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: 'rgba(255, 255, 255, 0.04)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1rem' }}>
                <FileText size={28} style={{ color: 'rgba(255, 255, 255, 0.3)' }} />
              </div>
              <p style={{ color: 'rgba(255, 255, 255, 0.7)', margin: 0, fontSize: '1rem', fontWeight: '500' }}>
                No documents uploaded for this project yet.
              </p>
              <p style={{ color: 'rgba(255, 255, 255, 0.45)', fontSize: '0.85rem', marginTop: '0.4rem' }}>
                Upload text documents, specifications, or architectural notes to build project context.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  style={{
                    background: 'rgba(255, 255, 255, 0.025)',
                    border: '1px solid rgba(255, 255, 255, 0.07)',
                    borderRadius: '16px',
                    padding: '1.1rem 1.4rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    backdropFilter: 'blur(10px)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.045)';
                    e.currentTarget.style.boxShadow = '0 8px 24px -6px rgba(0, 0, 0, 0.3)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {/* Left: Document Icon & Name & Date */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.1rem', minWidth: 0, flex: 1 }}>
                    <div style={{
                      width: '44px', height: '44px', borderRadius: '12px',
                      background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.1) 100%)',
                      border: '1px solid rgba(59, 130, 246, 0.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#60A5FA', flexShrink: 0
                    }}>
                      <FileText size={22} />
                    </div>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{
                        fontSize: '1rem', fontWeight: '600', color: '#fff',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                        letterSpacing: '-0.01em'
                      }}>
                        {doc.filename}
                      </div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                        <span>Uploaded {new Date(doc.uploaded_at || doc.created_at).toLocaleDateString()} at {new Date(doc.uploaded_at || doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        <span>•</span>
                        <span>{formatFileSize(doc.file_size)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Middle / Right: Status Badge & Actions */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', flexShrink: 0 }}>
                    {/* Status Badge */}
                    {doc.processing_status === 'ready' && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        background: 'rgba(16, 185, 129, 0.12)', color: '#34D399',
                        border: '1px solid rgba(16, 185, 129, 0.25)',
                        padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600'
                      }}>
                        <FileCheck size={14} /> Ready
                      </span>
                    )}
                    {(doc.processing_status === 'uploaded' || doc.processing_status === 'processing') && (
                      <span style={{
                        display: 'flex', alignItems: 'center', gap: '0.4rem',
                        background: 'rgba(59, 130, 246, 0.12)', color: '#60A5FA',
                        border: '1px solid rgba(59, 130, 246, 0.25)',
                        padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600'
                      }}>
                        <Loader2 className="animate-spin" size={14} /> Processing AI...
                      </span>
                    )}
                    {doc.processing_status === 'failed' && (
                      <span
                        title={doc.error_message || 'Document processing failed'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.4rem',
                          background: 'rgba(239, 68, 68, 0.12)', color: '#F87171',
                          border: '1px solid rgba(239, 68, 68, 0.25)',
                          padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600',
                          cursor: 'help'
                        }}
                      >
                        <FileX size={14} /> Failed
                      </span>
                    )}

                    {/* Action Icon Buttons */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                      {/* Download Button */}
                      <button
                        onClick={() => handleDownloadDocument(doc.id, doc.filename)}
                        title="Download Original Document"
                        style={{
                          background: 'rgba(59, 130, 246, 0.1)',
                          border: '1px solid rgba(59, 130, 246, 0.25)',
                          color: '#60A5FA',
                          borderRadius: '10px',
                          padding: '0.5rem 0.65rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'rgba(59, 130, 246, 0.1)';
                        }}
                      >
                        <Download size={16} />
                      </button>

                      {/* Disabled Delete Button */}
                      <button
                        disabled
                        title="Document deletion is disabled in Beta mode"
                        style={{
                          background: 'rgba(255, 255, 255, 0.03)',
                          border: '1px solid rgba(255, 255, 255, 0.08)',
                          color: 'rgba(255, 255, 255, 0.3)',
                          borderRadius: '10px',
                          padding: '0.5rem 0.65rem',
                          cursor: 'not-allowed',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0.4
                        }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab Content 3: Decisions */}
      {activeTab === 'decisions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {decisions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2.5rem', textAlign: 'center' }}>
              No decisions recorded for this project yet.
            </p>
          ) : (
            decisions.map((d) => (
              <div
                key={d.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px', padding: '1.25rem 1.5rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start'
                }}
              >
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'flex-start' }}>
                  <Lightbulb size={20} style={{ color: '#F59E0B', flexShrink: 0, marginTop: '2px' }} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff', marginBottom: '0.3rem' }}>
                      {d.decision_text}
                    </div>
                    {d.confidence_reason && (
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)' }}>
                        {d.confidence_reason}
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {d.confidence_score && (
                    <span style={{
                      background: 'rgba(245, 158, 11, 0.15)', color: '#FBBF24',
                      padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600'
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

      {/* Tab Content 4: Action Items */}
      {activeTab === 'actions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {actions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2.5rem', textAlign: 'center' }}>
              No action items assigned for this project yet.
            </p>
          ) : (
            actions.map((a) => (
              <div
                key={a.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px', padding: '1.25rem 1.5rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                  <CheckSquare size={20} style={{ color: '#10B981', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff' }}>{a.task}</div>
                    {a.assignee && (
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)', marginTop: '2px' }}>
                        Assignee: <strong>{a.assignee}</strong>
                      </div>
                    )}
                  </div>
                </div>

                <span style={{
                  background: a.status === 'completed' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(59, 130, 246, 0.15)',
                  color: a.status === 'completed' ? '#34D399' : '#60A5FA',
                  padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600'
                }}>
                  {a.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 5: Questions */}
      {activeTab === 'questions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {questions.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2.5rem', textAlign: 'center' }}>
              No open questions or unresolved risks identified for this project yet.
            </p>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px', padding: '1.25rem 1.5rem',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '0.85rem', alignItems: 'center' }}>
                  <HelpCircle size={20} style={{ color: '#EC4899', flexShrink: 0 }} />
                  <div style={{ fontSize: '1rem', fontWeight: '500', color: '#fff' }}>{q.question}</div>
                </div>

                <span style={{
                  background: 'rgba(236, 72, 153, 0.15)', color: '#F472B6',
                  padding: '0.25rem 0.75rem', borderRadius: '20px', fontSize: '0.78rem', fontWeight: '600'
                }}>
                  {q.status.toUpperCase()}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Tab Content 6: Meetings */}
      {activeTab === 'meetings' && (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {meetings.length === 0 ? (
            <p style={{ color: 'rgba(255, 255, 255, 0.5)', fontStyle: 'italic', padding: '2.5rem', textAlign: 'center' }}>
              No meetings assigned to this project yet.
            </p>
          ) : (
            meetings.map((m) => (
              <div
                key={m.id}
                onClick={() => navigate(`/meetings/${m.id}`)}
                style={{
                  background: 'rgba(255, 255, 255, 0.025)',
                  border: '1px solid rgba(255, 255, 255, 0.07)',
                  borderRadius: '16px', padding: '1.25rem 1.5rem',
                  cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.045)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.07)';
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.025)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                  <div style={{
                    width: '42px', height: '42px', borderRadius: '12px',
                    background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: '#60A5FA'
                  }}>
                    <Video size={20} />
                  </div>
                  <div>
                    <h4 style={{ fontSize: '1rem', fontWeight: '600', marginBottom: '0.2rem' }}>{m.title}</h4>
                    <div style={{ fontSize: '0.82rem', color: 'rgba(255, 255, 255, 0.5)', display: 'flex', gap: '1rem' }}>
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

      {/* Upload Document Modal */}
      {showUploadModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(18, 18, 22, 0.95)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px', padding: '2.25rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UploadCloud size={22} style={{ color: '#3B82F6' }} /> Upload Project Document
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '6px', borderRadius: '10px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleUploadDocumentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div style={{
                border: '2px dashed rgba(59, 130, 246, 0.3)',
                borderRadius: '18px',
                padding: '2.25rem 1.5rem',
                textAlign: 'center',
                background: 'rgba(59, 130, 246, 0.03)',
                cursor: 'pointer',
                transition: 'all 0.25s'
              }}>
                <input
                  type="file"
                  id="project-doc-file"
                  accept=".pdf,.docx,.md,.txt"
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                <label htmlFor="project-doc-file" style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60A5FA' }}>
                    <UploadCloud size={28} />
                  </div>
                  <div>
                    <span style={{ color: '#60A5FA', fontWeight: '600' }}>Click to select a document</span> or drag & drop
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)' }}>
                    Supported formats: PDF, DOCX, MD, TXT (Max 15 MB)
                  </span>
                </label>
              </div>

              {selectedFile && (
                <div style={{
                  background: 'rgba(59, 130, 246, 0.1)',
                  border: '1px solid rgba(59, 130, 246, 0.25)',
                  borderRadius: '12px', padding: '0.85rem 1.1rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                    <FileText size={20} style={{ color: '#60A5FA' }} />
                    <span style={{ fontSize: '0.92rem', fontWeight: '500', color: '#fff' }}>{selectedFile.name}</span>
                  </div>
                  <span style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.5)' }}>{formatFileSize(selectedFile.size)}</span>
                </div>
              )}

              {uploadError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {uploadError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  style={{
                    padding: '0.65rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!selectedFile || uploadingDoc}
                  style={{
                    padding: '0.65rem 1.5rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    border: 'none', color: '#fff', fontWeight: '600', cursor: (!selectedFile || uploadingDoc) ? 'not-allowed' : 'pointer',
                    opacity: (!selectedFile || uploadingDoc) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                  }}
                >
                  {uploadingDoc ? <Loader2 className="animate-spin" size={16} /> : 'Upload & Refine Memory'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Existing Meeting Modal */}
      {showAddModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(18, 18, 22, 0.95)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px', padding: '2.25rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Plus size={22} style={{ color: '#3B82F6' }} /> Add Existing Completed Meeting
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '6px', borderRadius: '10px' }}
              >
                <X size={20} />
              </button>
            </div>

            {loadingStandalone ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>
                <Loader2 className="animate-spin" size={28} style={{ color: '#3B82F6' }} />
              </div>
            ) : standaloneMeetings.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2.5rem 1rem', color: 'rgba(255,255,255,0.6)' }}>
                <CheckCircle2 size={44} style={{ color: 'rgba(255,255,255,0.2)', marginBottom: '0.85rem' }} />
                <p style={{ margin: 0, fontSize: '0.98rem', fontWeight: '500' }}>No standalone completed meetings available to add.</p>
                <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.45)', marginTop: '0.4rem' }}>
                  Only standalone meetings with 'Completed' status can be added to a project.
                </p>
              </div>
            ) : (
              <form onSubmit={handleAddMeetingToProject} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.5rem', fontWeight: '500' }}>
                    Select Completed Meeting *
                  </label>
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => setSelectedMeetingId(e.target.value)}
                    required
                    style={{
                      width: '100%', padding: '0.85rem 1.1rem', background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff',
                      fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', cursor: 'pointer'
                    }}
                  >
                    {standaloneMeetings.map((m) => (
                      <option key={m.id} value={m.id} style={{ background: '#141414', color: '#fff' }}>
                        {m.title} ({new Date(m.created_at).toLocaleDateString()})
                      </option>
                    ))}
                  </select>
                </div>

                {addError && (
                  <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                    {addError}
                  </div>
                )}

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    style={{
                      padding: '0.65rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontWeight: '500', cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={addingMeeting}
                    style={{
                      padding: '0.65rem 1.5rem', borderRadius: '12px',
                      background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                      border: 'none', color: '#fff', fontWeight: '600', cursor: addingMeeting ? 'wait' : 'pointer',
                      opacity: addingMeeting ? 0.7 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                      boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                    }}
                  >
                    {addingMeeting ? <Loader2 className="animate-spin" size={16} /> : 'Add to Project & Sync Memory'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Add Team Member Modal */}
      {showAddTeamModal && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(12px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: 'rgba(18, 18, 22, 0.95)', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '24px', padding: '2.25rem', width: '100%', maxWidth: '520px',
            boxShadow: '0 24px 60px -12px rgba(0,0,0,0.7)', display: 'flex', flexDirection: 'column', gap: '1.5rem',
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: '700', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <UserPlus size={22} style={{ color: '#3B82F6' }} /> Add Project Team Member
              </h2>
              <button
                onClick={() => setShowAddTeamModal(false)}
                style={{ background: 'rgba(255,255,255,0.05)', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', padding: '6px', borderRadius: '10px' }}
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleAddTeamMember} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem', fontWeight: '500' }}>
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sarah Connor"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff',
                    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem', fontWeight: '500' }}>
                  Role / Designation (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lead Backend Engineer / Product Manager"
                  value={teamRole}
                  onChange={(e) => setTeamRole(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff',
                    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem', fontWeight: '500' }}>
                  Email Address (Optional)
                </label>
                <input
                  type="email"
                  placeholder="e.g. sarah@company.com"
                  value={teamEmail}
                  onChange={(e) => setTeamEmail(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff',
                    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'rgba(255,255,255,0.7)', marginBottom: '0.4rem', fontWeight: '500' }}>
                  Current Focus / Assigned Responsibilities (Optional)
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Managing auth pipeline migration, handling Zoho API integration"
                  value={teamFocus}
                  onChange={(e) => setTeamFocus(e.target.value)}
                  style={{
                    width: '100%', padding: '0.8rem 1rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '12px', color: '#fff',
                    fontSize: '0.95rem', outline: 'none', boxSizing: 'border-box', resize: 'vertical'
                  }}
                />
              </div>

              {teamError && (
                <div style={{ color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)', padding: '0.75rem 1rem', borderRadius: '10px', border: '1px solid rgba(239,68,68,0.2)' }}>
                  {teamError}
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAddTeamModal(false)}
                  style={{
                    padding: '0.65rem 1.25rem', borderRadius: '12px', background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.8)', fontWeight: '500', cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingTeamMember || !teamName.trim()}
                  style={{
                    padding: '0.65rem 1.5rem', borderRadius: '12px',
                    background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
                    border: 'none', color: '#fff', fontWeight: '600', cursor: (addingTeamMember || !teamName.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (addingTeamMember || !teamName.trim()) ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: '0.5rem',
                    boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
                  }}
                >
                  {addingTeamMember ? <Loader2 className="animate-spin" size={16} /> : 'Add Team Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProjectDetails;
