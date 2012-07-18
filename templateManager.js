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
    this.log = require('./config.js').log('templateManager');
    this.templateStore = templateStore;
}

TemplateManager.prototype = {

    /**
     * Add a template to the store.
     */
    addTemplate: function (req, res) {
        var log = this.log.child('addTemplate');
        log.BEGIN();

        var body = req.body;

        var eventId = body.eventId;
        if (eventId === "") {
            log.error('missing eventId');
            res.send(null, null, 400);
            return;
        }

        var notificationId = body.notificationId;
        if (notificationId === "") {
            log.error('missing notificationId');
            res.send(null, null, 400);
            return;
        }

        var route = body.route;
        if (route === "") {
            log.error('missing route');
            res.send(null, null, 400);
            return;
        }

        var templateVersion = body.templateVersion;
        if (templateVersion === "") {
            log.error('missing templateVersion');
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = body.templateLanguage;
        if (templateLanguage === "") {
            log.error('missing templateLanguage');
            res.send(null, null, 400);
            return;
        }

        var service = body.service;
        if (service === "") {
            log.error('missing service');
            res.send(null, null, 400);
            return;
        }

        var template = body.template;
        if (template === "") {
            log.error('missing template');
            res.send(null, null, 400);
            return;
        }

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

        var eventId = req.param('eventId', '');
        if (eventId === "") {
            log.error('missing eventId');
            res.send(null, null, 400);
            return;
        }

        var templateVersion = req.param('templateVersion', '');
        if (templateVersion === "") {
            log.error('missing templateVersion');
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = req.param('templateLanguage', '');
        if (templateLanguage === "") {
            log.error('missing templateLanguage');
            res.send(null, null, 400);
            return;
        }

        var service = req.param('service', '');
        if (service === "") {
            log.error('missing service');
            res.send(null, null, 400);
            return;
        }

        var route = req.param('route', '');
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

        var eventId = req.param('eventId', '');
        if (eventId === "") {
            log.error('missing eventId');
            res.send(null, null, 400);
            return;
        }

        var notificationId = req.param('notificationId', '');
        if (notificationId === "") {
            log.error('missing notificationId');
            res.send(null, null, 400);
            return;
        }

        var templateVersion = req.param('templateVersion', '');
        if (templateVersion === "") {
            log.error('missing templateVersion');
            res.send(null, null, 400);
            return;
        }

        var templateLanguage = req.param('templateLanguage', '');
        if (templateLanguage === "") {
            log.error('missing templateLanguage');
            res.send(null, null, 400);
            return;
        }

        var service = req.param('service', '');
        if (service === "") {
            log.error('missing service');
            res.send(null, null, 400);
            return;
        }

        var route = req.param('route', '');

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
