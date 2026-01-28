import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';

interface Report {
  id: string;
  reporter_id: string;
  reporter_name: string;
  reported_user_id?: string;
  reported_user_name?: string;
  item_id?: string;
  reason: string;
  status: string;
  created_at: string;
}

export default function AdminReportsScreen() {
  const router = useRouter();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<string>('pending');

  const fetchReports = useCallback(async () => {
    try {
      const response = await api.get('/admin/reports');
      let data = response.data;
      if (filter !== 'all') {
        data = data.filter((r: Report) => r.status === filter);
      }
      setReports(data);
    } catch (error: any) {
      console.error('Error fetching reports:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchReports();
  };

  const updateReportStatus = async (reportId: string, status: string) => {
    try {
      await api.put(`/admin/reports/${reportId}`, { status });
      fetchReports();
      Alert.alert('Success', `Report marked as ${status}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    }
  };

  const handleResolve = (reportId: string) => {
    Alert.alert('Resolve Report', 'Mark this report as resolved?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Resolve', onPress: () => updateReportStatus(reportId, 'resolved') },
    ]);
  };

  const handleDismiss = (reportId: string) => {
    Alert.alert('Dismiss Report', 'Dismiss this report?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Dismiss', onPress: () => updateReportStatus(reportId, 'dismissed') },
    ]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'resolved': return '#22c55e';
      case 'pending': return '#f59e0b';
      case 'dismissed': return '#64748b';
      default: return '#64748b';
    }
  };

  const filters = ['pending', 'resolved', 'dismissed', 'all'];

  const renderReport = ({ item }: { item: Report }) => (
    <View style={styles.reportCard}>
      <View style={styles.reportHeader}>
        <View style={styles.reportType}>
          <Ionicons name="flag" size={18} color="#ef4444" />
          <Text style={styles.reportTitle}>Report #{item.id.slice(-6)}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) }]}>
          <Text style={styles.statusText}>{item.status}</Text>
        </View>
      </View>

      <View style={styles.reportContent}>
        <View style={styles.infoRow}>
          <Ionicons name="person" size={16} color="#94a3b8" />
          <Text style={styles.infoLabel}>Reporter:</Text>
          <Text style={styles.infoValue}>{item.reporter_name}</Text>
        </View>
        {item.reported_user_name && (
          <View style={styles.infoRow}>
            <Ionicons name="alert-circle" size={16} color="#ef4444" />
            <Text style={styles.infoLabel}>Reported:</Text>
            <Text style={styles.infoValue}>{item.reported_user_name}</Text>
          </View>
        )}
        <View style={styles.reasonBox}>
          <Text style={styles.reasonLabel}>Reason:</Text>
          <Text style={styles.reasonText}>{item.reason}</Text>
        </View>
        <Text style={styles.dateText}>
          {new Date(item.created_at).toLocaleDateString()}
        </Text>
      </View>

      <View style={styles.actions}>
        {item.status === 'pending' && (
          <>
            <TouchableOpacity
              style={[styles.actionBtn, styles.resolveBtn]}
              onPress={() => handleResolve(item.id)}
            >
              <Ionicons name="checkmark" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Resolve</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionBtn, styles.dismissBtn]}
              onPress={() => handleDismiss(item.id)}
            >
              <Ionicons name="close" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </>
        )}
        {item.item_id && (
          <TouchableOpacity
            style={[styles.actionBtn, styles.viewBtn]}
            onPress={() => router.push(`/item/${item.item_id}`)}
          >
            <Ionicons name="eye" size={18} color="#fff" />
            <Text style={styles.actionBtnText}>View Item</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Reports</Text>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterTab, filter === f && styles.filterTabActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <FlatList
          data={reports}
          keyExtractor={(item) => item.id}
          renderItem={renderReport}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3b82f6" />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="flag-outline" size={64} color="#334155" />
              <Text style={styles.emptyTitle}>No reports found</Text>
              <Text style={styles.emptyText}>No reports match the selected filter</Text>
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
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
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1e293b',
  },
  filterTabActive: {
    backgroundColor: '#3b82f6',
  },
  filterText: {
    fontSize: 13,
    color: '#94a3b8',
  },
  filterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
  },
  reportCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  reportHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  reportType: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reportTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  statusText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  reportContent: {},
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  infoLabel: {
    fontSize: 13,
    color: '#94a3b8',
  },
  infoValue: {
    fontSize: 13,
    color: '#fff',
    fontWeight: '500',
  },
  reasonBox: {
    backgroundColor: '#0f172a',
    borderRadius: 10,
    padding: 12,
    marginTop: 8,
  },
  reasonLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 4,
  },
  reasonText: {
    fontSize: 14,
    color: '#e2e8f0',
    lineHeight: 20,
  },
  dateText: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  resolveBtn: {
    backgroundColor: '#22c55e',
  },
  dismissBtn: {
    backgroundColor: '#64748b',
  },
  viewBtn: {
    backgroundColor: '#3b82f6',
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
  },
});
