import React, { createContext, useContext, useReducer, useCallback, useEffect, useRef } from 'react';

export type NotificationType = 'info' | 'success' | 'warning' | 'error';

export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  jobId?: string;
  read: boolean;
  timestamp: number;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
}

type NotificationAction =
  | { type: 'ADD'; notification: Notification }
  | { type: 'MARK_READ'; id: string }
  | { type: 'MARK_ALL_READ' };

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'ADD':
      return {
        notifications: [action.notification, ...state.notifications],
        unreadCount: state.unreadCount + 1,
      };
    case 'MARK_READ': {
      const notifications = state.notifications.map(n =>
        n.id === action.id ? { ...n, read: true } : n
      );
      return {
        notifications,
        unreadCount: notifications.filter(n => !n.read).length,
      };
    }
    case 'MARK_ALL_READ':
      return {
        notifications: state.notifications.map(n => ({ ...n, read: true })),
        unreadCount: 0,
      };
    default:
      return state;
  }
}

interface NotificationContextValue {
  notifications: Notification[];
  unreadCount: number;
  showNotification: (notification: Omit<Notification, 'id' | 'read' | 'timestamp'>) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  pendingBanner: Notification | null;
  clearPendingBanner: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

// Map SSE event types to notifications
function mapEventToNotification(event: { type: string; data: any }): Omit<Notification, 'id' | 'read' | 'timestamp'> | null {
  switch (event.type) {
    case 'bid_placed':
      return {
        type: 'info',
        title: 'New Bid',
        body: `${event.data.agentName || 'An agent'} placed a bid on your job`,
        jobId: event.data.jobId,
      };
    case 'job_completed':
      return {
        type: 'success',
        title: 'Job Completed',
        body: `Your job "${event.data.title || 'Untitled'}" has been completed`,
        jobId: event.data.jobId,
      };
    case 'delivery_submitted':
      return {
        type: 'info',
        title: 'Delivery Submitted',
        body: 'An agent has submitted a delivery for review',
        jobId: event.data.jobId,
      };
    case 'validation_complete':
      return {
        type: event.data.passed ? 'success' : 'warning',
        title: 'Validation Complete',
        body: event.data.passed ? 'Delivery passed validation' : 'Delivery failed validation',
        jobId: event.data.jobId,
      };
    case 'bid_accepted':
      return {
        type: 'success',
        title: 'Bid Accepted',
        body: `Your bid on "${event.data.title || 'a job'}" has been accepted`,
        jobId: event.data.jobId,
      };
    case 'delivery_approved':
      return {
        type: 'success',
        title: 'Delivery Approved',
        body: `Delivery for "${event.data.title || 'a job'}" has been approved. Funds released.`,
        jobId: event.data.jobId,
      };
    case 'dispute_opened':
      return {
        type: 'error',
        title: 'Dispute Opened',
        body: `A dispute has been opened on your job`,
        jobId: event.data.jobId,
      };
    default:
      return null;
  }
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(notificationReducer, {
    notifications: [],
    unreadCount: 0,
  });
  const [pendingBanner, setPendingBanner] = React.useState<Notification | null>(null);
  const bannerQueue = useRef<Notification[]>([]);

  const showNotification = useCallback((notif: Omit<Notification, 'id' | 'read' | 'timestamp'>) => {
    const notification: Notification = {
      ...notif,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      read: false,
      timestamp: Date.now(),
    };
    dispatch({ type: 'ADD', notification });

    // Queue banner
    if (pendingBanner) {
      bannerQueue.current.push(notification);
    } else {
      setPendingBanner(notification);
    }
  }, [pendingBanner]);

  const clearPendingBanner = useCallback(() => {
    if (bannerQueue.current.length > 0) {
      setPendingBanner(bannerQueue.current.shift()!);
    } else {
      setPendingBanner(null);
    }
  }, []);

  const markRead = useCallback((id: string) => {
    dispatch({ type: 'MARK_READ', id });
  }, []);

  const markAllRead = useCallback(() => {
    dispatch({ type: 'MARK_ALL_READ' });
  }, []);

  // Connect to SSE stream for real-time notifications
  useEffect(() => {
    let eventSource: any = null;
    try {
      const EventSource = require('react-native-sse').default;
      eventSource = new EventSource(`${API_URL}/v1/stream/jobs`);

      eventSource.addEventListener('message', (event: any) => {
        try {
          const data = JSON.parse(event.data);
          const notif = mapEventToNotification(data);
          if (notif) {
            showNotification(notif);
          }
        } catch {
          // Ignore parse errors
        }
      });

      eventSource.addEventListener('error', () => {
        // SSE will auto-reconnect
      });
    } catch {
      // SSE not available, notifications still work via showNotification()
    }

    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications: state.notifications,
        unreadCount: state.unreadCount,
        showNotification,
        markRead,
        markAllRead,
        pendingBanner,
        clearPendingBanner,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
