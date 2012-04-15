module.exports = Registrar;

/**
 * Registrar constructor.
 * 
 * A registrar allows for querying, updating, and deleting of registrations for
 * a given Skype ID.
 */
function Registrar(store) {
    // Create connection to Azure Table Store and create a our registrations
    // tables if necessary.
    this.store = store;
}

/**
 * Registrar prototype.
 * 
 * Defines the methods available to a Registrar instance.
 */
Registrar.prototype = {

    /**
     * Obtain the current registrations for a given Skype user.
     * 
     * @param req
     *   Contents of the incoming request
     * 
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    getDevices: function (req, res) {
        var skypeId = req.params.skypeId;
        if (skypeId === "") {
            res.send(null, null, 400);
            return;
        }

        var start = new Date();
        this.store.getDevices(skypeId, function (err, devices) {
	        var end = new Date();
	        var duration = end.getTime() - start.getTime();
	        if (err !== null || devices.length === 0) {
                console.log('error:', err);
		        res.send(null, null, 404);
	        }
	        else {
                var tmp = {
                    "devices": devices,
                    "tableStoreDuration": duration
                };
		        res.json(tmp);
	        }
	        console.log('getDevices', skypeId, duration);
        });
    },

    /**
     * Add or update a device for a given Skype user.
     * 
     * @param req
     *   Contents of the incoming request. Expects a body in JSON format.
     *   - req.params.skypeId: the Skype user to look for
     *   - req.body.DeviceId: the device to add/update.
     *   - req.body.TemplateVersion: the template version for this device.
     *   - req.body.TemplateLanguage: the template language for this device.
     *   - req.body.ServiceType: the notification service for this device.
     *   - req.body.Routes: array of one or more route dicts with keys:
     *     - Name: the unique name of the route for this device.
     *     - Path: service-specific way to reach the device for notifications.
     *     - Expiration: the time when the Path is no longer valid.
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    addDevice: function (req, res) {
        var body = req.body;
        var skypeId = req.params.skypeId;
        if (skypeId === "") {
            res.send(null, null, 400);
            return;
        }

        var deviceId = body.DeviceId;
        if (deviceId === "") {
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.TemplateVersion;
        if (templateVersion === "") {
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.TemplateLanguage;
        if (templateLanguage === "") {
            res.send(null, null, 400);
            return;
        }

        var serviceType = body.ServiceType;
        if (serviceType === "") {
            res.send(null, null, 400);
            return;
        }

        var routes = body.Routes;
        if (routes.length === 0) {
            res.send(null, null, 400);
            return;
        }

	    var start = new Date();
        this.store.updateDeviceEntity(skypeId, deviceId, templateVersion, 
                                      templateLanguage, serviceType, routes,
                                      function (err, deviceEntity) {
	        if (err) {
                console.log('error:', err);
		        res.send(null, null, 404);
	        }
            else {
                console.log('ok:', deviceEntity);
                var end = new Date();
                var duration = end.getTime() - start.getTime();
                var tmp = {
                    "DeviceId": deviceEntity.RowKey,
                    "TemplateVersion": deviceEntity.TemplateVersion,
                    "TemplateLanguage": deviceEntity.TemplateLanguage,
                    "ServiceType": deviceEntity.ServiceType,
                    "Routes": JSON.parse(deviceEntity.Routes),
                    "TableStoreDuration": duration
                };
                res.json(tmp);
	            console.log('addDevice', skypeId, duration);
            }
        });
    },

    /**
     * Delete a device or all devices for a given Skype user. If a JSON 
     * payload exits with a DeviceId attribute, only delete the one device
     * matching the DeviceId value. Otherwise, delete all devices under the
     * user.
     * 
     * @param req
     *   Contents of the incoming request.
     *   - req.params.skypeId: the Skype user to look for
     *   - req.body.DeviceId (optional): the device to delete
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    deleteDevice: function (req, res) {
        var skypeId = req.params.skypeId;
        if (skypeId === "") {
            res.send(null, null, 400);
            return;
        }

        var callback = function (err) {
            if (err) {
                res.send(null, null, 404);
            }
            else {
                res.send(null, null, 204);
            }
        };

        var deviceId = req.body.DeviceId;
        if (deviceId === undefined) {
            this.store.deleteAllDeviceEntities(skypeId, callback);
        }
        else {
            this.store.deleteDeviceEntity(skypeId, deviceId, callback);
        }
    }
};
