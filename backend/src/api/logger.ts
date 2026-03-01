import { Request, Response, NextFunction } from 'express';
import { log } from '../lib/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const msg = `${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`;

    if (res.statusCode >= 500) {
      log.http.error(msg);
    } else if (res.statusCode >= 400) {
      log.http.warn(msg);
    } else {
      log.http.info(msg);
    }
  });

  next();
}
