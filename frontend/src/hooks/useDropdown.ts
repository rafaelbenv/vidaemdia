import { useEffect, useRef, useState } from 'react';

export function useDropdown<T extends HTMLElement = HTMLDivElement>() {
  const [open, setOpen] = useState<boolean>(false);
  const ref = useRef<T>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false);
        const trigger = ref.current?.querySelector('button');
        if (trigger instanceof HTMLElement) {
          trigger.focus();
        }
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  return { open, setOpen, ref };
}
