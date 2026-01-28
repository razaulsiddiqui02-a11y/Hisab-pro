import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../../src/services/api';

const CATEGORIES = [
  'Mobile Phone',
  'Wallet',
  'Keys',
  'ID Card / Documents',
  'Bag / Backpack',
  'Laptop / Tablet',
  'Watch',
  'Jewelry',
  'Glasses / Sunglasses',
  'Clothing',
  'Electronics',
  'Pet',
  'Other',
];

interface VerificationQuestion {
  question: string;
  answer: string;
}

// Custom Alert Modal Component for Web compatibility
const CustomAlert = ({ visible, title, message, onClose, onConfirm, type = 'info' }: {
  visible: boolean;
  title: string;
  message: string;
  onClose: () => void;
  onConfirm?: () => void;
  type?: 'success' | 'error' | 'info';
}) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={alertStyles.overlay}>
      <View style={alertStyles.container}>
        <View style={[alertStyles.iconWrapper, { backgroundColor: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6' }]}>
          <Ionicons 
            name={type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle'} 
            size={32} 
            color="#fff" 
          />
        </View>
        <Text style={alertStyles.title}>{title}</Text>
        <Text style={alertStyles.message}>{message}</Text>
        <TouchableOpacity 
          style={[alertStyles.button, { backgroundColor: type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#3b82f6' }]} 
          onPress={onConfirm || onClose}
        >
          <Text style={alertStyles.buttonText}>OK</Text>
        </TouchableOpacity>
      </View>
    </View>
  </Modal>
);

const alertStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 22,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 10,
    width: '100%',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    textAlign: 'center',
  },
});

export default function PostItemScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [category, setCategory] = useState('');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [dateFound, setDateFound] = useState('');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState<VerificationQuestion[]>([
    { question: '', answer: '' },
  ]);
  const [showCategories, setShowCategories] = useState(false);

  const pickImage = async () => {
    if (images.length >= 3) {
      Alert.alert('Limit Reached', 'You can only upload up to 3 images');
      return;
    }

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'We need camera roll permission to upload images');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setImages([...images, base64Image]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const addQuestion = () => {
    if (questions.length >= 5) {
      Alert.alert('Limit Reached', 'You can add up to 5 verification questions');
      return;
    }
    setQuestions([...questions, { question: '', answer: '' }]);
  };

  const removeQuestion = (index: number) => {
    if (questions.length <= 1) {
      Alert.alert('Required', 'At least one verification question is required');
      return;
    }
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const updateQuestion = (index: number, field: 'question' | 'answer', value: string) => {
    const updated = [...questions];
    updated[index][field] = value;
    setQuestions(updated);
  };

  const handleSubmit = async () => {
    // Validation
    if (images.length === 0) {
      Alert.alert('Error', 'Please upload at least one image');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!city.trim() || !location.trim()) {
      Alert.alert('Error', 'Please enter city and location');
      return;
    }
    if (!dateFound.trim()) {
      Alert.alert('Error', 'Please enter the date found');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }

    const validQuestions = questions.filter(q => q.question.trim() && q.answer.trim());
    if (validQuestions.length === 0) {
      Alert.alert('Error', 'Please add at least one verification question with answer');
      return;
    }

    setLoading(true);
    try {
      await api.post('/items', {
        category,
        city: city.trim(),
        location: location.trim(),
        date_found: dateFound.trim(),
        description: description.trim(),
        images,
        verification_questions: validQuestions,
      });

      Alert.alert(
        'Success',
        'Your item has been posted and is pending approval.',
        [
          {
            text: 'OK',
            onPress: () => router.push('/(tabs)/my-items'),
          },
        ]
      );

      // Reset form
      setImages([]);
      setCategory('');
      setCity('');
      setLocation('');
      setDateFound('');
      setDescription('');
      setQuestions([{ question: '', answer: '' }]);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to post item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Post Found Item</Text>
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Images Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Photos (1-3)</Text>
            <View style={styles.imagesContainer}>
              {images.map((image, index) => (
                <View key={index} style={styles.imageWrapper}>
                  <Image source={{ uri: image }} style={styles.image} />
                  <TouchableOpacity
                    style={styles.removeImageButton}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons name="close" size={16} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
              {images.length < 3 && (
                <TouchableOpacity style={styles.addImageButton} onPress={pickImage}>
                  <Ionicons name="camera" size={32} color="#64748b" />
                  <Text style={styles.addImageText}>Add Photo</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>

          {/* Category Selection */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Category</Text>
            <TouchableOpacity
              style={styles.selectButton}
              onPress={() => setShowCategories(!showCategories)}
            >
              <Text style={category ? styles.selectButtonText : styles.selectPlaceholder}>
                {category || 'Select category'}
              </Text>
              <Ionicons
                name={showCategories ? 'chevron-up' : 'chevron-down'}
                size={20}
                color="#64748b"
              />
            </TouchableOpacity>
            {showCategories && (
              <View style={styles.categoriesList}>
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[
                      styles.categoryItem,
                      category === cat && styles.categoryItemActive,
                    ]}
                    onPress={() => {
                      setCategory(cat);
                      setShowCategories(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.categoryItemText,
                        category === cat && styles.categoryItemTextActive,
                      ]}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          {/* Location Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Location Details</Text>
            <TextInput
              style={styles.input}
              placeholder="City"
              placeholderTextColor="#64748b"
              value={city}
              onChangeText={setCity}
            />
            <TextInput
              style={styles.input}
              placeholder="Specific location (e.g., Central Park, Main Street)"
              placeholderTextColor="#64748b"
              value={location}
              onChangeText={setLocation}
            />
            <TextInput
              style={styles.input}
              placeholder="Date found (e.g., 2024-01-15)"
              placeholderTextColor="#64748b"
              value={dateFound}
              onChangeText={setDateFound}
            />
          </View>

          {/* Description Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Describe the item (avoid sensitive details like brand, color etc.)"
              placeholderTextColor="#64748b"
              value={description}
              onChangeText={setDescription}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
          </View>

          {/* Verification Questions */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Verification Questions</Text>
              <TouchableOpacity style={styles.addButton} onPress={addQuestion}>
                <Ionicons name="add" size={20} color="#3b82f6" />
              </TouchableOpacity>
            </View>
            <Text style={styles.sectionHint}>
              Ask questions only the real owner can answer
            </Text>
            {questions.map((q, index) => (
              <View key={index} style={styles.questionCard}>
                <View style={styles.questionHeader}>
                  <Text style={styles.questionNumber}>Question {index + 1}</Text>
                  <TouchableOpacity onPress={() => removeQuestion(index)}>
                    <Ionicons name="trash-outline" size={20} color="#ef4444" />
                  </TouchableOpacity>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Question (e.g., What color is the wallet?)"
                  placeholderTextColor="#64748b"
                  value={q.question}
                  onChangeText={(v) => updateQuestion(index, 'question', v)}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Answer (e.g., Brown)"
                  placeholderTextColor="#64748b"
                  value={q.answer}
                  onChangeText={(v) => updateQuestion(index, 'answer', v)}
                />
              </View>
            ))}
          </View>

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, loading && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color="#fff" />
                <Text style={styles.submitButtonText}>Post Item</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
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
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#e2e8f0',
    marginBottom: 12,
  },
  sectionHint: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 12,
    marginTop: -8,
  },
  imagesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageWrapper: {
    position: 'relative',
  },
  image: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#1e293b',
  },
  removeImageButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageButton: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addImageText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 4,
  },
  selectButton: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  selectButtonText: {
    fontSize: 16,
    color: '#fff',
  },
  selectPlaceholder: {
    fontSize: 16,
    color: '#64748b',
  },
  categoriesList: {
    marginTop: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    maxHeight: 250,
  },
  categoryItem: {
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  categoryItemActive: {
    backgroundColor: '#3b82f6',
  },
  categoryItemText: {
    fontSize: 15,
    color: '#e2e8f0',
  },
  categoryItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    color: '#fff',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  addButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  questionCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  questionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3b82f6',
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
    marginTop: 8,
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
