import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Trophy, CheckCircle, Clock, ExternalLink, User } from 'lucide-react';
import API_URL from '../api';

const CoachReward = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchRequests = async () => {
    try {
      const res = await axios.get(`${API_URL}/rewards/requests`);
      setRequests(res.data);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleComplete = async (id) => {
    if (!confirm('Mark this request as completed? (Payment has been sent)')) return;
    try {
      await axios.put(`${API_URL}/rewards/requests/${id}/complete`);
      fetchRequests();
    } catch (e) { alert('Failed to complete request'); }
  };

  const pending = requests.filter(r => r.status === 'pending');
  const completed = requests.filter(r => r.status === 'completed');

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg">
          <Trophy className="text-white" size={28} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Reward Requests</h1>
          <p className="text-sm text-slate-500">Manage student reward redemptions</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-amber-50 p-5 rounded-2xl border border-amber-200">
          <p className="text-sm text-amber-700 font-semibold">Pending</p>
          <p className="text-3xl font-black text-amber-600">{pending.length}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-2xl border border-green-200">
          <p className="text-sm text-green-700 font-semibold">Completed</p>
          <p className="text-3xl font-black text-green-600">{completed.length}</p>
        </div>
      </div>

      {/* Pending Requests */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
          <Clock size={20} className="text-amber-500" />
          <span>Pending Requests</span>
        </h2>
        {pending.length === 0 ? (
          <p className="text-center text-slate-400 py-8 italic">No pending requests</p>
        ) : (
          <div className="space-y-4">
            {pending.map(r => (
              <div key={r.id} className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm"
                      style={{ backgroundColor: r.avatar_color || '#0d9488' }}>
                      {(r.full_name || r.username || 'U')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{r.full_name || r.username}</p>
                      <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                  <span className="bg-amber-100 text-amber-700 text-sm font-bold px-3 py-1 rounded-full">
                    {r.points} pts
                  </span>
                </div>

                {/* QR Code */}
                {r.qr_image_url && (
                  <div className="mb-3 bg-white p-3 rounded-lg border border-amber-100 text-center">
                    <p className="text-xs text-slate-500 mb-2 font-medium">Student's Bank QR Code — Scan to transfer</p>
                    <img 
                      src={r.qr_image_url.startsWith('/static') ? `${API_URL}${r.qr_image_url}` : r.qr_image_url}
                      alt="QR Code"
                      className="max-h-48 mx-auto rounded-lg shadow"
                    />
                  </div>
                )}

                <button
                  onClick={() => handleComplete(r.id)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl transition-colors flex items-center justify-center space-x-2"
                >
                  <CheckCircle size={16} />
                  <span>Mark as Completed</span>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Completed Requests */}
      {completed.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
            <CheckCircle size={20} className="text-green-500" />
            <span>Completed ({completed.length})</span>
          </h2>
          <div className="space-y-2">
            {completed.map(r => (
              <div key={r.id} className="flex items-center justify-between px-4 py-3 rounded-xl bg-green-50 border border-green-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs"
                    style={{ backgroundColor: r.avatar_color || '#0d9488' }}>
                    {(r.full_name || r.username || 'U')[0].toUpperCase()}
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{r.full_name || r.username}</p>
                    <p className="text-xs text-slate-500">{r.points} pts • {new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className="text-xs font-bold text-green-600">✓ Done</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CoachReward;
