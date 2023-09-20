import logger from './../../logger.js';
import fetch from 'node-fetch';
import { getHeaders, findKeyInObj } from '../../utils.js';
import { itemsOfSitemapDb, sitemapsListDb, sitemapsForUserDb } from '../../db.js';
import { CACHE_TIME, CACHE_TIME_ACL, ADMIN_OU, EVERYONE_OU, ORG_SEPARATOR } from '../../server.js';

/**
 * Sitemaps backend namespace. Providing access to the openHAB backend.
 *
 * @namespace sitemapsBackend
 */

/**
 * Get all available Sitemaps.
 * Utilising LokiJS to cache the Sitemap list for better performance.
 *
 * @memberof sitemapsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @returns {Array<Object>} array of Sitemaps
 */
export const getAllSitemaps = async function (HOST, expressReq) {
  const now = Date.now();
  const sitemapsList = sitemapsListDb.findOne({ name: 'list' });
  if (sitemapsList) {
    if (now < sitemapsList.lastupdate + CACHE_TIME) {
      // Currently stored version not older than CACHE_TIME.
      logger.debug('getAllSitemaps(): Found in database and not older than CACHE_TIME.');
      return sitemapsList.json;
    }
    sitemapsListDb.findAndRemove({ name: 'list' });
  }

  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/sitemaps', { headers: headers });
    const json = await response.json();
    sitemapsListDb.insert({ name: 'list', lastupdate: now, json: json });
    const status = response.status;
    logger.debug(`getAllSitemaps(): Successfully requested backend ${HOST + '/rest/sitemaps'}, HTTP response code ${status}`);
    return json;
  } catch (err) {
    const error = new Error(`getAllSitemaps(): An error occurred while getting all Sitemaps from ${HOST + '/rest/sitemaps'}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Get a single Sitemap by name.
 *
 * @memberof sitemapsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} sitemapname Sitemap name
 * @returns {Object} Sitemap
 */
export const getSitemap = async function (HOST, expressReq, sitemapname) {
  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/sitemaps/' + sitemapname + '?jsoncallback=callback&includeHidden=true', { headers: headers });
    const json = await response.json();
    const status = response.status;
    logger.debug(`getSitemap(): Successfully requested backend ${HOST + '/rest/sitemaps/' + sitemapname + '?jsoncallback=callback&includeHidden=true, HTTP response code ${status}'}`);
    return {
      json: json,
      status: status
    };
  } catch (err) {
    const error = new Error(`getSitemap(): An error occurred when requesting backend ${HOST + '/rest/sitemaps/' + sitemapname + '?jsoncallback=callback&includeHidden=true'}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Get a single Page of Sitemap by name and pageid.
 *
 * @memberof sitemapsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} sitemapname Sitemap name
 * @param {String} pageid Page id 
 * @returns {Object} Sitemap
 */
export const getSitemapPage = async function (HOST, expressReq, sitemapname, pageid) {
  const headers = await getHeaders(expressReq);

  //process only query parameters defined in API
  let query = '';
  if (expressReq.query.subscriptionid) query = 'subscriptionid=' + expressReq.query.subscriptionid;
  query = (query) ? '?' + query + '&includeHidden=true' : '?includeHidden=true';
  
  try {
    const response = await fetch(HOST + '/rest/sitemaps/' + sitemapname + '/' + pageid + query, { headers: headers });
    const json = await response.json();
    const status = response.status;
    logger.debug(`getSitemapPage(): Successfully requested backend ${HOST + '/rest/sitemaps/' + sitemapname + '/' + pageid + query}, HTTP response code ${status}'}`);
    return {
      json: json,
      status: status
    };
  } catch (err) {
    const error = new Error(`getSitemapPage(): An error occurred when requesting backend ${HOST + '/rest/sitemaps/' + sitemapname + '/' + pageid + query}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Get names of all Items in Sitemap.
 * Utilising LokiJS to cache the Items for better performance.
 *
 * @memberof sitemapsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {*} sitemapname Sitemap name
 * @returns {Array<String>} names of all Items in Sitemap
 */
export const getItemsOfSitemap = async function (HOST, expressReq, sitemapname) {
  const now = Date.now();
  const itemsDb = itemsOfSitemapDb.findOne({ name: sitemapname });
  if (itemsDb) {
    if (now < itemsDb.lastupdate + CACHE_TIME) {
      // Currently stored version not older than CACHE_TIME.
      logger.debug(`getItemsOfSitemap(): Items of Sitemap ${sitemapname} found in database and not older than CACHE_TIME.`);
      return itemsDb.items;
    }
    itemsOfSitemapDb.findAndRemove({ name: sitemapname });
  }

  try {
    const sitemap = await getSitemap(HOST, expressReq, sitemapname);
    const items = findKeyInObj(sitemap.homepage.widgets, 'item').map(item => item.name);
    itemsOfSitemapDb.insert({ name: sitemapname, lastupdate: now, items: items });
    logger.debug({ sitemap: sitemapname }, `getItemOfSitemap(): Items of Sitemap ${sitemapname} fetched from backend`);
    return items;
  } catch (err) {
    throw Error(err);
  }
};

/**
 * Gets sitemapnames's of all allowed Sitemaps for a user.
 * Utilising LokiJS to cache filtered Sitemaps list for better performance.
 *
 * @memberof sitemapsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the user is member of
 * @returns {Array<String>} sitemapname's of sitemaps allowed for a user
 */
export const getSitemapsForUser = async function (HOST, expressReq, user, org) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];
  if (typeof org === 'string') org = org.toString().split('.');

  const now = Date.now();
  const storedSitemaps = sitemapsForUserDb.findOne({ name: user });
  if (storedSitemaps) {
    if (now < storedSitemaps.lastupdate + CACHE_TIME_ACL) {
      // Currently stored version not older than CACHE_TIME_ACL.
      logger.debug('getSitemapsForUser(): Found in database and not older than CACHE_TIME_ACL.');
      return storedSitemaps.sitemaps;
    }
    sitemapsForUserDb.findAndRemove({ name: user });
  }

  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/sitemaps', { headers: headers });
    const allSitemaps = await response.json();
    let filteredSitemaps = [];
    for (const i in allSitemaps) {
        // For Sitemaps created in MainUI strip "uicomponents_" from sitemapname
        // If Sitemap name includes ORG_SEPARATOR, return string before ORG_SEPARATOR, else return Sitemap name.
        let nameOfSitemap = '';
        let orgOfSitemap = ''
        if (allSitemaps[i].name.substring(0,13) == "uicomponents_") {
            nameOfSitemap = allSitemaps[i].name.substring(13);
            orgOfSitemap = (nameOfSitemap.includes(ORG_SEPARATOR)) ? nameOfSitemap.split(ORG_SEPARATOR)[0] : nameOfSitemap;
        } else {
            nameOfSitemap = allSitemaps[i].name;
            orgOfSitemap = (nameOfSitemap.includes(ORG_SEPARATOR)) ? nameOfSitemap.split(ORG_SEPARATOR)[0] : nameOfSitemap;
        }
        logger.trace(`getSitemapsForUser(): Organization of Sitemap ${allSitemaps[i].name} is ${orgOfSitemap}`);
        if (nameOfSitemap === user || 
            org.includes(orgOfSitemap) ||
            org.includes(ADMIN_OU) ||
			orgOfSitemap === EVERYONE_OU) {
			//Access allow when sitename is user name, user org or EVERYONE_OU, Member of ADMIN_OU has full access
            if (!filteredSitemaps.includes(allSitemaps[i].name)) filteredSitemaps.push(allSitemaps[i].name);
        }
	}
    sitemapsForUserDb.insert({ name: user, lastupdate: now, sitemaps: filteredSitemaps });
    const status = response.status;
    logger.debug(`getSitemapsForUser(): Successfully requested backend ${HOST + '/rest/sitemaps'}, HTTP response code ${status}`);
    return filteredSitemaps;
  } catch (err) {
    const error = new Error(`getSitemapsForUser(): An error occurred while getting all Sitemaps from ${HOST + '/rest/sitemaps'}: ${err}`);
    logger.error(error);
    error();
  }
};
