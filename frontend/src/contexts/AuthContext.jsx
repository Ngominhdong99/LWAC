import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('lwac_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.get(`http://127.0.0.1:8000/auth/me?token=${token}`)
        .then(res => { setUser(res.data); setLoading(false); })
        .catch(() => { logout(); setLoading(false); });
    } else {
      setLoading(false);
    }
  }, [token]);

  const login = async (username, password) => {
    const res = await axios.post('http://127.0.0.1:8000/auth/login', { username, password });
    const { token: newToken, user: userData } = res.data;
    localStorage.setItem('lwac_token', newToken);
    setToken(newToken);
    setUser(userData);
    return userData;
  };

  const logout = () => {
    localStorage.removeItem('lwac_token');
    setToken(null);
    setUser(null);
  };

  const isCoach = user?.role === 'coach';
  const isStudent = user?.role === 'student';

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isCoach, isStudent }}>
      {children}
    </AuthContext.Provider>
  );
};
