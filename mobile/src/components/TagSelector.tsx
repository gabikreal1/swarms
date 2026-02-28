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
import { useTheme } from '../theme/useTheme';

interface TagSuggestion {
  tag: string;
  categoryPath: string;
}

interface TagSelectorProps {
  selectedTags: string[];
  onTagsChange: (tags: string[]) => void;
}

export default function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps) {
  const { colors } = useTheme();
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
        style={[
          styles.input,
          {
            backgroundColor: colors.secondarySystemGroupedBackground,
            color: colors.label,
            borderColor: colors.separator,
          },
        ]}
        value={query}
        onChangeText={handleChangeText}
        placeholder="Search tags..."
        placeholderTextColor={colors.tertiaryLabel}
        onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
      />

      {showDropdown && (
        <View
          style={[
            styles.dropdown,
            {
              backgroundColor: colors.secondarySystemGroupedBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.tag}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.suggestionItem, { borderBottomColor: colors.separator }]}
                onPress={() => addTag(item.tag)}
              >
                <Text style={[styles.suggestionTag, { color: colors.label }]}>{item.tag}</Text>
                <Text style={[styles.suggestionPath, { color: colors.tertiaryLabel }]}>{item.categoryPath}</Text>
              </TouchableOpacity>
            )}
          />
        </View>
      )}

      {selectedTags.length > 0 && (
        <View style={styles.tagsRow}>
          {selectedTags.map((tag) => (
            <View key={tag} style={[styles.pill, { backgroundColor: colors.tint + '26' }]}>
              <Text style={[styles.pillText, { color: colors.tint }]}>{tag}</Text>
              <TouchableOpacity onPress={() => removeTag(tag)}>
                <Text style={[styles.pillRemove, { color: colors.systemRed }]}>x</Text>
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
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  dropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
  },
  suggestionItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  suggestionTag: {
    fontSize: 14,
    fontWeight: '600',
  },
  suggestionPath: {
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
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
    gap: 6,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  pillRemove: {
    fontSize: 15,
    fontWeight: '700',
  },
});
