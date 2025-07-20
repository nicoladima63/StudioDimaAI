import { useState, useRef, useEffect } from 'react';
import debounce from 'lodash/debounce';

export function useAutoComplete<T>(fetchSuggestions: (q: string) => Promise<T[]>, debounceMs = 350) {
  const [value, setValue] = useState('');
  const [suggestions, setSuggestions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [showList, setShowList] = useState(false);
  const [noResults, setNoResults] = useState(false);

  const debouncedFetch = useRef(
    debounce(async (q: string) => {
      if (!q.trim()) {
        setSuggestions([]);
        setNoResults(false);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const res = await fetchSuggestions(q);
        setSuggestions(res);
        setNoResults(res.length === 0);
      } catch {
        setSuggestions([]);
        setNoResults(true);
      } finally {
        setLoading(false);
      }
    }, debounceMs)
  ).current;

  useEffect(() => {
    if (showList && value.trim()) {
      debouncedFetch(value);
    } else {
      setSuggestions([]);
      setNoResults(false);
    }
    // eslint-disable-next-line
  }, [value, showList]);

  const onSelect = (item: T) => {
    setValue('');
    setSuggestions([]);
    setShowList(false);
  };

  const onChange = (val: string) => {
    setValue(val);
    setShowList(true);
  };

  return {
    value,
    setValue,
    suggestions,
    loading,
    showList,
    setShowList,
    onSelect,
    onChange,
    noResults
  };
} 