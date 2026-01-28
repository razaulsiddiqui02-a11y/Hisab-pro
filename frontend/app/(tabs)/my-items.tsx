import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface Item {
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
}

interface Claim {
  id: string;
  item_id: string;
  claimer_id: string;
  claimer_name: string;
  status: string;
  created_at: string;
}

export default function MyItemsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'posted' | 'claimed'>('posted');
  const [myItems, setMyItems] = useState<Item[]>([]);
  const [myClaims, setMyClaims] = useState<Claim[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [itemsRes, claimsRes] = await Promise.all([
        api.get('/items', { params: { my_items: true } }),
        api.get('/claims'),
      ]);
      setMyItems(itemsRes.data);
      setMyClaims(claimsRes.data.filter((c: Claim) => c.claimer_id === user?.id));
    } catch (error: any) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'closed': return '#64748b';
      case 'handed_over': return '#3b82f6';
      case 'rejected': return '#ef4444';
      default: return '#64748b';
    }
  };

  const handleMarkHandedOver = async (itemId: string) => {
    Alert.alert(
      'Mark as Handed Over',
      'Have you handed this item to the owner?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await api.put(`/items/${itemId}/status`, { status: 'handed_over' });
              fetchData();
              Alert.alert('Success', 'Item marked as handed over');
            } catch (error: any) {
              Alert.alert('Error', error.message);
            }
          },
        },
      ]
    );
  };

  const renderPostedItem = ({ item }: { item: Item }) => (
    <TouchableOpacity
      style={styles.itemCard}
      onPress={() => router.push(`/item/${item.id}`)}
      activeOpacity={0.8}
    >
      {item.images && item.images[0] && (
        <Image source={{ uri: item.images[0] }} style={styles.itemImage} resizeMode="cover" />
      )}
      <View style={styles.itemContent}>
        <View style={styles.itemHeader}>
          <Text style={styles.itemCategory}>{item.category}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <View style={styles.itemLocation}>
          <Ionicons name="location" size={14} color="#94a3b8" />
          <Text style={styles.locationText}>{item.city}</Text>
        </View>
        <Text style={styles.itemDescription} numberOfLines={2}>
          {item.description}
        </Text>
        {item.status === 'approved' && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleMarkHandedOver(item.id)}
          >
            <Ionicons name="checkmark-done" size={18} color="#fff" />
            <Text style={styles.actionButtonText}>Mark Handed Over</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderClaimedItem = ({ item }: { item: Claim }) => (
    <TouchableOpacity
      style={styles.claimCard}
      onPress={() => router.push(`/item/${item.item_id}`)}
      activeOpacity={0.8}
    >
      <View style={styles.claimContent}>
        <View style={styles.claimHeader}>
          <Text style={styles.claimTitle}>Claim #{item.id.slice(-6)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
            <Text style={styles.statusText}>{item.status}</Text>
          </View>
        </View>
        <Text style={styles.claimDate}>
          Claimed on: {new Date(item.created_at).toLocaleDateString()}
        </Text>
        <View style={styles.claimFooter}>
          <Text style={styles.viewDetails}>View Details</Text>
          <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Items</Text>
      </View>

      <View style={styles.tabsContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'posted' && styles.tabActive]}
          onPress={() => setActiveTab('posted')}
        >
          <Ionicons
            name="archive"
            size={20}
            color={activeTab === 'posted' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, activeTab === 'posted' && styles.tabTextActive]}>
            Posted ({myItems.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'claimed' && styles.tabActive]}
          onPress={() => setActiveTab('claimed')}
        >
          <Ionicons
            name="hand-left"
            size={20}
            color={activeTab === 'claimed' ? '#3b82f6' : '#64748b'}
          />
          <Text style={[styles.tabText, activeTab === 'claimed' && styles.tabTextActive]}>
            Claimed ({myClaims.length})
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : activeTab === 'posted' ? (
        <FlatList
          data={myItems}
          keyExtractor={(item) => item.id}
          renderItem={renderPostedItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="archive-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No items posted</Text>
              <Text style={styles.emptyText}>Found something? Post it to help others!</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/post')}
              >
                <Text style={styles.emptyButtonText}>Post Found Item</Text>
              </TouchableOpacity>
            </View>
          }
        />
      ) : (
        <FlatList
          data={myClaims}
          keyExtractor={(item) => item.id}
          renderItem={renderClaimedItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#3b82f6"
              colors={['#3b82f6']}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="hand-left-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No claims yet</Text>
              <Text style={styles.emptyText}>Lost something? Search and claim items!</Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/(tabs)/home')}
              >
                <Text style={styles.emptyButtonText}>Search Items</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 12,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#1e293b',
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748b',
  },
  tabTextActive: {
    color: '#3b82f6',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 20,
    paddingTop: 0,
  },
  itemCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
  },
  itemImage: {
    width: '100%',
    height: 140,
    backgroundColor: '#334155',
  },
  itemContent: {
    padding: 16,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  itemCategory: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  itemLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  locationText: {
    fontSize: 14,
    color: '#94a3b8',
  },
  itemDescription: {
    fontSize: 14,
    color: '#cbd5e1',
    lineHeight: 20,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#22c55e',
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  claimCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  claimContent: {
    padding: 16,
  },
  claimHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  claimTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  claimDate: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  claimFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  viewDetails: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginTop: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 4,
    textAlign: 'center',
  },
  emptyButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 20,
  },
  emptyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
