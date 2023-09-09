import pino from 'pino';
import * as dotenv from 'dotenv';

dotenv.config();

export default pino({
  level: process.env.PINO_LOG_LEVEL || 'info',
  formatters: {
    level: (label) => {
      return { level: label };
    }
  },
  transport: {
    target: 'pino-pretty',
    options: {
	destination: `${process.env.PINO_LOG_FILE}`,
	translateTime: 'SYS:standard',
	singleLine: true
    }
  }
});