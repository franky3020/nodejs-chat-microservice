const axios = require('axios');
const http = require('http');
const db = require('../server/lib/db');

const config = require('../config')[process.env.NODE_ENV || 'development'];

const log = config.log();
const service = require('../server/service')(config);

const server = http.createServer(service);

// Connect to Database
db.connect(config.db.dsn)
  .then(() => {
    log.info('Connected to MongoDB');
    // Should be a random port
    server.listen(process.env.PORT);
  })
  .catch(err => {
    log.fatal(err);
  });

server.on('listening', () => {
  // Adds this service to the Service Registry
  const registerService = () =>
    axios
      .put(
        `http://${process.env.SVC_REGISTRY_HOST}:${
          process.env.SVC_REGISTRY_PORT
        }/service/${config.name}/${config.version}/${server.address().port}`
      )
      .catch(err => log.fatal(err));
  // Removes this service from the Service Registry
  const unregisterService = () =>
    axios
      .delete(
        `http://${process.env.SVC_REGISTRY_HOST}:${
          process.env.SVC_REGISTRY_PORT
        }/service/${config.name}/${config.version}/${server.address().port}`
      )
      .catch(err => log.fatal(err));

  registerService();

  // Don't ignore me I'm still alive :)
  const interval = setInterval(
    registerService,
    process.env.SVC_REGISTER_INTERVAL
  );
  const cleanup = async () => {
    let clean = false;
    if (!clean) {
      clean = true;
      clearInterval(interval);
      await unregisterService();
    }
  };
  const shutdown = async () => {
    await cleanup();
    process.exitCode = 1;
  };
  process.on('uncaughtException', shutdown);
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  log.info(
    `Listening on port ${server.address().port} in ${service.get('env')} mode.`
  );
});
