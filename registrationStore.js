/**
 * @fileOverview Defines the RegistrationStore prototype and its methods.
 */
module.exports = RegistrationStore;

var azure = require("azure");

/**
 * RegistrationStore constructor.
 *
 * @class RegistrationStore
 */
function RegistrationStore(name, callback) {
    if (name === undefined)  name = 'registrations';
    if (callback === undefined) callback = function (err) {
        if (err) console.log('createTableIfNotExists: name:', name, 'err:', err);
    };

    this.tableName = name;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(name, callback);
}

/**
 * Store prototype.
 *
 * Defines the methods available to a Store instance.
 */
RegistrationStore.prototype = {

    /**
     * Obtain all registration entities for a given user.
     *
     * @param userId
     *   The user to look for.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: array of found registration entities for the user
     */
    getAllRegistrationEntities: function (userId, callback) {
        var query = azure.TableQuery.select()
            .from(this.tableName)
            .where("PartitionKey eq ?", userId);
        this.store.queryEntities(query, callback);
    },

    /**
     * Obtain a specific registration for a given user.
     *
     * @param userId
     *   The user to look for.
     *
     * @param registrationId
     *   The registration to look for.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: if no error, the existing registration entity
     */
    getRegistrationEntity: function (userId, registrationId, callback) {
        this.store.queryEntity(this.tableName, userId, registrationId, callback);
    },

    getRegistration: function (registrationEntity) {
        var registration = {
            'registrationId': registrationEntity.RowKey,
            'templateVersion': registrationEntity.TemplateVersion.substr(1),
            'templateLanguage': registrationEntity.TemplateLanguage,
            'service': registrationEntity.Service,
            'expiration': registrationEntity.Expiration,
            'routes': null
        };

        var now = new Date();
        now = now.toISOString();

        var routes = JSON.parse(registrationEntity.Routes);
        var valid = [];
        for (var each in routes) {
            var route = routes[each];
            if (route.Expiration > now) {
                valid.push( {
                                'name': route.Name,
                                'token': route.Token,
                                'expiration': route.Expiration
                            } );
            }
        }
        registration.routes = valid;
        return registration;
    },

    getRegistrations: function(userId, callback) {
        var self = this;
        this.getAllRegistrationEntities(userId, function(err, regs)
        {
            if (err !== null) {
                callback(err, null);
                return;
            }

            var registrations = [];

            if (regs.length === 0) {
                callback(null, registrations);
                return;
            }

            var now = new Date();
            now = now.toISOString();
            function deleteRegistrationCallback (err) {
                if (err) console.log("deleteRegistrationEntity: err:", err);
            }
            for (var index in regs) {
                var registrationEntity = regs[index];
                if (registrationEntity.Expiration <= now) {
                    self.deleteRegistrationEntity(userId, registrationEntity.RowKey, deleteRegistrationCallback);
                }
                else {
                    registrations.push(self.getRegistration(registrationEntity));
                }
            }
            callback(null, registrations);
        });
    },

    /**
     * Update a specific registration for a given user.
     *
     * @param userId
     *   The user to update.
     *
     * @param registrationId
     *   The registration to add or update.
     *
     * @param templateVersion
     *   The template version that this registration expects.
     *
     * @param templateLanguage
     *   The text language that this registration expects.
     *
     * @param context
     *   The service that will handle final notification delivery.
     *
     * @param routes
     *   Array of one or more notification routes for this registration.
     *
     * @param callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: if no error, the existing registration entity
     */
    updateRegistrationEntity: function(userId, registrationId, templateVersion, templateLanguage, service, routes,
                                       callback) {
        var self = this;
        self.getRegistrationEntity(userId, registrationId, function (err, found) {
            var registrationEntity = {
                "PartitionKey": userId,
                "RowKey": registrationId,
                "TemplateLanguage": templateLanguage,
                "TemplateVersion": 'v' + templateVersion,
                "Service": service,
                "Expiration": null,
                "Routes": null
            };

            var now = new Date();
            var oldest = now;
            now = now.getTime();
            for (var index in routes) {
                var route = routes[index];
                var expiration = new Date(now + route.secondsToLive * 1000);
                if (oldest < expiration) {
                    oldest = expiration;
                }
                route = {
                    "Name": route.name,
                    "Token": route.token,
                    "Expiration": expiration.toISOString()
                };
//                console.log('new route:', route);
                routes[index] = route;
            }

            registrationEntity.Expiration = oldest.toISOString();
            registrationEntity.Routes = JSON.stringify(routes);
            if (! found) {
                self.store.insertEntity(self.tableName, registrationEntity, callback);
            }
            else {
                self.store.updateEntity(self.tableName, registrationEntity, callback);
            }
	});
    },

    /**
     * Delete a specific registration for a given user.
     *
     * @param userId
     *   The user to look for.
     *
     * @param registrationId
     *   The registration to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     */
    deleteRegistrationEntity: function (userId, registrationId, callback) {
        var registrationEntity = {
            "PartitionKey": userId,
            "RowKey": registrationId
        };
        this.store.deleteEntity(this.tableName, registrationEntity, callback);
    },

    /**
     * Delete all registrations for a given user.
     *
     * @param userId
     *   The user to delete.
     *
     * @param callback
     *   Method to invoke when the deletion is done.
     *   - err: if not null, definition of the error that took place
     */
    deleteAllRegistrationEntities: function (userId, callback) {
        var self = this;
        self.getAllRegistrationEntities(userId, function (err, registrationEntities) {
            if (err || registrationEntities.length === 0) {
                callback(err);
            }
            else {
                for (var index in registrationEntities) {
                    var registrationId = registrationEntities[index].RowKey;
                    self.deleteRegistrationEntity(userId, registrationId,
                        function (err) {
                        if (err) console.log(err);
                    });
                }
                callback(null);
            }
        });
    }
};
