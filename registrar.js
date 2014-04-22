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
 * A registrar allows for querying, updating, and deleting of registrations for a given user ID. A registration defines
 * how to reach a user's device via notifications and in what form the notification payloads should be in (language,
 * version, etc). A registration also contains one or more routes, which are named pathways for notification delivery.
 * If a notification is to be sent to devices along a certain route, only registrations containing a route with the
 * matching name will be notified.
 *
 * @param {RegistrationStore} registrationStore the {@link RegistrationStore} instance to rely on for persistent data
 * operations.
 */
function Registrar(registrationStore) {
    this.log = require('./config').log('Registrar');
    this.log.BEGIN(registrationStore);
    this.registrationStore = registrationStore;
    this.monitorManager = {post: function(skypeId, message) {}};

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
     * JSON schema for route definitions. A route is a means by which one can reach a device via notifications. Each
     * device has a unique token value that is valid for secondsToLive seconds into the future. Whether or not the
     * route is used for a notification depends on if the route name associates with a notification template.
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
     * JSON schema for registration definitions. A registration consists of one or more routes
     * (see {@link Registrar#RouteModel}) that define the specific ways a device may be reached via notifications.
     * A registration details the version of the notification templates to be used when generating notification
     * payloads, the language of the notifications to generate, and the delivery service to use for the notification.
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

Registrar.prototype = {

    /**
     * Add Express routes for the Registrar API.
     *
     * @param {Express.App} app The application to route HTTP requests.
     */
    route: function(app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.get('/registrations/:userId', this.get.bind(this));
        app.post('/registrations/:userId', this.set.bind(this));
        app.del('/registrations/:userId', this.del.bind(this));
        log.END();
    },

    setMonitorManager: function (monitorManager) {
        this.monitorManager = monitorManager;
    },

    /**
     * Obtain the current registrations for a given user.
     *
     * @example HTTP GET /john.doe
     *
     * @example <code>{registrationId: "1234-56-7890", templateVersion: "3", templateLanguage: "en-US",
     *  service: "apns",
     *  routes:[{name: "main", token: "unique main token", expiration: 86400},
     *          {name: "alt", token: "unique alt token", expiration: 86400}]}
     * </code>
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body is ignored; the URL must contain
     * the user ID to use, and it must adhere to the {@link Registrar#UserIdModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 200 OK if one or more registrations were found
     * - 400 BAD REQUEST if missing or invalid query attribute(s)
     * - 404 NOT FOUND if no templates were found for the given key attributes
     */
    get: function (req, res) {
        var log = this.log.child('get');
        var params = {userId: req.param('userId')};
        log.BEGIN(params);

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
     * Add or update a registration for a given user.
     *
     * @example <code>{registrationId: "1234-56-7890", templateVersion: "3", templateLanguage: "en-US",
     *  service: "apns",
     *  routes:[{name: "main", token: "unique main token", secondsToLive: 86400},
     *          {name: "alt", token: "unique alt token", secondsToLive: 86400}]}
     * </code>
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body must be JSON that follows the
     * {@link Registrar#RegistrationModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 200 OK: successfully processed request
     * - 400 BAD REQUEST: missing or invalid attribute(s)
     */
    set: function (req, res) {
        var self = this;
        var log = self.log.child('set');
        log.BEGIN();

        var params = req.body;
        params.userId = req.param('userId');
        log.info('params:', params);

        var errors = self.RegistrationModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(params));
            self.monitorManager.post(params.userId, 'invalid registration: ' + JSON.stringify(params));
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var start = Date.now();
        self.registrationStore.set(params, function (err, registrationEntity) {
            var duration = Date.now() - start;
            if (err) {
                log.error('RegistrationStore.set error:', err);
                self.monitorManager.post(params.userId, 'failed to store registration');
                res.send(HTTPStatus.BAD_REQUEST);
            }
            else {
                var tmp = {
                    'tableStoreDuration': duration
                };
                log.info(tmp);
                self.monitorManager.post(params.userId, 'registration: ' + JSON.stringify(params));
                res.json(HTTPStatus.OK, tmp);
            }
            log.END(params.userId, duration, 'msec');
        });
    },

    /**
     * Delete a registration or all registrations for a given user. If a JSON payload exits with a registrationId
     * attribute, only delete the one entity matching the registrationId value. Otherwise, delete all registrations for
     * the user.
     *
     * @example <code>{}</code>
     *
     * @example <code>{registrationId: "1234-56-7890"}</code>
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body must be JSON that follows the
     * {@link Registrar#DeleteKeyModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 204 NO CONTENT: found and deleted the registration(s)
     * - 400 BAD REQUEST: missing or invalid attribute(s)
     * - 404 NOT FOUND: unable to locate any registration to delete
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
                self.monitorManager.post(params.userId, 'removed registration(s)');
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
