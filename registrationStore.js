'use strict';

/**
 * @fileOverview Defines the RegistrationStore prototype and its methods.
 */
module.exports = RegistrationStore;

var azure = require('azure');

/**
 * RegistrationStore constructor.
 *
 * @class RegistrationStore
 */
function RegistrationStore(tableName, callback) {
    var log = this.log = require('./config').log('registrationStore');
    log.BEGIN(tableName);
    if (tableName === undefined) {
        tableName = config.registrations_table_name;
    }

    this.tableName = tableName;
    this.store = azure.createTableService();
    this.store.createTableIfNotExists(tableName, function (err, b, c) {
                                          log.END(err, b, c);
                                          if (callback) callback(err);
                                      });
}

/**
 * Store prototype.
 *
 * Defines the methods available to a Store instance.
 */
RegistrationStore.prototype = {

    makePartitionKey: function(value) {
        return new Buffer(value).toString('base64');
    },

    makeRowKey: function(value) {
        return new Buffer(value).toString('base64');
    },

    /**
     * Obtain all registration entities for a given user.
     *
     * @param {string} userId
     *   The user to look for.
     *
     * @param {function} callback
     *   Method to invoke when the query is done
     *   - err: if not null, definition of the error that took place
     *   - found: array of found registration entities for the user
     *
     * @private
     */
    _getAllRegistrationEntities: function (partitionKey, callback) {
        var log = this.log.child('getAllRegistrationEntities');
        log.BEGIN(partitionKey);
        var query = azure.TableQuery.select()
            .from(this.tableName)
            .where('PartitionKey eq ?', partitionKey);
        this.store.queryEntities(query, callback);
        log.END();
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
     *
     * @private
     */
    _deleteRegistrationEntity: function (partitionKey, rowKey, callback) {
        var log = this.log.child('deleteRegistrationEntity');
        log.BEGIN(partitionKey, rowKey);
        var registrationEntity = {
            'PartitionKey': partitionKey,
            'RowKey': rowKey
        };
        this.store.deleteEntity(this.tableName, registrationEntity,
                                function (err) {
                                    callback(err);
                                    log.END(err);
                                });
    },

    _getRegistration: function (registrationEntity, tokens) {
        var log = this.log.child('_getRegistration');
        log.BEGIN(tokens, typeof tokens);

        var registration = {
            'registrationId': new Buffer(registrationEntity.RowKey, 'base64').toString('ascii'),
            'templateVersion': registrationEntity.TemplateVersion.substr(1),
            'templateLanguage': registrationEntity.TemplateLanguage,
            'service': registrationEntity.Service,
            'expiration': registrationEntity.Expiration,
            'routes': null
        };

        var now = new Date();
        now = now.toISOString();

        var routes = JSON.parse(registrationEntity.Routes);
        log.debug('routes:', routes);

        var valid = [];
        for (var each in routes) {
            var route = routes[each];
            if (route.Expiration > now) {
                var index = (tokens instanceof Array) ? tokens.indexOf(route.Token) : 0;
                log.debug('indexOf:', index);
                if (index !== -1) {
                    log.debug('using route', route.Name, 'token:', route.Token);
                    valid.push( {
                                    'name': route.Name,
                                    'token': route.Token,
                                    'expiration': route.Expiration
                                } );
                }
            }
            else {
                log.info('route', route.Name, 'is no longer active');
            }
        }

        if (valid.length === 0) {
            registration = null;
        }
        else {
            log.debug('valid routes:', valid);
            registration.routes = valid;
        }

        log.END(registration);
        return registration;
    },

    getRegistrations: function(userId, tokens, callback) {
        var self = this;
        var log = self.log.child('getRegistrations');
        log.BEGIN(userId, tokens);

        var partitionKey = this.makePartitionKey(userId);

        this._getAllRegistrationEntities(
            partitionKey, function(err, regs) {
                if (err !== null) {
                    log.error('_getAllRegistrationEntities error:', err);
                    callback(err, null);
                    return;
                }

                var registrations = [];

                if (regs.length === 0) {
                    log.info('no registrations found');
                    callback(null, registrations);
                    return;
                }

                var now = new Date();
                now = now.toISOString();

                function deleteRegistrationCallback (err) {
                    if (err) log.error('_deleteRegistrationEntity error:', err);
                }

                for (var index in regs) {
                    var registrationEntity = regs[index];
                    if (registrationEntity.Expiration <= now) {
                        log.info('registration has expired:', registrationEntity.RowKey);
                        self._deleteRegistrationEntity(partitionKey, registrationEntity.RowKey,
                                                       deleteRegistrationCallback);
                    }
                    else {
                        var r = self._getRegistration(registrationEntity, tokens);
                        if (r) registrations.push(r);
                    }
                }
                callback(null, registrations);
                log.END();
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
    updateRegistrationEntity: function(registration, callback) {
        var self = this;
        var log = self.log.child('updateRegistrationEntity');
        log.BEGIN(registration);

        var partitionKey = new Buffer(registration.userId).toString('base64');
        log.debug('partitionKey:', partitionKey);

        var rowKey = new Buffer(registration.registrationId).toString('base64');
        log.debug('rowKey:', rowKey);

        self.store.queryEntity(
            self.tableName, partitionKey, rowKey, function (err, found) {
                log.info('queryEntity results:', err, found);

                var registrationEntity = {
                    'PartitionKey': partitionKey,
                    'RowKey': rowKey,
                    'TemplateLanguage': registration.templateLanguage,
                    'TemplateVersion': 'v' + registration.templateVersion,
                    'Service': registration.service,
                    'Expiration': null,
                    'Routes': null
                };

                var now = new Date();
                var oldest = now;
                var routes = registration.routes;

                now = now.getTime();
                for (var index in registration.routes) {
                    var route = routes[index];
                    var expiration = new Date(now + route.secondsToLive * 1000);
                    if (oldest < expiration) {
                        oldest = expiration;
                    }
                    route = {
                        'Name': route.name,
                        'Token': route.token,
                        'Expiration': expiration.toISOString()
                    };

                    log.debug('new route:', route);
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

                log.END();
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
     *
     * @private
     */
    deleteRegistration: function (userId, registrationId, callback) {
        var log = this.log.child('deleteRegistrationEntity');
        log.BEGIN(userId, registrationId);
        this._deleteRegistrationEntity(makePartitionKey(userId), makeRowKey(registrationId), callback);
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
    deleteAllRegistrations: function (userId, callback) {
        var self = this;
        var log = self.log.child('deleteAllRegistrations');
        log.BEGIN(userId);

        var partitionKey = self.makePartitionKey(userId);

        self._getAllRegistrationEntities(
            partitionKey, function (err, registrationEntities) {
                if (err || registrationEntities.length === 0) {
                    callback(err);
                }
                else {
                    for (var index in registrationEntities) {
                        var rowKey = registrationEntities[index].RowKey;
                        self._deleteRegistrationEntity(
                            partitionKey, rowKey, function (err) {
                                if (err) {
                                    log.error('deleteRegistrationEntity error:', err);
                                }
                            });
                    }
                    callback(null);
                }
                log.END();
            });
    }
};
