import { Request, Response, NextFunction } from 'express';

export const parseManuscriptRequest = (req: Request, res: Response, next: NextFunction) => {
  if (req.body.keywords && typeof req.body.keywords === 'string') {
    try {
      req.body.keywords = JSON.parse(req.body.keywords);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid keywords format.' });
    }
  }

  if (req.body.submitter && typeof req.body.submitter === 'string') {
    try {
      req.body.submitter = JSON.parse(req.body.submitter);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid submitter format.' });
    }
  }

  if (req.body.coAuthors && typeof req.body.coAuthors === 'string') {
    try {
      req.body.coAuthors = JSON.parse(req.body.coAuthors);
    } catch (error) {
      return res.status(400).json({ success: false, message: 'Invalid coAuthors format.' });
    }
  }

  next();
};