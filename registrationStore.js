/**
 * @file
 * Store prototype definition.
 */

var azure = require("azure");

module.exports = RegistrationStore;

/**
 * Store constructor.
 * 
 * A store provides an interface to an Azure Table Store for managing
 * device definitions for a given Skype ID. Here we use skypeId for the table
 * PartitionKey and deviceId for RowKey.
 */
function RegistrationStore(settings) {
    if (settings === undefined) settings = {
        'name': 'registrations',
        'callback': function (err) { console.log('TemplateStore err:', err); }
    };

    this.tableName = settings.name;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(this.tableName, settings.callback);
}

/**
 * Store prototype.
 * 
 * Defines the methods available to a Store instance.
 */
RegistrationStore.prototype = {

    /**
     * Obtain all device entities for a given Skype user.
     *
     * @param skypeId
     *   The Skype user to look for.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: array of found device entities for the user
     */
    getAllDeviceEntities: function (skypeId, callback) {
        var query = azure.TableQuery.select()
            .from(this.tableName)
            .where("PartitionKey eq ?", skypeId);
        this.store.queryEntities(query, callback);
    },

    getDevices: function(skypeId, callback) {
        this.getAllDeviceEntities(skypeId, function(err, devEnts) {
            if (err !== null) callback(err, null);
            if (devEnts.length === 0) callback(null, devEnts);
            var devices = [];
            for (var index in devEnts) {
                var deviceEntity = devEnts[index];
                var device = {
                    'deviceId': deviceEntity.RowKey,
                    'templateVersion': deviceEntity.TemplateVersion,
                    'templateLanguage': deviceEntity.TemplateLanguage,
                    'serviceType': deviceEntity.ServiceType,
                    'routes': []
                };
                
                var routes = JSON.parse(deviceEntity.Routes);
                for (var context in routes) {
                    var z = routes[context];
//                    console.log('context:', context, 'z:', z);
                    device.routes.push(z);
                }

                devices.push(device);
            }
            callback(null, devices);
        });
    },
    
    /**
     * Obtain a specific device entity for a given Skype user.
     *
     * @param skypeId
     *   The Skype user to look for.
     *
     * @param deviceId
     *   The device entity to look for.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: if no error, the existing device entity
     */
    getDeviceEntity: function (skypeId, deviceId, callback) {
        this.store.queryEntity(this.tableName, skypeId, deviceId,
                               callback);
    },

    /**
     * Update a specific device entity for a given Skype user.
     *
     * @param skypeId
     *   The Skype user to update.
     *
     * @param deviceId
     *   The device entity to add or update.
     *
     * @param templateVersion
     *   The template version that this device expects.
     *
     * @param templateLanguage
     *   The text language that this device expects.
     *
     * @param serviceType
     *   The service that will handle final notification delivery.
     *
     * @param routes
     *   Array of one or more notification routes for this device.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: if no error, the existing device entity
     */
    updateDeviceEntity: function(skypeId, deviceId, templateVersion, 
                                 templateLanguage, serviceType, routes,
                                 callback) {
        var self = this;
        self.getDeviceEntity(skypeId, deviceId, function (err, found) {
//            console.log('getDeviceEntity: err:', err, 'found:', found);
            var deviceEntity = {
                "PartitionKey": skypeId,
                "RowKey": deviceId,
                "TemplateLanguage": templateLanguage,
                "TemplateVersion": templateVersion,
                "ServiceType": serviceType
            };

            if (! found) {
                deviceEntity.Routes = JSON.stringify(routes);
                self.store.insertEntity(self.tableName, deviceEntity, callback);
            }
            else {
                var activeRoutes = JSON.parse(found.Routes);
                activeRoutes = {};
                for (var index in routes) {
                    var route = routes[index];
                    activeRoutes[route.context] = {
                        "credential": route.credential,
                        "expiration": route.expiration
                    };
                }
                deviceEntity.Routes = JSON.stringify(activeRoutes);
                self.store.updateEntity(self.tableName, deviceEntity, callback);
            }
	    });
    },

    /**
     * Delete a specific device entity for a given Skype user.
     *
     * @param skypeId
     *   The Skype user to look for.
     *
     * @param deviceId
     *   The device entity to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     */
    deleteDeviceEntity: function (skypeId, deviceId, callback) {
        var entity = {
            "PartitionKey": skypeId,
            "RowKey": deviceId
        };
        this.store.deleteEntity(this.tableName, entity, callback);
    },

    /**
     * Delete all device entities for a given Skype user.
     *
     * @param skypeId
     *   The Skype user to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     */
    deleteAllDeviceEntities: function (skypeId, callback) {
        var self = this;
        self.getAllDeviceEntities(skypeId, function (err, deviceEntities) {
            if (err || deviceEntities.length === 0) {
                callback(err);
            }
            else {
                for (var index in deviceEntities) {
                    var deviceId = deviceEntities[index].RowKey;
                    self.deleteDeviceEntity(skypeId, deviceId,
                        function (err) {
                        if (err) console.log(err);
                    });
                }
                callback(null);
            }
        });
    }
};
