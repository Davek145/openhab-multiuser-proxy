import logger from './../../logger.js';
import fetch from 'node-fetch';
import { getHeaders } from '../../utils.js';
import { itemsListDb, itemsForUserDb } from '../../db.js';
import { CACHE_TIME, CACHE_TIME_ACL, ADMIN_OU, EVERYONE_OU, ACL_PREFIX } from '../../server.js';

/**
 * Items backend namespace. Providing access to the openHAB backend.
 *
 * @namespace itemsBackend
 */

/**
 * Gets all Items.
 * Utilising LokiJS to cache the Items list for better performance.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @returns {Object} Object: { json: JSON reponse, status: HTTP status code }
 */
export const getAllItems = async function (HOST, expressReq) {
  //process only query parameters defined in API
  let query = '';
  if (expressReq.query.metadata) query = 'metadata=' + expressReq.query.metadata;
  if (expressReq.query.recursive) {
    if (query) query = query + '&';
    query = query + 'recursive=' + expressReq.query.recursive;
  }
  if (expressReq.query.type) {
    if (query) query = query + '&';
    query = query + 'type=' + expressReq.query.type;
  }
  if (expressReq.query.tags) {
    if (query) query = query + '&';
    query = query + 'tags=' + expressReq.query.tags;
  }
  if (expressReq.query.fields) {
    if (query) query = query + '&';
    query = query + 'fields=' + expressReq.query.fields;
  }

  const now = Date.now();
  const itemsList = itemsListDb.findOne({ name: query });
  if (itemsList) {
    if (now < itemsList.lastupdate + CACHE_TIME) {
      // Currently stored version not older than CACHE_TIME.
      logger.debug('getAllItems(): Found in database and not older than CACHE_TIME.');
      return itemsList.json;
    }
    itemsListDb.findAndRemove({ name: query });
  }

  const headers = await getHeaders(expressReq);
  if (query) query = '?' + query;
  try {
    const response = await fetch(HOST + '/rest/items' + query, { headers: headers });
    const json = await response.json();
    itemsListDb.insert({ name: query, lastupdate: now, json: json });
    const status = response.status;
    logger.debug(`getAllItems(): Successfully requested backend ${HOST + '/rest/items' + query}, HTTP response code ${status}`);
    return json;
  } catch (err) {
    const error = new Error(`getAllItems(): An error occurred while getting all Items from ${HOST + '/rest/items' + query}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Gets a single Item by itemname.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} itemname Item name
 * @returns {Object} Object: { json: JSON reponse, status: HTTP status code }
 */
export const getItem = async function (HOST, expressReq, itemname) {
  const headers = await getHeaders(expressReq);
 
  //process only query parameters defined in API
  let query = '';
  if (expressReq.query.metadata) query = 'metadata=' + expressReq.query.metadata;
  if (expressReq.query.recursive) {
    if (query) query = query + '&';
    query = query + 'recursive=' + expressReq.query.recursive;
  }
  if (query) query = '?' + query;

  try {
    const response = await fetch(HOST + '/rest/items/' + itemname + query, { headers: headers });
    const json = await response.json();
    const status = response.status;
    logger.debug(`getItem(): Successfully requested backend ${HOST + '/rest/items/' + itemname + query}, HTTP response code ${status}`);
    return {
      json: json,
      status: status
    };
  } catch (err) {
    const error = new Error(`getItem(): An error occurred when requesting backend ${HOST + '/rest/items/' + itemname + query}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Gets itemnames's of all allowed Items for a user.
 * Utilising LokiJS to cache filtered Items list for better performance.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} user username
 * @param {String|Array<String>} org organizations the user is member of
 * @returns {Array<String>} itemname's of items allowed for a user
 */
export const getItemsForUser = async function (HOST, expressReq, user, org) {
  if (!user) throw Error('Parameter user is required!');
  if (!org) org = [];
  if (typeof org === 'string') org = org.toString().split('.');

  const now = Date.now();
  const storedItems = itemsForUserDb.findOne({ name: user });
  if (storedItems) {
    if (now < storedItems.lastupdate + CACHE_TIME_ACL) {
      // Currently stored version not older than CACHE_TIME_ACL.
      logger.debug('getItemsForUser(): Found in database and not older than CACHE_TIME_ACL.');
      return storedItems.items;
    }
    itemsForUserDb.findAndRemove({ name: user });
  }

  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/items?recursive=false&fields=name%2C%20tags', { headers: headers });
    const allItems = await response.json();
    let filteredItems = [];
    if (org.includes(ADMIN_OU)) {
	//Member of ADMIN_OU has full access
	filteredItems = allItems;
    } else {
        for (const i in allItems) {
		for (const j in allItems[i].tags) {
		    if (allItems[i].tags[j].startsWith(ACL_PREFIX)) {
			if (allItems[i].tags[j].substring(ACL_PREFIX.length) === user ||
			    org.includes(allItems[i].tags[j].substring(ACL_PREFIX.length)) ||
			    allItems[i].tags[j].substring(ACL_PREFIX.length) === EVERYONE_OU) {
			    //Access allow when tags include user name, user org or EVERYONE_OU
			    filteredItems.push(allItems[i].name);
			}
		    }
		}
	}
    }
    itemsForUserDb.insert({ name: user, lastupdate: now, items: filteredItems });
    const status = response.status;
    logger.debug(`getItemsForUser(): Successfully requested backend ${HOST + '/rest/items?recursive=false&fields=name%2C%20tags'}, HTTP response code ${status}`);
    return filteredItems;
  } catch (err) {
    const error = new Error(`getItemsForUser(): An error occurred while getting all Items from ${HOST + '/rest/items?recursive=false&fields=name%2C%20tags'}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Gets the state of an Item.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} itemname Item name
 * @returns {Object} Object: { state: Item state, status: HTTP status code }
 */
export const getItemState = async function (HOST, expressReq, itemname) {
  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/items/' + itemname + '/state', { headers: headers });
    const state = await response.text();
    const status = response.status;
    logger.debug(`getItemState(): Got state ${state} from ${HOST + '/rest/items/' + itemname + '/state'}, HTTP response code ${status}`);
    return {
      state: state,
      status: status
    };
  } catch (err) {
    const error = new Error(`getItemState(): An error occurred while getting state from ${HOST + '/rest/items/' + itemname + '/state'}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Gets the item which defines the requested semantics of an Item.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} itemname Item name
 * @returns {Object} Object: { json: JSON reponse, status: HTTP status code }
 */
export const getItemSemantic = async function (HOST, expressReq, itemname, semanticClass) {
  const headers = await getHeaders(expressReq);
  try {
    const response = await fetch(HOST + '/rest/items/' + itemname + '/semantic/' + semanticClass, { headers: headers });
    const json = await response.json();
    const status = response.status;
    logger.debug(`getItemSemantic(): Got Item ${itemname} from ${HOST + '/rest/items/' + itemname + '/semantic/' + semanticClass}, HTTP response code ${status}`);
    return {
      json: json,
      status: status
    };
  } catch (err) {
    const error = new Error(`getItemSemantic(): An error occurred while getting semantics from ${HOST + '/rest/items/' + itemname + '/semantic/' + semanticClass}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Sends a command to an Item.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} itemname Item name
 * @param {String} command valid item command (e.g. ON, OFF, UP, DOWN, REFRESH)
 * @returns {Integer} Response code from backend
 */
export const sendItemCommand = async function (HOST, expressReq, itemname, command) {
  const headers = await getHeaders(expressReq);
  Object.assign(headers, {accept: '*/*'});
  Object.assign(headers, {'content-type': 'text/plain'});
  try {
    const status = await (await fetch(HOST + '/rest/items/' + itemname, { headers: headers, method: 'POST', body: command })).status;
    logger.debug(`sendItemCommand(): Sent command ${command} to ${HOST + '/rest/items/' + itemname}, HTTP response code ${status}`);
    return status;
  } catch (err) {
    const error = new Error(`sendItemCommand(): An error occurred while sending command to ${HOST + '/rest/items/' + itemname}: ${err}`);
    logger.error(error);
    error();
  }
};

/**
 * Sends list of items a SSE connection will receive state updates to.
 *
 * @memberof itemsBackend
 * @param {String} HOST hostname of openHAB server
 * @param {*} expressReq request object from expressjs
 * @param {String} connectionId Connection ID
 * @param {String} items Items list
 * @returns {Integer} Response code from backend
 */
export const sendEventsItems = async function (HOST, expressReq, connectionId, items) {
  const headers = await getHeaders(expressReq);
  Object.assign(headers, {accept: '*/*'});
  Object.assign(headers, {'content-type': 'application/json'});
  try {
    const status = await (await fetch(HOST + '/rest/events/states/' + connectionId, { headers: headers, method: 'POST', body: JSON.stringify(items) })).status;
    logger.debug(`sendEventsItems(): Sent items list to ${HOST + '/rest/events/states/' + connectionId}, HTTP response code ${status}`);
    return status;
  } catch (err) {
    const error = new Error(`sendEventsItems(): An error occurred while sending items list to ${HOST + '/rest/events/states/' + connectionId}: ${err}`);
    logger.error(error);
    error();
  }
};