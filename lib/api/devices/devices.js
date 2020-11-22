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
    client.startDiscovery({}).on('device-new', async (device) => {
      this.logger.trace(`${this._traceStack()} - Found: ${device.alias}`);

      devices.push({
        hostIP: device.host,
        location: device.alias,
        inUse: device.lastState.inUse,
        sysInfo: device._sysInfo,
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
 * @type get
 * @path /devices/:deviceIP
 */
async function getDevice(req, res, next) {
  this.logger.debug(
    `${this._traceStack()} - Display TP-Link device API called`,
  );

  try {
    const { deviceIP } = req.params;

    this.logger.trace(
      `${this._traceStack()} - Get device state: (${deviceIP})`,
    );
    const client = new Client();
    const plug = await client.getDevice({ host: `${deviceIP}` });

    if (plug instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${plug.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, plug.message);
      }
      return plug;
    }

    const plugData = {
      hostIP: plug.host,
      descriptoion: plug.alias,
      inUse: plug.lastState.inUse,
      sysInfo: plug._sysInfo,
    };

    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, plugData);
    }
    return plug;
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
 * @path /devices/:deviceIP
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
    const { deviceIP, power } = req.params;

    this.logger.trace(`${this._traceStack()} - Create device object`);
    const client = new Client();

    const plug = await client.getDevice({ host: `${deviceIP}` });
    if (plug instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${plug.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, plug);
      }
      return plug;
    }

    this.logger.trace(
      `${this._traceStack()} - Update device: ${plug._sysInfo.alias}`,
    );
    const updateResult = await plug.setPowerState(power);
    if (updateResult instanceof Error) {
      this.logger.error(`${this._traceStack()} - ${updateResult.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, updateResult);
      }
      return updateResult;
    }
    this.logger.info(
      `Device: ${plug._sysInfo.alias} was turned ${power ? 'on' : 'off'}`,
    );
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, { state: 'saved' });
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
 * @path /devices/room/:room
 */
async function devicesInRoom(req, res, next) {
  let dbConnection;

  this.logger.debug(
    `${this._traceStack()} - List TP-Link devices in a room API called`,
  );

  const { room } = req.params;

  try {
    this.logger.trace(`${this._traceStack()} - Connect to db`);
    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const query = { room };
    const results = await dbConnection
      .db(this.namespace)
      .collection('devices')
      .find(query)
      .toArray();

    if (results.count === 0) {
      // Exit function as no data to process
      this.logger.info('No tp-link devices fonud');
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 200, []);
      } else {
        return [];
      }
    }

    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, results);
    } else {
      return results;
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
  return true;
}

/**
 * @type get
 * @path /schedules
 */
async function listSchedule(req, res, next) {
  let dbConnection;

  this.logger.debug(
    `${this._traceStack()} - List TP-Link schedules API called`,
  );

  try {
    this.logger.trace(`${this._traceStack()} - Connect to db`);
    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const query = {};
    const results = await dbConnection
      .db(this.namespace)
      .collection(this.namespace)
      .find(query)
      .toArray();

    if (results.count === 0) {
      // Exit function as no data to process
      this.logger.info('No tp-link schedules fonud');
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 200, []);
      } else {
        return [];
      }
    }

    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 200, results);
    } else {
      return results;
    }
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
    return err;
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
  return true;
}

/**
 * @type get
 * @path /schedules/:scheduleID
 */
async function schedule(req, res, next) {
  let dbConnection;

  this.logger.debug(
    `${this._traceStack()} - Display TP-Link schedule API called`,
  );

  const { scheduleID } = req.params;
  let query;

  try {
    const objID = this._getMongoObjectID(scheduleID);
    query = { _id: objID };
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    return err;
  }

  try {
    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);

    const results = await dbConnection
      .db(this.namespace)
      .collection(this.namespace)
      .find(query)
      .toArray();

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
      this._sendResponse(res, next, 200, results);
    }
    return results;
  } catch (err) {
    this.logger.error(`${this._traceStack()} - ${err.message}`);
    if (typeof res !== 'undefined' && res !== null) {
      this._sendResponse(res, next, 500, err);
    }
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
  }
  return true;
}

/**
 * @type put
 * @path /schedules/:scheduleID
 */
async function updateSchedule(req, res, next) {
  let dbConnection;

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
    hour,
    minute,
    description,
    deviceIP,
    power,
    active,
    override,
    girlsRoom,
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

    if (scheduleData.length === 0) {
      const err = new Error('Not able to find exisint record to update');
      this.logger.error(`${this._traceStack()} - ${err.message}`);
      if (typeof res !== 'undefined' && res !== null) {
        this._sendResponse(res, next, 500, err);
      }
      return err;
    }

    this.logger.trace(`${this._traceStack()} - Update vaules`);
    if (typeof hour !== 'undefined' && hour !== null)
      scheduleData[0].hour = hour;
    if (typeof minute !== 'undefined' && minute !== null)
      scheduleData[0].minute = minute;
    if (typeof description !== 'undefined' && description !== null)
      scheduleData[0].description = description;
    if (typeof deviceIP !== 'undefined' && deviceIP !== null)
      scheduleData[0].deviceIP = deviceIP;
    if (typeof power !== 'undefined' && power !== null)
      scheduleData[0].power = power;
    if (typeof active !== 'undefined' && active !== null)
      scheduleData[0].active = active;
    if (typeof override !== 'undefined' && override !== null)
      scheduleData[0].override = override;
    if (typeof girlsRoom !== 'undefined' && girlsRoom !== null)
      scheduleData[0].girlsRoom = girlsRoom;

    this.logger.trace(`${this._traceStack()} - Update db`);
    const query = { _id: scheduleData[0]._id };
    const body = { $set: scheduleData[0] };
    const opts = {
      returnOriginal: false,
      upsert: true,
    };

    dbConnection = await this._connectToDB();
    this.logger.trace(`${this._traceStack()} - Execute query`);
    const results = await dbConnection
      .db(this.namespace)
      .collection(this.namespace)
      .findOneAndUpdate(query, body, opts);

    // Send data back to caler
    if (results.ok === 1) {
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

      // Re-set schedule
      await this.setupSchedules.call(this);
      await this.activateSchedules.call(this);
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
  } finally {
    this.logger.trace(`${this._traceStack()} - Close DB connection`);
    await dbConnection.close();
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
  getDevice,
  updateDevice,
  devicesInRoom,
  listSchedule,
  schedule,
  updateSchedule,
  activeschedules,
};
