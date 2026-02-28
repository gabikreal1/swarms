import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface CriteriaItem {
  id: string;
  description: string;
  category: string;
  measurable: boolean;
  source: 'owasp' | 'llm_suggested' | 'user_defined' | 'similar_job';
  preselected: boolean;
}

interface CriteriaBlockProps {
  criteria: CriteriaItem[];
  allowCustom: boolean;
  onCriteriaChange: (selectedIds: string[], customCriteria?: string[]) => void;
}

const severityColors: Record<string, string> = {
  critical: '#FF453A',
  high: '#FF9F0A',
  medium: '#FFD60A',
  low: '#30D158',
};

const sourceLabels: Record<string, string> = {
  owasp: 'OWASP',
  llm_suggested: 'AI Suggested',
  user_defined: 'Custom',
  similar_job: 'Similar Job',
};

export default function CriteriaBlock({
  criteria,
  allowCustom,
  onCriteriaChange,
}: CriteriaBlockProps) {
  const { colors } = useTheme();

  const [selected, setSelected] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    criteria.forEach((c) => {
      if (c.preselected) initial.add(c.id);
    });
    return initial;
  });
  const [customItems, setCustomItems] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  useEffect(() => {
    onCriteriaChange(Array.from(selected), customItems.length > 0 ? customItems : undefined);
  }, [selected, customItems]);

  const toggleItem = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const addCustom = () => {
    const text = customInput.trim();
    if (!text) return;
    setCustomItems((prev) => [...prev, text]);
    setCustomInput('');
  };

  return (
    <View style={styles.container}>
      {criteria.map((item) => {
        const isChecked = selected.has(item.id);
        return (
          <TouchableOpacity
            key={item.id}
            style={[
              styles.item,
              {
                backgroundColor: colors.secondarySystemBackground,
                borderColor: colors.separator,
              },
              !isChecked && styles.itemUnchecked,
            ]}
            activeOpacity={0.7}
            onPress={() => toggleItem(item.id)}
          >
            {/* Checkbox */}
            <View
              style={[
                styles.checkbox,
                { borderColor: colors.tertiaryLabel },
                isChecked && {
                  backgroundColor: colors.tint,
                  borderColor: colors.tint,
                },
              ]}
            >
              {isChecked && <Text style={styles.checkmark}>{'\u2713'}</Text>}
            </View>

            {/* Content */}
            <View style={styles.content}>
              <Text
                style={[
                  styles.description,
                  { color: colors.label },
                  !isChecked && { color: colors.tertiaryLabel },
                ]}
              >
                {item.description}
              </Text>

              <View style={styles.badgeRow}>
                {/* Category badge */}
                <View
                  style={[
                    styles.categoryBadge,
                    { backgroundColor: colors.systemIndigo + '22' },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: colors.systemIndigo }]}
                  >
                    {item.category}
                  </Text>
                </View>

                {/* Source badge */}
                <View
                  style={[
                    styles.sourceBadge,
                    { borderColor: colors.tertiaryLabel },
                  ]}
                >
                  <Text
                    style={[styles.badgeText, { color: colors.secondaryLabel }]}
                  >
                    {sourceLabels[item.source] || item.source}
                  </Text>
                </View>
              </View>
            </View>
          </TouchableOpacity>
        );
      })}

      {/* Custom items */}
      {customItems.map((text, i) => (
        <View
          key={`custom-${i}`}
          style={[
            styles.item,
            {
              backgroundColor: colors.secondarySystemBackground,
              borderColor: colors.tint + '44',
            },
          ]}
        >
          <View
            style={[
              styles.checkbox,
              { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            <Text style={styles.checkmark}>{'\u2713'}</Text>
          </View>
          <View style={styles.content}>
            <Text style={[styles.description, { color: colors.label }]}>
              {text}
            </Text>
            <View style={styles.badgeRow}>
              <View
                style={[
                  styles.sourceBadge,
                  { borderColor: colors.systemGreen },
                ]}
              >
                <Text
                  style={[styles.badgeText, { color: colors.systemGreen }]}
                >
                  Custom
                </Text>
              </View>
            </View>
          </View>
          <TouchableOpacity
            onPress={() =>
              setCustomItems((prev) => prev.filter((_, idx) => idx !== i))
            }
          >
            <Text style={{ color: colors.destructive, fontSize: 16 }}>
              {'\u2715'}
            </Text>
          </TouchableOpacity>
        </View>
      ))}

      {/* Add custom input */}
      {allowCustom && (
        <View
          style={[
            styles.addCustomRow,
            {
              backgroundColor: colors.tertiarySystemBackground,
              borderColor: colors.separator,
            },
          ]}
        >
          <TextInput
            style={[styles.addCustomInput, { color: colors.label }]}
            value={customInput}
            onChangeText={setCustomInput}
            placeholder="Add custom criteria..."
            placeholderTextColor={colors.tertiaryLabel}
            onSubmitEditing={addCustom}
            returnKeyType="done"
          />
          <TouchableOpacity
            style={[
              styles.addBtn,
              {
                backgroundColor: colors.tint,
                opacity: customInput.trim() ? 1 : 0.4,
              },
            ]}
            onPress={addCustom}
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
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    gap: 10,
  },
  itemUnchecked: {
    opacity: 0.6,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
  },
  categoryBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  addCustomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    padding: 8,
    gap: 8,
  },
  addCustomInput: {
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
