'use strict';

/**
 * @fileOverview Defines the Notifier prototype and its methods.
 */
module.exports = Notifier;

var express = require('express');
var HTTPStatus = require('http-status');
var Model = require('model.js');
var PostTracker = require('./postTracker');

/**
 * Notifier constructor
 *
 * @class
 *
 * A Notifier pairs notification templates to user registrations and emits those that match. One notification event can
 * spawn multiple actual notification deliveries depending on what registrations are present for the user and what
 * templates map to a notification event ID.
 *
 * @param {TemplateStore} templateStore the repository of notification templates to rely on
 * @param {RegistrationStore} registrationStore the repository of user registrations to rely on
 * @param {Hash} senders a mapping of notification service tags to objects that provide a sendNotification method
 */
function Notifier(templateStore, registrationStore, senders) {
    this.log = require('./config').log('Notifier');

    /**
     * The backing store for templates. Notifier asks it for templates associated with a given event ID.
     *
     * @type TemplateStore
     */
    this.templateStore = templateStore;

    /**
     * The backing store for registrations. Notifier asks it for registrations associated with a given user ID. Also,
     * if a notification sender object encounters a registration that is no longer active, it will be used to remove
     * the registration.
     *
     * @type RegistrationStore
     */
    this.registrationStore = registrationStore;

    /**
     * Mapping of service tags ("wns", "apns", "gcm") to objects that can deliver a notification to a device.
     *
     * @type Hash
     */
    this.senders = senders;

    /**
     * Sequence ID for tracking. This value is added to all substitution maps under the name "SEQUENCE_ID"
     *
     * @type Integer
     */
    this.sequenceId = 1;

    /**
     * PostTracker instance that remembers notification requests by sequenceId value. Used by the logReceipt method to
     * calculate notification round-trip times.
     */
    this.postTracker = new PostTracker(100);

    /**
     * JSON schema for filter values. A filter allows one to limit which registrations will be used for notification
     * delivery. The attribute names closely match those in {@link Registrar#RegistrationModel}, though route
     * attributes appear with a 'route' prefix. Each attribute has as its value an array which contains one or values
     * that determine which registration values are acceptable for use in a delivery.
     *
     * - registrationId: array of acceptable registrationId values
     * - templateVersion: array of acceptable template version values
     * - templateLanguage: array of acceptable template language values
     * - service: array of acceptable notification deliver service values
     * - routeName: array of acceptable route name values
     * - routeToken: array of acceptable route token values
     *
     * All attributes are optional.
     *
     * @type Model
     */
    this.FilterModel = Model.extend(
        {
            registrationId: {type: 'array'},
            templateVersion: {type: 'array'},
            templateLanguage: {type: 'array'},
            service: {type: 'array'},
            routeName: {type: 'array'},
            routeToken: {type: 'array'}
        }
    );

    /**
     * JSON schema for a notification posting request. A notification goes to a specific user. The request may contain
     * a mapping of template placeholder names to runtime values. This mapping is used during notification payload
     * generation, where a template placeholder gets substituted with a value from the substitutions mapping. Finally,
     * there may be a filter definition (see {@link Notifier#FilterModel}) that will restrict notification delivery to
     * a subset of the registrations for the user.
     *
     * - userId: the user to notify
     * - eventId: the event ID to notify about
     * - substitutions: the optional mapping used to perform template placeholder substitution
     * - filter: an optional filter definition to restrict registration use
     *
     * @type Model
     */
    this.PostModel = Model.extend(
        {
            userId: {required:true, type:'string', minlength:2, maxlength:128},
            eventId: {required:true, type:'integer'},
            substitutions: {type:'stringmap'},
            filter: {type: 'filter'}
        },
        {
            types:
            {
                stringmap: function (value) {
                    if (typeof value !== 'object') return null;
                    for (var key in value) {
                        if (typeof value[key] !== 'string') return null;
                    }
                    return value;
                },
                filter: function (value) {
                    var log = this.log.child('filter model');
                    var err = this.FilterModel.validate(value);
                    log.debug('filter validation:', err);
                    if (err !== null) return null;
                    return value;
                }.bind(this)
            }
        }
    );

    /**
     * JSON schema for a logReceipt call.
     *
     * - sequenceId: the sequence ID associated with the notification request
     * - when: the timestamp when the notification arrived at a client
     */
    this.LogReceiptModel = Model.extend(
        {
            sequenceId: {required:true, type:'integer'},
            when: {required:true, type:'date'}
        }
    );
}

