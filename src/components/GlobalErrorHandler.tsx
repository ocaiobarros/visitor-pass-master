import { useEffect } from 'react';
import { toast } from 'sonner';

/**
 * Global error handler component that catches unhandled promise rejections
 * and runtime errors, preventing blank screens and providing user feedback.
 */
const GlobalErrorHandler = () => {
  useEffect(() => {
    // Handle unhandled promise rejections
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection:', event.reason);
      
      // Prevent the default behavior (console error) from also running
      event.preventDefault();

      // Extract error message
      let message = 'Ocorreu um erro inesperado.';
      if (event.reason instanceof Error) {
        message = event.reason.message;
      } else if (typeof event.reason === 'string') {
        message = event.reason;
      }

      // Don't show toast for network errors - these are usually handled elsewhere
      if (!message.includes('Failed to fetch') && !message.includes('NetworkError')) {
        toast.error('Erro', {
          description: message,
        });
      }
    };

    // Handle runtime errors
    const handleError = (event: ErrorEvent) => {
      console.error('Runtime error:', event.error);
      
      // Don't prevent default - we still want console errors for debugging
      // But show a user-friendly message
      if (event.error?.message && 
          !event.error.message.includes('ResizeObserver') && 
          !event.error.message.includes('Script error')) {
        toast.error('Erro', {
          description: 'Algo deu errado. Por favor, recarregue a página.',
        });
      }
    };

    window.addEventListener('unhandledrejection', handleRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener('unhandledrejection', handleRejection);
      window.removeEventListener('error', handleError);
    };
  }, []);

  return null;
};

export default GlobalErrorHandler;
