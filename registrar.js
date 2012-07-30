'use strict';

/**
 * @fileOverview Defines the Registrar prototype and its methods.
 */
module.exports = Registrar;

var Model = require('model.js');

/**
 * Registrar constructor.
 *
 * @class
 *
 * A registrar allows for querying, updating, and deleting of registrations for a given user ID.
 */
function Registrar(registrationStore) {
    this.log = require('./config').log('registrar');
    this.registrationStore = registrationStore;

    /**
     * JSON schema for userId values
     * @type Model
     */
    this.UserIdModel = Model.extend(
        {
            userId: {required:true, type:'string', minlength:2, maxlength:128}
        });

    /**
     * JSON schema for route definitions.
     * @type Model
     */
    this.RouteModel = Model.extend(
        {
            name: {required:true, type:'string', minlength:1, maxlength:128},
            token: {required:true, type:'string', minlength:1},
            secondsToLive: {required:true, type:'integer', min:1}
        });

    /**
     * JSON schema for registration definitions.
     * @type Model
     */
    this.RegistrationModel = this.UserIdModel.extend(
        {
            registrationId: {required:true, type:'string', minlength:1, maxlength:128},
            templateVersion: {required:true, type:'string', minlength:1, maxlength:10},
            templateLanguage: {required:true, type:'string', minlength:2, maxlength:10},
            service: {required:true, type:'string', minlength:1, maxlength:10},
            routes: {required:true, type:'routeArray', minlength:1}
        },
        {
            types:{
                routeArray:function (value) {
                    value = Model.types.array(value);
                    if (value === null) return value;
                    for (var index in value) {
                        var z = this.RouteModel.validate(value[index]);
                        if (z !== null) return null;
                    }
                    return value;
                }.bind(this)
            }
        });

    /**
     * JSON schema for delete parameter definitions.
     * @type Model
     */
    this.DeleteKeyModel = this.UserIdModel.extend(
        {
            registrationId: {type:'string', minlength:1, maxlength:128}
        });
}

/**
 * Registrar prototype.
 *
 * Defines the methods available to a Registrar instance.
 */
Registrar.prototype = {

    /**
     * Obtain the current registrations for a given user.
     *
     * @param req
     *   Contents of the incoming request
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    getRegistrations: function (req, res) {
        var log = this.log.child('getRegistrations');
        log.BEGIN();

        var params = {userId: req.param('userId')};
        log.info('params:', params);

        var errors = this.UserIdModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:',errors);
            res.send(null, null, 400);
            return;
        }

        var start = Date.now();
        this.registrationStore.getRegistrations(params.userId, null, function (err, regs) {
            var duration = Date.now() - start;
            if (err !== null || typeof(regs) === 'undefined' || regs.length === 0) {
                if (err) log.error('error:', err);
                log.info('no registrations found');
                res.send(null, null, 404);
            }
            else {
                var tmp = {
                    'registrations': regs,
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                res.json(tmp);
            }
            log.END(duration, 'msec');
        });
    },

    /**
     * Add or update a registration for a given user.
     *
     * @param req
     *   Contents of the incoming request. Expects a body in JSON format.
     *   - req.params.userId: the user to look for
     *   - req.body.registrationId: the registration to add/update.
     *   - req.body.templateVersion: the template version for this registration.
     *   - req.body.templateLanguage: the template language for this registration.
     *   - req.body.service: the notification service for this registration.
     *   - req.body.routes: array of one or more route dicts with keys:
     *     - name: the unique name of the route for this registration.
     *     - token: service-specific way to reach the user for notifications.
     *     - secondsToLive: the number of seconds into the future the token is valid.
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    addRegistration: function (req, res) {
        var self = this;
        var log = this.log.child('addRegistration');
        log.BEGIN('req:', req.body);

        var params = req.body;
        params.userId = req.param('userId');
        log.info('params:', params);

        var errors = this.RegistrationModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', params);
            res.send(null, null, 400);
            return;
        }

        var start = Date.now();
        this.registrationStore.updateRegistration(params, function (err, registrationEntity)
        {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.updateRegistration error:', err);
                res.send(null, null, 404);
            }
            else {
                var tmp = {
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                res.json(tmp);
            }
            log.END(params.userId, duration, 'msec');
        });
    },

    /**
     * Delete a registration or all registrations for a given user. If a JSON
     * payload exits with a registrationId attribute, only delete the one entity
     * matching the registrationId value. Otherwise, delete all registrations for the
     * user.
     *
     * @param req
     *   Contents of the incoming request.
     *   - req.params.userId: the user to look for
     *   - req.body.registrationId (optional): the registration to delete
     *
     * @param res
     *   Response generator for the request. Generates JSON output if the
     *   client requested JSON.
     */
    deleteRegistration: function (req, res) {
        var log = this.log.child('deleteRegistration');
        log.BEGIN();

        var params = {
            userId: req.param('userId')
        };

        var registrationId = req.param('registrationId');
        if (typeof registrationId !== 'undefined') {
            params.registrationId = registrationId;
        }

        log.info('params:', params);
        var errors = this.DeleteKeyModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', errors);
            res.send(null, null, 400);
            return;
        }

        var start = Date.now();
        function callback(err) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.deleteRegistrations error:', err);
                res.send(null, null, 404);
            }
            else {
                res.send(null, null, 204);
            }
            log.END(params.userId, registrationId, duration, 'msec');
        }

        if (params.registrationId === undefined) {
            this.registrationStore.deleteAllRegistrations(params.userId, callback);
        }
        else {
            this.registrationStore.deleteRegistration(params.userId, params.registrationId, callback);
        }
    }
};
