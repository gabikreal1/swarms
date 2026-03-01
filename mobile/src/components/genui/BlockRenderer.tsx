import React from 'react';
import { View, StyleSheet } from 'react-native';
import TextBlock from './TextBlock';
import ActionBlock from './ActionBlock';
import FormBlock from './FormBlock';
import TableBlock from './TableBlock';
import CardBlock from './CardBlock';
import CriteriaBlock from './CriteriaBlock';
import TagsBlock from './TagsBlock';
import TransactionBlock from './TransactionBlock';

interface BlockRendererProps {
  block: {
    id: string;
    type: string;
    [key: string]: any;
  };
  isStreaming?: boolean;
  onAction: (actionId: string, toolCall?: string, toolArgs?: Record<string, unknown>) => void;
  onFormSubmit: (formId: string, values: Record<string, string>) => void;
  onCriteriaChange: (selectedIds: string[], customCriteria?: string[]) => void;
  onTagsChange: (selectedTags: string[]) => void;
}

export default function BlockRenderer({
  block,
  isStreaming,
  onAction,
  onFormSubmit,
  onCriteriaChange,
  onTagsChange,
}: BlockRendererProps) {
  switch (block.type) {
    case 'text':
      return <TextBlock content={block.content || ''} isStreaming={isStreaming} />;

    case 'action':
      return (
        <ActionBlock
          actions={block.actions || []}
          layout={block.layout}
          onAction={onAction}
        />
      );

    case 'form':
      return (
        <FormBlock
          formId={block.formId}
          fields={block.fields || []}
          submitLabel={block.submitLabel}
          cancelLabel={block.cancelLabel}
          onFormSubmit={onFormSubmit}
        />
      );

    case 'table':
      return <TableBlock columns={block.columns || []} rows={block.rows || []} />;

    case 'card':
      return (
        <CardBlock
          variant={block.variant || 'default'}
          data={block.data || {}}
          onAction={onAction}
        />
      );

    case 'criteria':
      return (
        <CriteriaBlock
          criteria={block.criteria || []}
          allowCustom={block.allowCustom}
          onCriteriaChange={onCriteriaChange}
        />
      );

    case 'tags':
      return (
        <TagsBlock
          suggested={block.suggested || []}
          selected={block.selected || []}
          allowCustom={block.allowCustom}
          onTagsChange={onTagsChange}
        />
      );

    case 'transaction':
      return (
        <TransactionBlock
          transaction={block.transaction}
          title={block.title}
          budget={block.budget}
          criteriaCount={block.criteriaCount}
          approval={block.approval}
          onConfirmed={(txHash) => {
            onAction('tx-confirmed', undefined, { txHash });
          }}
        />
      );

    default:
      // Fallback: render as text if there's content, otherwise skip
      if (block.content) {
        return <TextBlock content={block.content} isStreaming={isStreaming} />;
      }
      return null;
  }
}

export { TextBlock, ActionBlock, FormBlock, TableBlock, CardBlock, CriteriaBlock, TagsBlock };
