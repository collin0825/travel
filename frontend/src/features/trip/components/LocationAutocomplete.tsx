import React from 'react';
import { Search } from 'lucide-react';
import type { NominatimSuggestion } from '@/types';

interface LocationAutocompleteProps {
  value: string;
  suggestions: NominatimSuggestion[];
  loading: boolean;
  onChange: (value: string) => void;
  onSelect: (suggestion: NominatimSuggestion) => void;
}

const LocationAutocomplete: React.FC<LocationAutocompleteProps> = ({
  value,
  suggestions,
  loading,
  onChange,
  onSelect,
}) => (
  <div style={{ position: 'relative' }}>
    <Search
      size={16}
      style={{ position: 'absolute', left: '12px', top: '14px', color: 'var(--text-muted)' }}
    />
    <input
      type="text"
      placeholder="搜尋地點 (例如: 淺草寺)"
      className="glass-input"
      style={{ paddingLeft: '36px' }}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required
    />

    {loading && (
      <div
        style={{
          position: 'absolute',
          right: '12px',
          top: '14px',
          fontSize: '11px',
          color: 'var(--text-muted)',
        }}
      >
        搜尋中...
      </div>
    )}

    {suggestions.length > 0 && (
      <div className="suggestions-list" style={{ position: 'absolute', width: '100%', zIndex: 50, top: '48px' }}>
        {suggestions.map((suggestion) => (
          <div
            key={suggestion.place_id}
            className="suggestion-item"
            onClick={() => onSelect(suggestion)}
          >
            <div style={{ fontWeight: 600 }}>{suggestion.display_name.split(',')[0]}</div>
            <div
              style={{
                fontSize: '11px',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {suggestion.display_name}
            </div>
          </div>
        ))}
      </div>
    )}
  </div>
);

export default LocationAutocomplete;
