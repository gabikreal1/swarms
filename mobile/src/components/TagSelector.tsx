import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from 'react-native';
import { api } from '../api/client';

interface TagSuggestion {
  tag: string;
  categoryPath: string;
}

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<TagSuggestion[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchSuggestions = useCallback(
    (text: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (text.length < 2) {
        setSuggestions([]);
        setShowDropdown(false);
        return;
      }
      debounceRef.current = setTimeout(async () => {
        try {
          const result = (await api.suggestTags(text)) as TagSuggestion[];
          const filtered = result.filter(
            (s) => !selectedTags.includes(s.tag),
          );
          setSuggestions(filtered);
          setShowDropdown(filtered.length > 0);
        } catch {
          setSuggestions([]);
          setShowDropdown(false);
        }
      }, 300);
    },
    [selectedTags],
  );

  const handleChangeText = (text: string) => {
    setQuery(text);
    fetchSuggestions(text);
  };

  const addTag = (tag: string) => {
    onTagsChange([...selectedTags, tag]);
    setQuery('');
    setSuggestions([]);
    setShowDropdown(false);
  };

  const removeTag = (tag: string) => {
    onTagsChange(selectedTags.filter((t) => t !== tag));
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.input}
        value={query}
        onChangeText={handleChangeText}
        placeholder="Search tags..."
        placeholderTextColor="#6a6a8a"
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />

      {showDropdown && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.tag}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => addTag(item.tag)}
              >
                <Text style={styles.suggestionTag}>{item.tag}</Text>
                <Text style={styles.suggestionPath}>{item.categoryPath}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {selectedTags.length > 0 && (
        <View style={styles.tagsRow}>
          {selectedTags.map((tag) => (
            <View key={tag} style={styles.pill}>
              <Text style={styles.pillText}>{tag}</Text>
              <TouchableOpacity onPress={() => removeTag(tag)}>
                <Text style={styles.pillRemove}>x</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  input: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  dropdown: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#2a2a4a',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a4a',
  },
  suggestionTag: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionPath: {
    color: '#6a6a8a',
    fontSize: 12,
    marginTop: 2,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 10,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#4CC9F022',
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  pillText: {
    color: '#4CC9F0',
    fontSize: 13,
    fontWeight: '600',
  },
  pillRemove: {
    color: '#4CC9F0',
    fontSize: 15,
    fontWeight: '700',
  },
});
