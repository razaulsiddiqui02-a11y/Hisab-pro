import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface ItemDetail {
  id: string;
  finder_id: string;
  finder_name: string;
  category: string;
  city: string;
  location: string;
  date_found: string;
  description: string;
  images: string[];
  status: string;
  created_at: string;
  has_verification_questions: boolean;
  verification_questions?: { question: string; answer?: string }[];
}

export default function ItemDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { user } = useAuth();
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  const fetchItem = useCallback(async () => {
    try {
      const response = await api.get(`/items/${id}`);
      setItem(response.data);
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

  const handleReport = async () => {
    Alert.prompt(
      'Report Item',
      'Please describe the issue:',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Please provide a reason');
              return;
            }
            try {
              await api.post('/reports', {
                item_id: id,
                reported_user_id: item?.finder_id,
                reason: reason.trim(),
              });
              Alert.alert('Reported', 'Thank you for your report. We will review it.');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'closed': return '#64748b';
      case 'handed_over': return '#3b82f6';
      default: return '#64748b';
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

  const isOwner = item.finder_id === user?.id;
  const canClaim = !isOwner && item.status === 'approved';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Item Details</Text>
        <TouchableOpacity style={styles.reportButton} onPress={handleReport}>
          <Ionicons name="flag-outline" size={24} color="#ef4444" />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Image Gallery */}
        {item.images && item.images.length > 0 && (
          <View style={styles.imageSection}>
            <Image
              source={{ uri: item.images[currentImageIndex] }}
              style={styles.mainImage}
              resizeMode="cover"
            />
            {item.images.length > 1 && (
              <View style={styles.thumbnailsContainer}>
                {item.images.map((img, index) => (
                  <TouchableOpacity
                    key={index}
                    onPress={() => setCurrentImageIndex(index)}
                    style={[
                      styles.thumbnail,
                      currentImageIndex === index && styles.thumbnailActive,
                    ]}
                  >
                    <Image source={{ uri: img }} style={styles.thumbnailImage} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Item Info */}
        <View style={styles.infoSection}>
          <View style={styles.categoryRow}>
            <Text style={styles.category}>{item.category}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
              <Text style={styles.statusText}>{item.status}</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="location" size={18} color="#3b82f6" />
            <Text style={styles.infoText}>{item.city}, {item.location}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="calendar" size={18} color="#3b82f6" />
            <Text style={styles.infoText}>Found on: {item.date_found}</Text>
          </View>

          <View style={styles.infoRow}>
            <Ionicons name="person" size={18} color="#3b82f6" />
            <Text style={styles.infoText}>Posted by: {item.finder_name}</Text>
          </View>

          <View style={styles.descriptionSection}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.description}>{item.description}</Text>
          </View>

          {/* Verification Questions Preview */}
          {item.has_verification_questions && (
            <View style={styles.questionsSection}>
              <Text style={styles.sectionTitle}>Verification Required</Text>
              <Text style={styles.questionsHint}>
                To claim this item, you'll need to answer {item.verification_questions?.length || 0} verification question(s) to prove ownership.
              </Text>
            </View>
          )}

          {/* Owner Info */}
          {isOwner && (
            <View style={styles.ownerSection}>
              <Ionicons name="information-circle" size={20} color="#3b82f6" />
              <Text style={styles.ownerText}>You posted this item</Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Claim Button */}
      {canClaim && (
        <View style={styles.bottomAction}>
          <TouchableOpacity
            style={styles.claimButton}
            onPress={() => router.push(`/claim/${item.id}`)}
          >
            <Ionicons name="hand-left" size={24} color="#fff" />
            <Text style={styles.claimButtonText}>Claim This Item</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
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
  reportButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    backgroundColor: '#1e293b',
  },
  mainImage: {
    width: '100%',
    height: 300,
    backgroundColor: '#334155',
  },
  thumbnailsContainer: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  thumbnailActive: {
    borderColor: '#3b82f6',
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  infoSection: {
    padding: 20,
  },
  categoryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  category: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  infoText: {
    fontSize: 15,
    color: '#cbd5e1',
  },
  descriptionSection: {
    marginTop: 20,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: '#94a3b8',
    lineHeight: 22,
  },
  questionsSection: {
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  questionsHint: {
    fontSize: 14,
    color: '#94a3b8',
    lineHeight: 20,
  },
  ownerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    padding: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
  },
  ownerText: {
    fontSize: 14,
    color: '#3b82f6',
  },
  bottomAction: {
    padding: 20,
    paddingBottom: 30,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  claimButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#22c55e',
    padding: 18,
    borderRadius: 12,
  },
  claimButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
});
