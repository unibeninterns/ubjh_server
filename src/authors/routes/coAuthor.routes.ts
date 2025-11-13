import express from 'express';
import coAuthorController from '../controllers/coAuthor.controller';
import { authenticateAuthorToken } from '../../middleware/auth.middleware';

const router = express.Router();

// Protect all routes with author authentication
router.use(authenticateAuthorToken);

// Get all co-authors for a manuscript
router.get(
  '/manuscripts/:manuscriptId/co-authors',
  coAuthorController.getCoAuthors
);

// Update an incomplete co-author
router.put('/co-authors/:id', coAuthorController.updateCoAuthor);

export default router;
