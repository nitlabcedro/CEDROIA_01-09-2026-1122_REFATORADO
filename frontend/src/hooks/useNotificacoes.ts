/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useCallback } from "react";

export interface NotificationToast {
  id: string;
  title: string;
  message: string;
  type: "success" | "info" | "warning" | "chat";
  actionLabel?: string;
  onAction?: () => void;
}

function playNotificationSound(type: "chat" | "success" | "info" | "warning") {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === "chat") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.1); // A5
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.15);
      osc2.start(ctx.currentTime + 0.1);
      osc2.stop(ctx.currentTime + 0.3);
    } else if (type === "success") {
      osc.type = "sine";
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = "sine";
      osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.15); // E5
      gain2.gain.setValueAtTime(0.1, ctx.currentTime + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      
      const osc3 = ctx.createOscillator();
      const gain3 = ctx.createGain();
      osc3.connect(gain3);
      gain3.connect(ctx.destination);
      osc3.type = "sine";
      osc3.frequency.setValueAtTime(783.99, ctx.currentTime + 0.3); // G5
      gain3.gain.setValueAtTime(0.1, ctx.currentTime + 0.3);
      gain3.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
      
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.2);
      osc2.start(ctx.currentTime + 0.15);
      osc2.stop(ctx.currentTime + 0.35);
      osc3.start(ctx.currentTime + 0.3);
      osc3.stop(ctx.currentTime + 0.5);
    } else {
      osc.type = "sine";
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      gain.gain.setValueAtTime(0.1, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    }
  } catch (e) {
    console.warn("Erro ao reproduzir som de notificação:", e);
  }
}

export function useNotifications() {
  const [toasts, setToasts] = useState<NotificationToast[]>([]);

  const addToast = useCallback((toast: Omit<NotificationToast, "id">) => {
    const id = Math.random().toString(36).substring(7);
    setToasts(prev => [...prev, { ...toast, id }]);
    playNotificationSound(toast.type);
    
    // Auto remove toast after 6 seconds
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 6000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return {
    toasts,
    addToast,
    removeToast
  };
}
