import { pageAllowedForClient, pageFilterHome } from './security.js';
import { requireHeader } from './../middleware.js';
import { backendInfo } from '../../server.js';
import { getAllPages, getPage } from './backend.js';

const pageAccess = () => {
  return async function (req, res, next) {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allowed = await pageAllowedForClient(backendInfo.HOST, req, user, org, req.params.pageUid);
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
 * Provide required /pages routes.
 *
 * @memberof routes
 * @param {*} app expressjs app
 */
const pages = (app) => {
  /**
   * @swagger
   * /auth/pages:
   *   get:
   *     summary: Authorization endpoint for Page access.
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
  app.get('/auth/pages', requireHeader('X-OPENHAB-USER'), requireHeader('X-ORIGINAL-URI'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    const regex = /\/page\/([a-zA-Z_0-9]+)/;
    const pageUid = regex.exec(req.headers['x-original-uri']);
    if (pageUid == null) return res.status(403).send();
    try {
      const allowed = await pageAllowedForClient(backendInfo.HOST, req, user, org, pageUid[1]);
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
   * /rest/ui/components/ui:page:
   *   get:
   *     summary: Get all available Pages.
   *     tags: [Pages]
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
   *               type: object
   */
  app.get('/rest/ui/components/ui[:]page', requireHeader('X-OPENHAB-USER'), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const allPages = await getAllPages(backendInfo.HOST, req);
      let filteredPages = [];
      for (const i in allPages) {
	if (await pageAllowedForClient(backendInfo.HOST, req, user, org, allPages[i].uid) === true) {
	    if (allPages[i].uid === 'home') {
		const filteredHome = await pageFilterHome(backendInfo.HOST, req, user, org, allPages[i]);
		filteredPages.push(filteredHome);
	    } else {
		filteredPages.push(allPages[i]);
	    }
	}
      }
      res.status(200).send(filteredPages);
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

  /**
   * @swagger
   * /rest/ui/components/ui:page/{pageUid}:
   *   get:
   *     summary: Gets a single Page.
   *     tags: [Pages]
   *     parameters:
   *       - in: path
   *         name: pageUid
   *         required: true
   *         description: Page uid
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
   *         description: Page access forbidden
   *       404:
   *         description: Page not found
   */
  app.get('/rest/ui/components/ui[:]page/:pageUid', requireHeader('X-OPENHAB-USER'), pageAccess(), async (req, res) => {
    const org = req.headers['x-openhab-org'] || '';
    const user = req.headers['x-openhab-user'];
    try {
      const response = await getPage(backendInfo.HOST, req, req.params.pageUid);
      if(req.params.pageUid === 'home') {
	const filteredHome = await pageFilterHome(backendInfo.HOST, req, user, org, response.json);
	res.status(response.status).send(filteredHome);
      } else {
        res.status(response.status).send(response.json);
      }
    } catch (e) {
      console.info(e);
      res.status(500).send();
    }
  });

};


export default pages;
