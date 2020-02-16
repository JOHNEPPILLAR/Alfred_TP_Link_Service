/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('alfred-helper');
const { Client } = require('tplink-smarthome-api');

/**
 * Import helper libraries
 */
const schedules = require('../../schedules/controller.js');

const skill = new Skills();

/**
 * @api {get} /devices
 * @apiName devices
 * @apiGroup Display
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     "data": [
 *            {
 *              "deviceID": "...",
 *              "deviceName": "Bedroom TV"
 *            },
 *            ...
 *     ]
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function listDevices(req, res, next) {
  serviceHelper.log('trace', 'Display TP-Link device data API called');
  const devices = [];

  try {
    const client = new Client();

    // Look for devices
    client.startDiscovery().on('device-new', async (device) => {
      const deviceInfo = await device.getSysInfo();
      serviceHelper.log('trace', `Found: ${deviceInfo.deviceId}`);
      devices.push({
        deviceHost: device.host,
        deviceID: deviceInfo.deviceId,
        deviceName: deviceInfo.alias,
        status: device.status,
      });
    });

    // timeout discovery and report back devices
    setTimeout(() => {
      client.stopDiscovery();
      serviceHelper.log('info', `Found ${devices.length} TL-Link device(s)`);
      serviceHelper.sendResponse(res, 200, devices);
      next();
    }, 15000);
  } catch (err) {
    serviceHelper.log('error', err.message);
    serviceHelper.sendResponse(res, 500, err);
    next();
  }
}
skill.get('/devices', listDevices);

/**
 * @api {put} /devices/:deviceHost
 * @apiName devices
 * @apiGroup Display
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     "data": { true }
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function updateDevice(req, res, next) {
  serviceHelper.log('trace', 'Update TP-Link device API called');
  serviceHelper.log('trace', `Params: ${JSON.stringify(req.params)}`);

  try {
    const client = new Client();
    const { deviceID } = req.params;
    const { deviceAction } = req.body;
    let updateAction = false;
    if (deviceAction === 'on') updateAction = true;

    let deviceHost;
    let sentClientResponse = false;
    serviceHelper.log('info', 'Searching for plugs');
    client.startDiscovery().on('device-new', async (device) => {
      const deviceInfo = await device.getSysInfo();
      if (deviceInfo.deviceId === deviceID) {
        deviceHost = device.host;
        serviceHelper.log('info', 'Found required plug');
        client.stopDiscovery();

        const plug = await client.getPlug({ host: deviceHost });
        if (device instanceof Error) {
          serviceHelper.log('error', device.message);
          if (typeof res !== 'undefined' && res !== null) {
            sentClientResponse = true;
            serviceHelper.sendResponse(res, 500, device);
            next();
          }
        }
        const updateResult = await plug.setPowerState(updateAction);
        if (updateResult instanceof Error) {
          serviceHelper.log('error', updateResult.message);
          if (typeof res !== 'undefined' && res !== null) {
            sentClientResponse = true;
            serviceHelper.sendResponse(res, 500, updateResult);
            next();
          }
        }
        serviceHelper.log('info', `TP-Link device: ${deviceID} was turned ${deviceAction}`);
        if (typeof res !== 'undefined' && res !== null) {
          sentClientResponse = true;
          serviceHelper.sendResponse(res, 200, '{ true }');
          next();
        }
      }
    });

    setTimeout(() => {
      serviceHelper.log('trace', 'Stopped searching for devices');
      client.stopDiscovery();
      if (!sentClientResponse) {
        if (typeof res !== 'undefined' && res !== null) {
          const err = new Error('Stopped searching for devices');
          serviceHelper.sendResponse(res, 500, err);
          next();
        }
      }
    }, 15000);
  } catch (err) {
    serviceHelper.log('error', err.message);
    if (typeof res !== 'undefined' && res !== null) {
      serviceHelper.sendResponse(res, 500, err);
      next();
    }
    return false;
  }
  return true;
}
skill.put('/devices/:deviceID', updateDevice);

/**
 * @api {put} /schedules/:scheduleID
 * @apiName schedules
 * @apiGroup Display
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     "data": [
 *       {
 *           "name": "Christmas tree morning lights on",
 *           "hour": 6,
 *           "minute": 30,
 *           "host": "1",
 *           "action": true,
 *           "active": true
 *       }
 *     ]
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function listSchedule(req, res, next) {
  serviceHelper.log('trace', 'List TP-Link schedules API called');
  serviceHelper.log('trace', `Params: ${JSON.stringify(req.params)}`);

  const { scheduleID } = req.params;

  try {
    const SQL = `SELECT name, hour, minute, host, name, action, active FROM tp_link_schedules WHERE id = ${scheduleID}`;
    const dbConnection = await serviceHelper.connectToDB('tplink');
    serviceHelper.log('trace', 'Get schedule settings');
    const results = await dbConnection.query(SQL);
    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbConnection.end(); // Close data store connection

    if (results.rowCount === 0) {
      // Exit function as no data to process
      serviceHelper.log('info', 'No tp-link schedules fonud');
      serviceHelper.sendResponse(res, 200, {});
      next();
      return false;
    }
    serviceHelper.sendResponse(res, 200, results.rows);
    next();
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    if (typeof res !== 'undefined' && res !== null) {
      serviceHelper.sendResponse(res, 500, err);
      next();
    }
    return false;
  }
}
skill.get('/schedules/:scheduleID', listSchedule);

/**
 * @api {put} /schedules/:scheduleID
 * @apiName schedules
 * @apiGroup Display
 *
 * @apiSuccessExample {json} Success-Response:
 *   HTTPS/1.1 200 OK
 *   {
 *     "data": saved
 *   }
 *
 * @apiErrorExample {json} Error-Response:
 *   HTTPS/1.1 500 Internal error
 *   {
 *     data: Error message
 *   }
 *
 */
