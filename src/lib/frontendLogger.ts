/**
 * GUARDA OPERACIONAL - Frontend Logger
 * 
 * Captura erros do frontend e envia para o backend.
 * Inclui:
 * - window.onerror (erros JS síncronos)
 * - unhandledrejection (promises não tratadas)
 * - Erros de fetch
 * - API manual para logging
 */

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  level: LogLevel;
  message: string;
  error?: {
    message: string;
    stack?: string;
    name?: string;
  };
  source: string;
  meta?: Record<string, unknown>;
}

interface FrontendLoggerConfig {
  endpoint: string;
  batchSize?: number;
  flushInterval?: number;
  enabled?: boolean;
}

class FrontendLogger {
  private config: Required<FrontendLoggerConfig>;
  private queue: LogEntry[] = [];
  private flushTimer: ReturnType<typeof setTimeout> | null = null;
  private isOnline = true;

  constructor(config: FrontendLoggerConfig) {
    this.config = {
      endpoint: config.endpoint,
      batchSize: config.batchSize ?? 10,
      flushInterval: config.flushInterval ?? 5000,
      enabled: config.enabled ?? true,
    };

    this.setupGlobalHandlers();
    this.startFlushTimer();

    // Track online/offline status
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => { this.isOnline = true; });
      window.addEventListener('offline', () => { this.isOnline = false; });
    }
  }

  private setupGlobalHandlers() {
    if (typeof window === 'undefined') return;

    // Capturar erros JS não tratados
    window.onerror = (message, source, lineno, colno, error) => {
      this.error(`Uncaught error: ${message}`, {
        source: source || 'unknown',
        lineno,
        colno,
        stack: error?.stack,
      });
      return false; // Permite propagação para console
    };

    // Capturar promises rejeitadas não tratadas
    window.addEventListener('unhandledrejection', (event) => {
      const reason = event.reason;
      this.error('Unhandled promise rejection', {
        reason: reason?.message || String(reason),
        stack: reason?.stack,
      });
    });

    // Capturar falhas de fetch (network error) e respostas 4xx/5xx do auth
    // (sem quebrar a aplicação e sem consumir o body do caller)
    const w = window as unknown as { __vpFetchWrapped?: boolean; fetch: typeof fetch };
    if (!w.__vpFetchWrapped && typeof w.fetch === 'function') {
      const originalFetch = w.fetch.bind(window);
      w.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : (input instanceof URL ? input.toString() : (input as Request).url);

        try {
          const res = await originalFetch(input as any, init);

          // Logar somente endpoints sensíveis para não inundar log
          const shouldInspect = url.includes('/auth/v1/') || url.includes('/rest/v1/') || url.includes('/admin/v1/');
          if (shouldInspect && !res.ok) {
            // Clonar para ler sem afetar o consumidor
            const cloned = res.clone();
            const bodyPreview = await cloned.text().catch(() => '');

            this.warn(`Fetch non-OK: ${url}`, {
              status: res.status,
              statusText: res.statusText,
              method: init?.method || 'GET',
              bodyPreview: bodyPreview?.slice(0, 500),
            });
          }

          return res;
        } catch (err) {
          this.logFetchError(url, err, init);
          throw err;
        }
      }) as any;

      w.__vpFetchWrapped = true;
    }
  }

  private startFlushTimer() {
    if (this.flushTimer) return;
    
    this.flushTimer = setInterval(() => {
      this.flush();
    }, this.config.flushInterval);
  }

  private async sendLogs(entries: LogEntry[]) {
    if (!this.config.enabled || entries.length === 0) return;
    if (!this.isOnline) return;

    try {
      for (const entry of entries) {
        await fetch(this.config.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(entry),
        });
      }
    } catch (err) {
      // Fallback para console se falhar envio
      console.error('[FrontendLogger] Failed to send logs:', err);
      entries.forEach(entry => {
        console.log(`[${entry.level.toUpperCase()}] ${entry.message}`, entry.meta);
      });
    }
  }

  private enqueue(entry: LogEntry) {
    this.queue.push(entry);

    // Flush imediato para erros
    if (entry.level === 'error' || entry.level === 'fatal') {
      this.flush();
    } else if (this.queue.length >= this.config.batchSize) {
      this.flush();
    }
  }

  public flush() {
    if (this.queue.length === 0) return;
    
    const entries = [...this.queue];
    this.queue = [];
    this.sendLogs(entries);
  }

  private log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const entry: LogEntry = {
      level,
      message,
      source: 'frontend',
      meta: {
        ...meta,
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        timestamp: new Date().toISOString(),
      },
    };

    // Se meta contém um erro, extrair informações
    if (meta?.error instanceof Error) {
      entry.error = {
        message: meta.error.message,
        stack: meta.error.stack,
        name: meta.error.name,
      };
      delete entry.meta!.error;
    }

    // Sempre logar no console também
    const consoleFn = level === 'error' || level === 'fatal' ? console.error :
                      level === 'warn' ? console.warn :
                      level === 'debug' ? console.debug : console.log;
    consoleFn(`[${level.toUpperCase()}] ${message}`, meta);

    this.enqueue(entry);
  }

  // Public API
  public fatal(message: string, meta?: Record<string, unknown>) {
    this.log('fatal', message, meta);
  }

  public error(message: string, meta?: Record<string, unknown>) {
    this.log('error', message, meta);
  }

  public warn(message: string, meta?: Record<string, unknown>) {
    this.log('warn', message, meta);
  }

  public info(message: string, meta?: Record<string, unknown>) {
    this.log('info', message, meta);
  }

  public debug(message: string, meta?: Record<string, unknown>) {
    this.log('debug', message, meta);
  }

  // Helper para logar erros de fetch
  public logFetchError(url: string, error: unknown, options?: RequestInit) {
    this.error(`Fetch failed: ${url}`, {
      error: error instanceof Error ? error : new Error(String(error)),
      method: options?.method || 'GET',
    });
  }

  // Cleanup
  public destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    this.flush();
  }
}

// Determinar endpoint baseado no ambiente
const getLogEndpoint = (): string => {
  // Em produção self-hosted, usar ADMIN_API_URL ou construir a partir da URL atual
  const adminApiUrl = import.meta.env.VITE_ADMIN_API_URL;
  if (adminApiUrl) {
    return `${adminApiUrl}/logs`;
  }
  
  // Fallback: mesmo host, porta 8000 (Kong)
  if (typeof window !== 'undefined') {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000/admin/v1/logs`;
  }
  
  return '/admin/v1/logs';
};

// Singleton instance
export const frontendLogger = new FrontendLogger({
  endpoint: getLogEndpoint(),
  enabled: true,
  batchSize: 5,
  flushInterval: 3000,
});

// Export para uso em outros módulos
export default frontendLogger;
