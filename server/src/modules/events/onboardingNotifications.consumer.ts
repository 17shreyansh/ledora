
import type { Config } from '../../config/env.js';
import type { MailDispatcher } from '../../services/mail/dispatcher.js';
import { MembershipModel } from '../memberships/membership.model.js';
import { OrganizationModel } from '../organizations/organization.model.js';
import { UserModel } from '../users/user.model.js';
import { WebsiteModel } from '../websites/website.model.js';
import type { EventConsumer } from './consumers.js';

/**
 * First-success indicator (Part 32.6): tells owners and admins, once, that Ledora is
 * receiving real data from their website.
 */
export function onboardingNotificationsConsumer(config: Config, mail: MailDispatcher): EventConsumer {
  return {
    name: 'onboarding-notifications',
    events: ['website.installation_verified'],
    async handle(event) {
      if (!event.websiteId) return;
      const [website, org] = await Promise.all([
        WebsiteModel.findOne({ _id: event.websiteId, status: 'active' }).lean(),
        OrganizationModel.findOne({ _id: event.orgId, status: 'active' }).lean(),
      ]);
      if (!website || !org) return;
      const members = await MembershipModel.find({ orgId: org._id, role: { $in: ['owner', 'admin'] } }).lean();
      const users = await UserModel.find({ _id: { $in: members.map((m) => m.userId) }, status: 'active', emailVerifiedAt: { $ne: null } }).lean();
      const link = `${config.APP_URL}/o/${org._id.toHexString()}/websites/${website._id.toHexString()}`;
      for (const u of users) {
        await mail.dispatch({
          to: u.email,
          template: 'installation_verified',
          data: { name: u.name, websiteName: website.name, domain: website.domain, link },
        });
      }
    },
  };
}

