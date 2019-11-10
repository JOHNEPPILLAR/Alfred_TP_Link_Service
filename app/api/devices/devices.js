/**
 * Import external libraries
 */
const Skills = require('restify-router').Router;
const serviceHelper = require('alfred-helper');
const { Client } = require('tplink-smarthome-api');

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
    const { deviceHost } = req.params;
    const { deviceAction } = req.body;
    let updateAction = false;
    if (deviceAction === 'on') updateAction = true;

    const device = await client.getPlug({ host: deviceHost });
    if (device instanceof Error) {
      serviceHelper.log('error', device.message);
      if (typeof res !== 'undefined' && res !== null) {
        serviceHelper.sendResponse(res, 500, device);
        next();
      }
    }

    const updateResult = await device.setPowerState(updateAction);
    if (updateResult instanceof Error) {
      serviceHelper.log('error', updateResult.message);
      if (typeof res !== 'undefined' && res !== null) {
        serviceHelper.sendResponse(res, 500, updateResult);
        next();
      }
    }
    serviceHelper.log('info', `TP-Link device: ${deviceHost} was turned ${deviceAction}`);
    if (typeof res !== 'undefined' && res !== null) {
      serviceHelper.sendResponse(res, 200, '{ true }');
      next();
    }
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
skill.put('/devices/:deviceHost', updateDevice);

module.exports = {
  skill,
  updateDevice,
};
