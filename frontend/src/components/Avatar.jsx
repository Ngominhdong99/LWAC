import React from 'react';
import API_URL from '../api';

const Avatar = ({ user, size = 'md', className = '' }) => {
  if (!user) return null;
  const isUrl = (str) => typeof str === 'string' && (str.startsWith('http') || str.startsWith('/'));
  const getAvatarUrl = (str) => str?.startsWith('/static') ? `${API_URL}${str}` : str;

  const color = user.avatar_color || '#0d9488';
  const initial = (user.full_name || user.username || 'U')[0].toUpperCase();

  const sizeClasses = {
    xs: 'w-6 h-6 text-[10px]',
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-20 h-20 text-2xl',
    '2xl': 'w-24 h-24 text-3xl'
  };

  const sz = sizeClasses[size] || sizeClasses.md;

  if (isUrl(color)) {
    return <img src={getAvatarUrl(color)} alt="Avatar" className={`rounded-full object-cover shrink-0 ${sz} ${className}`} />;
  }

  return (
    <div 
      className={`rounded-full flex items-center justify-center text-white font-bold shrink-0 shadow-sm ${sz} ${className}`}
      style={{ backgroundColor: color }}
    >
      {initial}
    </div>
  );
};

export default Avatar;