Notifier.prototype = {

    /**
     * Add Express routes for the Notifier API.
     *
     * @param {Express.App} app the application to route HTTP requests.
     */
    route: function (app) {
        var log = this.log.child('route');
        log.BEGIN('adding bindings');
        app.post('/post/:userId', express.json(), this.postNotification.bind(this));
        log.END();
    },

    /**
     * Post a notification to a user.
     *
     * @param {Express.Request} req Describes the incoming HTTP request. Message body must be JSON that follows the
     * {@link Notifier#PostModel} model.
     *
     * @param {Express.Response} res HTTP response generator for the request. Outputs JSON if no error.
     *
     * - 204 NO CONTENT: accepted request and queued notification delivery
     * - 400 BAD REQUEST: missing or invalid attribute(s)
     * - 500 INTERNAL SERVER ERROR: unable to obtain registrations and/or templates to work with
     */
    postNotification: function (req, res) {
        var self = this, duration;
        var log = self.log.child('postNotification');
        var result = {count: 0};
        log.BEGIN();

        var params = {
            userId: req.param('userId'),
            eventId: req.param('eventId'),
            substitutions: req.param('substitutions'),
            filter: req.param('filter')
        };

        log.info('params:', params);

        var errors = this.PostModel.validate(params);
        if (errors !== null) {
            log.error('invalid params:', JSON.stringify(errors));
            log.error(params);
            res.send(HTTPStatus.BAD_REQUEST);
            return;
        }

        var substitutions = params.substitutions;
        if (typeof substitutions !== 'object') {
            substitutions = {};
            params.substitutions = substitutions;
        }

        var start = Date.now();
        log.debug('start:', start);

        var sequenceId = ++this.sequenceId;
        substitutions.SEQUENCE_ID = sequenceId;
        this.postTracker.add(sequenceId, start);

        // Fetch the registrations for the given user
        this.registrationStore.get(params.userId, params.filter, function (err, registrations) {
            if (err !== null) {
                log.error('RegistrationStore.get error:', err);
                res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
                return;
            }

            if (registrations.length === 0) {
                log.info('no registrations exist for user', params.userId);
                res.json(HTTPStatus.ACCEPTED, result);
                duration = Date.now() - start;
                log.END(duration, 'msecs');
                return;
            }

            // Find the templates that apply for the given registrations
            self.templateStore.find(params.eventId, registrations, function (err, matches) {
                var token = null;
                if (err !== null) {
                    log.error('TemplateStore.find error:', err);
                    res.send(HTTPStatus.INTERNAL_SERVER_ERROR);
                    duration = Date.now() - start;
                    log.END(duration, 'msecs');
                    return;
                }

                if (matches.length === 0) {
                    log.info('TemplateStore.find returned no matches');
                }

                // For each template, generate a notification payload and send it on its way.
                for (var index in matches) {
                    var r = matches[index];
                    log.info(r);
                    r.prepare(substitutions, params.userId, self.registrationStore, 30);
                    log.debug('*** service:', r.service);
                    self.senders[r.service].sendNotification(r);
                }

                duration = Date.now() - start;
                log.END(duration, 'msecs');
                result.count = matches.length;
                res.json(HTTPStatus.ACCEPTED, result);
                return;
            });
        });
    }
};
