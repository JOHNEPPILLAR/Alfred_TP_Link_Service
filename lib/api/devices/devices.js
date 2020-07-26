/**
 * Import external libraries
 */
const { Client } = require('tplink-smarthome-api');

// Import Schemas
const devicePowerSchema = require('../../schemas/device_power.json');
const deviceScheduleSchema = require('../../schemas/device_schedule.json');

/**
 * @type get
 * @path /devices
 */
async function listDevices(req, res, next) {
  this.logger.debug(`${this._traceStack()} - List TP-Link devices API called`);

  const devices = [];

  try {
    const client = new Client();

    // Look for devices
    client
      .startDiscovery({
        broadcast: '192.168.85.255',
      })
      .on('device-new', async (device) => {
        const deviceInfo = await device.getSysInfo();
        this.logger.trace(
          `${this._traceStack()} - Found: ${deviceInfo.deviceId}`,
        );

        devices.push({
          deviceHost: device.host,
          deviceID: deviceInfo.deviceId,
          deviceName: deviceInfo.alias,
          status: device.status,
        });
      });

    // timeout discovery and report back devices
    return new Promise((resolve) => {
      setTimeout(() => {
        client.stopDiscovery();
        this.logger.trace(
          `${this._traceStack()} - Found ${devices.length} TL-Link device(s)`,
        );
        if (typeof res !== 'undefined' && res !== null) {
          this._sendResponse(res, next, 200, devices);
        }
        resolve(devices);
      }, 15000);
    });
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
}

/**
 * @type put
 * @path /devices/:deviceHost
 */
async function updateDevice(req, res, next) {
  this.logger.debug(`${this._traceStack()} - Update TP-Link device API called`);

  this.logger.trace(`${this._traceStack()} - Check for valid params`);
  const validSchema = this._validateSchema(req, devicePowerSchema);
  if (validSchema !== true) {
    if (typeof res !== 'undefined' && res !== null) {
      this.logger.error(
        `${this._traceStack()} - Error in params: ${validSchema}`,
      );
      this._sendResponse(res, next, 400, validSchema);
    }
    return validSchema;
  }

  try {
    const { deviceID, power } = req.params;

    this.logger.trace(`${this._traceStack()} - Get devices`);
    const devices = await this.listDevices(null, null, null);

    this.logger.trace(`${this._traceStack()} - Filter devices`);
    const filteredDevices = devices.filter((device) => {
      return device.deviceID === deviceID;
    });

    if (filteredDevices.length === 0) {
      this.logger.error(`Not able to find IP for device: ${deviceID}`);
      if (deviceID === '800693F733CEA366746DA9EE9AA3CE0C17D8ACF4') {
        this.logger.info(`Overriding with static IP`);
        const harrietLight = {
          deviceHost: '192.168.85.43',
          deviceID,
          deviceName: 'Harriets bed lights',
          status: 'online',
        };
        filteredDevices.push(harrietLight);
      }
    }

    this.logger.trace(`${this._traceStack()} - Update device`);
    const deviceIP = filteredDevices[0].deviceHost;
    const client = new Client();
    const plug = await client.getPlug({ host: deviceIP });
    if (plug instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${plug.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, plug);
      }
      return plug;
    }
    const updateResult = await plug.setPowerState(power);
    if (updateResult instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${updateResult.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, updateResult);
      }
      return updateResult;
    }
    this.logger.info(
      `TP-Link device: ${filteredDevices[0].deviceName} was turned ${
        power ? 'on' : 'off'
      }`,
    );
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, '{ true }');
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
  return true;
}

/**
 * @type get
 * @path /schedules
 */
async function listSchedule(req, res, next) {
  this.logger.debug(
    `${this._traceStack()} - List TP-Link schedules API called`,
  );

  try {
    const sql =
      'SELECT name, hour, minute, deviceid, name, ai_override, active FROM tp_link_schedules';
    this.logger.trace(`${this._traceStack()} - Connect to db`);
    const dbConnection = await this._connectToDB('tplink');
    this.logger.trace(`${this._traceStack()} - Execute sql`);
    const results = await dbConnection.query(sql);
    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection

    if (results.rowCount === 0) {
      // Exit function as no data to process
      if (typeof res !== 'undefined' && res !== null) {
        this.logger.info('No tp-link schedule fonud');
        this._sendResponse(res, next, 200, []);
      }
      return [];
    }
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, results.rows);
    } else {
      return results.rows;
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
  return true;
}

/**
 * @type get
 * @path /schedules/:scheduleID
 */
