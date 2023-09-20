import { sitemapAllowedForClient, widgetsFilterForClient } from './security.js';
import { requireHeader } from './../middleware.js';
import { backendInfo } from '../../server.js';
import { getAllSitemaps, getSitemap, getSitemapPage } from './backend.js';
import proxy from 'express-http-proxy';

const sitemapAccess = () => {
  return async function (req, res, next) {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allowed = await sitemapAllowedForClient(backendInfo.HOST, req, user, org, req.params.sitemapname);
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
 * Provides required /sitemaps routes.
 *
 * @memberof routes
 * @param {*} app expressjs app
 */
const sitemaps = (app) => {
  /**
   * @swagger
   * /auth/sitemaps:
   *   get:
   *     summary: Authorization endpoint for Sitemap access.
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
  app.get('/auth/sitemaps', requireHeader('X-OPENHAB-USER'), requireHeader('X-ORIGINAL-URI'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    const regex1 = /(\?|&)sitemap=([a-zA-Z_0-9]+)[&]?/;
    const regex2 = /\/sitemaps\/([a-zA-Z_0-9]+)/;
    const sitemapname1 = regex1.exec(req.headers['x-original-uri']);
    const sitemapname2 = regex2.exec(req.headers['x-original-uri']);
    const sitemapname = (sitemapname1 == null) ? sitemapname2 : sitemapname1;
    if (sitemapname == null) return res.status(403).send();
    try {
      const allowed = await sitemapAllowedForClient(backendInfo.HOST, req, user, org, sitemapname[2]);      
      if (allowed === true) {
        res.status(200).send();
      } else {
        res.status(403).send();
      }
    } catch (err) {
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/sitemaps:
   *   get:
   *     summary: Get all available sitemaps.
   *     tags: [Sitemaps]
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
   *     responses:
   *       200:
   *         description: OK
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   */
  app.get('/rest/sitemaps', requireHeader('X-OPENHAB-USER'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allSitemaps = await getAllSitemaps(backendInfo.HOST, req);
      let filteredSitemaps = [];
      for (const i in allSitemaps) {
        if (await sitemapAllowedForClient(backendInfo.HOST, req, user, org, allSitemaps[i].name) === true) {
            filteredSitemaps.push(allSitemaps[i]);
        }
      }
      res.status(200).send(filteredSitemaps);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/sitemaps/{sitemapname}:
   *   get:
   *     summary: Get a sitemap by name.
   *     tags: [Sitemaps]
   *     parameters:
   *       - in: path
   *         name: sitemapname
   *         required: true
   *         description: Sitemap name
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
   *         description: Sitemap access forbidden
   *       404:
   *         description: Sitemap not found
   */
  app.get('/rest/sitemaps/:sitemapname', requireHeader('X-OPENHAB-USER'), sitemapAccess(), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const response = await getSitemap(backendInfo.HOST, req, req.params.sitemapname);
      const tempWidget = response.json.homepage.widgets;
      //recursive filtering of child widgets
      if (Array.isArray(tempWidget)) {
          response.json.homepage.widgets = [];
          const tempChWidgets = await widgetsFilterForClient(backendInfo.HOST, req, user, org, tempWidget);
          response.json.homepage.widgets = tempChWidgets;
      }
      res.status(response.status).send(response.json);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/sitemaps/{sitemapname}/{pageid}:
   *   get:
   *     summary: Polls the data for a sitemap.
   *     tags: [Sitemaps]
   *     parameters:
   *       - in: path
   *         name: sitemapname
   *         required: true
   *         description: Sitemap name
   *         schema:
   *           type: string
   *         style: form
   *       - in: path
   *         name: pageid
   *         required: true
   *         description: page id
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Query parameters from API (subscriptionid)
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
   *         description: Sitemap access forbidden
   *       404:
   *         description: Sitemap not found
   */
  app.get('/rest/sitemaps/:sitemapname/:pageid', requireHeader('X-OPENHAB-USER'), sitemapAccess(), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const response = await getSitemapPage(backendInfo.HOST, req, req.params.sitemapname, req.params.pageid);
      const tempWidget = response.json.widgets;
      //recursive filtering of child widgets
      if (Array.isArray(tempWidget)) {
          response.json.widgets = [];
          const tempChWidgets = await widgetsFilterForClient(backendInfo.HOST, req, user, org, tempWidget);
          response.json.widgets = tempChWidgets;
      }
      res.status(response.status).send(response.json);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });  
  
  /**
   * @swagger
   * /rest/sitemaps/events/{subscriptionid}:
   *   get:
   *     summary: Get Sitemap events. Requires nginx.
   *     tags: [Sitemaps]
   *     parameters:
   *       - in: path
   *         name: subscriptionid
   *         required: true
   *         description: subscription id
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: sitemap
   *         required: false
   *         description: Sitemap name
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: pageid
   *         required: false
   *         description: page id
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   *       400:
   *         description: Page not linked to the subscription.
   *       404:
   *         description: Subscription not found.
   */

  /**
   * @swagger
   * /rest/sitemaps/events/subscribe:
   *   post:
   *     summary: Creates a Sitemap event subscription. Requires nginx.
   *     tags: [Sitemaps]
   *     responses:
   *       201:
   *         description: Subscription created.
   *       503:
   *         description: Subscriptions limit reached.
   */
  
  /**
   * @swagger
   * /basicui/:
   *   get:
   *     summary: Gets BasicUI. Requires nginx.
   *     tags: [Sitemaps]
   *     parameters:
   *       - in: path
   *         name: app
   *         required: true
   *         description: basic UI app and other components
   *         schema:
   *           type: string
   *         style: form
   *       - in: query
   *         name: parameters
   *         required: false
   *         description: Query parameters (e.g. sitemap, w)
   *         schema:
   *           type: string
   *         style: form
   *     responses:
   *       200:
   *         description: OK
   */
  
};

export default sitemaps;
