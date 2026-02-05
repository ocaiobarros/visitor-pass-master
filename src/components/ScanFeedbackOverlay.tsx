import { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Ban, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

type FeedbackStatus = 'success' | 'error' | 'blocked' | 'warning' | null;

interface ScanFeedbackOverlayProps {
  status: FeedbackStatus;
  message?: string;
  onComplete?: () => void;
  duration?: number;
}

const STATUS_CONFIG = {
  success: {
    icon: CheckCircle,
    bg: 'bg-success/95',
    text: 'text-success-foreground',
    label: 'LIBERADO',
  },
  error: {
    icon: XCircle,
    bg: 'bg-destructive/95',
    text: 'text-destructive-foreground',
    label: 'NÃO ENCONTRADO',
  },
  blocked: {
    icon: Ban,
    bg: 'bg-destructive/95',
    text: 'text-destructive-foreground',
    label: 'BLOQUEADO',
  },
  warning: {
    icon: AlertTriangle,
    bg: 'bg-warning/95',
    text: 'text-warning-foreground',
    label: 'ATENÇÃO',
  },
};

const ScanFeedbackOverlay = ({
  status,
  message,
  onComplete,
  duration = 1500,
}: ScanFeedbackOverlayProps) => {
  const [visible, setVisible] = useState(false);
  const [animating, setAnimating] = useState(false);

  useEffect(() => {
    if (status) {
      setVisible(true);
      setAnimating(true);

      const hideTimer = setTimeout(() => {
        setAnimating(false);
        setTimeout(() => {
          setVisible(false);
          onComplete?.();
        }, 300); // Fade out animation duration
      }, duration);

      return () => clearTimeout(hideTimer);
    }
  }, [status, duration, onComplete]);

  if (!visible || !status) return null;

  const config = STATUS_CONFIG[status];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-300',
        config.bg,
        animating ? 'opacity-100' : 'opacity-0'
      )}
    >
      {/* Animated icon */}
      <div
        className={cn(
          'transform transition-all duration-300',
          animating ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
        )}
      >
        <Icon
          className={cn(
            'w-32 h-32 md:w-48 md:h-48',
            config.text,
            status === 'success' && 'animate-pulse'
          )}
          strokeWidth={1.5}
        />
      </div>

      {/* Status label */}
      <h1
        className={cn(
          'text-4xl md:text-6xl font-black mt-6 tracking-wide',
          config.text,
          'transform transition-all duration-300 delay-100',
          animating ? 'translate-y-0 opacity-100' : 'translate-y-4 opacity-0'
        )}
      >
        {config.label}
      </h1>

      {/* Optional message */}
      {message && (
        <p
          className={cn(
            'text-xl md:text-2xl mt-4 max-w-lg text-center px-6',
            config.text,
            'opacity-90',
            'transform transition-all duration-300 delay-200',
            animating ? 'translate-y-0 opacity-90' : 'translate-y-4 opacity-0'
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default ScanFeedbackOverlay;
