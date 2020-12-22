/**
 * Import external libraries
 */
const { Service } = require('alfred-base');
const debug = require('debug')('TPLink:Server');

// Setup service options
const { version } = require('../../package.json');
const serviceName = require('../../package.json').description;
const namespace = require('../../package.json').name;

const options = {
  serviceName,
  namespace,
  serviceVersion: version,
};

// Bind api functions to base class
Object.assign(Service.prototype, require('../api/devices/devices'));

// Bind schedule functions to base class
Object.assign(Service.prototype, require('../schedules/tp-link'));

// Create and extend base service
const service = new Service(options);

async function setupServer() {
  // Setup service
  await service.createRestifyServer();

  // Apply api routes
  service.restifyServer.get('/devices', (req, res, next) =>
    service.listDevices(req, res, next),
  );
  debug(`Added get '/devices' api`);

  service.restifyServer.get('/devices/:deviceIP', (req, res, next) =>
    service.getDevice(req, res, next),
  );
  debug(`Added get '/devices/:deviceIP' api`);

  service.restifyServer.put('/devices/:deviceIP', (req, res, next) =>
    service.updateDevice(req, res, next),
  );
  debug(`Added put '/devices/:deviceIP' api`);

  service.restifyServer.get('/devices/room/:room', (req, res, next) =>
    service.devicesInRoom(req, res, next),
  );
  debug(`Added get '/devices/room/:room' api`);

  service.restifyServer.get('/schedules', (req, res, next) =>
    service.listSchedule(req, res, next),
  );
  debug(`Added get '/schedules' api`);

  service.restifyServer.get('/schedules/:scheduleID', (req, res, next) =>
    service.schedule(req, res, next),
  );
  debug(`Added get '/schedules/:scheduleID' api`);

  service.restifyServer.put('/schedules/:scheduleID', (req, res, next) =>
    service.updateSchedule(req, res, next),
  );
  debug(`Added put '/schedules/:scheduleID' api`);

  service.restifyServer.get('/schedules/active', (req, res, next) =>
    service.activeschedules(req, res, next),
  );
  debug(`Added get '/schedules/active' api`);

  if (process.env.MOCK === 'true') {
    this.logger.info('Mocking enabled, will not run tp-link schedules');
  } else {
    // Add schedules
    await service.setupSchedules();
  }

  // Listen for api requests
  service.listen();
}
setupServer();
