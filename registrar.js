'use strict';

/**
 * @fileOverview Defines the Registrar prototype and its methods.
 */
module.exports = Registrar;

var express = require('express');
var Model = require('model.js');
var HTTPStatus = require('http-status');

/**
 * Registrar constructor.
 *
 * @class
 *
 * A registrar allows for querying, updating, and deleting of registrations for a given user ID.
 *
 * @param {RegistrationStore} registrationStore the RegistrationStore instance to rely on for persistent data
 * operations.
 */
function Registrar(registrationStore) {
    this.log = require('./config').log('Registrar');
    this.log.BEGIN(registrationStore);

    this.registrationStore = registrationStore;

    /**
     * JSON schema for userId values. Contains just one value:
     *
     * - userId: the user to operate on
     *
     * @type Model
     */
    this.UserIdModel = Model.extend(
        {
            userId: {required:true, type:'string', minlength:2, maxlength:128}
        });

    /**
     * JSON schema for route definitions. Attributes:
     *
     * - name: the name of the route. Only receives notifications from templates with a matching name value.
     * - token: the OS-specific value associated with the device to notify
     * - secondsToLive: the number of seconds this registration route will be valid
     *
     * @type Model
     */
    this.RouteModel = Model.extend(
        {
            name: {required:true, type:'string', minlength:1, maxlength:128},
            token: {required:true, type:'string', minlength:1},
            secondsToLive: {required:true, type:'integer', min:1}
        });

    /**
     * JSON schema for registration definitions. Attributes:
     *
     * - registrationId: the unique identifier associated with the device being registered. This must be unique across
     *   all devices, but it should be constant for the same device.
     * - templateVersion: the version to look for when searching for templates to use for this device
     * - templateLanguage: the language to look for when searching for templates to use for this device
     * - service: identifier of the OS-specific service that handles notification delivery ("wns", "apns", "gcm")
     * - routes: an array of one or more {@link Registrar#RouteModel} objects that define the registration delivery
     *           paths for the device
     *
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
     * JSON schema for delete parameter definitions. Attributes:
     *
     * - registrationId: the unique identifier associated with the device to be removed. See
     *   {@link Registrar#RegistrationModel} for additional information.
     *
     * @type Model
     */
    this.DeleteKeyModel = this.UserIdModel.extend(
        {
            registrationId: {type:'string', minlength:1, maxlength:128}
        });

    this.log.END();
}

/**
 * Registrar prototype.
 *
 * Defines the methods available to a Registrar instance.
 */
Registrar.prototype = {

    /**
     * Add Express routes for the Registrar API.
     *
     * @param {Express.App} app the application to route
     */
    route: function(app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.get('/registrations/:userId', this.get.bind(this));
        app.post('/registrations/:userId', this.set.bind(this));
        app.del('/registrations/:userId', this.del.bind(this));
        log.END();
    },

    /**
     * Obtain the current registrations for a given user. Parameters:
     *
     * - userId: the user to look for (found in the URL)
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid query attribute(s)
     * - 404 NOT FOUND: no templates were found for the given key attributes
     * - 200 OK: one or more registrations were found
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request. Generates JSON output if there are registrations
     */
    get: function (req, res) {
        var log = this.log.child('get');
        log.BEGIN();

        var params = {userId: req.param('userId')};
        log.info('params:', params);

        var errors = this.UserIdModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:',JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        this.registrationStore.get(params.userId, null, function (err, regs) {
            var duration = Date.now() - start;
            if (err !== null || typeof(regs) === 'undefined' || regs.length === 0) {
                if (err) log.error('error:', err);
                log.info('no registrations found');
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                var tmp = {
                    'registrations': regs,
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                res.json(HTTPStatus.OK, tmp);
            }
            log.END(duration, 'msec');
        });
    },

    /**
     * Add or update a registration for a given user. Parameters:
     *
     * - userId: the user to look for (found in the URL)
     * - registrationId: the registration to add/update.
     * - templateVersion: the template version for this registration.
     * - templateLanguage: the template language for this registration.
     * - service: the notification service for this registration.
     * - routes: array of one or more route dicts with keys:
     *   - name: the unique name of the route for this registration.
     *   - token: service-specific way to reach the user for notifications.
     *   - secondsToLive: the number of seconds into the future the token is valid.
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid template attribute(s)
     * - 200 OK: one or moret templates were found
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request.
     */
    set: function (req, res) {
        var self = this;
        var log = this.log.child('set');
        log.BEGIN();

        var params = req.body;
        params.userId = req.param('userId');
        log.info('params:', params);

        var errors = this.RegistrationModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(params));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        this.registrationStore.set(params, function (err, registrationEntity) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.set error:', err);
                res.send(HTTPStatus.BAD_REQUEST);
            }
            else {
                var tmp = {
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                res.json(HTTPStatus.OK, tmp);
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
     * - userId: the user to look for (found in the URL)
     * - registrationId (optional): the registration to delete
     *
     * HTTP Responses:
     *
     * - 400 BAD REQUEST: missing or invalid template attribute(s)
     * - 404 NOT FOUND: unable to locate any registration to delete
     * - 204 NO CONTENT: found and delete the registration(s)
     *
     * @param req Contents of the incoming request.
     *
     * @param res Response generator for the request.
     */
    del: function (req, res) {
        var log = this.log.child('del');
        log.BEGIN('body:', req.body);

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
            log.error('invalid params:', JSON.stringify(errors));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        function callback(err) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.del error:', err);
                res.send(HTTPStatus.NOT_FOUND);
            }
            else {
                res.send(HTTPStatus.NO_CONTENT);
            }
            log.END(params.userId, registrationId, duration, 'msec');
        }

        if (params.registrationId === undefined) {
            this.registrationStore.delAll(params.userId, callback);
        }
        else {
            this.registrationStore.del(params.userId, params.registrationId, callback);
        }
    }
};
