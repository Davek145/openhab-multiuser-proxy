import logger from './../../logger.js';
import { ADMIN_OU } from '../../server.js';

/**
 * Admin security namespace. Provides security checks for Admin access.
 *
 * @namespace adminSecurity
 */

/**
 * Check whether Admin access is allowed for client.
 * Must be used with await in async functions.
 *
 * @memberof adminSecurity
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @returns {Boolean} whether Admin access is allowed or not
 */
export const adminAllowedForClient = async function (user, org) {
  if (typeof org === 'string') org = org.toString().split('.');
  const allowed = org.includes(ADMIN_OU);
  logger.info({ user: user, orgs: org }, `adminAllowedForClient(): Admin access allowed: ${allowed}`);
  return allowed;
};
