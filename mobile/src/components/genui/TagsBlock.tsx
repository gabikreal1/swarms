import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface TagsBlockProps {
  suggested: string[];
  selected: string[];
  allowCustom: boolean;
  onTagsChange: (selectedTags: string[]) => void;
}

export default function TagsBlock({
  suggested,
  selected: initialSelected,
  allowCustom,
  onTagsChange,
}: TagsBlockProps) {
  const { colors } = useTheme();
  const [selectedTags, setSelectedTags] = useState<Set<string>>(
    new Set(initialSelected),
  );
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    onTagsChange(Array.from(selectedTags));
  }, [selectedTags]);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  };

  const addCustomTag = () => {
    const tag = customInput.trim().toLowerCase();
    if (!tag) return;
    setSelectedTags((prev) => new Set(prev).add(tag));
    setCustomInput('');
  };

  // Merge suggested and any selected tags that aren't in suggested
  const allTags = [
    ...suggested,
    ...Array.from(selectedTags).filter((t) => !suggested.includes(t)),
  ];

  return (
    <View style={styles.container}>
      <View style={styles.tagsWrap}>
        {allTags.map((tag) => {
          const isSelected = selectedTags.has(tag);
          return (
            <TouchableOpacity
              key={tag}
              style={[
                styles.pill,
                isSelected
                  ? { backgroundColor: colors.tint }
                  : {
                      backgroundColor: 'transparent',
                      borderColor: colors.tint,
                      borderWidth: 1,
                    },
              ]}
              activeOpacity={0.7}
              onPress={() => toggleTag(tag)}
            >
              <Text
                style={[
                  styles.pillText,
                  { color: isSelected ? '#FFFFFF' : colors.tint },
                ]}
              >
                {tag}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {allowCustom && (
        <View
          style={[
            styles.addRow,
            {
              backgroundColor: colors.tertiarySystemBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <TextInput
            style={[styles.addInput, { color: colors.label }]}
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="Add tag..."
            placeholderTextColor={colors.tertiaryLabel}
            onSubmitEditing={addCustomTag}
            returnKeyType="done"
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.tint,
                opacity: customInput.trim() ? 1 : 0.4,
              },
            ]}
            onPress={addCustomTag}
            disabled={!customInput.trim()}
          >
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 10,
  },
  tagsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pill: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
  },
  addRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  addInput: {
    flex: 1,
    fontSize: 14,
    padding: 4,
  },
  addBtn: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  addBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
});
