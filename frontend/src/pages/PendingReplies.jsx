import React, { useState, useEffect, useCallback } from 'react';
import { Mail, RefreshCw, AlertCircle, CheckCircle2, HelpCircle, Clock, ChevronDown, ChevronUp, Link as LinkIcon, Sparkles, Send, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const PendingReplies = () => {
  const navigate = useNavigate();
  const [emails, setEmails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [googleConnected, setGoogleConnected] = useState(true);
  const [activeFilter, setActiveFilter] = useState('NEEDS_REPLY'); // 'NEEDS_REPLY', 'NO_REPLY_NEEDED', 'UNCLEAR', 'ALL'
  const [expandedId, setExpandedId] = useState(null);

  // Modal State for Review & Send Reply
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [userInstructions, setUserInstructions] = useState('');
  const [draftRecipient, setDraftRecipient] = useState('');
  const [draftSubject, setDraftSubject] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [inReplyToHeader, setInReplyToHeader] = useState('');
  
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [successBanner, setSuccessBanner] = useState(null);

  const fetchPendingEmails = useCallback(async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('/v1/emails/pending-replies?limit=25', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 400) {
        const errData = await response.json();
        if (errData.detail && errData.detail.includes("Google account not connected")) {
          setGoogleConnected(false);
          setEmails([]);
          return;
        }
      }

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to fetch pending emails');
      }

      const data = await response.json();
      setGoogleConnected(true);
      setEmails(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingEmails();
  }, [fetchPendingEmails]);

  const handleOpenReplyModal = async (email) => {
    setSelectedEmail(email);
    setUserInstructions('');
    setModalError(null);
    
    const origSubj = email.subject || '(no subject)';
    const defaultSubj = origSubj.toLowerCase().startsWith('re:') ? origSubj : `Re: ${origSubj}`;
    
    setDraftRecipient(email.sender);
    setDraftSubject(defaultSubj);
    setDraftBody('');
    setInReplyToHeader('');

    // Trigger initial AI draft generation
    await generateDraft(email.gmail_message_id, '');
  };

  const generateDraft = async (messageId, instructions) => {
    try {
      setIsGeneratingDraft(true);
      setModalError(null);

      const token = localStorage.getItem('token');
      const response = await fetch(`/v1/emails/${messageId}/draft-reply`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          user_instructions: instructions || null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to generate AI reply draft');
      }

      const data = await response.json();
      setDraftRecipient(data.recipient || draftRecipient);
      setDraftSubject(data.subject || draftSubject);
      setDraftBody(data.body_text || '');
      setInReplyToHeader(data.in_reply_to_message_id || '');
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsGeneratingDraft(false);
    }
  };

  const handleSendReply = async () => {
    if (!draftBody.trim()) {
      setModalError("Reply body text cannot be empty.");
      return;
    }

    try {
      setIsSending(true);
      setModalError(null);

      const token = localStorage.getItem('token');
      const response = await fetch('/v1/emails/send-reply', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          gmail_message_id: selectedEmail.gmail_message_id,
          thread_id: selectedEmail.thread_id,
          recipient: draftRecipient,
          subject: draftSubject,
          body_text: draftBody,
          in_reply_to_message_id: inReplyToHeader || null
        })
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to send reply email');
      }

      const sentData = await response.json();
      
      // Update local list: remove sent email from list or update classification
      setEmails(prev => prev.filter(e => e.gmail_message_id !== selectedEmail.gmail_message_id));
      
      setSuccessBanner(`Reply sent successfully to ${draftRecipient}!`);
      setSelectedEmail(null);

      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setIsSending(false);
    }
  };

  const filteredEmails = emails.filter(email => {
    if (activeFilter === 'ALL') return true;
    return email.classification === activeFilter;
  });

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'NEEDS_REPLY':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(168, 85, 247, 0.15)', border: '1px solid rgba(168, 85, 247, 0.4)',
            color: '#c084fc', padding: '0.35rem 0.75rem', borderRadius: '20px',
            fontSize: '0.8rem', fontWeight: '600'
          }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#a855f7', boxShadow: '0 0 8px #a855f7' }}></span>
            Needs Reply
          </span>
        );
      case 'NO_REPLY_NEEDED':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(16, 185, 129, 0.12)', border: '1px solid rgba(16, 185, 129, 0.3)',
            color: '#34d399', padding: '0.35rem 0.75rem', borderRadius: '20px',
            fontSize: '0.8rem', fontWeight: '600'
          }}>
            <CheckCircle2 size={13} color="#34d399" />
            No Reply Needed
          </span>
        );
      case 'UNCLEAR':
        return (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
            background: 'rgba(245, 158, 11, 0.15)', border: '1px solid rgba(245, 158, 11, 0.35)',
            color: '#fbbf24', padding: '0.35rem 0.75rem', borderRadius: '20px',
            fontSize: '0.8rem', fontWeight: '600'
          }}>
            <HelpCircle size={13} color="#fbbf24" />
            Unclear Context
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (isoString) => {
    if (!isoString) return '';
    try {
      const dt = new Date(isoString);
      return dt.toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    } catch {
      return isoString;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', maxWidth: '1100px' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', margin: '0 0 0.5rem 0', color: '#fff', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Mail size={28} color="#a855f7" /> Pending Email Replies
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', margin: 0 }}>
            Automated intelligence identifying inbox messages requiring follow-up action.
          </p>
        </div>

        <button
          onClick={() => fetchPendingEmails(true)}
          disabled={refreshing || loading}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '10px',
            padding: '0.65rem 1.15rem',
            color: '#fff',
            fontWeight: '600',
            fontSize: '0.9rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            cursor: refreshing || loading ? 'wait' : 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => { if (!refreshing && !loading) e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
        >
          <RefreshCw size={16} style={{ animation: refreshing ? 'spin 1s linear infinite' : 'none' }} />
          {refreshing ? 'Syncing Inbox...' : 'Refresh Inbox'}
        </button>
      </div>

      {/* Success Notification Banner */}
      {successBanner && (
        <div style={{
          background: 'rgba(16, 185, 129, 0.12)',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '12px',
          padding: '1rem 1.25rem',
          color: '#34d399',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          fontSize: '0.95rem',
          fontWeight: '500'
        }}>
          <CheckCircle2 size={20} color="#34d399" />
          {successBanner}
        </div>
      )}

      {/* Google Account Not Connected Notice */}
      {!googleConnected && (
        <div style={{
          background: 'rgba(245, 158, 11, 0.08)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '16px',
          padding: '2rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '1.5rem'
        }}>
          <div style={{ maxWidth: '650px' }}>
            <h3 style={{ color: '#fbbf24', fontSize: '1.15rem', margin: '0 0 0.5rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertCircle size={20} color="#fbbf24" /> Google Account Connection Required
            </h3>
            <p style={{ color: 'rgba(255,255,255,0.7)', margin: 0, fontSize: '0.95rem', lineHeight: '1.5' }}>
              To analyze inbox threads and detect pending replies, please connect your Google / Gmail account in Settings.
            </p>
          </div>
          <button
            onClick={() => navigate('/settings')}
            style={{
              background: '#fbbf24', border: 'none', borderRadius: '8px',
              padding: '0.75rem 1.5rem', color: '#000', fontWeight: 'bold',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
            }}
          >
            <LinkIcon size={16} /> Go to Settings
          </button>
        </div>
      )}

      {googleConnected && (
        <>
          {/* Classification Filters */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
            {[
              { id: 'NEEDS_REPLY', label: 'Needs Reply', count: emails.filter(e => e.classification === 'NEEDS_REPLY').length },
              { id: 'NO_REPLY_NEEDED', label: 'No Reply Needed', count: emails.filter(e => e.classification === 'NO_REPLY_NEEDED').length },
              { id: 'UNCLEAR', label: 'Unclear', count: emails.filter(e => e.classification === 'UNCLEAR').length },
              { id: 'ALL', label: 'All Emails', count: emails.length },
            ].map(tab => {
              const isActive = activeFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveFilter(tab.id)}
                  style={{
                    background: isActive ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.03)',
                    border: isActive ? '1px solid rgba(168, 85, 247, 0.5)' : '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '0.55rem 1rem',
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.6)',
                    fontWeight: isActive ? '600' : '400',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s'
                  }}
                >
                  {tab.label}
                  <span style={{
                    background: isActive ? 'rgba(168, 85, 247, 0.4)' : 'rgba(255,255,255,0.1)',
                    padding: '2px 7px', borderRadius: '10px', fontSize: '0.75rem', color: '#fff'
                  }}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error Message */}
          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '12px', padding: '1.5rem', textAlign: 'center', color: '#fff'
            }}>
              <AlertCircle size={36} color="#ef4444" style={{ marginBottom: '0.5rem' }} />
              <h3 style={{ margin: '0 0 0.5rem 0' }}>Unable to fetch emails</h3>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1rem' }}>{error}</p>
              <button onClick={() => fetchPendingEmails()} style={{
                background: '#ef4444', border: 'none', borderRadius: '6px',
                padding: '0.5rem 1.25rem', color: '#fff', fontWeight: 'bold', cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: '0.5rem'
              }}>
                <RefreshCw size={14} /> Retry
              </button>
            </div>
          )}

          {/* Loading Skeleton */}
          {loading && !error && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {[1, 2, 3].map(i => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '12px', padding: '1.5rem', height: '110px', animation: 'pulse 1.5s infinite ease-in-out'
                }}></div>
              ))}
            </div>
          )}

          {/* Empty State */}
          {!loading && !error && filteredEmails.length === 0 && (
            <div style={{
              background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.15)',
              borderRadius: '16px', padding: '4rem 2rem', textAlign: 'center', color: '#fff'
            }}>
              <div style={{
                width: '64px', height: '64px', borderRadius: '50%', background: 'rgba(168, 85, 247, 0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.25rem auto'
              }}>
                <CheckCircle2 size={32} color="#a855f7" />
              </div>
              <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>No pending emails found</h3>
              <p style={{ color: 'rgba(255,255,255,0.6)', maxWidth: '450px', margin: '0 auto' }}>
                {activeFilter === 'NEEDS_REPLY' 
                  ? 'All clear! No pending emails require a reply at this time.' 
                  : `No emails match the selected filter (${activeFilter}).`}
              </p>
            </div>
          )}

          {/* Email Cards List */}
          {!loading && !error && filteredEmails.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {filteredEmails.map(email => {
                const isExpanded = expandedId === email.gmail_message_id;

                return (
                  <div
                    key={email.gmail_message_id}
                    style={{
                      background: 'rgba(255, 255, 255, 0.03)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '14px',
                      padding: '1.25rem 1.5rem',
                      backdropFilter: 'blur(10px)',
                      transition: 'border-color 0.2s, background 0.2s'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '280px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                          {getClassificationBadge(email.classification)}
                          <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                            <Clock size={12} /> {formatDate(email.received_at)}
                          </span>
                        </div>

                        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#fff', margin: '0.3rem 0' }}>
                          {email.subject || '(No Subject)'}
                        </h3>

                        <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                          From: <span style={{ color: 'rgba(255,255,255,0.95)', fontWeight: '500' }}>{email.sender}</span>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : email.gmail_message_id)}
                          style={{
                            background: 'transparent', border: '1px solid rgba(255,255,255,0.15)',
                            borderRadius: '8px', padding: '0.45rem 0.85rem', color: 'rgba(255,255,255,0.7)',
                            fontSize: '0.82rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem'
                          }}
                        >
                          {isExpanded ? 'Hide Details' : 'View Message'}
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>

                        <button
                          onClick={() => handleOpenReplyModal(email)}
                          style={{
                            background: 'linear-gradient(135deg, #a855f7, #6366f1)',
                            border: 'none', borderRadius: '8px', padding: '0.5rem 1.1rem',
                            color: '#fff', fontSize: '0.85rem', fontWeight: '600',
                            display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer',
                            boxShadow: '0 4px 14px rgba(168, 85, 247, 0.35)', transition: 'transform 0.15s'
                          }}
                          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                          onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                        >
                          <Sparkles size={15} /> Draft & Reply
                        </button>
                      </div>
                    </div>

                    {/* AI Reasoning Callout */}
                    <div style={{
                      background: 'rgba(168, 85, 247, 0.05)',
                      borderLeft: '3px solid #a855f7',
                      padding: '0.75rem 1rem',
                      borderRadius: '0 8px 8px 0',
                      marginTop: '0.5rem',
                      color: 'rgba(255,255,255,0.85)',
                      fontSize: '0.88rem'
                    }}>
                      <strong style={{ color: '#c084fc' }}>AI Reason: </strong> {email.reasoning}
                    </div>

                    {/* Expandable Body Text */}
                    {isExpanded && (
                      <div style={{
                        marginTop: '1rem',
                        paddingTop: '1rem',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                        color: 'rgba(255,255,255,0.75)',
                        fontSize: '0.9rem',
                        lineHeight: '1.6',
                        whiteSpace: 'pre-wrap',
                        maxHeight: '300px',
                        overflowY: 'auto',
                        background: 'rgba(0,0,0,0.2)',
                        padding: '1rem',
                        borderRadius: '8px'
                      }}>
                        {email.body_text || email.snippet || '(No body text available)'}
                      </div>
                    )}

                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* DRAFT REPLY & REVIEW MODAL */}
      {selectedEmail && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000, padding: '1rem'
        }}>
          <div style={{
            background: '#12131e', border: '1px solid rgba(255,255,255,0.15)',
            borderRadius: '16px', padding: '2rem', width: '100%', maxWidth: '680px',
            boxShadow: '0 25px 60px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '1.25rem',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 'bold', margin: 0, color: '#fff', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Sparkles size={20} color="#c084fc" /> Review & Send Reply
                </h2>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.85rem', marginTop: '4px' }}>
                  Replying to thread: {selectedEmail.subject}
                </div>
              </div>
              <button
                onClick={() => setSelectedEmail(null)}
                style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Custom Prompt / Instructions for AI */}
            <div style={{ background: 'rgba(168, 85, 247, 0.05)', border: '1px solid rgba(168, 85, 247, 0.2)', borderRadius: '10px', padding: '1rem' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', color: '#c084fc', marginBottom: '0.4rem', fontWeight: '600' }}>
                Optional Instructions for AI Drafter:
              </label>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <input
                  type="text"
                  placeholder="e.g. 'Tell them I am free on Tuesday after 2 PM'"
                  value={userInstructions}
                  onChange={(e) => setUserInstructions(e.target.value)}
                  style={{
                    flex: 1, padding: '0.6rem 0.85rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff',
                    fontSize: '0.88rem', outline: 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => generateDraft(selectedEmail.gmail_message_id, userInstructions)}
                  disabled={isGeneratingDraft}
                  style={{
                    background: 'rgba(168, 85, 247, 0.25)', border: '1px solid rgba(168, 85, 247, 0.5)',
                    borderRadius: '6px', padding: '0.6rem 1rem', color: '#fff', fontSize: '0.85rem',
                    fontWeight: '600', cursor: isGeneratingDraft ? 'wait' : 'pointer', display: 'flex',
                    alignItems: 'center', gap: '0.4rem', whitespace: 'nowrap'
                  }}
                >
                  <Sparkles size={14} /> {isGeneratingDraft ? 'Regenerating...' : 'Regenerate Draft'}
                </button>
              </div>
            </div>

            {/* Recipient & Subject fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.3rem' }}>
                  Recipient (To)
                </label>
                <input
                  type="text"
                  value={draftRecipient}
                  onChange={(e) => setDraftRecipient(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.3rem' }}>
                  Subject
                </label>
                <input
                  type="text"
                  value={draftSubject}
                  onChange={(e) => setDraftSubject(e.target.value)}
                  style={{
                    width: '100%', padding: '0.6rem 0.85rem', background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', color: '#fff',
                    fontSize: '0.9rem', outline: 'none', boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Draft Body Text Editor */}
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'rgba(255,255,255,0.6)', marginBottom: '0.4rem' }}>
                Email Reply Body (Editable)
              </label>
              {isGeneratingDraft ? (
                <div style={{
                  padding: '2rem', textAlign: 'center', background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: 'rgba(255,255,255,0.7)',
                  fontSize: '0.9rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem'
                }}>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  AI is drafting a contextual response...
                </div>
              ) : (
                <textarea
                  rows={8}
                  value={draftBody}
                  onChange={(e) => setDraftBody(e.target.value)}
                  placeholder="Draft body..."
                  style={{
                    width: '100%', padding: '0.85rem', background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: '8px', color: '#fff',
                    fontSize: '0.92rem', lineHeight: '1.6', outline: 'none', resize: 'vertical',
                    boxSizing: 'border-box', fontFamily: 'inherit'
                  }}
                />
              )}
            </div>

            {/* Modal Error */}
            {modalError && (
              <div style={{
                color: '#ef4444', fontSize: '0.85rem', background: 'rgba(239,68,68,0.1)',
                padding: '0.65rem 0.85rem', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.2)'
              }}>
                {modalError}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setSelectedEmail(null)}
                style={{
                  padding: '0.65rem 1.25rem', borderRadius: '8px', background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', fontWeight: '500', cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              
              <button
                type="button"
                onClick={handleSendReply}
                disabled={isSending || isGeneratingDraft || !draftBody.trim()}
                style={{
                  padding: '0.65rem 1.5rem', borderRadius: '8px',
                  background: 'linear-gradient(135deg, #10b981, #059669)',
                  border: 'none', color: '#fff', fontWeight: '600',
                  cursor: isSending || isGeneratingDraft ? 'wait' : 'pointer',
                  opacity: (isSending || isGeneratingDraft || !draftBody.trim()) ? 0.6 : 1,
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  boxShadow: '0 4px 14px rgba(16, 185, 129, 0.3)'
                }}
              >
                <Send size={16} /> {isSending ? 'Sending Email...' : 'Send Email Now'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default PendingReplies;
