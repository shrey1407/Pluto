import { Request, Response } from 'express';

/** GET /api/hello - Simple hello handler. */
export const getHello = async (_req: Request, res: Response): Promise<void> => {
  res.json({ message: 'Hello from API' });
};
