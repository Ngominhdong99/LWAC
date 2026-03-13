import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Gift, Star, Upload, ArrowRight, Clock, CheckCircle, Trophy, Coins, Flame, CalendarCheck } from 'lucide-react';

const StudentReward = () => {
  const { user } = useAuth();
  const [balance, setBalance] = useState({ total_earned: 0, total_redeemed: 0, balance: 0 });
  const [history, setHistory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [qrUrl, setQrUrl] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [redeeming, setRedeeming] = useState(false);
  const [checkin, setCheckin] = useState({ checked_today: false, streak: 0, total_checkins: 0, last_7_days: [] });
  const [checkingIn, setCheckingIn] = useState(false);
  const fileRef = useRef(null);

  const fetchData = async () => {
    if (!user) return;
    try {
      const [balRes, histRes, reqRes, qrRes, ciRes] = await Promise.all([
        axios.get(`http://127.0.0.1:8000/rewards/points/${user.id}`),
        axios.get(`http://127.0.0.1:8000/rewards/history/${user.id}`),
        axios.get(`http://127.0.0.1:8000/rewards/my-requests/${user.id}`),
        axios.get(`http://127.0.0.1:8000/rewards/qr/${user.id}`),
        axios.get(`http://127.0.0.1:8000/rewards/checkin/${user.id}`),
      ]);
      setBalance(balRes.data);
      setHistory(histRes.data);
      setRequests(reqRes.data);
      if (qrRes.data.qr_url) setQrUrl(qrRes.data.qr_url);
      setCheckin(ciRes.data);
    } catch (e) { console.error(e); }
  };

  const handleCheckIn = async () => {
    setCheckingIn(true);
    try {
      await axios.post(`http://127.0.0.1:8000/rewards/checkin/${user.id}`);
      await fetchData();
    } catch (e) { alert(e.response?.data?.detail || 'Check-in failed'); }
    finally { setCheckingIn(false); }
  };

  useEffect(() => { fetchData(); }, [user]);

  const handleUploadQR = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(`http://127.0.0.1:8000/rewards/qr/${user.id}`, formData);
      setQrUrl(res.data.qr_url);
    } catch (e) { alert('Upload failed'); }
    finally { setUploading(false); }
  };

  const handleRedeem = async () => {
    if (balance.balance < 100) return alert('Not enough points! Need at least 100.');
    if (!qrUrl) return alert('Please upload your QR code first!');
    setRedeeming(true);
    try {
      const fullQrUrl = qrUrl.startsWith('/static') ? `http://127.0.0.1:8000${qrUrl}` : qrUrl;
      await axios.post(`http://127.0.0.1:8000/rewards/redeem/${user.id}?qr_url=${encodeURIComponent(fullQrUrl)}`);
      await fetchData();
    } catch (e) { alert(e.response?.data?.detail || 'Redemption failed'); }
    finally { setRedeeming(false); }
  };

  const typeIcon = (type) => {
    if (type === 'reading') return '📖';
    if (type === 'listening') return '🎧';
    if (type === 'writing') return '✍️';
    if (type === 'speaking') return '🎤';
    return '📝';
  };

  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-3">
        <div className="bg-gradient-to-br from-amber-400 to-orange-500 p-3 rounded-2xl shadow-lg">
          <Trophy className="text-white" size={28} />
        </div>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-slate-800">Rewards</h1>
          <p className="text-sm text-slate-500">Earn points, redeem rewards!</p>
        </div>
      </div>

      {/* Daily Check-In */}
      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-yellow-50 p-6 rounded-2xl border border-amber-200 shadow-sm">
        <div className="flex flex-col md:flex-row items-center gap-6">
          {/* Streak */}
          <div className="flex flex-col items-center">
            <div className="relative">
              <Flame size={48} className={`${checkin.streak > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
              {checkin.streak > 0 && (
                <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs font-black rounded-full w-6 h-6 flex items-center justify-center">
                  {checkin.streak}
                </span>
              )}
            </div>
            <p className="text-lg font-black text-slate-800 mt-1">{checkin.streak} day{checkin.streak !== 1 ? 's' : ''}</p>
            <p className="text-xs text-slate-500">streak</p>
          </div>

          {/* 7-day Calendar */}
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-700 mb-3">Last 7 days</p>
            <div className="flex gap-2 justify-center md:justify-start">
              {checkin.last_7_days.map((d, i) => {
                const dayName = DAYS[new Date(d.date + 'T00:00:00').getDay()];
                const isToday = d.date === new Date().toISOString().slice(0, 10);
                return (
                  <div key={d.date} className="flex flex-col items-center space-y-1.5">
                    <span className="text-[10px] text-slate-500 font-medium">{dayName}</span>
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
                      d.checked 
                        ? 'bg-green-500 text-white shadow-md shadow-green-200' 
                        : isToday ? 'bg-white border-2 border-amber-400 text-amber-600' : 'bg-white border border-slate-200 text-slate-400'
                    }`}>
                      {d.checked ? '✓' : new Date(d.date + 'T00:00:00').getDate()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Check-In Button */}
          <div className="flex flex-col items-center">
            <button
              onClick={handleCheckIn}
              disabled={checkin.checked_today || checkingIn}
              className={`px-8 py-3 rounded-xl font-bold text-sm flex items-center space-x-2 transition-all ${
                checkin.checked_today
                  ? 'bg-green-100 text-green-700 cursor-default'
                  : 'bg-gradient-to-r from-orange-500 to-amber-500 text-white hover:from-orange-600 hover:to-amber-600 shadow-lg hover:shadow-xl hover:scale-105 active:scale-95'
              }`}
            >
              {checkin.checked_today ? (
                <><CheckCircle size={18} /><span>Checked In ✓</span></>
              ) : (
                <><CalendarCheck size={18} /><span>{checkingIn ? 'Checking...' : 'Check In (+5 pts)'}</span></>
              )}
            </button>
            <p className="text-xs text-slate-500 mt-2">{checkin.total_checkins} total check-ins</p>
          </div>
        </div>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-primary-500 to-teal-600 p-6 rounded-2xl text-white shadow-lg">
          <p className="text-sm opacity-80 font-medium">Available Balance</p>
          <p className="text-4xl font-black mt-1">{balance.balance}</p>
          <p className="text-xs opacity-70 mt-1">points</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Total Earned</p>
          <p className="text-3xl font-bold text-green-600 mt-1">{balance.total_earned}</p>
          <p className="text-xs text-slate-400 mt-1">lifetime points</p>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-sm text-slate-500 font-medium">Total Redeemed</p>
          <p className="text-3xl font-bold text-amber-600 mt-1">{balance.total_redeemed}</p>
          <p className="text-xs text-slate-400 mt-1">points used</p>
        </div>
      </div>

      {/* Redeem Section */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
          <Gift size={20} className="text-amber-500" />
          <span>Redeem Reward</span>
        </h2>
        <div className="flex flex-col md:flex-row gap-6">
          {/* QR Upload */}
          <div className="flex-1">
            <p className="text-sm text-slate-600 mb-3">Upload your bank QR code so coach can transfer your reward:</p>
            <div className="border-2 border-dashed border-slate-200 rounded-xl p-4 text-center">
              {qrUrl ? (
                <div className="space-y-3">
                  <img 
                    src={qrUrl.startsWith('/static') ? `http://127.0.0.1:8000${qrUrl}` : qrUrl} 
                    alt="Your QR Code" 
                    className="max-h-40 mx-auto rounded-lg shadow"
                  />
                  <button 
                    onClick={() => fileRef.current?.click()}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    Upload new QR
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => fileRef.current?.click()}
                  className="flex flex-col items-center space-y-2 py-4 w-full text-slate-400 hover:text-primary-500 transition-colors"
                >
                  <Upload size={32} />
                  <span className="text-sm font-medium">{uploading ? 'Uploading...' : 'Upload QR Code'}</span>
                </button>
              )}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleUploadQR} />
            </div>
          </div>

          {/* Redeem Button */}
          <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border border-amber-100">
            <Coins size={40} className="text-amber-500 mb-3" />
            <p className="text-2xl font-black text-slate-800">100 pts</p>
            <p className="text-sm text-slate-500 mb-4">per redemption</p>
            <button
              onClick={handleRedeem}
              disabled={redeeming || balance.balance < 100}
              className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 transition-all ${
                balance.balance >= 100 
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white hover:from-amber-600 hover:to-orange-600 shadow-lg hover:shadow-xl' 
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Gift size={16} />
              <span>{redeeming ? 'Processing...' : balance.balance >= 100 ? 'Redeem Now' : `Need ${100 - balance.balance} more pts`}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Redemption Requests */}
      {requests.length > 0 && (
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h2 className="text-lg font-bold text-slate-800 mb-4">My Requests</h2>
          <div className="space-y-3">
            {requests.map(r => (
              <div key={r.id} className={`flex items-center justify-between px-4 py-3 rounded-xl border ${r.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
                <div className="flex items-center space-x-3">
                  {r.status === 'completed' ? <CheckCircle size={18} className="text-green-500" /> : <Clock size={18} className="text-amber-500" />}
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{r.points} points</p>
                    <p className="text-xs text-slate-500">{new Date(r.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-xs font-bold px-3 py-1 rounded-full ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {r.status === 'completed' ? 'Completed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Points History */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center space-x-2">
          <Star size={20} className="text-amber-500" />
          <span>Points History</span>
        </h2>
        {history.length === 0 ? (
          <p className="text-center text-slate-400 py-8 italic">No points yet. Complete some tests to earn!</p>
        ) : (
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.id} className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-slate-50 transition-colors border border-slate-100">
                <div className="flex items-center space-x-3">
                  <span className="text-xl">{typeIcon(h.lesson_type)}</span>
                  <div>
                    <p className="font-semibold text-sm text-slate-800">{h.lesson_title}</p>
                    <p className="text-xs text-slate-500">{h.reason}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">+{h.points}</p>
                  <p className="text-xs text-slate-400">{new Date(h.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Points Guide */}
      <div className="bg-gradient-to-r from-primary-50 to-teal-50 p-6 rounded-2xl border border-primary-100">
        <h3 className="font-bold text-primary-800 mb-3">How to earn points</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div className="flex items-center space-x-3 text-slate-700">
            <span className="bg-white px-2 py-1 rounded-lg font-bold text-primary-600 shadow-sm">+2</span>
            <span>Per correct answer (Reading & Listening)</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-700">
            <span className="bg-white px-2 py-1 rounded-lg font-bold text-primary-600 shadow-sm">+5</span>
            <span>Per submission (Writing & Speaking)</span>
          </div>
          <div className="flex items-center space-x-3 text-slate-700">
            <span className="bg-white px-2 py-1 rounded-lg font-bold text-orange-500 shadow-sm">+5</span>
            <span>Daily check-in</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentReward;
