/**
 * Import external libraries
 */
// const { Service } = require('alfred-base');
const { Service } = require('../../../Alfred_Base_Service/index');

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
  service.logger.debug(`${service._traceStack()} - Added '/devices' api`);

  service.restifyServer.put('/devices/:deviceHost', (req, res, next) =>
    service.updateDevice(req, res, next),
  );
  service.logger.debug(
    `${service._traceStack()} - Added '/devices/:deviceHost' api`,
  );

  service.restifyServer.get('/schedules', (req, res, next) =>
    service.listSchedule(req, res, next),
  );
  service.logger.debug(`${service._traceStack()} - Added '/schedules' api`);

  service.restifyServer.get('/schedules/:scheduleID', (req, res, next) =>
    service.schedule(req, res, next),
  );
  service.logger.debug(
    `${service._traceStack()} - Added '/schedules/:scheduleID' api`,
  );

  service.restifyServer.put('/schedules/:scheduleID', (req, res, next) =>
    service.updateSchedule(req, res, next),
  );
  service.logger.debug(
    `${service._traceStack()} - Added '/schedules/:scheduleID' api`,
  );

  // Listen for api requests
  service.listen();

  // Setup schedules
  service.setupSchedules();
}
setupServer();
