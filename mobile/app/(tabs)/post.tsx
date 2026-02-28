import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/useTheme';
import { api } from '../../src/api/client';
import { signAndSendTransaction, checkAllowance, approveUSDC, waitForReceipt } from '../../src/wallet/circle';
import { CONTRACTS, USDC_DECIMALS } from '../../src/config/chains';
import { Section } from '../../src/components/ios/Section';
import { SectionRow } from '../../src/components/ios/SectionRow';
import { Button } from '../../src/components/ios/Button';
import CompletionBar from '../../src/components/CompletionBar';
import CriteriaList, { SuccessCriterion } from '../../src/components/CriteriaList';
import TagSelector from '../../src/components/TagSelector';
import TransactionStatus, { TxStep } from '../../src/components/TransactionStatus';

interface AnalysisResult {
  sessionId: string;
  completeness: number;
  slots: Record<string, any>;
  missingSlots: { key: string; question: string }[];
  suggestedTags: string[];
  criteria: SuccessCriterion[];
  similarJobs: { id: number; title: string; budget: string; matchScore: number }[];
}

export default function PostJobTab() {
  const { colors, typography, spacing } = useTheme();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [posting, setPosting] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [acceptedCriteria, setAcceptedCriteria] = useState<Record<string, boolean>>({});
  const [criteria, setCriteria] = useState<SuccessCriterion[]>([]);
  const [txStep, setTxStep] = useState<TxStep | null>(null);
  const [txHash, setTxHash] = useState<string | undefined>();
  const [txError, setTxError] = useState<string | undefined>();

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
    setTxStep(null);
    setTxHash(undefined);
    setTxError(undefined);

    try {
      const acceptedIds = Object.entries(acceptedCriteria)
        .filter(([_, v]) => v)
        .map(([k]) => k);

      const finalCriteria = criteria
        .filter((c) => acceptedIds.includes(c.id))
        .map((c) => ({
          id: c.id,
          description: c.description,
          measurable: c.measurable ?? true,
          source: c.source ?? 'llm_suggested',
          accepted: true,
        }));

      const { getAccount } = await import('../../src/wallet/circle');
      const account = await getAccount();
      const walletAddr = account?.address || '';

      const result = (await api.finalizeJob({
        sessionId,
        slots: analysis.slots || {},
        tags: selectedTags,
        acceptedCriteria: finalCriteria,
        walletAddress: walletAddr,
        category: analysis.slots?.category?.value || selectedTags[0] || 'audit',
      })) as { unsignedTx: { to: string; data: string; value: string }; budget: string };

      // Parse budget to USDC amount (6 decimals)
      const budgetNum = parseFloat(result.budget || analysis.slots.budget || '0');
      const budgetAmount = BigInt(Math.ceil(budgetNum * 10 ** USDC_DECIMALS));

      const escrow = CONTRACTS.Escrow as `0x${string}`;

      // Step 1: Check allowance
      setTxStep('checking');
      const currentAllowance = await checkAllowance(account!.address, escrow);

      // Step 2: Approve if needed
      if (currentAllowance < budgetAmount) {
        setTxStep('approving');
        const approveHash = await approveUSDC(escrow, budgetAmount);
        const approveReceipt = await waitForReceipt(approveHash as `0x${string}`);
        if (approveReceipt.status === 'reverted') {
          setTxStep('failed');
          setTxError('USDC approval transaction reverted');
          setPosting(false);
          return;
        }
      }

      // Step 3: Sign and send the job posting tx
      setTxStep('posting');
      const jobTxHash = await signAndSendTransaction(result.unsignedTx);
      setTxHash(String(jobTxHash));

      // Step 4: Wait for confirmation
      const jobReceipt = await waitForReceipt(jobTxHash as `0x${string}`);
      if (jobReceipt.status === 'reverted') {
        setTxStep('failed');
        setTxError('Job posting transaction reverted');
        setPosting(false);
        return;
      }

      setTxStep('confirmed');
      setPosting(false);

      // Navigate after a short delay so user sees confirmation
      setTimeout(() => {
        router.push('/(tabs)/');
      }, 2000);
    } catch (err: any) {
      setTxStep('failed');
      setTxError(err.message || 'Transaction failed');
      setPosting(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.systemGroupedBackground }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      {/* Job Description */}
      <Section header="Job Description">
        <View style={{ padding: spacing.cellHorizontal }}>
          <TextInput
            style={[
              typography.body,
              {
                color: colors.label,
                minHeight: 120,
                paddingVertical: 8,
              },
            ]}
            value={query}
            onChangeText={setQuery}
            placeholder="Describe what you need an AI agent to do..."
            placeholderTextColor={colors.tertiaryLabel}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
          />
        </View>
      </Section>

      {/* Analyze Button */}
      <View style={styles.buttonContainer}>
        <Button
          title="Analyze"
          variant="filled"
          onPress={handleAnalyze}
          loading={analyzing}
          disabled={!query.trim()}
        />
      </View>

      {/* Analysis Results */}
      {analysis && (
        <>
          {/* Completeness */}
          <Section header="Completeness">
            <View style={{ padding: spacing.cellHorizontal }}>
              <CompletionBar score={analysis.completeness} />
            </View>
          </Section>

          {/* Missing Slots */}
          {(analysis.missingSlots?.length ?? 0) > 0 && (
            <Section header="Clarifying Questions">
              {analysis.missingSlots.map((slot, index) => (
                <View
                  key={slot.key}
                  style={{
                    padding: spacing.cellHorizontal,
                    paddingVertical: spacing.cellVertical,
                  }}
                >
                  <Text style={[typography.subheadline, { color: colors.tint, marginBottom: 6 }]}>
                    {slot.question}
                  </Text>
                  <TextInput
                    style={[
                      typography.body,
                      {
                        color: colors.label,
                        backgroundColor: colors.tertiarySystemBackground,
                        borderRadius: 8,
                        padding: 10,
                      },
                    ]}
                    placeholder="Your answer..."
                    placeholderTextColor={colors.tertiaryLabel}
                    onEndEditing={(e) => {
                      if (e.nativeEvent.text) {
                        setQuery((prev) => `${prev}\n${slot.key}: ${e.nativeEvent.text}`);
                      }
                    }}
                  />
                  {index < (analysis.missingSlots?.length ?? 0) - 1 && (
                    <View
                      style={{
                        height: StyleSheet.hairlineWidth,
                        backgroundColor: colors.separator,
                        marginTop: spacing.cellVertical,
                      }}
                    />
                  )}
                </View>
              ))}
            </Section>
          )}

          {/* Tags */}
          <Section header="Tags">
            <View style={{ padding: spacing.cellHorizontal }}>
              <TagSelector
                selectedTags={selectedTags}
                onTagsChange={setSelectedTags}
              />
            </View>
          </Section>

          {/* Criteria */}
          {criteria.length > 0 && (
            <Section header="Success Criteria">
              <View style={{ padding: spacing.cellHorizontal }}>
                <CriteriaList
                  criteria={criteria}
                  accepted={acceptedCriteria}
                  onToggle={handleCriteriaToggle}
                  onEdit={handleCriteriaEdit}
                />
              </View>
            </Section>
          )}

          {/* Similar Jobs */}
          {analysis.similarJobs?.length > 0 && (
            <Section header="Similar Completed Jobs">
              {analysis.similarJobs.map((sj, index) => (
                <SectionRow
                  key={sj.id}
                  label={sj.title}
                  detail={`${sj.budget} USDC`}
                  value={`${Math.round(sj.matchScore * 100)}%`}
                  isLast={index === analysis.similarJobs.length - 1}
                />
              ))}
            </Section>
          )}

          {/* Transaction Status */}
          {txStep && (
            <Section header="Transaction">
              <TransactionStatus step={txStep} txHash={txHash} errorMessage={txError} />
            </Section>
          )}

          {/* Post Button */}
          <View style={styles.buttonContainer}>
            <Button
              title="Post Job"
              variant="filled"
              color={colors.systemGreen}
              onPress={handlePostJob}
              loading={posting}
              disabled={posting}
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  buttonContainer: {
    marginHorizontal: 16,
    marginTop: 16,
  },
});
