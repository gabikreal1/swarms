import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
} from 'react-native';
import { useTheme } from '../theme/useTheme';

export interface SuccessCriterion {
  id: string;
  description: string;
  measurable: boolean;
  source: 'similar_job' | 'llm_suggested' | 'user_defined';
}

interface CriteriaListProps {
  criteria: SuccessCriterion[];
  onToggle: (id: string, accepted: boolean) => void;
  onEdit: (id: string, description: string) => void;
  accepted: Record<string, boolean>;
}

export default function CriteriaList({
  criteria,
  onToggle,
  onEdit,
  accepted,
}: CriteriaListProps) {
  const { colors } = useTheme();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const sourceLabel: Record<string, string> = {
    similar_job: 'Similar Job',
    llm_suggested: 'AI Suggested',
    user_defined: 'Custom',
  };

  const sourceColorKey: Record<string, keyof typeof colors> = {
    similar_job: 'systemIndigo',
    llm_suggested: 'tint',
    user_defined: 'systemGreen',
  };

  const startEdit = (item: SuccessCriterion) => {
    setEditingId(item.id);
    setEditText(item.description);
  };

  const saveEdit = (id: string) => {
    onEdit(id, editText);
    setEditingId(null);
  };

  const renderItem = ({ item }: { item: SuccessCriterion }) => {
    const isAccepted = accepted[item.id] ?? true;
    const isEditing = editingId === item.id;
    const srcColor = colors[sourceColorKey[item.source]];

    return (
      <View
        style={[
          styles.item,
          {
            backgroundColor: colors.secondarySystemGroupedBackground,
            borderColor: colors.separator,
          },
          !isAccepted && styles.itemRejected,
        ]}
      >
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggle(item.id, !isAccepted)}
        >
          <View
            style={[
              styles.checkboxInner,
              { borderColor: colors.tertiaryLabel },
              isAccepted && { backgroundColor: colors.tint, borderColor: colors.tint },
            ]}
          >
            {isAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.content}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={[
                  styles.editInput,
                  {
                    color: colors.label,
                    borderColor: colors.tint,
                  },
                ]}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
              />
              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                onPress={() => saveEdit(item.id)}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text
              style={[
                styles.description,
                { color: colors.label },
                !isAccepted && { color: colors.tertiaryLabel, textDecorationLine: 'line-through' as const },
              ]}
            >
              {item.description}
            </Text>
          )}

          <View style={styles.badges}>
            {item.measurable && (
              <View style={[styles.measurableBadge, { backgroundColor: colors.systemGreen + '22' }]}>
                <Text style={[styles.measurableText, { color: colors.systemGreen }]}>measurable</Text>
              </View>
            )}
            <View
              style={[
                styles.sourceBadge,
                { borderColor: srcColor },
              ]}
            >
              <Text
                style={[styles.sourceText, { color: srcColor }]}
              >
                {sourceLabel[item.source]}
              </Text>
            </View>
          </View>
        </View>

        {!isEditing && (
          <TouchableOpacity
            style={styles.editBtn}
            onPress={() => startEdit(item)}
          >
            <Text style={[styles.editIcon, { color: colors.secondaryLabel }]}>&#9998;</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <FlatList
      data={criteria}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      scrollEnabled={false}
      contentContainerStyle={styles.list}
    />
  );
}

const styles = StyleSheet.create({
  list: {
    gap: 8,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
  },
  itemRejected: {
    opacity: 0.5,
  },
  checkbox: {
    marginRight: 10,
    marginTop: 2,
  },
  checkboxInner: {
    width: 22,
    height: 22,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  measurableBadge: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  measurableText: {
    fontSize: 11,
    fontWeight: '600',
  },
  sourceBadge: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sourceText: {
    fontSize: 11,
    fontWeight: '600',
  },
  editBtn: {
    marginLeft: 8,
    padding: 4,
  },
  editIcon: {
    fontSize: 16,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  editInput: {
    flex: 1,
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
  },
  saveBtn: {
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13,
  },
});