async function updateSchedule(req, res, next) {
  serviceHelper.log('trace', 'Update TP-Link schedules API called');
  serviceHelper.log('trace', `Params: ${JSON.stringify(req.params)}`);

  const { scheduleID } = req.params;
  const {
    hour, minute, host, name, action, active,
  } = req.body;

  try {
    const SQL = 'UPDATE tp_link_schedules SET hour = $2, minute = $3, host = $4, name = $5, action = $6, active = $7 WHERE id = $1';
    const SQLValues = [
      scheduleID,
      hour,
      minute,
      host,
      name,
      action,
      active,
    ];

    serviceHelper.log('trace', 'Connect to data store connection pool');
    const dbConnection = await serviceHelper.connectToDB('tplink');
    const dbClient = await dbConnection.connect(); // Connect to data store
    serviceHelper.log('trace', 'Get schedule settings');
    const results = await dbClient.query(SQL, SQLValues);

    serviceHelper.log(
      'trace',
      'Release the data store connection back to the pool',
    );
    await dbClient.end(); // Close data store connection

    // Send data back to caler
    if (results.rowCount === 1) {
      serviceHelper.log(
        'info',
        `Saved schedule data: ${JSON.stringify(req.body)}`,
      );
      serviceHelper.sendResponse(res, 200, 'saved');
      schedules.setSchedule(); // Re-set schedule
    } else {
      serviceHelper.log('error', 'Failed to save data');
      serviceHelper.sendResponse(res, 500, 'failed to save');
    }
    next();
    return true;
  } catch (err) {
    serviceHelper.log('error', err.message);
    if (typeof res !== 'undefined' && res !== null) {
      serviceHelper.sendResponse(res, 500, err);
      next();
    }
    return false;
  }
}
skill.put('/schedules/:scheduleID', updateSchedule);

module.exports = {
  skill,
  updateDevice,
};
