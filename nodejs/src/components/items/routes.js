import { itemAllowedForClient, itemsFilterForClient } from './security.js';
import { requireHeader } from './../middleware.js';
import { backendInfo } from '../../server.js';
import { getAllItems, getItem, getItemState, getItemSemantic, sendItemCommand, sendEventsItems } from './backend.js';
import proxy from 'express-http-proxy';

const itemAccess = () => {
  return async function (req, res, next) {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allowed = await itemAllowedForClient(backendInfo.HOST, req, user, org, req.params.itemname);
      if (allowed === true) {
        next();
      } else {
        res.status(403).send();
      }
    } catch {
      res.status(500).send();
    }
  };
};

/**
 * Provides required /items routes.
 *
 * @memberof routes
 * @param {*} app expressjs app
 */
const items = (app) => {
  /**
   * @swagger
   * /auth/items:
   *   get:
   *     summary: Authorization endpoint for Item access.
   *     description: Used by NGINX auth_request.
   *     tags: [Auth]
   *     parameters:
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-ORIGINAL-URI
   *         required: true
   *         description: Original request URI
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: Allowed
   *       403:
   *         description: Forbidden
   */
  app.get('/auth/items', requireHeader('X-OPENHAB-USER'), requireHeader('X-ORIGINAL-URI'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    const regex1 = /(\?|&)items=([a-zA-Z_0-9]+)[&]?/;
    const regex2 = /\/items\/([a-zA-Z_0-9]+)/;
    const itemname1 = regex1.exec(req.headers['x-original-uri']);
    const itemname2 = regex2.exec(req.headers['x-original-uri']);
    const itemname = (itemname1 == null) ? itemname2 : itemname1;
    
    if (itemname == null) return res.status(403).send();
    try {
      const allowed = await itemAllowedForClient(backendInfo.HOST, req, user, org, itemname[1]);
      if (allowed === true) {
        res.status(200).send();
      } else {
        res.status(403).send();
      }
    } catch {
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/items:
   *   get:
   *     summary: Get all available Items.
   *     tags: [Items]
   *     parameters:
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Query parameters from API (metadata, recursive, type, tags, fields)
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  app.get('/rest/items', requireHeader('X-OPENHAB-USER'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allItems = await getAllItems(backendInfo.HOST, req);
      let filteredItems = [];
      for (const i in allItems) {
         if (await itemAllowedForClient(backendInfo.HOST, req, user, org, allItems[i].name) === true) {
            let tempItem = allItems[i];
            const tempItem2 = allItems[i].members;
            //recursive filtering of member items
            if (Array.isArray(tempItem2)) {
                tempItem.members = [];
                const tempMembers = await itemsFilterForClient(backendInfo.HOST, req, user, org, tempItem2);
                tempItem.members = tempMembers;
            }
            filteredItems.push(tempItem);
         }
      }
      res.status(200).send(filteredItems);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/items/{itemname}:
   *   get:
   *     summary: Gets a single Item.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: itemname
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Query parameters from API (metadata, recursive)
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       403:
   *         description: Item access forbidden
   *       404:
   *         description: Item not found
   */
  app.get('/rest/items/:itemname', requireHeader('X-OPENHAB-USER'), itemAccess(), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
        let response = await getItem(backendInfo.HOST, req, req.params.itemname);
        const tempItem = response.json.members;
        //recursive filtering of member items
        if (Array.isArray(tempItem)) {
            response.json.members = [];
            const tempMembers = await itemsFilterForClient(backendInfo.HOST, req, user, org, tempItem);
            response.json.members = tempMembers;
        }
        res.status(response.status).send(response.json);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/items/{itemname}/state:
   *   get:
   *     summary: Gets the state of an Item.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: itemname
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           text/plain:
   *             schema:
   *               type: string
   *       403:
   *         description: Item access forbidden
   *       404:
   *         description: Item not found
   */
  app.get('/rest/items/:itemname/state', requireHeader('X-OPENHAB-USER'), itemAccess(), async (req, res) => {
    const response = await getItemState(backendInfo.HOST, req, req.params.itemname);
    res.status(response.status).send(response.state);
  });

  /**
   * @swagger
   * /rest/items/{itemname}/semantic/{semanticClass}:
   *   get:
   *     summary: Gets the item which defines the requested semantics of an Item.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: itemname
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: path
   *         name: semanticClass
   *         required: true
   *         description: Semantic class
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       403:
   *         description: Item access forbidden
   *       404:
   *         description: Item not found
   */
  app.get('/rest/items/:itemname/semantic/:semanticClass', requireHeader('X-OPENHAB-USER'), itemAccess(), async (req, res) => {
    const response = await getItemSemantic(backendInfo.HOST, req, req.params.itemname, req.params.semanticClass);
    res.status(response.status).send(response.json);
  });

  /**
   * @swagger
   * /rest/items/{itemname}:
   *   post:
   *     summary: Sends a command to an Item.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: itemname
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     requestBody:
   *       description: valid item command (e.g. ON, OFF, UP, DOWN, REFRESH)
   *       required: true
   *       content:
   *         text/plain:
   *           schema:
   *             type: string
   *     responses:
   *       200:
   *         description: OK
   *       400:
   *         description: Item command null
   *       403:
   *         description: Item access forbidden
   *       404:
   *         description: Item not found
   */
  app.post('/rest/items/:itemname', requireHeader('X-OPENHAB-USER'), itemAccess(), async (req, res) => {
    const status = await sendItemCommand(backendInfo.HOST, req, req.params.itemname, req.body);
    res.status(status).send();
  });

  /**
   * @swagger
   * /rest/events/states/{connectionId}:
   *   post:
   *     summary: Changes list of items a SSE connection will receive state updates to.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: connectionId
   *         required: true
   *         description: Connection ID
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     requestBody:
   *       description: items list
   *       required: true
   *       content:
   *         text/plain:
   *           schema:
   *             type: string
   *     responses:
   *       200:
   *         description: OK
   *       404:
   *         description: Items not found / list is empty
   */
  app.post('/rest/events/states/:connectionId', requireHeader('X-OPENHAB-USER'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    const allItems = req.body;
    try {
      let filteredItems = [];
      for (const i in allItems) {
        if (await itemAllowedForClient(backendInfo.HOST, req, user, org, allItems[i]) === true) {
            filteredItems.push(allItems[i]);
        }
      }
      const status = await sendEventsItems(backendInfo.HOST, req, req.params.connectionId, filteredItems);
      res.status(status).send();
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });


  /**
   * @swagger
   * /chart?items={itemname}:
   *   get:
   *     summary: Gets BasicUI OH chart.
   *     tags: [Sitemaps]
   *     parameters:
   *       - in: query
   *         name: parameters
   *         required: true
   *         description: Query parameters (e.g. items)
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-USER
   *         required: true
   *         description: Name of user
   *         schema:
   *           type: string
   *         style: form
   *       - in: header
   *         name: X-OPENHAB-ORG
   *         required: false
   *         description: Organisations the user is member of
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *       404:
   *         description: Chart not found
   */
  app.get('/chart', requireHeader('X-OPENHAB-USER'), proxy(backendInfo.HOST + '/chart', {
    proxyReqPathResolver: async (req) => {
      const org = req.headers['x-openhab-org'] || '';
      const user = req.headers['x-openhab-user'];
      const reqPath = req.path;
      let reqQuery = req.query;
      
      //filtering of chart items
      if (reqQuery.hasOwnProperty('items')) {
          let allItems = reqQuery.items;
          if (typeof allItems === 'string') allItems = allItems.toString().split(',');
          let filteredItems = [];
          for (const i in allItems) {
            if (await itemAllowedForClient(backendInfo.HOST, req, user, org, allItems[i]) === true) filteredItems.push(allItems[i]);
          }
          reqQuery.items = filteredItems.toString();
      }
      let updatedQuery = Object.entries(reqQuery).reduce((str, [p, val]) => {
        return `${str}&${p}=${val}`;
      }, '');
      updatedQuery = updatedQuery.substring(1);
      
      return reqPath + ((updatedQuery) ? '?' + updatedQuery : '');
    },
    proxyErrorHandler: function(err, res, next) {
      console.info(err);
      res.status(500).send();
    }
  })); 

  /**
   * @swagger
   * /analyzer/:
   *   get:
   *     summary: Analyze Item(s) using built-in OH analyzer. Requires nginx.
   *     tags: [Items]
   *     parameters:
   *       - in: query
   *         name: items
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Analyzer parameters (e.g. chartType)
   *         schema:
   *           type: string
   *         style: form   
   *     responses:
   *       200:
   *         description: OK
   *       404:
   *         description: Unknown Item or persistence service
   */
  
  /**
   * @swagger
   * /rest/persistence/items/{itemname}:
   *   get:
   *     summary: Gets item persistence data from the persistence service. Requires nginx.
   *     tags: [Items]
   *     parameters:
   *       - in: path
   *         name: itemname
   *         required: true
   *         description: Item name
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Query parameters (e.g. serviceId, starttime, endtime, page, pagelength, boundary)
   *         schema:
   *           type: string
   *         style: form   
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *       404:
   *         description: Unknown Item or persistence service
   */    
  
};

export default items;
