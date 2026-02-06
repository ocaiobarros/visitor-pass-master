/**
 * GUARDA OPERACIONAL - Logger Estruturado
 * 
 * Winston logger com:
 * - Saída para console (fallback)
 * - Saída para /var/log/visitor-pass/app.log (todos os níveis)
 * - Saída para /var/log/visitor-pass/error.log (apenas ERROR e FATAL)
 * - Formato estruturado com timestamp ISO, serviço e stack trace
 * - Flush imediato (sem buffer) para compatibilidade com tail -f
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

const LOG_DIR = process.env.LOG_DIR || '/var/log/visitor-pass';
const SERVICE_NAME = process.env.SERVICE_NAME || 'admin-api';

// Garantir que o diretório de logs existe
const ensureLogDir = () => {
  try {
    if (!fs.existsSync(LOG_DIR)) {
      fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    return true;
  } catch (error) {
    console.error(`[LOGGER] Não foi possível criar diretório de logs: ${error.message}`);
    return false;
  }
};

// Formato customizado para logs estruturados
const structuredFormat = winston.format.printf(({ level, message, timestamp, service, stack, ...meta }) => {
  const levelUpper = level.toUpperCase();
  const svc = service || SERVICE_NAME;
  
  let logLine = `[${timestamp}] [${levelUpper}] [${svc}] ${message}`;
  
  // Adicionar stack trace se existir
  if (stack) {
    logLine += `\nStack: ${stack}`;
  }
  
  // Adicionar metadados extras se existirem
  const extraKeys = Object.keys(meta);
  if (extraKeys.length > 0) {
    logLine += `\nMeta: ${JSON.stringify(meta)}`;
  }
  
  return logLine;
});

// Níveis customizados incluindo FATAL
const customLevels = {
  levels: {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    http: 4,
    debug: 5,
  },
  colors: {
    fatal: 'red bold',
    error: 'red',
    warn: 'yellow',
    info: 'green',
    http: 'magenta',
    debug: 'blue',
  }
};

winston.addColors(customLevels.colors);

// Criar transports
const transports = [];

// Console transport (sempre ativo como fallback)
transports.push(
  new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
      structuredFormat
    )
  })
);

// File transports (se o diretório existir)
if (ensureLogDir()) {
  // App log - todos os níveis
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'app.log'),
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        structuredFormat
      ),
      // Flush imediato para tail -f
      options: { flags: 'a' },
    })
  );

  // Error log - apenas error e fatal
  transports.push(
    new winston.transports.File({
      filename: path.join(LOG_DIR, 'error.log'),
      level: 'error',
      format: winston.format.combine(
        winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ssZ' }),
        structuredFormat
      ),
      options: { flags: 'a' },
    })
  );
}

// Criar logger
const logger = winston.createLogger({
  levels: customLevels.levels,
  level: process.env.LOG_LEVEL || 'info',
  defaultMeta: { service: SERVICE_NAME },
  transports,
  // Não crashar se o logger falhar
  exitOnError: false,
});

// Métodos auxiliares
logger.fatal = (message, meta = {}) => {
  logger.log('fatal', message, meta);
};

// Método para logar erros com stack trace
logger.logError = (message, error, meta = {}) => {
  logger.error(message, {
    ...meta,
    stack: error?.stack || '',
    errorMessage: error?.message || '',
  });
};

// Método para logar requisições HTTP
logger.logRequest = (req, statusCode, duration) => {
  const level = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'http';
  logger.log(level, `${req.method} ${req.path} ${statusCode} ${duration}ms`, {
    method: req.method,
    path: req.path,
    statusCode,
    duration,
    ip: req.ip || req.connection?.remoteAddress,
  });
};

module.exports = logger;
