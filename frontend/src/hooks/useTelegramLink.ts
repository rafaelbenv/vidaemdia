import { useEffect, useRef, useState } from 'react';

export function useTelegramLink() {
  const [telegramLinked, setTelegramLinked] = useState<boolean>(false);
  const [telegramWaiting, setTelegramWaiting] = useState<boolean>(false);
  const pollingRef = useRef<number | null>(null);
  const pollingTimeoutRef = useRef<number | null>(null);

  const stopPolling = () => {
    if (pollingRef.current !== null) {
      window.clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
    if (pollingTimeoutRef.current !== null) {
      window.clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    setTelegramWaiting(false);
  };

  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []);

  return {
    telegramLinked,
    setTelegramLinked,
    telegramWaiting,
    setTelegramWaiting,
    pollingRef,
    pollingTimeoutRef,
    stopPolling,
  };
}
