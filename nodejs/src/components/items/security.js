import logger from './../../logger.js';
import { getItemsForUser } from './backend.js';
import { ADMIN_OU } from '../../server.js';

/**
 * Items security namespace. Provides security checks for Item access.
 *
 * @namespace itemsSecurity
 */

/**
 * Check whether Item access is allowed for client.
 * Must be used with await in async functions.
 *
 * @memberof itemsSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String} itemname name of Item
 * @returns {Boolean} whether Item access is allowed or not
 */
export const itemAllowedForClient = async function (HOST, expressReq, user, org, itemname) {
  if (typeof org === 'string') org = org.toString().split('.');
  if (org.includes(ADMIN_OU)) {
    logger.info({ user: user, orgs: org }, `itemAllowedForClient(): Item ${itemname} allowed: true due to admin privileges`);
    return true;
  }
  try {
    const userItems = await getItemsForUser(HOST, expressReq, user, org);
    const allowed = userItems.includes(itemname);
    logger.info({ user: user, orgs: org }, `itemAllowedForClient(): Item ${itemname} allowed: ${allowed}`);
    return allowed;
  } catch (err) {
    logger.error(err);
    return false;
  }
};


/**
 * Filter Items allowed for client - used for recursive filtering of group members.
 * Must be used with await in async functions.
 *
 * @memberof itemsSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String|Array<String>} list of items to filter
 * @returns {String|Array<String>} list of filtered items
 */
export const itemsFilterForClient = async function (HOST, expressReq, user, org, allItems) {
  if (typeof org === 'string') org = org.toString().split('.');
  if (org.includes(ADMIN_OU)) {
    for (const i in allItems) {
	logger.info({ user: user, orgs: org }, `itemsFilterForClient(): Item ${allItems[i].name} allowed: true due to admin privileges`);
    }
    return allItems;
  }
  try {
    const userItems = await getItemsForUser(HOST, expressReq, user, org);
    let filteredItems = [];
    for (const i in allItems) {
	//filter current item
	const allowed = userItems.includes(allItems[i].name);
        if (allowed  === true) {
	    let tempItem = allItems[i];
	    const tempItem2 = allItems[i].members;
	    //recursive filtering of member items
	    if (Array.isArray(tempItem2)) {
		tempItem.members = [];
		const tempMembers = await itemsFilterForClient(HOST, expressReq, user, org, tempItem2);
		tempItem.members = tempMembers;
	    }
	    filteredItems.push(tempItem);
	}
	logger.info({ user: user, orgs: org }, `itemsFilterForClient(): Item ${allItems[i].name} allowed: ${allowed}`);
    }
    return filteredItems;
  } catch (err) {
    logger.error(err);
    return [];
  }
};
