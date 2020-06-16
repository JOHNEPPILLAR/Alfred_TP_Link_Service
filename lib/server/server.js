/**
 * Import external libraries
 */
const serviceHelper = require('alfred-helper');

/**
 * Import helper libraries
 */
const { version } = require('../../package.json');
const serviceName = require('../../package.json').description;
const virtualHost = require('../../package.json').name;
const schedules = require('../schedules/controller.js');
const APIroot = require('../api/root/root.js');
const APIdevices = require('../api/devices/devices.js');

global.APITraceID = '';
global.schedules = [];

async function setupAndRun() {
  // Create restify server
  const server = await serviceHelper.setupRestifyServer(virtualHost, version);

  // Setup API middleware
  await serviceHelper.setupRestifyMiddleware(server, virtualHost);

  // Configure API end points
  APIroot.applyRoutes(server);
  APIdevices.skill.applyRoutes(server);

  // Capture and process API errors
  await serviceHelper.captureRestifyServerErrors(server);

  // Start service and listen to requests
  server.listen(process.env.PORT, async () => {
    serviceHelper.log(
      'info',
      `${serviceName} has started`,
    );
    if (process.env.MOCK === 'true') {
      serviceHelper.log(
        'info',
        'Mocking enabled, will not setup monitors or schedules',
      );
    } else {
      await schedules.setSchedule(); // Setup schedules
    }
  });
}

setupAndRun();
