import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

interface ItemDetail {
  id: string;
  category: string;
  city: string;
  verification_questions?: { question: string }[];
}

export default function ClaimScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fetchItem = useCallback(async () => {
    try {
      const response = await api.get(`/items/${id}`);
      setItem(response.data);
      // Initialize answers array
      if (response.data.verification_questions) {
        setAnswers(new Array(response.data.verification_questions.length).fill(''));
      }
    } catch (error: any) {
      console.error('Error fetching item:', error);
      Alert.alert('Error', error.message || 'Failed to load item');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchItem();
  }, [fetchItem]);

  const updateAnswer = (index: number, value: string) => {
    const updated = [...answers];
    updated[index] = value;
    setAnswers(updated);
  };

  const handleSubmit = async () => {
    // Validate all answers filled
    if (answers.some(a => !a.trim())) {
      Alert.alert('Error', 'Please answer all verification questions');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/claims', {
        item_id: id,
        answers: answers.map(a => a.trim()),
      });

      Alert.alert(
        'Claim Submitted',
        'Your claim has been submitted. The finder will review your answers and contact you through chat.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/chats'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to submit claim');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  if (!item) {
    return null;
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Claim Item</Text>
          <View style={{ width: 44 }} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Item Summary */}
          <View style={styles.itemSummary}>
            <Text style={styles.itemCategory}>{item.category}</Text>
            <View style={styles.itemLocation}>
              <Ionicons name="location" size={16} color="#94a3b8" />
              <Text style={styles.locationText}>{item.city}</Text>
            </View>
          </View>

          {/* Instructions */}
          <View style={styles.instructionsCard}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
            <View style={styles.instructionsText}>
              <Text style={styles.instructionsTitle}>Verification Required</Text>
              <Text style={styles.instructionsDesc}>
                Please answer the following questions accurately. Only the real owner would know these answers.
              </Text>
            </View>
          </View>

          {/* Questions */}
          <View style={styles.questionsSection}>
            <Text style={styles.sectionTitle}>Verification Questions</Text>
            {item.verification_questions?.map((q, index) => (
              <View key={index} style={styles.questionCard}>
                <Text style={styles.questionNumber}>Question {index + 1}</Text>
                <Text style={styles.questionText}>{q.question}</Text>
                <TextInput
                  style={styles.answerInput}
                  placeholder="Your answer..."
                  placeholderTextColor="#64748b"
                  value={answers[index] || ''}
                  onChangeText={(v) => updateAnswer(index, v)}
                  multiline
                />
              </View>
            ))}
          </View>

          {/* Disclaimer */}
          <View style={styles.disclaimer}>
            <Ionicons name="warning" size={18} color="#f59e0b" />
            <Text style={styles.disclaimerText}>
              False claims may result in account suspension. Only claim items that belong to you.
            </Text>
          </View>
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>Submit Claim</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  keyboardView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  itemSummary: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  itemCategory: {
    fontSize: 20,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  instructionsCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  instructionsText: {
    flex: 1,
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  instructionsDesc: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  questionsSection: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  questionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  questionNumber: {
    fontSize: 12,
    fontWeight: '600',
    color: '#3b82f6',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 16,
    color: '#fff',
    marginBottom: 12,
  },
  answerInput: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 14,
    fontSize: 15,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    minHeight: 60,
    textAlignVertical: 'top',
  },
  disclaimer: {
    flexDirection: 'row',
    gap: 10,
    backgroundColor: '#422006',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  disclaimerText: {
    flex: 1,
    fontSize: 13,
    color: '#fcd34d',
    lineHeight: 18,
  },
  bottomAction: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
