import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import { api } from '../api/client';
import { signAndSendTransaction } from '../wallet/circle';
import CompletionBar from '../components/CompletionBar';
import CriteriaList, { SuccessCriterion } from '../components/CriteriaList';
import TagSelector from '../components/TagSelector';

type Props = NativeStackScreenProps<RootStackParamList, 'PostJob'>;

interface AnalysisResult {
  sessionId: string;
  completeness: number;
  slots: Record<string, any>;
  missingSlots: { key: string; question: string }[];
  suggestedTags: string[];
  criteria: SuccessCriterion[];
  similarJobs: { id: number; title: string; budget: string; matchScore: number }[];
}

export default function PostJobScreen({ navigation, route }: Props) {
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState(route.params?.sessionId || '');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [acceptedCriteria, setAcceptedCriteria] = useState<Record<string, boolean>>({});
  const [criteria, setCriteria] = useState<SuccessCriterion[]>([]);

  const handleAnalyze = async () => {
    if (!query.trim()) return;
    setAnalyzing(true);
    try {
      const result = (await api.analyzeJob(query, sessionId || undefined)) as AnalysisResult;
      setAnalysis(result);
      setSessionId(result.sessionId);
      setSelectedTags(result.suggestedTags || []);
      setCriteria(result.criteria || []);
      const accepted: Record<string, boolean> = {};
      (result.criteria || []).forEach((c) => {
        accepted[c.id] = true;
      });
      setAcceptedCriteria(accepted);
    } catch (err: any) {
      Alert.alert('Analysis failed', err.message || 'Please try again');
    }
    setAnalyzing(false);
  };

  const handleCriteriaToggle = (id: string, accepted: boolean) => {
    setAcceptedCriteria((prev) => ({ ...prev, [id]: accepted }));
  };

  const handleCriteriaEdit = (id: string, description: string) => {
    setCriteria((prev) =>
      prev.map((c) => (c.id === id ? { ...c, description, source: 'user_defined' as const } : c)),
    );
  };

  const handlePostJob = async () => {
    if (!analysis) return;
    setPosting(true);
    try {
      const acceptedIds = Object.entries(acceptedCriteria)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      const finalCriteria = criteria.filter((c) => acceptedIds.includes(c.id));

      const result = (await api.finalizeJob({
        sessionId,
        slots: analysis.slots,
        tags: selectedTags,
        criteria: finalCriteria,
      })) as { unsignedTx: { to: string; data: string; value: string } };

      const txHash = await signAndSendTransaction(result.unsignedTx);
      Alert.alert('Job Posted', `Transaction: ${String(txHash).slice(0, 16)}...`, [
        { text: 'OK', onPress: () => navigation.navigate('Home') },
      ]);
    } catch (err: any) {
      Alert.alert('Posting failed', err.message || 'Transaction failed');
    }
    setPosting(false);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Job description input */}
      <Text style={styles.label}>Describe your job</Text>
      <TextInput
        style={styles.textArea}
        value={query}
        onChangeText={setQuery}
        placeholder="e.g. I need an AI agent to analyze 500 customer reviews and generate a sentiment report with actionable insights..."
        placeholderTextColor="#6a6a8a"
        multiline
        numberOfLines={5}
        textAlignVertical="top"
      />

      <TouchableOpacity
        style={[styles.analyzeBtn, analyzing && styles.btnDisabled]}
        onPress={handleAnalyze}
        disabled={analyzing || !query.trim()}
      >
        {analyzing ? (
          <ActivityIndicator color="#0f0f23" />
        ) : (
          <Text style={styles.analyzeBtnText}>Analyze</Text>
        )}
      </TouchableOpacity>

      {/* Analysis results */}
      {analysis && (
        <View style={styles.analysisSection}>
          {/* Completeness */}
          <CompletionBar score={analysis.completeness} />

          {/* Missing slots */}
          {analysis.missingSlots.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Clarifying Questions</Text>
              {analysis.missingSlots.map((slot) => (
                <View key={slot.key} style={styles.questionCard}>
                  <Text style={styles.questionText}>{slot.question}</Text>
                  <TextInput
                    style={styles.answerInput}
                    placeholder="Your answer..."
                    placeholderTextColor="#6a6a8a"
                    onEndEditing={(e) => {
                      if (e.nativeEvent.text) {
                        setQuery(
                          (prev) => `${prev}\n${slot.key}: ${e.nativeEvent.text}`,
                        );
                      }
                    }}
                  />
                </View>
              ))}
            </View>
          )}

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tags</Text>
            <TagSelector
              selectedTags={selectedTags}
              onTagsChange={setSelectedTags}
            />
          </View>

          {/* Criteria */}
          {criteria.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Success Criteria</Text>
              <CriteriaList
                criteria={criteria}
                accepted={acceptedCriteria}
                onToggle={handleCriteriaToggle}
                onEdit={handleCriteriaEdit}
              />
            </View>
          )}

          {/* Similar jobs */}
          {analysis.similarJobs?.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Similar Completed Jobs</Text>
              {analysis.similarJobs.map((sj) => (
                <View key={sj.id} style={styles.similarJob}>
                  <Text style={styles.similarTitle}>{sj.title}</Text>
                  <View style={styles.similarRow}>
                    <Text style={styles.similarBudget}>{sj.budget} USDC</Text>
                    <Text style={styles.similarMatch}>
                      {Math.round(sj.matchScore * 100)}% match
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Post button */}
          <TouchableOpacity
            style={[styles.postBtn, posting && styles.btnDisabled]}
            onPress={handlePostJob}
            disabled={posting}
          >
            {posting ? (
              <ActivityIndicator color="#0f0f23" />
            ) : (
              <Text style={styles.postBtnText}>Post Job</Text>
            )}
          </TouchableOpacity>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f23',
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  label: {
    color: '#e0e0e0',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  textArea: {
    backgroundColor: '#1a1a2e',
    color: '#e0e0e0',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#2a2a4a',
    lineHeight: 22,
  },
  analyzeBtn: {
    backgroundColor: '#4CC9F0',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  analyzeBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 16,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  analysisSection: {
    marginTop: 20,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    color: '#e0e0e0',
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 10,
  },
  questionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  questionText: {
    color: '#4CC9F0',
    fontSize: 14,
    marginBottom: 8,
  },
  answerInput: {
    backgroundColor: '#0f0f23',
    color: '#e0e0e0',
    borderRadius: 6,
    padding: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  similarJob: {
    backgroundColor: '#1a1a2e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#2a2a4a',
  },
  similarTitle: {
    color: '#e0e0e0',
    fontSize: 14,
    fontWeight: '600',
  },
  similarRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 6,
  },
  similarBudget: {
    color: '#a0a0b8',
    fontSize: 13,
  },
  similarMatch: {
    color: '#22c55e',
    fontSize: 13,
    fontWeight: '600',
  },
  postBtn: {
    backgroundColor: '#22c55e',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  postBtnText: {
    color: '#0f0f23',
    fontWeight: '700',
    fontSize: 17,
  },
});
