import logger from './../../logger.js';
import { getSitemapsForUser } from './backend.js';
import { getItemsForUser } from './../items/backend.js';
import { ADMIN_OU, SITEMAPS_DISABLE } from '../../server.js';

/**
 * Sitemaps security namespace. Provides security checks for Sitemaps access.
 *
 * @namespace sitemapsSecurity
 */

/**
 * Check whether Sitemap access is allowed for client.
 * Must be used with await in async functions.
 *
 * @memberof sitemapsSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs* 
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String} sitemapname name of Sitemap
 * @returns {Boolean} whether Sitemap access is allowed or not
 */
export const sitemapAllowedForClient = async function (HOST, expressReq, user, org, sitemapname) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];  
  if (typeof org === 'string') org = org.toString().split('.');
  if (SITEMAPS_DISABLE == 'true') {
    //Sitemaps disabled for all clients
    logger.info({ user: user, orgs: org }, `sitemapAllowedForClient(): Sitemap ${sitemapname} allowed: false - Sitemaps disabled for all clients`);
    return false;
  }
  if (org.includes(ADMIN_OU)) {
    logger.info({ user: user, orgs: org }, `sitemapAllowedForClient(): Sitemap ${sitemapname} allowed: true due to admin privileges`);
    return true;
  }
  try {
    const userSitemaps = await getSitemapsForUser(HOST, expressReq, user, org);
    const allowed = userSitemaps.includes(sitemapname);
    logger.info({ user: user, orgs: org }, `sitemapAllowedForClient(): Sitemap ${sitemapname} allowed: ${allowed}`);
    return allowed;
  } catch (err) {
    logger.error(err);
    return false;
  }
};

/**
 * Filter Items in widgets allowed for client - used for recursive filtering of Sitemap widgets.
 * Must be used with await in async functions.
 *
 * @memberof sitemapsSecurity
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the client is member of
 * @param {String|Array<String>} list of widgets to filter
 * @returns {String|Array<String>} list of filtered widgets
 */
export const widgetsFilterForClient = async function (HOST, expressReq, user, org, allWidgets) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];  
  if (typeof org === 'string') org = org.toString().split('.');
  if (org.includes(ADMIN_OU)) {
    for (const i in allWidgets) {
        if (allWidgets[i].hasOwnProperty('item')) logger.info({ user: user, orgs: org }, `widgetsFilterForClient(): Widget ${allWidgets[i].label} with Item ${allWidgets[i].item.name} allowed: true due to admin privileges`);
    }
    return allWidgets;
  }
  try {
    const userItems = await getItemsForUser(HOST, expressReq, user, org);
    let filteredWidgets = [];
    for (const i in allWidgets) {
        //filter current widget
        let tempWidget = allWidgets[i];
        if (tempWidget.hasOwnProperty('item')) {
            const tempItem = tempWidget.item;
            const allowed = userItems.includes(tempItem.name);
            if (allowed  === true) {
                //recursive filtering of child widgets
                const tempWidget2 = tempWidget.widgets;
                if (Array.isArray(tempWidget2)) {
                    tempWidget.widgets = [];
                    const tempChWidgets = await widgetsFilterForClient(HOST, expressReq, user, org, tempWidget2);
                    tempWidget.widgets = tempChWidgets;
                }
                filteredWidgets.push(tempWidget);
            }
            logger.info({ user: user, orgs: org }, `widgetsFilterForClient(): Item ${tempItem.name} allowed: ${allowed}`);
        } else if (tempWidget.hasOwnProperty('linkedPage')) {
            //recursive filtering of linkedPage and its child widgets
            const tempLinkedPage = tempWidget.linkedPage;
            const tempWidget2 = tempLinkedPage.widgets;
            if (Array.isArray(tempWidget2)) {
                tempWidget.linkedPage.widgets = [];
                const tempChWidgets = await widgetsFilterForClient(HOST, expressReq, user, org, tempWidget2);
                tempWidget.linkedPage.widgets = tempChWidgets;
            }
            filteredWidgets.push(tempWidget);
        } else {
            //recursive filtering of child widgets
            const tempWidget2 = tempWidget.widgets;
            if (Array.isArray(tempWidget2)) {
                tempWidget.widgets = [];
                const tempChWidgets = await widgetsFilterForClient(HOST, expressReq, user, org, tempWidget2);
                tempWidget.widgets = tempChWidgets;
            }
            filteredWidgets.push(tempWidget);
        }
    }
    return filteredWidgets;
  } catch (err) {
    logger.error(err);
    return [];
  }
};

