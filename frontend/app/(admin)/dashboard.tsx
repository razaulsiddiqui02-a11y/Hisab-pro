import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/services/api';
import { useAuth } from '../../src/contexts/AuthContext';

interface Stats {
  total_users: number;
  total_items: number;
  pending_items: number;
  approved_items: number;
  resolved_cases: number;
  pending_reports: number;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const response = await api.get('/admin/stats');
      setStats(response.data);
    } catch (error: any) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchStats();
  };

  const StatCard = ({ icon, title, value, color, onPress }: any) => (
    <TouchableOpacity
      style={[styles.statCard, { borderLeftColor: color }]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.statIconWrapper, { backgroundColor: color + '20' }]}>
        <Ionicons name={icon} size={24} color={color} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </TouchableOpacity>
  );

  const MenuCard = ({ icon, title, subtitle, onPress, badge }: any) => (
    <TouchableOpacity style={styles.menuCard} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.menuCardLeft}>
        <Ionicons name={icon} size={24} color="#3b82f6" />
        <View>
          <Text style={styles.menuCardTitle}>{title}</Text>
          <Text style={styles.menuCardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <View style={styles.menuCardRight}>
        {badge > 0 && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{badge}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={20} color="#64748b" />
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Admin Dashboard</Text>
          <Text style={styles.headerSubtitle}>Welcome, {user?.name}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#3b82f6"
          />
        }
      >
        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <StatCard
            icon="people"
            title="Total Users"
            value={stats?.total_users || 0}
            color="#3b82f6"
            onPress={() => router.push('/(admin)/users')}
          />
          <StatCard
            icon="archive"
            title="Total Items"
            value={stats?.total_items || 0}
            color="#22c55e"
            onPress={() => router.push('/(admin)/items')}
          />
          <StatCard
            icon="time"
            title="Pending Items"
            value={stats?.pending_items || 0}
            color="#f59e0b"
            onPress={() => router.push('/(admin)/items')}
          />
          <StatCard
            icon="checkmark-circle"
            title="Resolved"
            value={stats?.resolved_cases || 0}
            color="#8b5cf6"
            onPress={() => router.push('/(admin)/items')}
          />
        </View>

        {/* Quick Actions */}
        <Text style={styles.sectionTitle}>Management</Text>
        <View style={styles.menuSection}>
          <MenuCard
            icon="document-text"
            title="Manage Items"
            subtitle="Approve, reject or close item posts"
            badge={stats?.pending_items || 0}
            onPress={() => router.push('/(admin)/items')}
          />
          <MenuCard
            icon="people"
            title="Manage Users"
            subtitle="Block/unblock users, change roles"
            onPress={() => router.push('/(admin)/users')}
          />
          <MenuCard
            icon="flag"
            title="Reports"
            subtitle="Handle abuse reports"
            badge={stats?.pending_reports || 0}
            onPress={() => router.push('/(admin)/reports')}
          />
        </View>

        {/* Quick Stats Summary */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Overview</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Approved Items</Text>
            <Text style={styles.summaryValue}>{stats?.approved_items || 0}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Pending Reports</Text>
            <Text style={[styles.summaryValue, { color: '#ef4444' }]}>
              {stats?.pending_reports || 0}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Success Rate</Text>
            <Text style={[styles.summaryValue, { color: '#22c55e' }]}>
              {stats?.total_items
                ? Math.round((stats.resolved_cases / stats.total_items) * 100)
                : 0}%
            </Text>
          </View>
        </View>
      </ScrollView>
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
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginTop: 2,
  },
  scrollView: {
    flex: 1,
    padding: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: '47%',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
  },
  statIconWrapper: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  statTitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  menuSection: {
    gap: 12,
    marginBottom: 24,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  menuCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuCardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  menuCardSubtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 2,
  },
  menuCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  summaryCard: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 20,
    marginBottom: 40,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
  },
  summaryLabel: {
    fontSize: 14,
    color: '#94a3b8',
  },
  summaryValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
