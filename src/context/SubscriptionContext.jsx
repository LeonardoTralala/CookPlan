import { useState, useEffect, useMemo, useCallback } from "react";
import { SubscriptionContext } from "./subscription-context.js";
import { getCurrentSubscription } from "../services/subscriptionService.js";
import { useAuth } from "../hooks/useAuth.js";
import { supabase } from "../lib/supabase.js";
import { SubscriptionCelebrationModal } from "../components/SubscriptionCelebrationModal.jsx";

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showCelebrationModal, setShowCelebrationModal] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetch = async () => {
      if (!user) {
        setSubscription(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const sub = await getCurrentSubscription();
        if (mounted) setSubscription(sub);
      } catch (err) {
        console.error("Failed to fetch subscription:", err);
        if (mounted) setSubscription(null);
      } finally {
        if (mounted) setLoading(false);
      }
    };
    fetch();
    return () => { mounted = false; };
  }, [user]);

  const refreshSubscription = useCallback(async () => {
    if (!user) return null;
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      setSubscription(sub);
      return sub;
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
      setSubscription(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Realtime Listener saat admin menyetujui langganan
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`user-subscription-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'subscriptions',
          filter: `user_id=eq.${user.id}`
        },
        async (payload) => {
          if (payload.new && payload.new.status === 'active') {
            setSubscription(payload.new);
            setShowCelebrationModal(true);
          } else {
            await refreshSubscription();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, refreshSubscription]);

  // Polling fallback saat status pending (tiap 8 detik)
  useEffect(() => {
    if (!user || subscription?.status !== 'pending') return;

    const interval = setInterval(async () => {
      try {
        const sub = await getCurrentSubscription();
        if (sub && sub.status === 'active') {
          setSubscription(sub);
          setShowCelebrationModal(true);
        }
      } catch (err) {
        console.error("Failed to poll subscription:", err);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [user, subscription?.status]);

  const value = useMemo(() => ({
    subscription,
    loading,
    refreshSubscription,
    showCelebrationModal,
    setShowCelebrationModal
  }), [subscription, loading, refreshSubscription, showCelebrationModal]);

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
      <SubscriptionCelebrationModal
        isOpen={showCelebrationModal}
        onClose={() => setShowCelebrationModal(false)}
        subscription={subscription}
      />
    </SubscriptionContext.Provider>
  );
}
