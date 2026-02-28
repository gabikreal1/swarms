import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  FlatList,
} from 'react-native';

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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const sourceLabel: Record<string, string> = {
    similar_job: 'Similar Job',
    llm_suggested: 'AI Suggested',
    user_defined: 'Custom',
  };

  const sourceColor: Record<string, string> = {
    similar_job: '#818cf8',
    llm_suggested: '#4CC9F0',
    user_defined: '#22c55e',
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

    return (
      <View style={[styles.item, !isAccepted && styles.itemRejected]}>
        <TouchableOpacity
          style={styles.checkbox}
          onPress={() => onToggle(item.id, !isAccepted)}
        >
          <View
            style={[styles.checkboxInner, isAccepted && styles.checkboxChecked]}
          >
            {isAccepted && <Text style={styles.checkmark}>✓</Text>}
          </View>
        </TouchableOpacity>

        <View style={styles.content}>
          {isEditing ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={editText}
                onChangeText={setEditText}
                autoFocus
                multiline
              />
              <TouchableOpacity
                style={styles.saveBtn}
                onPress={() => saveEdit(item.id)}
              >
                <Text style={styles.saveBtnText}>Save</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <Text style={[styles.description, !isAccepted && styles.textMuted]}>
              {item.description}
            </Text>
          )}

          <View style={styles.badges}>
            {item.measurable && (
              <View style={styles.measurableBadge}>
                <Text style={styles.measurableText}>measurable</Text>
              </View>
            )}
            <View
              style={[
                styles.sourceBadge,
                { borderColor: sourceColor[item.source] },
              ]}
            >
              <Text
                style={[styles.sourceText, { color: sourceColor[item.source] }]}
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
            <Text style={styles.editIcon}>&#9998;</Text>
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
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#2a2a4a',
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
    borderColor: '#4a4a6a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#4CC9F0',
    borderColor: '#4CC9F0',
  },
  checkmark: {
    color: '#0f0f23',
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
  },
  description: {
    color: '#e0e0e0',
    fontSize: 14,
    lineHeight: 20,
  },
  textMuted: {
    color: '#6a6a8a',
    textDecorationLine: 'line-through',
  },
  badges: {
    flexDirection: 'row',
    gap: 6,
    marginTop: 6,
  },
  measurableBadge: {
    backgroundColor: '#22c55e22',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  measurableText: {
    color: '#22c55e',
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
    color: '#a0a0b8',
    fontSize: 16,
  },
  editRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  editInput: {
    flex: 1,
    color: '#e0e0e0',
    backgroundColor: '#0f0f23',
    borderRadius: 6,
    padding: 8,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#4CC9F0',
  },
  saveBtn: {
    backgroundColor: '#4CC9F0',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  saveBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 13,
  },
});
