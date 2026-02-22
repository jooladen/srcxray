export interface SampleCode {
  id: string;
  emoji: string;
  title: string;
  desc: string;
  code: string;
}

export const SAMPLES: SampleCode[] = [
  {
    id: 'login',
    emoji: '🔐',
    title: '로그인 폼',
    desc: 'useState + form',
    code: `'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoginFormData {
  email: string;
  password: string;
}

export default function LoginForm() {
  const router = useRouter();
  const [formData, setFormData] = useState<LoginFormData>({ email: '', password: '' });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      setError('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || '로그인에 실패했습니다.');
      }

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">로그인</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              placeholder="hello@example.com"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="비밀번호 입력"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-blue-600 text-white font-semibold py-2.5 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isLoading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}`,
  },
  {
    id: 'todo',
    emoji: '📋',
    title: '할일 목록',
    desc: 'useEffect + map',
    code: `'use client';

import { useState, useEffect, useCallback } from 'react';

interface Todo {
  id: number;
  text: string;
  done: boolean;
  createdAt: string;
}

type Filter = 'all' | 'active' | 'done';

export default function TodoApp() {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem('my-todos');
    if (saved) {
      try {
        setTodos(JSON.parse(saved));
      } catch {
        setTodos([]);
      }
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (!isLoading) {
      localStorage.setItem('my-todos', JSON.stringify(todos));
    }
  }, [todos, isLoading]);

  const addTodo = useCallback(() => {
    const text = input.trim();
    if (!text) return;
    setTodos(prev => [
      ...prev,
      { id: Date.now(), text, done: false, createdAt: new Date().toISOString() },
    ]);
    setInput('');
  }, [input]);

  const toggleTodo = useCallback((id: number) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }, []);

  const deleteTodo = useCallback((id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  }, []);

  const filtered = todos.filter(t => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const doneCount = todos.filter(t => t.done).length;

  if (isLoading) return <div className="text-center py-12">로딩 중...</div>;

  return (
    <div className="max-w-lg mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">할일 목록</h1>
        <span className="text-sm text-gray-500">{doneCount}/{todos.length} 완료</span>
      </div>

      <div className="flex gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="할일 입력 후 Enter"
          className="flex-1 border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button onClick={addTodo} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700">
          추가
        </button>
      </div>

      <div className="flex gap-1">
        {(['all', 'active', 'done'] as Filter[]).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={\`px-3 py-1 rounded-full text-sm font-medium transition-colors \${
              filter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }\`}
          >
            {f === 'all' ? '전체' : f === 'active' ? '진행중' : '완료'}
          </button>
        ))}
      </div>

      <ul className="space-y-2">
        {filtered.map(todo => (
          <li key={todo.id} className="flex items-center gap-3 bg-white border rounded-xl p-3 group">
            <input
              type="checkbox"
              checked={todo.done}
              onChange={() => toggleTodo(todo.id)}
              className="w-4 h-4 accent-blue-600"
            />
            <span className={\`flex-1 text-sm \${todo.done ? 'line-through text-gray-400' : 'text-gray-800'}\`}>
              {todo.text}
            </span>
            <button
              onClick={() => deleteTodo(todo.id)}
              className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              ✕
            </button>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-center text-gray-400 py-8 text-sm">
            {filter === 'done' ? '완료한 항목이 없어요' : '할일을 추가해보세요!'}
          </li>
        )}
      </ul>
    </div>
  );
}`,
  },
  {
    id: 'product',
    emoji: '🛒',
    title: '상품 카드',
    desc: 'props + 조건부',
    code: `'use client';

import { useState } from 'react';

interface Product {
  id: number;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating: number;
  reviewCount: number;
  stock: number;
  tags: string[];
  isNew?: boolean;
}

interface ProductCardProps {
  product: Product;
  onAddToCart: (product: Product, quantity: number) => void;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(star => (
        <span key={star} className={star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-300'}>
          ★
        </span>
      ))}
    </div>
  );
}

export function ProductCard({ product, onAddToCart }: ProductCardProps) {
  const [quantity, setQuantity] = useState(1);
  const [isWished, setIsWished] = useState(false);
  const [addedToCart, setAddedToCart] = useState(false);

  const discountRate = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const isOutOfStock = product.stock === 0;
  const isLowStock = product.stock > 0 && product.stock <= 3;

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    onAddToCart(product, quantity);
    setAddedToCart(true);
    setTimeout(() => setAddedToCart(false), 2000);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="relative">
        <img src={product.image} alt={product.name} className="w-full h-48 object-cover" />
        {product.isNew && (
          <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full">
            NEW
          </span>
        )}
        {discountRate > 0 && (
          <span className="absolute top-2 right-12 bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            -{discountRate}%
          </span>
        )}
        <button
          onClick={() => setIsWished(prev => !prev)}
          className="absolute top-2 right-2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow"
        >
          {isWished ? '❤️' : '🤍'}
        </button>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex flex-wrap gap-1">
          {product.tags.map(tag => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>

        <h3 className="font-semibold text-gray-800 leading-snug">{product.name}</h3>

        <div className="flex items-center gap-2">
          <StarRating rating={product.rating} />
          <span className="text-sm text-gray-500">({product.reviewCount})</span>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-xl font-black text-gray-900">{product.price.toLocaleString()}원</span>
          {product.originalPrice && (
            <span className="text-sm text-gray-400 line-through">{product.originalPrice.toLocaleString()}원</span>
          )}
        </div>

        {isLowStock && (
          <p className="text-xs text-orange-600 font-semibold">⚠️ 재고 {product.stock}개 남음</p>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button
              onClick={() => setQuantity(q => Math.max(1, q - 1))}
              className="px-3 py-1.5 hover:bg-gray-100 text-gray-600"
            >
              −
            </button>
            <span className="px-3 py-1.5 text-sm font-medium">{quantity}</span>
            <button
              onClick={() => setQuantity(q => Math.min(product.stock, q + 1))}
              disabled={isOutOfStock}
              className="px-3 py-1.5 hover:bg-gray-100 text-gray-600 disabled:opacity-40"
            >
              +
            </button>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={\`flex-1 py-2 rounded-lg font-semibold text-sm transition-colors \${
              isOutOfStock
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                : addedToCart
                ? 'bg-green-600 text-white'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }\`}
          >
            {isOutOfStock ? '품절' : addedToCart ? '✓ 담겼어요!' : '장바구니 담기'}
          </button>
        </div>
      </div>
    </div>
  );
}`,
  },
];
