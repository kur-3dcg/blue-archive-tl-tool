import { useState, useRef, useEffect } from 'react';
import type { Character } from '../../types';

interface Props {
  characters: Character[];
  onSelect: (character: Character) => void;
  onClose: () => void;
}

export function CharacterSearch({ characters, onSelect, onClose }: Props) {
  const [filter, setFilter] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const filtered = filter
    ? characters.filter((c) => c.name.includes(filter))
    : characters;

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
          {filtered.map((c) => (
            <button
              key={c.name}
              className="character-search-item"
              onClick={() => onSelect(c)}
            >
              <img src={c.image} alt={c.name} width={40} height={40} />
              <span>{c.name}</span>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="character-search-empty">該当なし</div>
          )}
        </div>
      </div>
    </div>
  );
}
