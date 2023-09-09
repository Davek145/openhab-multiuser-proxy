import logger from './../../logger.js';
import fetch from 'node-fetch';
import { getHeaders } from '../../utils.js';
import { pagesListDb, pagesForUserDb } from '../../db.js';
import { CACHE_TIME, CACHE_TIME_ACL, ADMIN_OU, EVERYONE_OU, ACL_PREFIX } from '../../server.js';

/**
 * Pages backend namespace. Providing access to the openHAB backend.
 *
 * @namespace pagesBackend
 */

/**
 * Gets all available Pages.
 * Utilising LokiJS to cache the Pages list for better performance.
 *
 * @memberof pagesBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @returns {Object} Object: { json: JSON reponse, status: HTTP status code }
 */
export const getAllPages = async function (HOST, expressReq) {
  const now = Date.now();
  const pagesList = pagesListDb.findOne({ name: 'list' });
  if (pagesList) {
    if (now < pagesList.lastupdate + CACHE_TIME) {
      // Currently stored version not older than CACHE_TIME.
      logger.debug('getAllPages(): Found in database and not older than CACHE_TIME.');
      return pagesList.json;
    }
    pagesListDb.findAndRemove({ name: 'list' });
  }

  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/ui/components/ui%3Apage', { headers: headers });
    const json = await response.json();
    pagesListDb.insert({ name: 'list', lastupdate: now, json: json });
    const status = response.status;
    logger.debug(`getAllItems(): Successfully requested backend ${HOST + '/rest/ui/components/ui:page'}, HTTP response code ${status}`);
    return json;
  } catch (err) {
    const error = new Error(`getAllPages(): An error occurred while getting all Pages from ${HOST + '/rest/ui/components/ui:page'}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Get a single Page by uid(name).
 *
 * @memberof pagesBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} pageUid Uid(name) of page
 * @returns {Object} Object: { json: JSON reponse, status: HTTP status code }
 */
export const getPage = async function (HOST, expressReq, pageUid) {
  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/ui/components/ui%3Apage/' + pageUid, { headers: headers });
    const json = await response.json();
    const status = response.status;
    logger.debug(`getPage(): Successfully requested backend ${HOST + '/rest/ui/components/ui:page/' + pageUid}, HTTP response code ${status}`);
    return {
      json: json,
      status: status
    };
  } catch (err) {
    const error = new Error(`getPage(): An error occurred when requesting backend ${HOST + '/rest/ui/components/ui:page/' + pageUid}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Gets uid's of all allowed Pages for a user.
 * Utilising LokiJS to cache filtered Pages list for better performance.
 *
 * @memberof pagesBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the user is member of
 * @returns {Array<String>} uid's of pages allowed for a user
 */
export const getPagesForUser = async function (HOST, expressReq, user, org) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];
  if (typeof org === 'string') org = org.toString().split('.');

  const now = Date.now();
  const storedPages = pagesForUserDb.findOne({ name: user });
  if (storedPages) {
    if (now < storedPages.lastupdate + CACHE_TIME_ACL) {
      // Currently stored version not older than CACHE_TIME_ACL.
      logger.debug('getPagesForUser(): Found in database and not older than CACHE_TIME_ACL.');
      return storedPages.pages;
    }
    pagesForUserDb.findAndRemove({ name: user });
  }

  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/ui/components/ui%3Apage?summary=true', { headers: headers });
    const allPages = await response.json();
    let filteredPages = [];
    if (org.includes(ADMIN_OU)) {
	//Member of ADMIN_OU has full access
	filteredPages = allPages;
    } else {
        for (const i in allPages) {
	    if (allPages[i].uid === 'home' || allPages[i].uid === 'overview') {
		//Default OH page 'home' and 'overview' is allways allowed, otherwise MainUI does not load
		filteredPages.push(allPages[i].uid);
	    } else {
		for (const j in allPages[i].tags) {
		    if (allPages[i].tags[j].startsWith(ACL_PREFIX)) {
			if (allPages[i].tags[j].substring(ACL_PREFIX.length) === user || 
			    org.includes(allPages[i].tags[j].substring(ACL_PREFIX.length)) || 
			    allPages[i].tags[j].substring(ACL_PREFIX.length) === EVERYONE_OU) {
			    //Access allow when tags include user name, user org or EVERYONE_OU
			    filteredPages.push(allPages[i].uid);
        		}
		    }
		}
	    }
	}
    }
    pagesForUserDb.insert({ name: user, lastupdate: now, pages: filteredPages });
    const status = response.status;
    logger.debug(`getPagesForUser(): Successfully requested backend ${HOST + '/rest/ui/components/ui:page?summary=true'}, HTTP response code ${status}`);
    return filteredPages;
  } catch (err) {
    const error = new Error(`getPagesForUser(): An error occurred while getting all Pages from ${HOST + '/rest/ui/components/ui:page?summary=true'}: ${err}`);
    logger.error(error);
    error();
  }
};