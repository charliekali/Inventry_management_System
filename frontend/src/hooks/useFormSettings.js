import { useState, useEffect, useRef } from 'react';
import { formSettingsAPI } from '../api';

// In-memory cache to avoid redundant API calls within the same session
const _cache = {};

/**
 * useFormSettings(formType)
 *
 * Fetches and caches form field settings from the backend.
 * Returns { fields, loading, fieldMap }
 *
 * fieldMap is keyed by field_key for O(1) lookups:
 *   fieldMap['remarks'] → { visible, required, label, field_order, locked_visible, locked_required }
 */
export default function useFormSettings(formType) {
  const [fields, setFields] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toggle, setToggle] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    if (!formType) return;

    // Return cached result immediately
    if (_cache[formType]) {
      setFields(_cache[formType]);
      setLoading(false);
      return;
    }

    setLoading(true);
    formSettingsAPI.get(formType)
      .then(r => {
        const data = r.data.data || [];
        _cache[formType] = data;
        if (mounted.current) {
          setFields(data);
          setLoading(false);
        }
      })
      .catch(() => {
        // On error, fall back to showing all fields
        if (mounted.current) {
          setFields([]);
          setLoading(false);
        }
      });
  }, [formType, toggle]);

  // Invalidate cache (call after saving settings)
  const invalidate = () => {
    delete _cache[formType];
    setToggle(t => !t);
  };

  // Build O(1) lookup map
  const fieldMap = {};
  fields.forEach(f => {
    fieldMap[f.field_key] = f;
  });

  /**
   * isVisible(fieldKey) — returns true if field should be rendered.
   * Defaults to true if settings haven't loaded yet (graceful fallback).
   */
  const isVisible = (key) => {
    if (loading || !fieldMap[key]) return true;
    return fieldMap[key].visible !== false;
  };

  /**
   * isRequired(fieldKey) — returns true if field is required.
   * Locked-required fields always return true regardless of settings.
   */
  const isRequired = (key) => {
    if (loading || !fieldMap[key]) return false;
    return fieldMap[key].required === true || fieldMap[key].locked_required === true;
  };

  /**
   * getLabel(fieldKey, fallback) — returns configured label or fallback.
   */
  const getLabel = (key, fallback) => {
    if (loading || !fieldMap[key]) return fallback;
    return fieldMap[key].label || fallback;
  };

  return { fields, fieldMap, loading, isVisible, isRequired, getLabel, invalidate };
}
