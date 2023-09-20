import logger from './../../logger.js';
import { getPagesForUser } from './backend.js';
import { getItemsForUser } from './../items/backend.js';
import { ADMIN_OU, HOME_SEPARATOR } from '../../server.js';

/**
 * Pages security namespace. Provides security checks for Page access.
 *
 * @namespace pagesSecurity
 */

/**
 * Check whether Page access is allowed for client.
 * Must be used with await in async functions.
 *
 * @memberof pagesSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String} pageUid name of Page
 * @returns {Boolean} whether Page access is allowed or not
 */
export const pageAllowedForClient = async function (HOST, expressReq, user, org, pageUid) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];  
  if (typeof org === 'string') org = org.toString().split('.');
  if (org.includes(ADMIN_OU)) {
    logger.info({ user: user, orgs: org }, `pageAllowedForClient(): Page ${pageUid} allowed: true due to admin privileges`);
    return true;
  }
  try {
    const userPages = await getPagesForUser(HOST, expressReq, user, org);
    const allowed = userPages.includes(pageUid);
    logger.info({ user: user, orgs: org }, `pageAllowedForClient(): Page ${pageUid} allowed: ${allowed}`);
    return allowed;
  } catch (err) {
    logger.error(err);
    return false;
  }
};

/**
 * Filter home page to include only locations allowed for the client
 * Must be used with await in async functions.
 *
 * @memberof pagesSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String} full original home page to filter
 * @returns {String} filtered home page
 */
export const pageFilterHome = async function (HOST, expressReq, user, org, origHome) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];  
  if (typeof org === 'string') org = org.toString().split('.');
  if (org.includes(ADMIN_OU)) {
    logger.info({ user: user, orgs: org }, `pageFilterHome(): Home page allowed in full due to admin privileges`);
    return origHome;
  }
  try {
    const userItems = await getItemsForUser(HOST, expressReq, user, org);
    let filteredHome = origHome;
    const allCards = origHome.slots.locations[0].config.cardOrder;
    let filteredCards = [];
    let excludedCards = origHome.slots.locations[0].config.excludedCards;
    for (let i = 0; i < allCards.length; i++) {
        if (allCards[i].hasOwnProperty('separator')) {
            //separator
            filteredCards.push(allCards[i]);
        } else {
            //filter current location item
            const allowed = userItems.includes(allCards[i]);
            if (allowed  === true) {
                filteredCards.push(allCards[i]);
            } else {
                excludedCards.push(allCards[i]);
            }
            logger.info({ user: user, orgs: org }, `pageFilterHome(): Card ${allCards[i]} allowed: ${allowed}`);
        }
    }
    if (HOME_SEPARATOR == 'true') {
        //remove separator for empty location section
        let tempCards = [];
        for (let i = 0; i < filteredCards.length; i++) {
            if (filteredCards[i].hasOwnProperty('separator')) {
                if (i < (filteredCards.length - 1)) {
                    if (!(filteredCards[i+1].hasOwnProperty('separator'))) tempCards.push(filteredCards[i]);
                }
            } else {
                tempCards.push(filteredCards[i]);
            }
        }
        filteredCards = tempCards;
    }
    filteredHome.slots.locations[0].config.cardOrder = filteredCards;
    filteredHome.slots.locations[0].config.excludedCards = excludedCards;
    return filteredHome;
  } catch (err) {
    logger.error(err);
    return [];
  }
};
