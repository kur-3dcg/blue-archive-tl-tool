import { useState, useRef, useEffect, useCallback } from 'react';
import type { Character } from '../../types';

const FAVORITES_KEY = 'ba-tl-favorites';

function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(FAVORITES_KEY);
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const toggleFavorite = useCallback((name: string) => {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]));
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  return [favorites, toggleFavorite] as const;
}

interface Props {
  characters: Character[];
  onSelect: (character: Character) => void;
  onClose: () => void;
}

export function CharacterSearch({ characters, onSelect, onClose }: Props) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const [favorites, toggleFavorite] = useFavorites();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = filter
    ? characters.filter((c) => c.name.includes(filter) || (c.reading && c.reading.includes(filter)))
    : characters;

  // お気に入りを先頭に、それ以外は元の順序を維持
  const sorted = [
    ...filtered.filter((c) => favorites.has(c.name)),
    ...filtered.filter((c) => !favorites.has(c.name)),
  ];

  return (
    <div className="character-search-overlay" onClick={onClose}>
      <div
        className="character-search"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          type="text"
          placeholder="生徒名で検索..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="character-search-input"
        />
        <div className="character-search-list">
          {sorted.map((c) => (
            <button
              key={c.name}
              className="character-search-item"
              onClick={() => onSelect(c)}
            >
              <img src={c.image} alt={c.name} width={40} height={40} />
              <span className="character-search-name">{c.name}</span>
              <button
                className={`character-search-fav${favorites.has(c.name) ? ' active' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFavorite(c.name);
                }}
                title={favorites.has(c.name) ? 'お気に入り解除' : 'お気に入り登録'}
              >
                ★
              </button>
            </button>
          ))}
          {sorted.length === 0 && (
            <div className="character-search-empty">該当なし</div>
          )}
        </div>
      </div>
    </div>
  );
}
