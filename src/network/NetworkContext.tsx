import NetInfo, { type NetInfoState } from "@react-native-community/netinfo";
import React, { createContext, useContext, useEffect, useRef, useState } from "react";
import { count as countPending, initLocationDb } from "@/db/locationDb";
import { flushQueue, onQueueChange } from "./flush";

type NetworkContextValue = {
  isOnline: boolean;
  queuedCount: number;
  refreshQueuedCount: () => Promise<void>;
  flushNow: () => Promise<number>;
};

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function NetworkProvider({ children }: { children: React.ReactNode }) {
  const [isOnline, setIsOnline] = useState<boolean>(true);
  const [queuedCount, setQueuedCount] = useState<number>(0);
  const wasOnlineRef = useRef<boolean>(true);

  const refreshQueuedCount = async () => {
    try {
      setQueuedCount(await countPending());
    } catch (err) {
      console.warn("[network] failed to read queue size", err);
    }
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      await initLocationDb();
      if (cancelled) return;
      await refreshQueuedCount();
    })();

    const unsubNet = NetInfo.addEventListener((state: NetInfoState) => {
      const online = !!state.isConnected && state.isInternetReachable !== false;
      setIsOnline(online);
      if (online && !wasOnlineRef.current) {
        // Came back online → attempt to drain.
        void flushQueue().then(() => refreshQueuedCount());
      }
      wasOnlineRef.current = online;
    });

    const unsubQueue = onQueueChange(() => {
      void refreshQueuedCount();
    });

    return () => {
      cancelled = true;
      unsubNet();
      unsubQueue();
    };
  }, []);

  const value: NetworkContextValue = {
    isOnline,
    queuedCount,
    refreshQueuedCount,
    flushNow: async () => {
      const n = await flushQueue();
      await refreshQueuedCount();
      return n;
    },
  };

  return <NetworkContext.Provider value={value}>{children}</NetworkContext.Provider>;
}

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used inside NetworkProvider");
  return ctx;
}
