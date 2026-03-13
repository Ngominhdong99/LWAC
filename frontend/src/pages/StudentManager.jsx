import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Users, Plus, Trash2, Edit3, X, Eye, ChevronDown, RefreshCw, Save } from 'lucide-react';
import API_URL from '../api';

const StudentManager = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ username: '', password: '', email: '', full_name: '' });
  const [expandedId, setExpandedId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [library, setLibrary] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningStudentId, setAssigningStudentId] = useState(null);
  const [viewingResult, setViewingResult] = useState(null);
  
  // Writing feedback state
  const [selectedText, setSelectedText] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');
  const [scoreInput, setScoreInput] = useState('');

  const fetchStudents = async () => {
    try {
      const res = await axios.get(`${API_URL}/coach/students`);
      setStudents(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const fetchLibrary = async () => {
    try {
      const res = await axios.get(`${API_URL}/coach/library`);
      setLibrary(res.data);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchStudents(); fetchLibrary(); }, []);

  const handleSave = async () => {
    try {
      if (editId) {
        const update = {};
        if (form.full_name) update.full_name = form.full_name;
        if (form.email) update.email = form.email;
        if (form.password) update.password = form.password;
        await axios.put(`${API_URL}/coach/students/${editId}`, update);
      } else {
        await axios.post(`${API_URL}/coach/students`, form);
      }
      setShowModal(false);
      setEditId(null);
      setForm({ username: '', password: '', email: '', full_name: '' });
      fetchStudents();
    } catch (e) {
      alert(e.response?.data?.detail || 'Error saving student');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this student?')) return;
    try {
      await axios.delete(`${API_URL}/coach/students/${id}`);
      fetchStudents();
    } catch (e) { alert('Error deleting student'); }
  };

  const handleEdit = (s) => {
    setEditId(s.id);
    setForm({ username: s.username, password: '', email: s.email, full_name: s.full_name });
    setShowModal(true);
  };

  const toggleAssignments = async (id) => {
    if (expandedId === id) { setExpandedId(null); return; }
    try {
      const res = await axios.get(`${API_URL}/coach/students/${id}/assignments`);
      setAssignments(res.data);
      setExpandedId(id);
    } catch (e) { console.error(e); }
  };

  const refreshAssignments = async (id) => {
    try {
      const res = await axios.get(`${API_URL}/coach/students/${id}/assignments`);
      setAssignments(res.data);
    } catch (e) { console.error(e); }
  };

  const handleAssignTest = async (lessonId) => {
    try {
      await axios.post(`${API_URL}/coach/students/${assigningStudentId}/assignments`, { lesson_id: lessonId });
      refreshAssignments(assigningStudentId); // refresh assignments without collapsing
    } catch (e) { alert('Error assigning test'); }
  };

  const handleDeleteAssignment = async (assignmentId) => {
    if (!confirm('Remove this assignment?')) return;
    try {
      await axios.delete(`${API_URL}/coach/assignments/${assignmentId}`);
      refreshAssignments(expandedId);
    } catch (e) { alert('Error removing assignment'); }
  };

  const handleToggleRetake = async (assignmentId) => {
    try {
      await axios.put(`${API_URL}/coach/assignments/${assignmentId}/toggle-retake`);
      refreshAssignments(expandedId);
    } catch (e) { alert('Error toggling retake'); }
  };

  const handleViewDetails = async (assignment) => {
    try {
      if (!assignment.result_id) {
        alert("This test has no valid result ID linked.");
        return;
      }
      const [lessonRes, resultRes] = await Promise.all([
        axios.get(`${API_URL}/lessons/${assignment.lesson_id}`),
        axios.get(`${API_URL}/coach/results/${assignment.result_id}`)
      ]);
      setViewingResult({
        assignment,
        lesson: lessonRes.data,
        result: resultRes.data
      });
      // Initialize scoring state for writing/speaking if un-graded
      setScoreInput(resultRes.data?.responses?.score || '');
    } catch (e) {
      alert('Error fetching detailed result');
      console.error(e);
    }
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.toString().length > 0) {
      setSelectedText(selection.toString());
    }
  };

  const handleSaveWritingFeedback = async () => {
    try {
      const currentResponses = viewingResult.result.responses || {};
      const newFeedback = {
          quote: selectedText,
          comment: feedbackComment,
          timestamp: new Date().toISOString()
      };
      
      const updatedFeedbackList = [...(currentResponses.feedback || []), newFeedback];
      
      const res = await axios.put(`${API_URL}/results/${viewingResult.result.id}`, {
          responses: {
              ...currentResponses,
              feedback: updatedFeedbackList,
              score: scoreInput !== '' ? Number(scoreInput) : currentResponses.score
          }
      });
      
      // Update local state to reflect changes without closing modal
      setViewingResult(prev => ({
          ...prev,
          result: res.data
      }));
      
      setSelectedText('');
      setFeedbackComment('');
    } catch (e) {
      alert("Failed to save feedback.");
      console.error(e);
    }
  };

  if (loading) return <div className="p-8 flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div></div>;

  return (
    <div className="p-6 pb-24 md:pb-6 space-y-6 max-w-5xl mx-auto">
      <header className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-800 tracking-tight">Student Manager</h1>
          <p className="text-slate-500 mt-1">{students.length} students enrolled</p>
        </div>
        <button onClick={() => { setEditId(null); setForm({ username: '', password: '', email: '', full_name: '' }); setShowModal(true); }}
          className="flex items-center space-x-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2.5 rounded-xl font-semibold shadow-md transition-colors">
          <Plus size={18} /><span>Add Student</span>
        </button>
      </header>

      {/* Students Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Student</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Email</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Tests</th>
                <th className="text-center px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Avg Score</th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody>
              {students.map(s => (
                <React.Fragment key={s.id}>
                  <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0" style={{ backgroundColor: s.avatar_color }}>
                          {(s.full_name || s.username)[0].toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800 text-sm">{s.full_name || s.username}</p>
                          <p className="text-xs text-slate-400">@{s.username}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">{s.email || '-'}</td>
                    <td className="px-5 py-4 text-center text-sm font-medium text-slate-700">{s.tests_completed}</td>
                    <td className="px-5 py-4 text-center">
                      <span className={`text-sm font-bold ${s.avg_score >= 70 ? 'text-green-600' : s.avg_score >= 50 ? 'text-amber-600' : 'text-slate-400'}`}>
                        {s.avg_score > 0 ? `${s.avg_score}%` : '-'}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <button onClick={() => toggleAssignments(s.id)} className="p-2 text-slate-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors" title="View Assignments">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => handleEdit(s)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Edit">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === s.id && (
                    <tr>
                      <td colSpan={5} className="bg-slate-50 px-5 py-4">
                        <div className="flex justify-between items-center mb-3">
                          <h4 className="font-semibold text-slate-700 text-sm">Assignments for {s.full_name}</h4>
                          <button onClick={() => { setAssigningStudentId(s.id); setShowAssignModal(true); }} className="text-xs font-semibold bg-white border border-slate-200 px-3 py-1 rounded-lg hover:bg-slate-100 flex items-center shadow-sm">
                            <Plus size={14} className="mr-1" /> Assign New Test
                          </button>
                        </div>
                        {assignments.length === 0 ? (
                          <p className="text-sm text-slate-400 text-center py-4 bg-white rounded-xl border border-slate-200">No assignments yet.</p>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                            {assignments.map(a => (
                              <div key={a.id} className="bg-white p-3 rounded-xl border border-slate-200 flex justify-between items-center">
                                <div>
                                  <p className="font-medium text-slate-800 text-sm truncate max-w-[150px]" title={a.lesson_title}>{a.lesson_title}</p>
                                  <p className="text-xs text-slate-400 capitalize">{a.lesson_type} • {a.status}</p>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {a.status === 'completed' ? (
                                    <div className="flex items-center space-x-2">
                                      <div 
                                        className="flex items-center space-x-2 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition-colors border border-transparent hover:border-slate-200" 
                                        title="View Details" 
                                        onClick={() => handleViewDetails(a)}
                                      >
                                        <span className={`text-lg font-bold ${a.score >= 70 ? 'text-green-600' : a.score >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
                                          {a.score}%
                                        </span>
                                        <Eye size={16} className="text-slate-400" />
                                      </div>
                                      <button 
                                        onClick={() => handleToggleRetake(a.id)}
                                        title={a.allow_retake ? 'Deny retake' : 'Allow retake'}
                                        className={`text-xs font-semibold px-2 py-1 rounded-full transition-colors ${
                                          a.allow_retake 
                                            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' 
                                            : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                                        }`}
                                      >
                                        <RefreshCw size={12} className="inline mr-0.5" />
                                        {a.allow_retake ? 'Deny' : 'Allow'}
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-semibold px-2 py-1 bg-slate-100 text-slate-500 rounded-full">Pending</span>
                                  )}
                                  <button onClick={() => handleDeleteAssignment(a.id)} className="text-slate-300 hover:text-red-500 p-1">
                                    <X size={14} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
        {students.length === 0 && <p className="text-slate-400 text-center py-12">No students yet. Click "Add Student" to create one.</p>}
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="text-xl font-bold text-slate-800">{editId ? 'Edit Student' : 'Add Student'}</h3>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            <div className="space-y-4">
              {!editId && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
                  <input value={form.username} onChange={e => setForm({...form, username: e.target.value})}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="username" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input value={form.full_name} onChange={e => setForm({...form, full_name: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="Nguyen Van A" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="email@example.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">{editId ? 'New Password (leave blank to keep)' : 'Password'}</label>
                <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})}
                  className="w-full px-4 py-2.5 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent" placeholder="••••••••" />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex-1 py-2.5 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold shadow-md transition-colors">
                {editId ? 'Save Changes' : 'Create Student'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Assign Test Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[80vh] flex flex-col">
            <div className="flex justify-between items-center mb-5 shrink-0">
              <h3 className="text-xl font-bold text-slate-800">Assign a Test</h3>
              <button onClick={() => setShowAssignModal(false)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            <div className="overflow-y-auto space-y-3 pr-2 flex-1">
              {library.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No tests available in library.</p>}
              {library.map(l => {
                const isAssigned = assignments.some(a => a.lesson_id === l.id);
                return (
                  <div key={l.id} className={`p-4 rounded-xl border border-slate-200 flex justify-between items-center ${isAssigned ? 'opacity-50 bg-slate-50' : 'bg-white hover:border-primary-300'}`}>
                    <div>
                      <p className="font-semibold text-slate-800">{l.title}</p>
                      <p className="text-xs text-slate-500 capitalize">{l.chapter} • {l.question_count} questions • {l.type}</p>
                    </div>
                    <button
                      onClick={() => !isAssigned && handleAssignTest(l.id)}
                      disabled={isAssigned}
                      className={`px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ${isAssigned ? 'bg-slate-200 text-slate-500 cursor-not-allowed' : 'bg-primary-100 text-primary-700 hover:bg-primary-200'}`}
                    >
                      {isAssigned ? 'Assigned' : 'Assign'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Result Details Modal */}
      {viewingResult && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center p-6 border-b border-slate-100 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800">Result Details</h3>
                <p className="text-sm text-slate-500">{viewingResult.assignment.lesson_title} - {viewingResult.assignment.score}%</p>
              </div>
              <button onClick={() => setViewingResult(null)} className="p-2 hover:bg-slate-100 rounded-full"><X size={18} /></button>
            </div>
            
            <div className="p-6 overflow-y-auto flex-1 bg-slate-50 space-y-4">
              {viewingResult.lesson.type === 'writing' ? (
                <div className="flex flex-col md:flex-row gap-6 h-full">
                  {/* Left: Prompt + AI Evaluation */}
                  <div className="flex-1 space-y-4 overflow-y-auto">
                    {/* Writing Prompt */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <div className="inline-flex items-center space-x-2 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-full text-sm font-semibold mb-4">
                        <span>Writing Prompt</span>
                      </div>
                      <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
                        <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">
                          {viewingResult.lesson.content?.prompt || viewingResult.lesson.passage || viewingResult.lesson.title}
                        </p>
                        {viewingResult.lesson.content?.tips?.length > 0 && (
                          <div className="mt-4 pt-3 border-t border-slate-200">
                            <ul className="list-disc list-inside text-sm text-slate-500 space-y-1">
                              {viewingResult.lesson.content.tips.map((t, i) => <li key={i}>{t}</li>)}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* AI Evaluation */}
                    {viewingResult.result.responses?.evaluation && (
                      <div className="bg-white p-6 rounded-xl border border-slate-200">
                        <h4 className="text-lg font-bold text-slate-900 mb-4 flex items-center">
                          <span className="bg-primary-500 w-2 h-5 rounded-full mr-3"></span>
                          AI Evaluation
                        </h4>
                        <div className="bg-gradient-to-br from-primary-50 to-teal-50 p-5 rounded-xl border border-primary-100 mb-4">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-primary-800 font-semibold uppercase text-sm tracking-wide">Estimated Band</span>
                            <span className="text-3xl font-black text-primary-600">
                              {viewingResult.result.responses.evaluation.estimated_band?.toFixed?.(1) || viewingResult.result.responses.evaluation.estimated_band || '-'}
                            </span>
                          </div>
                          <p className="text-slate-700 leading-relaxed text-sm">
                            {viewingResult.result.responses.evaluation.feedback}
                          </p>
                        </div>
                        {viewingResult.result.responses.evaluation.criteria_scores && (
                          <div className="grid grid-cols-2 gap-3">
                            {Object.entries(viewingResult.result.responses.evaluation.criteria_scores).map(([crit, score]) => (
                              <div key={crit} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                <span className="text-xs text-slate-500 font-medium uppercase tracking-wide">{crit}</span>
                                <p className="text-lg font-bold text-slate-800 mt-1">{typeof score === 'number' ? score.toFixed(1) : score}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Right: Student Essay + Coach Feedback */}
                  <div className="flex-1 space-y-4 overflow-y-auto">
                    {/* Student Essay */}
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-1">Student's Essay</h4>
                      <p className="text-sm text-slate-500 mb-4">Highlight text below to add specific comments.</p>
                      <div 
                        className="text-slate-700 whitespace-pre-wrap leading-relaxed selection:bg-yellow-200 bg-slate-50 p-4 rounded-lg border border-slate-100 min-h-[200px]"
                        onMouseUp={handleTextSelection}
                        onTouchEnd={handleTextSelection}
                      >
                        {viewingResult.result.responses?.user_essay || viewingResult.result.responses?.user_response || (typeof viewingResult.result.responses === 'string' ? viewingResult.result.responses : JSON.stringify(viewingResult.result.responses))}
                      </div>
                    </div>

                    {/* Coach Feedback */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-slate-800 mb-4 border-b pb-2">Coach Feedback</h4>
                      
                      {selectedText && (
                        <div className="mb-4 bg-yellow-50 p-3 rounded-lg border border-yellow-200 text-sm">
                          <p className="italic text-slate-600 mb-2">"{selectedText}"</p>
                          <textarea 
                            className="w-full px-3 py-2 border border-yellow-300 rounded focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                            placeholder="Add comment on this section..."
                            value={feedbackComment}
                            onChange={e => setFeedbackComment(e.target.value)}
                            rows={3}
                          />
                          <div className="flex gap-2 mt-2">
                            <button onClick={handleSaveWritingFeedback} className="flex-1 bg-primary-600 text-white py-1.5 rounded text-xs font-bold hover:bg-primary-700">Save Comment</button>
                            <button onClick={() => {setSelectedText(''); setFeedbackComment('');}} className="px-3 bg-slate-200 text-slate-700 py-1.5 rounded text-xs font-bold hover:bg-slate-300">Cancel</button>
                          </div>
                        </div>
                      )}

                      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                        {(viewingResult.result.responses?.feedback || []).map((fb, i) => (
                          <div key={i} className="bg-slate-50 p-3 rounded-lg text-sm border border-slate-100">
                            <p className="italic text-slate-500 mb-1 border-l-2 border-primary-300 pl-2">"{fb.quote}"</p>
                            <p className="text-slate-800 font-medium">{fb.comment}</p>
                          </div>
                        ))}
                        {(!viewingResult.result.responses?.feedback || viewingResult.result.responses.feedback.length === 0) && !selectedText && (
                          <p className="text-slate-400 text-center text-sm italic">No comments yet.</p>
                        )}
                      </div>
                    </div>

                    {/* Scoring */}
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
                      <span className="font-bold text-slate-700">Overall Score:</span>
                      <div className="flex items-center space-x-2">
                        <input 
                          type="number" max="100" min="0"
                          className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-primary-700 focus:ring-2 focus:ring-primary-500 outline-none" 
                          value={scoreInput}
                          onChange={e => setScoreInput(e.target.value)}
                          placeholder="%"
                        />
                        <button onClick={handleSaveWritingFeedback} className="bg-slate-800 hover:bg-slate-900 text-white p-1.5 rounded-lg transition-colors"><Save size={18} /></button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : viewingResult.lesson.type === 'speaking' ? (
                <div className="bg-white p-6 rounded-xl border border-slate-200">
                    <h4 className="font-bold text-slate-800 mb-4">Student's Audio Recording</h4>
                    {viewingResult.result.responses?.user_audio_url ? (
                        <div className="space-y-6">
                            <audio 
                                src={viewingResult.result.responses.user_audio_url.startsWith('/static') 
                                    ? `${API_URL}${viewingResult.result.responses.user_audio_url}` 
                                    : viewingResult.result.responses.user_audio_url} 
                                controls 
                                className="w-full" 
                            />
                            
                            {/* Scoring for Speaking */}
                            <div className="flex items-center justify-between border-t pt-4 mt-6">
                                <span className="font-bold text-slate-700">Overall Score:</span>
                                <div className="flex items-center space-x-2">
                                    <input 
                                        type="number" 
                                        max="100" 
                                        min="0"
                                        className="w-20 px-3 py-1.5 border border-slate-200 rounded-lg text-center font-bold text-primary-700 focus:ring-2 focus:ring-primary-500 outline-none" 
                                        value={scoreInput}
                                        onChange={e => setScoreInput(e.target.value)}
                                        placeholder="%"
                                    />
                                    <button onClick={handleSaveWritingFeedback} className="bg-slate-800 hover:bg-slate-900 text-white p-1.5 rounded-lg transition-colors"><Save size={18} /></button>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <p className="text-slate-500 italic">No audio recording found.</p>
                    )}
                </div>
              ) : (
                <>
                  {/* Passage for Reading / Listening */}
                  {(() => {
                    const content = viewingResult.lesson.content;
                    const passageText = content?.paragraphs 
                      ? content.paragraphs.map(p => p.text).join('\n\n')
                      : content?.passage || viewingResult.lesson.passage || null;
                    return passageText ? (
                      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                        <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide">
                          {viewingResult.lesson.type === 'listening' ? 'Transcript / Passage' : 'Reading Passage'}
                        </h4>
                        <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-sm bg-slate-50 p-4 rounded-lg border border-slate-100">{passageText}</p>
                      </div>
                    ) : null;
                  })()}

                  {/* Audio for Listening */}
                  {(viewingResult.lesson.media_url || viewingResult.lesson.audio_url) && (
                    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                      <h4 className="font-bold text-slate-800 mb-3 text-sm uppercase tracking-wide">Audio</h4>
                      <audio 
                        src={(() => {
                          const url = viewingResult.lesson.media_url || viewingResult.lesson.audio_url;
                          return url.startsWith('/static') ? `${API_URL}${url}` : url;
                        })()}
                        controls className="w-full" 
                      />
                    </div>
                  )}
                {viewingResult.lesson.questions?.map((q, idx) => {
                  const studentAns = viewingResult.result.responses?.[q.id];
                  let isCorrect = false;
                  
                  if (q.type === 'multiple_choice') {
                    isCorrect = studentAns === q.correct_answer;
                  } else if (q.type === 'fill_blank') {
                    isCorrect = (studentAns || '').trim().toLowerCase() === q.correct_answer.toLowerCase();
                  }

                  return (
                    <div key={q.id} className={`bg-white p-5 rounded-xl border-l-4 border-y border-r border-y-slate-200 border-r-slate-200 shadow-sm ${isCorrect ? 'border-l-green-500' : 'border-l-red-500'}`}>
                      <p className="font-semibold text-slate-800 mb-4 flex items-start leading-relaxed">
                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs mr-3 mt-0.5 flex-shrink-0 text-white ${isCorrect ? 'bg-green-500' : 'bg-red-500'}`}>
                          {idx + 1}
                        </span>
                        {q.question_text}
                      </p>
                      
                      <div className="pl-9 space-y-2 text-sm">
                        {q.type === 'multiple_choice' && q.options ? (
                          Object.entries(q.options).map(([key, value]) => {
                            const isChosenByStudent = studentAns === key;
                            const isTheCorrectAnswer = key === q.correct_answer;
                            
                            let boxClass = 'bg-slate-50 border-transparent text-slate-600';
                            if (isChosenByStudent && isTheCorrectAnswer) {
                                boxClass = 'bg-green-50 border-green-200 text-green-800';
                            } else if (isChosenByStudent && !isTheCorrectAnswer) {
                                boxClass = 'bg-red-50 border-red-200 text-red-800 line-through opacity-70';
                            } else if (isTheCorrectAnswer) {
                                boxClass = 'bg-green-50 border-green-200 text-green-800 right-answer';
                            }

                            return (
                             <div key={key} className={`p-3 rounded-lg border flex items-center ${boxClass}`}>
                               <span className="font-bold w-6 shrink-0">{key}.</span> 
                               <span>{value}</span>
                               {isChosenByStudent && <span className="ml-auto font-bold tracking-wide italic text-xs uppercase opacity-60">Student</span>}
                               {isTheCorrectAnswer && !isChosenByStudent && <span className="ml-auto font-bold tracking-wide italic text-xs uppercase opacity-60">Correct</span>}
                             </div>
                            );
                          })
                        ) : (
                          <div className="space-y-3">
                            <div className={`p-4 rounded-xl border ${isCorrect ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}>
                              <span className="block text-xs uppercase tracking-wider font-bold opacity-60 mb-1">Student's Answer</span>
                              <span className="font-medium text-base">{studentAns || <span className="text-slate-400 italic font-normal">No answer provided</span>}</span>
                            </div>
                            {!isCorrect && (
                              <div className="p-4 rounded-xl border bg-green-50 border-green-200 text-green-800">
                                <span className="block text-xs uppercase tracking-wider font-bold opacity-60 mb-1">Correct Answer</span>
                                <span className="font-medium text-base">{q.correct_answer}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
                }
                </>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default StudentManager;
