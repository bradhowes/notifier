/**
 * @fileOverview Defines the TemplateManager prototype and its methods.
 */
module.exports = TemplateManager;

/**
 * Initializes a new TemplateManager object. A TemplateManager stores and retrieves notification template definitions.
 * It relies on a TemplateStore object to provide the actual storage.
 *
 * @class TemplateManager
 *
 * @param {TemplateStore} templateStore the TemplateStore instance to rely on
 */
function TemplateManager(templateStore) {
    this.log = require('./config').log('templateManager');
    this.templateStore = templateStore;
}

TemplateManager.prototype = {

    /**
     * Add a template to the store.
     */
    addTemplate: function (req, res) {
        var log = this.log.child('addTemplate');
        log.BEGIN();

        function invalid(value, msg) {
            if (typeof value === "undefined" || value === '') {
                log.error(msg);
                res.send(null, null, 400);
                return true;
            }
            return false;
        }

        var body = req.body;

        var eventId = body.eventId;
        if (invalid(eventId, 'missing eventId')) return;

        var notificationId = body.notificationId;
        if (invalid(notificationId, 'missing notificationId')) return;

        var route = body.route;
        if (invalid(route, 'missing route')) return;

        var templateVersion = body.templateVersion;
        if (invalid(templateVersion,'missing templateVersion')) return;

        var templateLanguage = body.templateLanguage;
        if (invalid(templateLanguage, 'missing templateLanguage')) return;

        var service = body.service;
        if (invalid(service, 'missing service')) return;

        var template = body.template;
        if (invalid(template, 'missing template')) return;

        var start = new Date();
        this.templateStore.addTemplate(eventId, notificationId, route, templateVersion, templateLanguage, service,
                                       template, function (err, templateEntity)
        {
            var end = new Date();
            var duration = end.getTime() - start.getTime();
            if (err) {
                log.error('TemplateStore.addTemplate error:', err);
                res.send(null, null, 500);
            }
            else {
                var tmp = {
                    'templateEntity': templateEntity,
                    'tableStoreDuration': duration
                };
                res.json(tmp);
            }

            log.END(duration, 'msec');
        });
    },

    /**
     * Get a template.
     */
    getTemplates: function (req, res) {
        var log = this.log.child('getTemplates');
        log.BEGIN();

        function invalid(value, msg) {
            if (typeof value === "undefined" || value === '') {
                log.error(msg);
                res.send(null, null, 400);
                return true;
            }
            return false;
        }

        var body = req.body;

        var eventId = body.eventId;
        if (invalid(eventId, 'missing eventId')) return;

        var notificationId = body.notificationId;
        if (invalid(notificationId, 'missing notificationId')) return;

        var route = body.route;
        if (invalid(route, 'missing route')) return;

        var templateVersion = body.templateVersion;
        if (invalid(templateVersion,'missing templateVersion')) return;

        var templateLanguage = body.templateLanguage;
        if (invalid(templateLanguage, 'missing templateLanguage')) return;

        var service = body.service;
        if (invalid(service, 'missing service')) return;

        var route = body.route;
        if (invalid(route, 'missing route')) return;

        var reg = {
            'templateVersion': '' + templateVersion,
            'templateLanguage': templateLanguage,
            'service': service,
            'routes': [ {'name':route, 'token':''} ]
        };

        var start = new Date();
        this.templateStore.findTemplates(eventId, [reg], function (err, templates)
        {
            var end = new Date();
            var duration = end.getTime() - start.getTime();
            if (err) {
                log.error('TemplateStore.findTemplates error:', err);
                res.send(null, null, 500);
            }
            else if (templates.length == 0) {
                log.info('no templates found in store');
                res.send(null, null, 404);
            }
            else {
                var tmp = {
                    'templates': templates,
                    'tableStoreDuration': duration
                };
                res.json(tmp);
            }

            log.END(duration, 'msec');
        });
    },

    /**
     * Delete a template.
     */
    deleteTemplate: function (req, res) {
        var log = this.log.child('deleteTemplate');
        log.BEGIN();

        function invalid(value, msg) {
            if (typeof value === "undefined" || value === '') {
                log.error(msg);
                res.send(null, null, 400);
                return true;
            }
            return false;
        }

        var eventId = body.eventId;
        if (invalid(eventId, 'missing eventId')) return;

        var notificationId = body.notificationId;
        if (invalid(notificationId, 'missing notificationId')) return;

        var route = body.route;
        if (invalid(route, 'missing route')) return;

        var templateVersion = body.templateVersion;
        if (invalid(templateVersion,'missing templateVersion')) return;

        var templateLanguage = body.templateLanguage;
        if (invalid(templateLanguage, 'missing templateLanguage')) return;

        var service = body.service;
        if (invalid(service, 'missing service')) return;

        log.debug('eventId:', eventId,
                  'notificationId:', notificationId,
                  'route:', route,
                  'templateVersion:', templateVersion,
                  'templateLanguage:', templateLanguage,
                  'service:', service);

        var start = new Date();
        this.templateStore.removeTemplate(eventId, notificationId, route, templateVersion, templateLanguage,
                                          service, function (err, templateEntity)
        {
            var end = new Date();
            var duration = end.getTime() - start.getTime();
            if (err !== null) {
                log.error('TemplateStore.removeTemplate error:', err);
                res.send(null, null, 404);
            }
            else {
                log.info('removed');
                res.send(null, null, 204);
            }
            log.END(duration, 'msecs');
        });
    }
};
