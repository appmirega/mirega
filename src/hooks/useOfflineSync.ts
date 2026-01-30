import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

interface QueueItem {
  id?: string;
  action: string;
  target_table: string;
  data: any;
  synced?: boolean;
  created_at?: string;
}

export function useOfflineSync() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingItems, setPendingItems] = useState<QueueItem[]>([]);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadPendingItems();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    if (isOnline && pendingItems.length > 0 && !syncing) {
      syncPendingItems();
    }
  }, [isOnline, pendingItems.length]);

  const loadPendingItems = async () => {
    try {
      const { data: queueItems } = await supabase
        .from('offline_queue')
        .select('*')
        .eq('synced', false)
        .order('created_at', { ascending: true });

      if (queueItems) {
        setPendingItems(queueItems);
      }

      const localQueue = localStorage.getItem('offlineQueue');
      if (localQueue) {
        const parsed = JSON.parse(localQueue);
        setPendingItems(prev => [...prev, ...parsed]);
      }
    } catch (error) {
      console.error('Error loading pending items:', error);
      const localQueue = localStorage.getItem('offlineQueue');
      if (localQueue) {
        setPendingItems(JSON.parse(localQueue));
      }
    }
  };

  const queueAction = useCallback(async (item: QueueItem) => {
    const queueItem = {
      ...item,
      id: crypto.randomUUID(),
      created_at: new Date().toISOString(),
      synced: false
    };

    if (isOnline) {
      try {
        const { error } = await supabase
          .from('offline_queue')
          .insert(queueItem);

        if (!error) {
          setPendingItems(prev => [...prev, queueItem]);
          return true;
        }
      } catch (error) {
        console.error('Error queuing online:', error);
      }
    }

    const localQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    localQueue.push(queueItem);
    localStorage.setItem('offlineQueue', JSON.stringify(localQueue));
    setPendingItems(prev => [...prev, queueItem]);
    return true;
  }, [isOnline]);

  const syncPendingItems = async () => {
    if (syncing || !isOnline) return;

    setSyncing(true);
    const itemsToSync = [...pendingItems];
    const syncedIds: string[] = [];

    for (const item of itemsToSync) {
      try {
        let success = false;

        switch (item.action) {
          case 'insert':
            const { error: insertError } = await supabase
              .from(item.target_table)
              .insert(item.data);
            success = !insertError;
            break;

          case 'update':
            const { error: updateError } = await supabase
              .from(item.target_table)
              .update(item.data)
              .eq('id', item.data.id);
            success = !updateError;
            break;

          case 'delete':
            const { error: deleteError } = await supabase
              .from(item.target_table)
              .delete()
              .eq('id', item.data.id);
            success = !deleteError;
            break;
        }

        if (success && item.id) {
          if (item.id.includes('-')) {
            await supabase
              .from('offline_queue')
              .update({ synced: true, synced_at: new Date().toISOString() })
              .eq('id', item.id);
          }
          syncedIds.push(item.id);
        }
      } catch (error) {
        console.error('Error syncing item:', error);
      }
    }

    setPendingItems(prev => prev.filter(item => !syncedIds.includes(item.id!)));

    const localQueue = JSON.parse(localStorage.getItem('offlineQueue') || '[]');
    const updatedQueue = localQueue.filter((item: QueueItem) => !syncedIds.includes(item.id!));
    localStorage.setItem('offlineQueue', JSON.stringify(updatedQueue));

    setSyncing(false);
  };

  return {
    isOnline,
    pendingItems,
    syncing,
    queueAction,
    syncPendingItems
  };
}