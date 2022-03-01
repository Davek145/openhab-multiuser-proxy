import sitemaps from './sitemaps/routes.js';
import items from './items/routes.js';
import { requireHeader } from './middleware.js';
import { sitemapAllowedForClient } from './sitemaps/security.js';
import { ADMIN_OU } from '../server.js';

/**
 * Routes namespace. Providing routes.
 *
 * @namespace routes
 */

/**
 * Main router.
 *
 * @memberof routes
 * @param {*} app expressjs app
 */
export default (app) => {
  /**
   * @swagger
   * /:
   *   get:
   *     summary: Retrieve server information.
   *     responses:
   *       200:
   *         description: Server information.
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   */
  app.get('/', (req, res) => {
    res.send({
      name: process.env.npm_package_name,
      description: 'Multi-User support for openHAB REST API with NGINX.',
      purpose: 'This NodeJS application provides filters and access control mechanisms.',
      author: 'Florian Hotze',
      version: process.env.npm_package_version,
      license: 'GNU GPL-3.0',
      links: [
        { type: 'swagger-doc', path: '/swagger/' },
        { type: 'rest-api', path: '/rest' }
      ]
    });
  });

  /**
   * @swagger
   * /auth/admin:
   *   get:
   *     summary: Authorization endpoint whether client has admin privileges.
   *     description: Used by nginx auth_request.
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
   *         description: Allowed
   *       403:
   *         description: Forbidden
   */
  app.get('/auth/admin', requireHeader('X-OPENHAB-USER'), async (req, res) => {
    const user = req.headers['x-openhab-user'];
    const org = req.headers['x-openhab-org'] || '';
    try {
      const allowed = await sitemapAllowedForClient(user, org, ADMIN_OU);
      if (allowed === true) {
        res.status(200).send();
      } else {
        res.status(403).send();
      }
    } catch {
      res.status(500).send();
    }
  });

  // Other routes
  sitemaps(app);
  items(app);
};