async function schedule(req, res, next) {
  this.logger.debug(
    `${this._traceStack()} - List TP-Link schedules by device API called`,
  );

  const { scheduleID } = req.params;
  // eslint-disable-next-line no-restricted-globals
  if (isNaN(scheduleID)) {
    const err = new Error('param: scheduleID is not a number');
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }

  try {
    const sql = `SELECT name, hour, minute, deviceid, name, ai_override, active FROM tp_link_schedules WHERE id = ${scheduleID}`;
    const dbConnection = await this._connectToDB('tplink');
    this.logger.trace(`${this._traceStack()} - Execute sql`);
    const results = await dbConnection.query(sql);
    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection

    if (results.rowCount === 0) {
      // Exit function as no data to process
      const err = new Error('No tp-link schedule fonud');
      if (typeof res !== 'undefined' && res !== null) {
        this.logger.trace(`${this._traceStack()} - ${err.message}`);
        this._sendResponse(res, next, 200, {});
      }
      return err;
    }
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, results.rows);
    }
    return results.rows;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
}

/**
 * @type put
 * @path /schedules/:scheduleID
 */
async function updateSchedule(req, res, next) {
  this.logger.debug(
    `${this._traceStack()} - Update TP-Link schedule API called`,
  );

  this.logger.trace(`${this._traceStack()} - Check for valid params`);
  const validSchema = this._validateSchema(req, deviceScheduleSchema);
  if (validSchema !== true) {
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 400, validSchema);
    }
    return validSchema;
  }

  const {
    scheduleID,
    name,
    hour,
    minute,
    deviceID,
    action,
    aiOverride,
    active,
  } = req.params;

  try {
    this.logger.trace(`${this._traceStack()} - Read existing values`);
    const scheduleData = await schedule.call(
      this,
      { params: { scheduleID } },
      null,
      null,
    );

    if (scheduleData instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${scheduleData.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, scheduleData);
      }
      return scheduleData;
    }

    this.logger.trace(`${this._traceStack()} - Update vaules`);
    if (typeof name !== 'undefined' && name !== null)
      scheduleData[0].name = name;
    if (typeof hour !== 'undefined' && hour !== null)
      scheduleData[0].hour = hour;
    if (typeof minute !== 'undefined' && minute !== null)
      scheduleData[0].minute = minute;
    if (typeof deviceID !== 'undefined' && deviceID !== null)
      scheduleData[0].deviceid = deviceID;
    if (typeof action !== 'undefined' && action !== null)
      scheduleData[0].action = action;
    if (typeof aiOverride !== 'undefined' && aiOverride !== null)
      scheduleData[0].ai_override = aiOverride;
    if (typeof active !== 'undefined' && active !== null)
      scheduleData[0].active = active;

    this.logger.trace(`${this._traceStack()} - Updated db`);
    const sql =
      'UPDATE tp_link_schedules SET name = $2, hour = $3, minute = $4, deviceid = $5, ai_override = $6, active = $7 WHERE id = $1';
    const sqlValues = [
      scheduleID,
      scheduleData[0].name,
      scheduleData[0].hour,
      scheduleData[0].minute,
      scheduleData[0].deviceid,
      scheduleData[0].ai_override,
      scheduleData[0].active,
    ];

    this.logger.trace(`${this._traceStack()} - Connect to db`);
    const dbConnection = await this._connectToDB('tplink');
    this.logger.trace(`${this._traceStack()} - Execute sql`);
    const results = await dbConnection.query(sql, sqlValues);
    this.logger.trace(
      `${this._traceStack()} - Release the data store connection back to the pool`,
    );
    await dbConnection.end(); // Close data store connection

    // Send data back to caler
    if (results.rowCount === 1) {
      this.logger.trace(
        `${this._traceStack()} - Saved schedule data: ${JSON.stringify(
          req.params,
        )}`,
      );
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 200, { state: 'saved' });
        this.logger.trace(
          `${this._traceStack()} - Reseting schedules due to save event`,
        );
      }
      // this.reSetSchedule(); // Re-set schedule
      return true;
    }
    if (typeof res !== 'undefined' && res !== null) {
      const err = new Error('Failed to save');
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      this._sendResponse(res, next, 500, err);
      return err;
    }
    return true;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
}

/**
 * @type get
 * @path /schedules/active
 */
async function activeschedules(req, res, next) {
  this.logger.debug(`${this._traceStack()} - List Active schedules API called`);

  try {
    this._sendResponse(res, next, 200, this.schedules);
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  }
  return true;
}

module.exports = {
  listDevices,
  updateDevice,
  listSchedule,
  schedule,
  updateSchedule,
  activeschedules,
};
