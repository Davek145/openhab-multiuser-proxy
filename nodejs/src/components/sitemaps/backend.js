import logger from './../../logger.js';
import fetch from 'node-fetch';
import { getHeaders, findKeyInObj } from '../../utils.js';
import { itemsOfSitemapDb, sitemapsListDb } from '../../db.js';
import { CACHE_TIME } from '../../server.js';

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
