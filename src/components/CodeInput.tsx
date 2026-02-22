'use client';

import { useRef, useState } from 'react';

interface Props {
  onAnalyze: (code: string, fileName: string) => void;
  isLoading: boolean;
}

const SAMPLE_CODE = `import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { fetchUsers } from '@/lib/api';

interface User {
  id: number;
  name: string;
  email: string;
}

interface UserListProps {
  title?: string;
  maxItems?: number;
}

export default function UserList({ title = '사용자 목록', maxItems = 10 }: UserListProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    setLoading(true);
    fetchUsers().then(data => {
      setUsers(data.slice(0, maxItems));
      setLoading(false);
    });
  }, [maxItems]);

  const filtered = users.filter(u =>
    u.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="검색..."
        className="border p-2 mt-2 w-full"
      />
      {loading ? (
        <p>로딩 중...</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {filtered.map(user => (
            <li key={user.id} className="border rounded p-3">
              <strong>{user.name}</strong>
              <span className="text-gray-500 ml-2">{user.email}</span>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={() => setSearch('')}>초기화</Button>
    </div>
  );
}`;

export default function CodeInput({ onAnalyze, isLoading }: Props) {
  const [code, setCode] = useState('');
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.match(/\.(tsx?|jsx?)$/)) {
      alert('TSX, TypeScript, JSX 파일만 지원합니다.');
      return;
    }
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = e => setCode(e.target?.result as string ?? '');
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const loadSample = () => {
    setCode(SAMPLE_CODE);
    setFileName('UserList.tsx (샘플)');
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Drop zone */}
      <div
        className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
          ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-gray-50'}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
      >
        <div className="text-4xl mb-2">📁</div>
        <p className="text-gray-600 font-medium">TSX 파일을 드래그하거나 클릭해서 업로드</p>
        <p className="text-gray-400 text-sm mt-1">.tsx .ts .jsx .js 지원</p>
        <input
          ref={fileRef}
          type="file"
          accept=".tsx,.ts,.jsx,.js"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {/* File name indicator */}
      {fileName && (
        <div className="flex items-center gap-2 text-sm bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
          <span className="text-blue-600">📄</span>
          <span className="font-mono text-blue-700">{fileName}</span>
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={code}
          onChange={e => setCode(e.target.value)}
          placeholder="또는 TSX 코드를 여기에 직접 붙여넣기 (Ctrl+V)..."
          className="w-full h-56 p-4 border rounded-xl font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-950 text-green-400 placeholder-gray-600"
          spellCheck={false}
        />
        {code && (
          <span className="absolute bottom-2 right-3 text-xs text-gray-500">
            {code.split('\n').length}줄
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => code.trim() && onAnalyze(code, fileName || 'code.tsx')}
          disabled={!code.trim() || isLoading}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-bold rounded-xl transition-colors text-lg"
        >
          {isLoading ? '분석 중...' : '🔍 분석 시작'}
        </button>
        <button
          onClick={loadSample}
          className="px-5 py-3 border-2 border-gray-300 hover:border-blue-400 text-gray-600 hover:text-blue-600 font-medium rounded-xl transition-colors"
        >
          샘플 코드
        </button>
        {code && (
          <button
            onClick={() => { setCode(''); setFileName(''); }}
            className="px-5 py-3 border-2 border-red-200 hover:border-red-400 text-red-500 font-medium rounded-xl transition-colors"
          >
            지우기
          </button>
        )}
      </div>
    </div>
  );
}
