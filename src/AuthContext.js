import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { supabase } from "./supabaseClient";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async (userId) => {
    const { data } = await supabase
      .from("subscriptions")
      .select("status, current_period_end, stripe_customer_id")
      .eq("user_id", userId)
      .maybeSingle();
    setSubscription(data);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) fetchSubscription(session.user.id);
      setLoading(false);
    });

    const { data: { subscription: authListener } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchSubscription(session.user.id);
        } else {
          setSubscription(null);
        }
      }
    );

    return () => authListener.unsubscribe();
  }, [fetchSubscription]);

  // Poll for subscription activation after successful Stripe checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("checkout") !== "success" || !user) return;
    window.history.replaceState({}, "", "/");
    let attempts = 0;
    const poll = setInterval(async () => {
      attempts++;
      await fetchSubscription(user.id);
      if (attempts >= 6) clearInterval(poll);
    }, 2000);
    return () => clearInterval(poll);
  }, [user, fetchSubscription]);

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password });

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password });

  const signOut = async () => {
    setSubscription(null);
    return supabase.auth.signOut();
  };

  const openCheckout = async () => {
    const { data, error } = await supabase.functions.invoke("create-checkout-session");
    if (error) throw new Error(error.message);
    window.location.href = data.url;
  };

  const openPortal = async () => {
    const { data, error } = await supabase.functions.invoke("create-portal-session");
    if (error) throw new Error(error.message);
    window.location.href = data.url;
  };

  const isPro = subscription?.status === "active";

  return (
    <AuthContext.Provider value={{
      user, subscription, isPro, loading,
      signIn, signUp, signOut, openCheckout, openPortal,
      refreshSubscription: () => user && fetchSubscription(user.id),
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
