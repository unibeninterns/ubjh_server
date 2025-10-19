import User, { UserRole } from '../model/user.model';
import { Types } from 'mongoose';
import logger from '../utils/logger';

class UserService {
  /**
   * Finds an existing user or creates a new one.
   * Assigns the manuscript to the user.
   */
  public findOrCreateUser = async (
    email: string,
    name: string,
    faculty: string,
    affiliation: string,
    manuscriptId: Types.ObjectId,
    orcid?: string
  ): Promise<Types.ObjectId> => {
    let user = await User.findOne({ email });

    if (!user) {
      user = new User({
        name,
        email,
        faculty,
        affiliation,
        orcid,
        role: UserRole.AUTHOR,
        invitationStatus: 'none',
        manuscripts: [manuscriptId],
      });
      await user.save();
      logger.info(
        `New user created with email: ${email} and associated with manuscript.`
      );
    } else {
      // Add manuscript to existing user's list if not already present
      if (user.manuscripts && !user.manuscripts.includes(manuscriptId)) {
        user.manuscripts.push(manuscriptId);
        await user.save();
      } else if (!user.manuscripts) {
        user.manuscripts = [manuscriptId];
        await user.save();
      }
    }
    return user._id as Types.ObjectId;
  };
}

export default new UserService();
