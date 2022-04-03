import * as dotenv from 'dotenv';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import express from 'express';
import pino from 'pino-http';
import logger from './logger.js';
import swagger from './components/swagger.js';
import routes from './components/routes.js';
import { replaceSpaceHyphenWithUnderscore, formatOrgs } from './components/middleware.js';

dotenv.config();

// Argument parser
const argv = yargs(hideBin(process.argv))
  .option('port', {
    alias: 'p',
    describe: 'port for the api',
    type: 'number'
  })
  .option('host', {
    alias: 'o',
    describe: 'openHAB hostname or IP-Address, e.g. http://10.10.10.2:8080',
    type: 'string'
  })
  .demandCommand(0)
  .parse();

// Server variables.
export const PORT = (argv.port !== undefined) ? argv.port : (process.env.PORT !== undefined) ? parseInt(process.env.PORT) : 8081;
export const backendInfo = {
  HOST: (argv.host !== undefined) ? argv.host : (process.env.HOST !== undefined) ? process.env.HOST : 'http://127.0.0.1:8080'
};
/**
 * Administrator Organizational Unit.
 * Defaults to admin
 */
export const ADMIN_OU = process.env.ADMIN_OU || 'admin';
/**
 * Time to cache in milliseconds.
 * Defaults to 300000 ms = 5 min.
 */
export const CACHE_TIME = process.env.CACHE_TIME || 300000;

/**
 * Separates the organization name at beginning of Sitemap name from the full name.
 *
 * @memberof sitemapsSecurity
 */
export const ORG_SEPARATOR = process.env.ORG_SEPARATOR || '_org_';
logger.debug(`Organization separator is ${ORG_SEPARATOR}`);
const app = express();

// Server setup.
app.set('trust proxy', 'loopback');
app.use(replaceSpaceHyphenWithUnderscore(['X-OPENHAB-USER', 'X-OPENHAB-ORG']));
app.use(formatOrgs());
app.disable('x-powered-by');
app.disable('etag');
app.use(express.json());
app.use(express.text());
app.use(pino({
  logger: logger,
  customLogLevel: function (res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) { // Client error
      return 'trace';
    } else if (res.statusCode >= 500 || err) { // Server error
      return 'error';
    } else if (res.statusCode >= 300 && res.statusCode < 400) { // Redirections
      return 'silent';
    } else if (res.statusCode >= 200 && res.statusCode < 300) { // Success
      return 'silent';
    }
    return 'info';
  }
})); // High-speed HTTP logger for Node.js

// Use routes.
swagger(app);
routes(app);

// Server activation.
app.listen(PORT, () => {
  logger.info(`Listening on port ${PORT}`);
  logger.info(`openHAB host is ${backendInfo.HOST}`);
});
