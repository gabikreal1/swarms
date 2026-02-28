import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Switch,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface FormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'select' | 'checkbox' | 'address';
  placeholder?: string;
  options?: { label: string; value: string }[];
  required?: boolean;
  defaultValue?: string;
  validation?: { pattern?: string; min?: number; max?: number; message?: string };
}

interface FormBlockProps {
  formId: string;
  fields: FormField[];
  submitLabel: string;
  cancelLabel?: string;
  onFormSubmit: (formId: string, values: Record<string, string>) => void;
}

export default function FormBlock({
  formId,
  fields,
  submitLabel,
  cancelLabel,
  onFormSubmit,
}: FormBlockProps) {
  const { colors, typography } = useTheme();

  const initialValues: Record<string, string> = {};
  fields.forEach((f) => {
    initialValues[f.name] = f.defaultValue || '';
  });
  const [values, setValues] = useState<Record<string, string>>(initialValues);
  const [selectOpen, setSelectOpen] = useState<string | null>(null);

  const setValue = (name: string, value: string) => {
    setValues((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = () => {
    const missing = fields
      .filter((f) => f.required && !values[f.name]?.trim())
      .map((f) => f.label);
    if (missing.length > 0) {
      Alert.alert('Required Fields', `Please fill in: ${missing.join(', ')}`);
      return;
    }
    onFormSubmit(formId, values);
  };

  const renderField = (field: FormField) => {
    switch (field.type) {
      case 'text':
      case 'number':
      case 'address':
        return (
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.tertiarySystemBackground,
                color: colors.label,
                borderColor: colors.separator,
              },
              field.type === 'address' && { fontFamily: 'Courier' },
            ]}
            value={values[field.name]}
            onChangeText={(t) => setValue(field.name, t)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.tertiaryLabel}
            keyboardType={field.type === 'number' ? 'numeric' : 'default'}
            autoCapitalize="none"
          />
        );

      case 'textarea':
        return (
          <TextInput
            style={[
              styles.input,
              styles.textArea,
              {
                backgroundColor: colors.tertiarySystemBackground,
                color: colors.label,
                borderColor: colors.separator,
              },
            ]}
            value={values[field.name]}
            onChangeText={(t) => setValue(field.name, t)}
            placeholder={field.placeholder}
            placeholderTextColor={colors.tertiaryLabel}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        );

      case 'select':
        return (
          <View>
            <TouchableOpacity
              style={[
                styles.selectTrigger,
                {
                  backgroundColor: colors.tertiarySystemBackground,
                  borderColor: colors.separator,
                },
              ]}
              onPress={() =>
                setSelectOpen(selectOpen === field.name ? null : field.name)
              }
            >
              <Text
                style={{
                  color: values[field.name]
                    ? colors.label
                    : colors.tertiaryLabel,
                  fontSize: 15,
                }}
              >
                {values[field.name]
                  ? field.options?.find((o) => o.value === values[field.name])
                      ?.label || values[field.name]
                  : field.placeholder || 'Select...'}
              </Text>
              <Text style={{ color: colors.tertiaryLabel, fontSize: 13 }}>
                {selectOpen === field.name ? '\u25B2' : '\u25BC'}
              </Text>
            </TouchableOpacity>
            {selectOpen === field.name && field.options && (
              <View
                style={[
                  styles.selectDropdown,
                  {
                    backgroundColor: colors.secondarySystemBackground,
                    borderColor: colors.separator,
                  },
                ]}
              >
                {field.options.map((opt) => (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      styles.selectOption,
                      { borderBottomColor: colors.separator },
                      values[field.name] === opt.value && {
                        backgroundColor: colors.tint + '1A',
                      },
                    ]}
                    onPress={() => {
                      setValue(field.name, opt.value);
                      setSelectOpen(null);
                    }}
                  >
                    <Text
                      style={{
                        color:
                          values[field.name] === opt.value
                            ? colors.tint
                            : colors.label,
                        fontSize: 15,
                      }}
                    >
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        );

      case 'checkbox':
        return (
          <View style={styles.checkboxRow}>
            <Switch
              value={values[field.name] === 'true'}
              onValueChange={(v) => setValue(field.name, v ? 'true' : 'false')}
              trackColor={{ false: colors.systemFill, true: colors.tint + '66' }}
              thumbColor={
                values[field.name] === 'true' ? colors.tint : colors.tertiaryLabel
              }
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <View style={styles.container}>
      {fields.map((field) => (
        <View key={field.name} style={styles.fieldContainer}>
          <View style={styles.labelRow}>
            <Text style={[styles.label, { color: colors.secondaryLabel }]}>
              {field.label}
            </Text>
            {field.required && (
              <Text style={[styles.required, { color: colors.destructive }]}>
                *
              </Text>
            )}
          </View>
          {renderField(field)}
        </View>
      ))}

      <View style={styles.buttonRow}>
        {cancelLabel && (
          <TouchableOpacity
            style={[
              styles.cancelBtn,
              { borderColor: colors.separator },
            ]}
            onPress={() => onFormSubmit(formId, {})}
          >
            <Text style={[styles.cancelText, { color: colors.secondaryLabel }]}>
              {cancelLabel}
            </Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: colors.tint }]}
          onPress={handleSubmit}
        >
          <Text style={styles.submitText}>{submitLabel}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  fieldContainer: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  required: {
    fontSize: 14,
    fontWeight: '700',
  },
  input: {
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
    borderWidth: 1,
  },
  textArea: {
    minHeight: 80,
  },
  selectTrigger: {
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectDropdown: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    overflow: 'hidden',
  },
  selectOption: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  cancelBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '600',
  },
  submitBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
});
