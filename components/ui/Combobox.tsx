import React, { useState, useRef, useEffect } from 'react';

export interface ComboboxOption {
  id: string | number;
  label: string;
  sublabel?: string;
  extra?: React.ReactNode;
}

export interface ComboboxProps {
  options: ComboboxOption[];
  value?: string | number | null;
  onSelect: (option: ComboboxOption) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export const Combobox: React.FC<ComboboxProps> = ({
  options,
  value,
  onSelect,
  placeholder = 'بحث...',
  className = '',
  disabled = false,
}) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.id === value);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // وهي مقفولة بتعرض اسم الاختيار الحالي، ووهي مفتوحة بتعرض اللي المستخدم بيكتبه
  const inputValue = isOpen ? query : selectedOption?.label ?? query;

  const filteredOptions = query.trim()
    ? options.filter((opt) => opt.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev + 1) % filteredOptions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev - 1 + filteredOptions.length) % filteredOptions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredOptions[activeIndex]) {
        onSelect(filteredOptions[activeIndex]);
        setQuery(filteredOptions[activeIndex].label);
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  };

  const renderHighlightedText = (text: string, highlight: string) => {
    if (!highlight.trim()) return text;
    // escape عشان حروف زي ( أو + في البحث ماتعملش regex غلط وتوقع الصفحة
    const escaped = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = text.split(new RegExp(`(${escaped})`, 'gi'));
    return (
      <span>
        {parts.map((part, i) =>
          part.toLowerCase() === highlight.toLowerCase() ? (
            <mark key={i}>{part}</mark>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  return (
    <div ref={containerRef} className={`m-combo ${className}`}>
      <div className="m-search">
        <svg className="m-ico" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-4-4" />
        </svg>
        <input
          type="text"
          className="m-input"
          value={inputValue}
          placeholder={placeholder}
          disabled={disabled}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setActiveIndex(0);
          }}
          onFocus={() => {
            setQuery(selectedOption?.label ?? query);
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
        />
      </div>

      {isOpen && filteredOptions.length > 0 && (
        <div className="m-combo__list" role="listbox">
          {filteredOptions.map((opt, index) => {
            const isActive = index === activeIndex;
            return (
              <div
                key={opt.id}
                role="option"
                aria-selected={isActive}
                className={`m-combo__opt ${isActive ? 'is-active' : ''}`}
                onClick={() => {
                  onSelect(opt);
                  setQuery(opt.label);
                  setIsOpen(false);
                }}
              >
                <div>
                  {renderHighlightedText(opt.label, query)}
                  {opt.sublabel && <div className="t-small t-muted">{opt.sublabel}</div>}
                </div>
                {opt.extra && <div className="t-small t-muted">{opt.extra}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Combobox;
