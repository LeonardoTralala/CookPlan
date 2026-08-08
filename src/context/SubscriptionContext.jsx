import { useState, useEffect, useMemo, useCallback } from "react";
import { SubscriptionContext } from "./subscription-context.js";
import { getCurrentSubscription } from "../services/subscriptionService.js";
import { useAuth } from "../hooks/useAuth.js";

export function SubscriptionProvider({ children }) {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

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
    if (!user) return;
    setLoading(true);
    try {
      const sub = await getCurrentSubscription();
      setSubscription(sub);
    } catch (err) {
      console.error("Failed to fetch subscription:", err);
      setSubscription(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const value = useMemo(() => ({
    subscription,
    loading,
    refreshSubscription,
  }), [subscription, loading, refreshSubscription]);

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}
