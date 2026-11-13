import type { Membership } from '../modules/memberships/membership.model.js';
import type { Organization } from '../modules/organizations/organization.model.js';
import type { Session } from '../modules/auth/session.model.js';
import type { User } from '../modules/users/user.model.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      auth?: { user: User; session: Session; rawToken: string };
      org?: Organization;
      membership?: Membership;
    }
  }
}

export {};
