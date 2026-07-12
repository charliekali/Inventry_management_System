import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';

export default function SearchBar() {
  const [query, setQuery] = useState('');
  const navigate = useNavigate();

  const handleSearch = (e) => {
    e.preventDefault();
    if (query.trim()) {
      navigate(`/store/shop?search=${encodeURIComponent(query.trim())}`);
    }
  };

  return (
    <form onSubmit={handleSearch} style={{ position: 'relative', width: '100%', maxWidth: 400 }}>
      <input
        type="text"
        placeholder="Search premium spices, foods..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="form-control"
        style={{
          paddingLeft: 40,
          borderRadius: 24,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)'
        }}
      />
      <Search 
        size={18} 
        style={{
          position: 'absolute',
          left: 14,
          top: '50%',
          transform: 'translateY(-50%)',
          color: 'var(--color-text-muted)'
        }}
      />
    </form>
  );
}
