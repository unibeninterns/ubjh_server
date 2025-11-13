import { Request, Response } from 'express';
import asyncHandler from '../../utils/asyncHandler';
import IncompleteCoAuthor from '../../Manuscript_Submission/models/incompleteCoAuthor.model';
import Manuscript from '../../Manuscript_Submission/models/manuscript.model';
import userService from '../../services/user.service';
import { NotFoundError } from '../../utils/customErrors';
import { Types } from 'mongoose';

class CoAuthorController {
  updateCoAuthor = asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, email, faculty, affiliation, orcid } = req.body;

    const incompleteCoAuthor = await IncompleteCoAuthor.findById(id);

    if (!incompleteCoAuthor) {
      throw new NotFoundError('Incomplete co-author not found');
    }

    // Update fields
    incompleteCoAuthor.name = name || incompleteCoAuthor.name;
    incompleteCoAuthor.email = email || incompleteCoAuthor.email;
    incompleteCoAuthor.faculty = faculty || incompleteCoAuthor.faculty;
    incompleteCoAuthor.affiliation =
      affiliation || incompleteCoAuthor.affiliation;
    incompleteCoAuthor.orcid = orcid || incompleteCoAuthor.orcid;

    // Check if all required fields are now present
    if (
      incompleteCoAuthor.name &&
      incompleteCoAuthor.email &&
      incompleteCoAuthor.faculty &&
      incompleteCoAuthor.affiliation
    ) {
      // Create a new user
      const coAuthorId = await userService.findOrCreateUser(
        incompleteCoAuthor.email,
        incompleteCoAuthor.name,
        incompleteCoAuthor.faculty,
        incompleteCoAuthor.affiliation,
        incompleteCoAuthor.manuscript as Types.ObjectId,
        incompleteCoAuthor.orcid
      );

      // Add the new user to the manuscript's coAuthors array
      await Manuscript.findByIdAndUpdate(incompleteCoAuthor.manuscript, {
        $push: { coAuthors: coAuthorId },
        $pull: { incompleteCoAuthors: incompleteCoAuthor._id },
      });

      // Delete the incomplete co-author record
      await IncompleteCoAuthor.findByIdAndDelete(id);

      res.status(200).json({
        success: true,
        message: 'Co-author information completed and user created.',
      });
    } else {
      await incompleteCoAuthor.save();
      res.status(200).json({
        success: true,
        message: 'Co-author information updated.',
        data: incompleteCoAuthor,
      });
    }
  });

  getCoAuthors = asyncHandler(async (req: Request, res: Response) => {
    const { manuscriptId } = req.params;

    const manuscript = await Manuscript.findById(manuscriptId)
      .populate('coAuthors', 'name email faculty affiliation orcid')
      .populate('incompleteCoAuthors', 'name email faculty affiliation orcid');

    if (!manuscript) {
      throw new NotFoundError('Manuscript not found');
    }

    res.status(200).json({
      success: true,
      data: {
        coAuthors: manuscript.coAuthors,
        incompleteCoAuthors: manuscript.incompleteCoAuthors,
      },
    });
  });
}

export default new CoAuthorController();
